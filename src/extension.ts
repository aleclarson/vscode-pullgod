import * as vscode from "vscode";
import { AdapterFactory } from "./adapters/factory";
import { PRCache } from "./cache";
import { PullRequest } from "./adapters/types";
import { DiffContentProvider } from "./providers/diffContentProvider";
import { createQuickPickItem } from "./quickPick";
import { generatePRMarkdown } from "./markdown";

export function activate(context: vscode.ExtensionContext) {
  console.log("Pullgod is activating...");
  const outputChannel = vscode.window.createOutputChannel("Pullgod");
  context.subscriptions.push(outputChannel);

  const storagePath = context.storageUri
    ? context.storageUri.fsPath
    : context.globalStorageUri.fsPath;
  const cache = new PRCache(storagePath);
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

  context.subscriptions.push(
    vscode.commands.registerCommand("pullgod.copyPRSummary", async () => {
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
            vscode.window.showInformationMessage(
              "PR summary copied to clipboard",
            );
          },
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error copying PR summary: ${error}`);
      }
    }),
  );

  const disposable = vscode.commands.registerCommand(
    "pullgod.viewPullRequests",
    async () => {
      console.log("Pullgod command triggered");
      const quickPick = vscode.window.createQuickPick<
        vscode.QuickPickItem & {
          pr?: PullRequest;
          isCurrentPrOption?: boolean;
        }
      >();
      let isDisposed = false;
      quickPick.placeholder = "Search Pull Requests...";
      quickPick.busy = true;
      quickPick.show();

      const branchPromise = provider.getCurrentBranch();

      const itemsMap = new Map<
        string,
        vscode.QuickPickItem & {
          pr?: PullRequest;
          isCurrentPrOption?: boolean;
        }
      >();

      const updateQuickPickItems = (
        prs: PullRequest[],
        currentPr?: PullRequest,
        currentBranch?: string,
      ) => {
        const previousActive = quickPick.activeItems[0];
        const newItems: (vscode.QuickPickItem & {
          pr?: PullRequest;
          isCurrentPrOption?: boolean;
        })[] = [];

        let activePR = currentPr;
        if (!activePR && currentBranch) {
          activePR = prs.find((p) => p.headRefName === currentBranch);
        }

        const currentKey = "current-option";
        let currentItem = itemsMap.get(currentKey);

        if (activePR) {
          if (!currentItem || !currentItem.isCurrentPrOption) {
            currentItem = {
              label: "$(git-pull-request) Open changes",
              description: `(#${activePR.number}) ${activePR.title}`,
              detail: "View the git diff for the current PR",
              pr: activePR,
              isCurrentPrOption: true,
            };
            itemsMap.set(currentKey, currentItem);
          } else {
            currentItem.description = `(#${activePR.number}) ${activePR.title}`;
            currentItem.pr = activePR;
          }
        } else {
          if (!currentItem || !currentItem.isCurrentPrOption) {
            currentItem = {
              label: "$(git-pull-request) Open changes",
              description: "Select a PR to view changes",
              detail: "View the git diff for a selected PR",
              isCurrentPrOption: true,
            };
            itemsMap.set(currentKey, currentItem);
          } else {
            currentItem.description = "Select a PR to view changes";
            currentItem.pr = undefined;
          }
        }
        newItems.push(currentItem);

        for (const pr of prs) {
          const key = `pr-${pr.number}`;
          const props = createQuickPickItem(pr);
          let item = itemsMap.get(key);
          if (item) {
            item.label = props.label;
            item.description = props.description;
            item.detail = props.detail;
            item.pr = pr;
          } else {
            item = { ...props, pr };
            itemsMap.set(key, item);
          }
          newItems.push(item);
        }

        quickPick.items = newItems;

        // Restore active item to maintain scroll position/selection
        if (previousActive) {
          const newActive = newItems.find((item) => {
            if (item.isCurrentPrOption && previousActive.isCurrentPrOption) {
              return true;
            }
            if (
              !item.isCurrentPrOption &&
              !previousActive.isCurrentPrOption &&
              item.pr &&
              previousActive.pr
            ) {
              return item.pr.number === previousActive.pr.number;
            }
            return false;
          });
          if (newActive) {
            quickPick.activeItems = [newActive];
          }
        }
      };

      const fetchPRs = async () => {
        try {
          const [prs, currentPr, branch] = await Promise.all([
            provider.listPullRequests(),
            provider.getCurrentPullRequest(),
            branchPromise,
          ]);
          cache.set("github", prs);

          if (!isDisposed) {
            updateQuickPickItems(prs, currentPr, branch);
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
      // SWR implementation: Use cached data first
      const cachedPRs = cache.get("github");
      if (cachedPRs) {
        // Optimistically use cached PRs, waiting for fast branch check
        branchPromise.then((branch) => {
          if (!isDisposed) {
            updateQuickPickItems(cachedPRs, undefined, branch);
          }
        });
      }

      // Always revalidate
      fetchPRs();

      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        if (selected) {
          quickPick.hide();

          if (selected.isCurrentPrOption) {
            const openChangesForPr = async (pr: PullRequest) => {
              try {
                const match = pr.url.match(
                  /github\.com\/([^\/]+)\/([^\/]+)\/pull\/\d+/,
                );
                if (match) {
                  const [, owner, repo] = match;
                  await vscode.commands.executeCommand("pr.openChanges", {
                    owner,
                    repo,
                    number: pr.number,
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
            };

            if (selected.pr) {
              await openChangesForPr(selected.pr);
            } else {
              // Show a new Quick Pick to select a PR
              const prSelection = vscode.window.createQuickPick<
                vscode.QuickPickItem & { pr: PullRequest }
              >();
              prSelection.items = quickPick.items.filter(
                (i): i is vscode.QuickPickItem & { pr: PullRequest } =>
                  !i.isCurrentPrOption && !!i.pr,
              );
              prSelection.placeholder = "Select a PR to view changes";
              prSelection.show();

              prSelection.onDidAccept(async () => {
                const prSelected = prSelection.selectedItems[0];
                if (prSelected) {
                  prSelection.hide();
                  await openChangesForPr(prSelected.pr);
                }
              });

              prSelection.onDidHide(() => prSelection.dispose());
            }
            return;
          }

          if (!selected.pr) {
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
                if (selected.pr) {
                  await provider.checkoutPullRequest(selected.pr);
                }
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
