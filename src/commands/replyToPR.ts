import * as vscode from "vscode";
import { PullRequestProvider } from "../adapters/types";

export const replyToPR = (provider: PullRequestProvider) => async () => {
  try {
    const pr = await provider.getCurrentPullRequest();
    if (!pr) {
      vscode.window.showErrorMessage(
        "No active pull request found for the current branch.",
      );
      return;
    }

    const comment = await vscode.window.showInputBox({
      prompt: "Enter your comment (Press Enter to submit)",
      placeHolder: "Type your comment here...",
      ignoreFocusOut: true,
    });

    if (!comment) {
      return; // User cancelled or entered empty string
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Posting comment...",
        cancellable: false,
      },
      async () => {
        await provider.postComment(pr, comment);
      },
    );

    vscode.window.showInformationMessage("Comment posted successfully!");
  } catch (error) {
    if (error instanceof Error) {
      vscode.window.showErrorMessage(
        `Failed to post comment: ${error.message}`,
      );
    } else {
      vscode.window.showErrorMessage("Failed to post comment.");
    }
  }
};
