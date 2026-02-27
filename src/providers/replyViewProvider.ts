import * as vscode from "vscode";
import { PullRequestProvider, PullRequest } from "../adapters/types";

export class ReplyViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "pullgod.replyView";

  private _view?: vscode.WebviewView;
  private _targetPR?: PullRequest;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: PullRequestProvider,
    private readonly _context: vscode.ExtensionContext,
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
            this._clearDraft(this._targetPR);
            // Focus the terminal panel after successful submission
            vscode.commands.executeCommand("workbench.action.terminal.focus");
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to post comment: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
          break;
        }
        case "saveDraft": {
          if (this._targetPR && data.value) {
            this._saveDraft(this._targetPR, data.value);
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

    // Load draft if PR is already set
    if (this._targetPR) {
      const draft = this._loadDraft(this._targetPR);
      if (draft) {
        webviewView.webview.postMessage({ type: "setDraft", value: draft });
      }
    }
  }

  public setTargetPR(pr: PullRequest | undefined) {
    this._targetPR = pr;
    if (!this._view) {
      return;
    }

    if (pr) {
      // Show view
      this._view.show?.(true); // Show and preserve focus
      this._view.webview.postMessage({ type: "setPR", value: pr.title, number: pr.number });

      const draft = this._loadDraft(pr);
      if (draft) {
         this._view.webview.postMessage({ type: "setDraft", value: draft });
      } else {
         this._view.webview.postMessage({ type: "clear" });
      }
    } else {
      // Hide view / Clear PR context
      vscode.commands.executeCommand('workbench.action.closePanel');
      this._view.webview.postMessage({ type: "clearPR" });
    }
  }

  private _getCacheKey(pr: PullRequest): string {
    // Assuming repo info is available or just using PR ID if globally unique enough for this context
    // Ideally we need repo context. PR object has headRepository.
    // If headRepository is missing, fallback to number (might conflict across repos, but acceptable for MVP if repo info is missing)
    const repo = pr.headRepository?.url || "unknown-repo";
    return `replyCache:${repo}:${pr.number}`;
  }

  private _saveDraft(pr: PullRequest, text: string) {
    const key = this._getCacheKey(pr);
    this._context.globalState.update(key, { text, timestamp: Date.now() });
  }

  private _loadDraft(pr: PullRequest): string | undefined {
    const key = this._getCacheKey(pr);
    const data = this._context.globalState.get<{ text: string, timestamp: number }>(key);
    if (!data) return undefined;

    // Check expiration (7 days)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - data.timestamp > sevenDaysMs) {
      this._context.globalState.update(key, undefined);
      return undefined;
    }
    return data.text;
  }

  private _clearDraft(pr: PullRequest) {
    const key = this._getCacheKey(pr);
    this._context.globalState.update(key, undefined);
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

    // Initial draft
    let initialDraft = "";
    if (this._targetPR) {
        initialDraft = this._loadDraft(this._targetPR) || "";
    }

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
                    .hidden {
                        display: none;
                    }
				</style>
			</head>
			<body>
                <div id="container">
                    <div id="header">${initialHeader}</div>
                    <textarea id="comment-body" placeholder="Write your comment here... (Cmd+Enter to submit)">${this._escapeHtml(initialDraft)}</textarea>
                    <div class="actions">
                        <button id="submit">Comment</button>
                        <button id="cancel" style="background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);">Cancel</button>
                    </div>
                </div>
                <div id="empty-state" class="${this._targetPR ? 'hidden' : ''}">
                    No active Pull Request selected.
                </div>

				<script>
					const vscode = acquireVsCodeApi();
                    const container = document.getElementById('container');
                    const emptyState = document.getElementById('empty-state');
                    const textarea = document.getElementById('comment-body');
                    const header = document.getElementById('header');

                    let draftTimeout;

                    function updateState(hasPR) {
                        if (hasPR) {
                            container.classList.remove('hidden');
                            emptyState.classList.add('hidden');
                        } else {
                            container.classList.add('hidden');
                            emptyState.classList.remove('hidden');
                        }
                    }

                    // Initial state check
                    if ("${!!this._targetPR}" === "false") {
                        updateState(false);
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'setPR':
                                header.textContent = \`Replying to PR #\${message.number}: \${message.value}\`;
                                updateState(true);
                                break;
                            case 'clearPR':
                                updateState(false);
                                break;
                            case 'clear':
                                textarea.value = '';
                                break;
                            case 'setDraft':
                                textarea.value = message.value;
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

                    textarea.addEventListener('input', () => {
                        clearTimeout(draftTimeout);
                        draftTimeout = setTimeout(() => {
                            vscode.postMessage({ type: 'saveDraft', value: textarea.value });
                        }, 500); // Debounce save
                    });

                    // Focus textarea automatically
                    textarea.focus();
				</script>
			</body>
			</html>`;
  }
}
