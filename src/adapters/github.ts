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

  async listPullRequests(): Promise<PullRequest[]> {
    await this.checkGhInstalled();
    await this.checkIsGitHubRepo();
    const output = await this.exec("gh", [
      "pr",
      "list",
      "--json",
      "number,title,author,headRefName,baseRefName,updatedAt,url",
      "--limit",
      "100",
    ]);
    const prs = JSON.parse(output);
    return prs
      .map((pr: any) => ({
        ...pr,
        author: pr.author.login,
        id: pr.number.toString(),
      }))
      .sort((a: PullRequest, b: PullRequest) => {
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }

  async checkoutPullRequest(pr: PullRequest): Promise<void> {
    await this.checkGhInstalled();
    await this.checkIsGitHubRepo();
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
}
