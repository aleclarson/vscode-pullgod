import * as vscode from "vscode";
import { AdapterFactory } from "./adapters/factory";
import { PRCache } from "./cache";
import { PullRequest } from "./adapters/types";
import { DiffContentProvider } from "./providers/diffContentProvider";
import { createQuickPickItem } from "./quickPick";

export function activate(context: vscode.ExtensionContext) {
  console.log("Pullgod is activating...");
  const outputChannel = vscode.window.createOutputChannel("Pullgod");
  context.subscriptions.push(outputChannel);

  const cache = new PRCache(context.globalStorageUri.fsPath);
  const provider = AdapterFactory.getProvider();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "pullgod-pr",
      new DiffContentProvider(provider),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pullgod.openInBrowser",
      async (uri?: vscode.Uri) => {
        let pr: PullRequest | undefined;

        if (uri && uri.scheme === "pullgod-pr") {
          const params = new URLSearchParams(uri.query);
          const num = params.get("number");
          if (num) {
            pr = { number: parseInt(num, 10) } as PullRequest;
          }
        }

        try {
          await provider.openPullRequestOnWeb(pr);
        } catch (error) {
          vscode.window.showErrorMessage(`Error opening PR on GitHub: ${error}`);
        }
      },
    ),
  );

  const disposable = vscode.commands.registerCommand(
    "pullgod.viewPullRequests",
    async () => {
      console.log("Pullgod command triggered");
      const quickPick = vscode.window.createQuickPick<
        vscode.QuickPickItem & {
          pr: PullRequest;
          isCurrentPrOption?: boolean;
        }
      >();
      let isDisposed = false;
      quickPick.placeholder = "Search Pull Requests...";
      quickPick.busy = true;
      quickPick.show();

      const fetchPRs = async () => {
        try {
          const [prs, currentPr] = await Promise.all([
            provider.listPullRequests(),
            provider.getCurrentPullRequest(),
          ]);
          cache.set("github", prs);
          if (!isDisposed) {
            updateQuickPickItems(prs, currentPr);
          }
        } catch (error) {
          if (!isDisposed) {
            vscode.window.showErrorMessage(
              `Error fetching pull requests: ${error}`,
            );
          }
        } finally {
          if (!isDisposed) {
            quickPick.busy = false;
          }
        }
      };

      const updateQuickPickItems = (
        prs: PullRequest[],
        currentPr?: PullRequest,
      ) => {
        const items: (vscode.QuickPickItem & {
          pr: PullRequest;
          isCurrentPrOption?: boolean;
        })[] = prs.map(createQuickPickItem);

        if (currentPr) {
          items.unshift({
            label: "$(git-pull-request) Open changes for current PR",
            description: `PR #${currentPr.number}: ${currentPr.title}`,
            detail: "Opens the changes view for the currently checked out pull request",
            pr: currentPr,
            isCurrentPrOption: true,
          });
        }

        quickPick.items = items;
      };

      // SWR implementation: Use cached data first
      const cachedPRs = cache.get("github");
      if (cachedPRs) {
        updateQuickPickItems(cachedPRs);
      }

      // Always revalidate
      fetchPRs();

      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        if (selected) {
          quickPick.hide();

          if (selected.isCurrentPrOption) {
            try {
              const match = selected.pr.url.match(
                /github\.com\/([^\/]+)\/([^\/]+)\/pull\/\d+/,
              );
              if (match) {
                const [, owner, repo] = match;
                await vscode.commands.executeCommand("pr.openChanges", {
                  owner,
                  repo,
                  number: selected.pr.number,
                });
              } else {
                vscode.window.showErrorMessage(
                  "Could not parse repository info from PR URL",
                );
              }
            } catch (error) {
              vscode.window.showErrorMessage(
                `Error opening changes for current PR: ${error}`,
              );
            }
            return;
          }

          try {
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: `Checking out PR #${selected.pr.number}...`,
                cancellable: false,
              },
              async () => {
                await provider.checkoutPullRequest(selected.pr);
              },
            );
            vscode.window.showInformationMessage(
              `Checked out PR #${selected.pr.number}`,
            );

            try {
              await vscode.commands.executeCommand("pr.openDescription");
            } catch (error) {
              outputChannel.appendLine(
                `Failed to open pull request description: ${error}`,
              );
            }

            try {
              await vscode.commands.executeCommand(
                "github:activePullRequest.focus",
              );
            } catch (error) {
              outputChannel.appendLine(
                `Failed to focus GitHub active pull request view: ${error}`,
              );
            }

            try {
              const uri = vscode.Uri.from({
                scheme: "pullgod-pr",
                path: `PR-${selected.pr.number}.md`,
                query: `number=${selected.pr.number}`,
              });
              await vscode.commands.executeCommand("markdown.showPreview", uri);
            } catch (error) {
              vscode.window.showErrorMessage(
                `Error opening pull request diff: ${error}`,
              );
            }
          } catch (error) {
            vscode.window.showErrorMessage(
              `Error checking out pull request: ${error}`,
            );
          }
        }
      });

      quickPick.onDidHide(() => {
        isDisposed = true;
        quickPick.dispose();
      });
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
