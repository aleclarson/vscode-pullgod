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

    const uri = vscode.Uri.parse(
      `pullgod-reply:/reply-${pr.number}-${Date.now()}.md`,
    );

    const initialContent = [
      "<!--",
      `Replying to PR #${pr.number}`,
      "Save this file to submit your comment.",
      "Close without saving to cancel.",
      "-->",
      "",
      "",
    ].join("\n");

    await vscode.workspace.fs.writeFile(uri, Buffer.from(initialContent));

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);

    const disposables: vscode.Disposable[] = [];

    const cleanup = async () => {
      vscode.Disposable.from(...disposables).dispose();
      try {
        await vscode.workspace.fs.delete(uri);
      } catch (e) {
        // Ignore if file already deleted
      }
    };

    const saveListener = vscode.workspace.onDidSaveTextDocument(
      async (savedDoc) => {
        if (savedDoc.uri.toString() === uri.toString()) {
          const text = savedDoc.getText();
          const cleanText = text.replace(/<!--[\s\S]*?-->/g, "").trim();

          if (!cleanText) {
            vscode.window.showWarningMessage("Comment cannot be empty.");
            return;
          }

          try {
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: "Posting comment...",
              },
              async () => {
                await provider.postComment(pr, cleanText);
              },
            );
            vscode.window.showInformationMessage("Comment posted successfully!");

            // Attempt to close the editor
            const editor = vscode.window.visibleTextEditors.find(
              (e) => e.document.uri.toString() === uri.toString(),
            );
            if (editor) {
              await vscode.window.showTextDocument(editor.document);
              await vscode.commands.executeCommand(
                "workbench.action.closeActiveEditor",
              );
            }

            await cleanup();
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to post comment: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }
      },
    );

    const closeListener = vscode.workspace.onDidCloseTextDocument(
      async (closedDoc) => {
        if (closedDoc.uri.toString() === uri.toString()) {
          await cleanup();
        }
      },
    );

    disposables.push(saveListener, closeListener);
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
