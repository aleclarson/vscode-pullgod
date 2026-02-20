import * as vscode from "vscode";
import { PullRequestProvider, PullRequest } from "../adapters/types";
import { generatePRMarkdown } from "../markdown";

export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private provider: PullRequestProvider) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const params = new URLSearchParams(uri.query);
    const prNumber = params.get("number");
    if (!prNumber) {
      return "Error: No PR number provided.";
    }

    try {
      // Create a partial PR object with just the number, as the adapter only needs that.
      const pr = { number: parseInt(prNumber, 10) } as PullRequest;
      const [viewJson, diff] = await Promise.all([
        this.provider.getPullRequestView(pr),
        this.provider.getPullRequestDiff(pr),
      ]);

      const prData = JSON.parse(viewJson);

      return generatePRMarkdown(prData, diff);
    } catch (error) {
      return `Error fetching diff: ${error}`;
    }
  }
}
