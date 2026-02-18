import * as vscode from "vscode";
import { PullRequestProvider, PullRequest } from "../adapters/types";

export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private provider: PullRequestProvider) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params = new URLSearchParams(uri.query);
    const prNumber = params.get("number");
    if (!prNumber) {
      return "Error: No PR number provided.";
    }

    try {
      // Create a partial PR object with just the number, as getPullRequestDiff only needs that.
      // In a real scenario, we might want to fetch the full PR details, but for diffing,
      // the number is sufficient for `gh pr diff`.
      const pr = { number: parseInt(prNumber, 10) } as PullRequest;
      return await this.provider.getPullRequestDiff(pr);
    } catch (error) {
      return `Error fetching diff: ${error}`;
    }
  }
}
