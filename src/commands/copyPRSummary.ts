import * as vscode from "vscode";
import { PullRequestProvider } from "../adapters/types";
import { generatePRMarkdown } from "../markdown";

export const copyPRSummary = (provider: PullRequestProvider) => async () => {
  try {
    const pr = await provider.getCurrentPullRequest();
    if (!pr) {
      vscode.window.showErrorMessage("No active pull request found.");
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fetching PR #${pr.number} summary...`,
        cancellable: false,
      },
      async () => {
        const [viewJson, diff] = await Promise.all([
          provider.getPullRequestView(pr),
          provider.getPullRequestDiff(pr),
        ]);

        const prData = JSON.parse(viewJson);
        const markdown = generatePRMarkdown(prData, diff);

        await vscode.env.clipboard.writeText(markdown);
        vscode.window.showInformationMessage("PR summary copied to clipboard");
      },
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Error copying PR summary: ${error}`);
  }
};
