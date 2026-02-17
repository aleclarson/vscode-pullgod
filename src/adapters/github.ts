import * as cp from "child_process";
import { PullRequest, PullRequestProvider } from "./types";
import * as vscode from "vscode";

export class GitHubAdapter implements PullRequestProvider {
  private async exec(command: string, args: string[]): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      throw new Error("Please open a project folder in VS Code first.");
    }
    return new Promise((resolve, reject) => {
      cp.execFile(
        command,
        args,
        { cwd: workspaceFolder },
        (error, stdout, stderr) => {
          if (error) {
            reject(stderr || error.message);
            return;
          }
          resolve(stdout.trim());
        },
      );
    });
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
}
