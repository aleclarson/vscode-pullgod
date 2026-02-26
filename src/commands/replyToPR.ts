import * as vscode from "vscode";
import { PullRequestProvider } from "../adapters/types";
import { ReplyViewProvider } from "../providers/replyViewProvider";

export const replyToPR =
  (provider: PullRequestProvider, replyViewProvider: ReplyViewProvider) =>
  async () => {
    try {
      const pr = await provider.getCurrentPullRequest();
      if (!pr) {
        vscode.window.showErrorMessage(
          "No active pull request found for the current branch.",
        );
        return;
      }

      replyViewProvider.setTargetPR(pr);
      await vscode.commands.executeCommand("pullgod.replyView.focus");
    } catch (error) {
      if (error instanceof Error) {
        vscode.window.showErrorMessage(
          `Failed to initiate reply: ${error.message}`,
        );
      } else {
        vscode.window.showErrorMessage("Failed to initiate reply.");
      }
    }
  };
