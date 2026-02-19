import { PullRequest, PullRequestProvider } from "./types";
import { Executor, NodeExecutor, Workspace, VSCodeWorkspace } from "./system";

export class GitHubAdapter implements PullRequestProvider {
  private executor: Executor;
  private workspace: Workspace;

  constructor(
    executor: Executor = new NodeExecutor(),
    workspace: Workspace = new VSCodeWorkspace(),
  ) {
    this.executor = executor;
    this.workspace = workspace;
  }

  private async exec(command: string, args: string[]): Promise<string> {
    const workspaceFolder = this.workspace.getWorkspaceFolder();
    if (!workspaceFolder) {
      throw new Error("Please open a project folder in VS Code first.");
    }
    return this.executor.exec(command, args, workspaceFolder);
  }

  private async checkGhInstalled(): Promise<void> {
    try {
      await this.exec("gh", ["--version"]);
    } catch (error) {
      throw new Error(
        "The GitHub CLI (gh) is not installed or not in your PATH. Please install it from https://cli.github.com/",
      );
    }
  }

  private async checkIsGitHubRepo(): Promise<void> {
    try {
      await this.exec("git", ["rev-parse", "--is-inside-work-tree"]);
      const remotes = await this.exec("git", ["remote", "-v"]);
      if (!remotes.includes("github.com")) {
        throw new Error(
          "This project does not appear to have a GitHub remote.",
        );
      }
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

  private parseStatus(statusCheckRollup: any): string {
    if (!statusCheckRollup) {
      return "UNKNOWN";
    }

    if (Array.isArray(statusCheckRollup)) {
      if (statusCheckRollup.length === 0) {
        return "UNKNOWN";
      }
      let hasFailure = false;
      let hasPending = false;

      for (const check of statusCheckRollup) {
        const state = check.state || check.conclusion || check.status;
        if (!state) {
          continue;
        }

        const s = state.toUpperCase();
        if (
          [
            "FAILURE",
            "ERROR",
            "CANCELLED",
            "TIMED_OUT",
            "ACTION_REQUIRED",
          ].includes(s)
        ) {
          hasFailure = true;
          break;
        }
        if (["PENDING", "IN_PROGRESS", "QUEUED", "WAITING"].includes(s)) {
          hasPending = true;
        }
      }

      if (hasFailure) {
        return "FAILURE";
      }
      if (hasPending) {
        return "PENDING";
      }
      return "SUCCESS";
    } else if (typeof statusCheckRollup === "object") {
      const state = statusCheckRollup.state || statusCheckRollup.status;
      if (!state) {
        return "UNKNOWN";
      }

      const s = state.toUpperCase();
      if (
        [
          "FAILURE",
          "ERROR",
          "CANCELLED",
          "TIMED_OUT",
          "ACTION_REQUIRED",
        ].includes(s)
      ) {
        return "FAILURE";
      }
      if (["PENDING", "IN_PROGRESS", "QUEUED", "WAITING"].includes(s)) {
        return "PENDING";
      }
      if (["SUCCESS", "NEUTRAL", "SKIPPED", "COMPLETED"].includes(s)) {
        return "SUCCESS";
      }
    }

    return "UNKNOWN";
  }

  async listPullRequests(): Promise<PullRequest[]> {
    await this.checkGhInstalled();
    await this.checkIsGitHubRepo();
    const output = await this.exec("gh", [
      "pr",
      "list",
      "--json",
      "number,title,author,headRefName,baseRefName,updatedAt,url,statusCheckRollup,mergeable",
      "--limit",
      "100",
    ]);
    const prs = JSON.parse(output);
    return prs
      .map((pr: any) => ({
        ...pr,
        author: pr.author.login,
        id: pr.number.toString(),
        status: this.parseStatus(pr.statusCheckRollup),
        mergeable: pr.mergeable,
      }))
      .sort((a: PullRequest, b: PullRequest) => {
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
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
    await this.checkGhInstalled();
    await this.checkIsGitHubRepo();

    const branchName = pr.headRefName;
    if (await this.localBranchExists(branchName)) {
      if (await this.hasUnpushedCommits(branchName)) {
        await this.exec("git", ["checkout", branchName]);
        return;
      }
    }

    await this.exec("gh", ["pr", "checkout", pr.number.toString()]);
  }

  async getPullRequestDiff(pr: PullRequest): Promise<string> {
    await this.checkGhInstalled();
    await this.checkIsGitHubRepo();
    return this.exec("gh", ["pr", "diff", pr.number.toString()]);
  }

  async getPullRequestView(pr: PullRequest): Promise<string> {
    await this.checkGhInstalled();
    await this.checkIsGitHubRepo();
    return this.exec("gh", [
      "pr",
      "view",
      pr.number.toString(),
      "--json",
      "number,title,body,author,state,url,createdAt,updatedAt,headRefName,baseRefName",
    ]);
  }

  async openPullRequestOnWeb(pr?: PullRequest): Promise<void> {
    await this.checkGhInstalled();
    await this.checkIsGitHubRepo();
    if (pr) {
      await this.exec("gh", ["pr", "view", pr.number.toString(), "--web"]);
    } else {
      await this.exec("gh", ["pr", "view", "--web"]);
    }
  }

  async getCurrentPullRequest(): Promise<PullRequest | undefined> {
    try {
      await this.checkGhInstalled();
      await this.checkIsGitHubRepo();
      const output = await this.exec("gh", [
        "pr",
        "view",
        "--json",
        "number,title,author,headRefName,baseRefName,updatedAt,url",
      ]);
      const pr = JSON.parse(output);
      return {
        ...pr,
        author: pr.author.login,
        id: pr.number.toString(),
      };
    } catch (error) {
      return undefined;
    }
  }
}
