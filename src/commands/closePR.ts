import * as vscode from "vscode";
import { PullRequestProvider } from "../adapters/types";

export function closePR(provider: PullRequestProvider) {
  return async () => {
    try {
      const pr = await provider.getCurrentPullRequest();
      if (!pr) {
        vscode.window.showErrorMessage(
          "No active pull request found for the current branch.",
        );
        return;
      }

      const answer = await vscode.window.showWarningMessage(
        `Are you sure you want to close PR #${pr.number}: ${pr.title}?`,
        "Yes",
        "No",
      );

      if (answer === "Yes") {
        await provider.closePullRequest(pr);
        vscode.window.showInformationMessage(`PR #${pr.number} closed.`);
      }
    } catch (error) {
      if (error instanceof Error) {
        vscode.window.showErrorMessage(`Failed to close PR: ${error.message}`);
      } else {
        vscode.window.showErrorMessage("Failed to close PR");
      }
    }
  };
}
