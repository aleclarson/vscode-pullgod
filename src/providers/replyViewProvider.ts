import * as vscode from "vscode";
import { PullRequestProvider, PullRequest } from "../adapters/types";

export class ReplyViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "pullgod.replyView";

  private _view?: vscode.WebviewView;
  private _targetPR?: PullRequest;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: PullRequestProvider,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "submit": {
          if (!this._targetPR) {
            vscode.window.showErrorMessage("No active PR selected to reply to.");
            return;
          }
          if (!data.value) {
            vscode.window.showWarningMessage("Comment cannot be empty.");
            return;
          }
          try {
            await this._provider.postComment(this._targetPR, data.value);
            vscode.window.showInformationMessage("Comment posted successfully!");
            if (this._view) {
              this._view.webview.postMessage({ type: "clear" });
            }
            // Focus the terminal panel after successful submission
            vscode.commands.executeCommand("workbench.action.terminal.focus");
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to post comment: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
          break;
        }
        case "cancel": {
          // Clear and close
           if (this._view) {
              this._view.webview.postMessage({ type: "clear" });
            }
           vscode.commands.executeCommand('workbench.action.closePanel');
          break;
        }
      }
    });
  }

  public setTargetPR(pr: PullRequest) {
    this._targetPR = pr;
    if (this._view) {
      this._view.show?.(true); // Show and preserve focus
      this._view.webview.postMessage({ type: "setPR", value: pr.title, number: pr.number });
    }
  }

  private _escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const initialHeader = this._targetPR
      ? `Replying to PR #${this._targetPR.number}: ${this._escapeHtml(this._targetPR.title)}`
      : "Reply to PR";

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Reply to PR</title>
				<style>
					body {
						font-family: var(--vscode-font-family);
						padding: 10px;
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        box-sizing: border-box;
					}
                    #header {
                        margin-bottom: 10px;
                        font-weight: bold;
                    }
					textarea {
						width: 100%;
						height: 150px;
                        flex-grow: 1;
						background-color: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						border: 1px solid var(--vscode-input-border);
						padding: 5px;
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                        resize: none;
					}
                    textarea:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                    }
					button {
						background-color: var(--vscode-button-background);
						color: var(--vscode-button-foreground);
						border: none;
						padding: 8px 12px;
						cursor: pointer;
                        margin-top: 10px;
                        align-self: flex-start;
					}
					button:hover {
						background-color: var(--vscode-button-hoverBackground);
					}
                    .actions {
                        display: flex;
                        gap: 10px;
                    }
				</style>
			</head>
			<body>
                <div id="header">${initialHeader}</div>
				<textarea id="comment-body" placeholder="Write your comment here... (Cmd+Enter to submit)"></textarea>
                <div class="actions">
				    <button id="submit">Comment</button>
                    <button id="cancel" style="background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">Cancel</button>
                </div>

				<script>
					const vscode = acquireVsCodeApi();
                    const textarea = document.getElementById('comment-body');
                    const header = document.getElementById('header');

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'setPR':
                                header.textContent = \`Replying to PR #\${message.number}: \${message.value}\`;
                                break;
                            case 'clear':
                                textarea.value = '';
                                break;
                        }
                    });

					document.getElementById('submit').addEventListener('click', () => {
						vscode.postMessage({ type: 'submit', value: textarea.value });
					});

                    document.getElementById('cancel').addEventListener('click', () => {
                        vscode.postMessage({ type: 'cancel' });
                    });

                    textarea.addEventListener('keydown', (e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            e.preventDefault();
                            vscode.postMessage({ type: 'submit', value: textarea.value });
                        }
                    });

                    // Focus textarea automatically
                    textarea.focus();
				</script>
			</body>
			</html>`;
  }
}
