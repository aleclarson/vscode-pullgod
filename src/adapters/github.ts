import { PullRequest, PullRequestProvider } from "./types";
import { Executor, NodeExecutor, Workspace, VSCodeWorkspace } from "./system";
import { Authenticator } from "./authenticator";
import * as vscode from "vscode";

interface GitHubPullRequestNode {
  number: number;
  title: string;
  author: {
    login: string;
  };
  headRefName: string;
  baseRefName: string;
  updatedAt: string;
  createdAt: string;
  url: string;
  mergeable: string;
  statusCheckRollup?: {
    state: string;
  };
  headRepository?: {
    url: string;
    owner: {
      login: string;
    };
  };
  labels?: {
    nodes: {
      name: string;
    }[];
  };
}

interface GitHubPullRequestsResponse {
  repository: {
    pullRequests: {
      nodes: GitHubPullRequestNode[];
    };
  };
}

export class GitHubAdapter implements PullRequestProvider {
  private executor: Executor;
  private workspace: Workspace;
  private authenticator?: Authenticator;

  constructor(
    executor: Executor = new NodeExecutor(),
    workspace: Workspace = new VSCodeWorkspace(),
    authenticator?: Authenticator,
  ) {
    this.executor = executor;
    this.workspace = workspace;
    this.authenticator = authenticator;
  }

  private async exec(command: string, args: string[]): Promise<string> {
    const workspaceFolder = this.workspace.getWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error("Please open a project folder in VS Code first.");
    }
    return this.executor.exec(command, args, workspaceFolder);
  }

  private async getOwnerRepo(): Promise<{ owner: string; repo: string }> {
    try {
      await this.exec("git", ["rev-parse", "--is-inside-work-tree"]);
      const remotes = await this.exec("git", ["remote", "-v"]);

      const lines = remotes.split("\n");
      // Find origin first
      const originLine = lines.find(
        (l) =>
          l.trim().startsWith("origin") &&
          l.includes("github.com") &&
          l.includes("(fetch)"),
      );
      if (originLine) {
        const match = originLine.match(/github\.com[:/]([^\/]+)\/([^\s]+)/);
        if (match) {
          let repo = match[2];
          if (repo.endsWith(".git")) {
            repo = repo.slice(0, -4);
          }
          return { owner: match[1], repo };
        }
      }

      // Fallback to any github remote
      const anyLine = lines.find(
        (l) => l.includes("github.com") && l.includes("(fetch)"),
      );
      if (anyLine) {
        const match = anyLine.match(/github\.com[:/]([^\/]+)\/([^\s]+)/);
        if (match) {
          let repo = match[2];
          if (repo.endsWith(".git")) {
            repo = repo.slice(0, -4);
          }
          return { owner: match[1], repo };
        }
      }

      throw new Error("This project does not appear to have a GitHub remote.");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("not a git repository")
      ) {
        throw new Error("This project is not a git repository.");
      }
      throw error;
    }
  }

  private mapStatus(state: string | undefined): string {
    if (!state) {
      return "UNKNOWN";
    }
    switch (state) {
      case "FAILURE":
      case "ERROR":
        return "FAILURE";
      case "PENDING":
        return "PENDING";
      case "SUCCESS":
        return "SUCCESS";
      default:
        return "UNKNOWN";
    }
  }

  async listPullRequests(): Promise<PullRequest[]> {
    const { owner, repo } = await this.getOwnerRepo();
    if (!this.authenticator) {
      throw new Error("Authentication provider not configured.");
    }
    const octokit = await this.authenticator.getOctokit();

    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(first: 100, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              number
              title
              author {
                login
              }
              headRefName
              baseRefName
              updatedAt
              createdAt
              url
              mergeable
              statusCheckRollup {
                state
              }
              headRepository {
                url
                owner {
                  login
                }
              }
              labels(first: 10) {
                nodes {
                  name
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result = await octokit.graphql<GitHubPullRequestsResponse>(query, {
        owner,
        repo,
      });
      const prs = result.repository.pullRequests.nodes;

      return prs
        .map(
          (pr): PullRequest => ({
            id: pr.number.toString(),
            number: pr.number,
            title: pr.title,
            author: pr.author.login,
            headRefName: pr.headRefName,
            baseRefName: pr.baseRefName,
            updatedAt: pr.updatedAt,
            createdAt: pr.createdAt,
            url: pr.url,
            status: pr.statusCheckRollup
              ? this.mapStatus(pr.statusCheckRollup.state)
              : "UNKNOWN",
            mergeable: pr.mergeable,
            headRepository: pr.headRepository,
            labels: pr.labels?.nodes || [],
          }),
        )
        .sort((a, b) => {
          const aLow = a.labels?.some((l) => l.name === "priority:low");
          const bLow = b.labels?.some((l) => l.name === "priority:low");

          if (aLow && !bLow) {
            return 1;
          }
          if (!aLow && bLow) {
            return -1;
          }
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
    } catch (error) {
      console.error("Error listing PRs", error);
      throw error;
    }
  }

  async localBranchExists(branchName: string): Promise<boolean> {
    try {
      await this.exec("git", ["rev-parse", "--verify", branchName]);
      return true;
    } catch (error) {
      return false;
    }
  }

  async hasUnpushedCommits(branchName: string): Promise<boolean> {
    try {
      // Check if upstream exists
      await this.exec("git", [
        "rev-parse",
        "--abbrev-ref",
        `${branchName}@{u}`,
      ]);
    } catch (error) {
      // If no upstream, it's a local branch, effectively unpushed.
      return true;
    }

    try {
      const output = await this.exec("git", [
        "log",
        `${branchName}@{u}..${branchName}`,
        "--oneline",
      ]);
      return output.trim().length > 0;
    } catch (error) {
      // If git log fails for some reason, default to safe behavior (true -> don't pull)
      return true;
    }
  }

  async checkoutPullRequest(pr: PullRequest): Promise<void> {
    const { owner: currentOwner } = await this.getOwnerRepo();
    const branchName = pr.headRefName;

    // 1. Check if local branch exists
    if (await this.localBranchExists(branchName)) {
      // 2. Check for unpushed commits
      if (await this.hasUnpushedCommits(branchName)) {
        await this.exec("git", ["checkout", branchName]);
        return;
      }
    }

    // 3. Determine remote
    let remoteName = "origin";
    let remoteUrl = "";

    if (pr.headRepository && pr.headRepository.owner.login !== currentOwner) {
      remoteName = pr.headRepository.owner.login;
      remoteUrl = pr.headRepository.url;
    }

    // 4. Setup remote if needed
    if (remoteName !== "origin") {
      const remotes = await this.exec("git", ["remote"]);
      const remoteList = remotes.split("\n").map((r) => r.trim());
      if (!remoteList.includes(remoteName)) {
        await this.exec("git", ["remote", "add", remoteName, remoteUrl]);
      }
    }

    // 5. Fetch
    await this.exec("git", ["fetch", remoteName]);

    // 6. Checkout
    if (await this.localBranchExists(branchName)) {
      await this.exec("git", ["checkout", branchName]);
      await this.exec("git", ["pull", remoteName, branchName]);
    } else {
      await this.exec("git", [
        "checkout",
        "-b",
        branchName,
        `${remoteName}/${branchName}`,
      ]);
    }
  }

  async getPullRequestDiff(pr: PullRequest): Promise<string> {
    const { owner, repo } = await this.getOwnerRepo();
    if (!this.authenticator) {
      throw new Error("Authentication provider not configured.");
    }
    const octokit = await this.authenticator.getOctokit();

    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pr.number,
      mediaType: {
        format: "diff",
      },
    });

    return data as unknown as string;
  }

  async getPullRequestView(pr: PullRequest): Promise<string> {
    const { owner, repo } = await this.getOwnerRepo();
    if (!this.authenticator) {
      throw new Error("Authentication provider not configured.");
    }
    const octokit = await this.authenticator.getOctokit();

    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pr.number,
    });

    return JSON.stringify({
      number: data.number,
      title: data.title,
      body: data.body,
      author: { login: data.user?.login },
      state: data.state,
      url: data.html_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      headRefName: data.head.ref,
      baseRefName: data.base.ref,
    });
  }

  async openPullRequestOnWeb(pr?: PullRequest): Promise<void> {
    if (pr) {
      await vscode.env.openExternal(vscode.Uri.parse(pr.url));
    } else {
      const { owner, repo } = await this.getOwnerRepo();
      const url = `https://github.com/${owner}/${repo}/pulls`;
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }
  }

  async getCurrentPullRequest(): Promise<PullRequest | undefined> {
    const branch = await this.getCurrentBranch();
    if (!branch) {
      return undefined;
    }

    const { owner, repo } = await this.getOwnerRepo();
    if (!this.authenticator) {
      throw new Error("Authentication provider not configured.");
    }
    const octokit = await this.authenticator.getOctokit();

    const query = `
      query($owner: String!, $repo: String!, $headName: String!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(headRefName: $headName, first: 1, states: OPEN) {
            nodes {
              number
              title
              author {
                login
              }
              headRefName
              baseRefName
              updatedAt
              createdAt
              url
              mergeable
              statusCheckRollup {
                state
              }
              headRepository {
                 url
                 owner {
                   login
                 }
              }
            }
          }
        }
      }
    `;

    try {
      const result = await octokit.graphql<GitHubPullRequestsResponse>(query, {
        owner,
        repo,
        headName: branch,
      });
      const nodes = result.repository.pullRequests.nodes;
      if (nodes.length === 0) {
        return undefined;
      }
      const pr = nodes[0];

      return {
        id: pr.number.toString(),
        number: pr.number,
        title: pr.title,
        author: pr.author.login,
        headRefName: pr.headRefName,
        baseRefName: pr.baseRefName,
        updatedAt: pr.updatedAt,
        createdAt: pr.createdAt,
        url: pr.url,
        status: pr.statusCheckRollup
          ? this.mapStatus(pr.statusCheckRollup.state)
          : "UNKNOWN",
        mergeable: pr.mergeable,
        headRepository: pr.headRepository,
      };
    } catch (error) {
      return undefined;
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      return await this.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    } catch (error) {
      return "";
    }
  }

  async updateCurrentBranchIfClean(): Promise<void> {
    try {
      const branch = await this.getCurrentBranch();
      if (!branch) {
        return;
      }

      const status = await this.exec("git", ["status", "--porcelain"]);
      if (status.trim().length > 0) {
        return;
      }

      try {
        await this.exec("git", ["fetch"]);
      } catch (error) {
        // Ignore fetch errors (e.g. network issues)
        return;
      }

      if (await this.hasUnpushedCommits(branch)) {
        return;
      }

      // Check if behind
      try {
        const behind = await this.exec("git", [
          "log",
          "HEAD..@{u}",
          "--oneline",
        ]);
        if (behind.trim().length === 0) {
          return;
        }
      } catch (error) {
        // If @{u} fails (no upstream), return
        return;
      }

      await this.exec("git", ["pull"]);
    } catch (error) {
      // Ignore all other errors to avoid disrupting user
    }
  }

  async ensureLabelExists(
    label: string,
    color: string,
    description: string,
  ): Promise<void> {
    const { owner, repo } = await this.getOwnerRepo();
    if (!this.authenticator) {
      throw new Error("Authentication provider not configured.");
    }
    const octokit = await this.authenticator.getOctokit();

    try {
      await octokit.rest.issues.getLabel({
        owner,
        repo,
        name: label,
      });
    } catch (error: any) {
      if (error.status === 404) {
        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: label,
          color,
          description,
        });
      } else {
        throw error;
      }
    }
  }

  async addLabel(pr: PullRequest, label: string): Promise<void> {
    const { owner, repo } = await this.getOwnerRepo();
    if (!this.authenticator) {
      throw new Error("Authentication provider not configured.");
    }
    const octokit = await this.authenticator.getOctokit();

    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: [label],
    });
  }

  async removeLabel(pr: PullRequest, label: string): Promise<void> {
    const { owner, repo } = await this.getOwnerRepo();
    if (!this.authenticator) {
      throw new Error("Authentication provider not configured.");
    }
    const octokit = await this.authenticator.getOctokit();

    try {
      await octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: pr.number,
        name: label,
      });
    } catch (error: any) {
      // Ignore if label doesn't exist
      if (error.status !== 404) {
        throw error;
      }
    }
  }

  async getBranchBehindCounts(): Promise<Record<string, number>> {
    try {
      const output = await this.exec("git", [
        "for-each-ref",
        "--format=%(refname:short)|%(upstream:track)",
        "refs/heads",
      ]);

      const counts: Record<string, number> = {};
      const lines = output.split("\n");

      for (const line of lines) {
        const parts = line.split("|");
        if (parts.length !== 2) {
          continue;
        }

        const branch = parts[0];
        const track = parts[1];

        const match = track.match(/behind (\d+)/);
        if (match) {
          counts[branch] = parseInt(match[1], 10);
        }
      }

      return counts;
    } catch (error) {
      console.error("Error getting branch behind counts:", error);
      return {};
    }
  }
}
