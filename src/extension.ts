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

  const storagePath = context.globalStorageUri.fsPath;
  const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  const cache = new PRCache(storagePath, workspacePath);
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
          vscode.window.showErrorMessage(
            `Error opening PR on GitHub: ${error}`,
          );
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

  const interval = setInterval(() => {
    provider.updateCurrentBranchIfClean().catch((error) => {
      console.error("Failed to update branch:", error);
    });
  }, 60000); // Check every minute

  context.subscriptions.push({
    dispose: () => clearInterval(interval),
  });

  const disposable = vscode.commands.registerCommand(
    "pullgod.viewPullRequests",
    async () => {
      console.log("Pullgod command triggered");
      const quickPick = vscode.window.createQuickPick<
        vscode.QuickPickItem & {
          pr?: PullRequest;
          isCurrentPrOption?: boolean;
          isViewLowPriority?: boolean;
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
          isViewLowPriority?: boolean;
        }
      >();

      // Store fetched PRs to be used in "View low priority PRs" flow
      let fetchedPRs: PullRequest[] = [];

      const updateQuickPickItems = (
        prs: PullRequest[],
        currentPr?: PullRequest,
        currentBranch?: string,
      ) => {
        fetchedPRs = prs;
        prs.sort((a, b) => {
          const aLow = a.labels?.some((l) => l.name === "priority:low");
          const bLow = b.labels?.some((l) => l.name === "priority:low");

          if (aLow && !bLow) {
            return 1;
          }
          if (!aLow && bLow) {
            return -1;
          }

          const aCheckedOut = cache.getLastCheckedOut(a.number);
          const bCheckedOut = cache.getLastCheckedOut(b.number);

          if (aCheckedOut && bCheckedOut) {
            return bCheckedOut - aCheckedOut;
          }
          if (aCheckedOut) {
            return -1;
          }
          if (bCheckedOut) {
            return 1;
          }

          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });

        const previousActive = quickPick.activeItems[0];
        const newItems: (vscode.QuickPickItem & {
          pr?: PullRequest;
          isCurrentPrOption?: boolean;
          isViewLowPriority?: boolean;
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

        // Separate PRs into regular and low priority
        const regularPRs: PullRequest[] = [];
        const lowPriorityPRs: PullRequest[] = [];

        for (const pr of prs) {
          if (pr.labels?.some((l) => l.name === "priority:low")) {
            lowPriorityPRs.push(pr);
          } else {
            regularPRs.push(pr);
          }
        }

        const addPRItem = (pr: PullRequest) => {
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
        };

        for (const pr of regularPRs) {
          addPRItem(pr);
        }

        if (lowPriorityPRs.length > 0) {
          const lowPriKey = "view-low-priority";
          let lowPriItem = itemsMap.get(lowPriKey);
          if (!lowPriItem) {
            lowPriItem = {
              label: "View low priority PRs",
              isViewLowPriority: true,
            };
            itemsMap.set(lowPriKey, lowPriItem);
          }
          newItems.push(lowPriItem);
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

      // Extracted helper to handle PR selection actions (checkout, open changes, etc)
      const handlePRSelection = async (pr: PullRequest) => {
        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Checking out PR #${pr.number}...`,
              cancellable: false,
            },
            async () => {
              await provider.checkoutPullRequest(pr);
              await cache.setLastCheckedOut(pr.number, Date.now());
            },
          );
          vscode.window.showInformationMessage(
            `Checked out PR #${pr.number}`,
          );

          try {
            const match = pr.url.match(
              /github\.com\/([^\/]+)\/([^\/]+)\/pull\/\d+/,
            );
            if (match) {
              const [, owner, repo] = match;
              const uri = vscode.Uri.from({
                scheme: vscode.env.uriScheme,
                authority: "GitHub.vscode-pull-request-github",
                path: "/open-pull-request-webview",
                query: JSON.stringify({
                  owner,
                  repo,
                  pullRequestNumber: pr.number,
                }),
              });
              await vscode.env.openExternal(uri);
            }
          } catch (error) {
            outputChannel.appendLine(
              `Failed to open pull request description via URI: ${error}`,
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
      };

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

      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        if (selected) {
          if (selected.kind === vscode.QuickPickItemKind.Separator) {
            return;
          }

          if (selected.isViewLowPriority) {
            // Open a new Quick Pick for Low Priority PRs
            const lowPriQuickPick = vscode.window.createQuickPick<
              vscode.QuickPickItem & { pr: PullRequest }
            >();
            lowPriQuickPick.placeholder = "Low Priority Pull Requests";

            const lowPriorityPRs = fetchedPRs.filter(pr =>
              pr.labels?.some((l) => l.name === "priority:low")
            );

            lowPriQuickPick.items = lowPriorityPRs.map(pr => {
                const props = createQuickPickItem(pr);
                return { ...props, pr };
            });

            lowPriQuickPick.show();

            lowPriQuickPick.onDidAccept(async () => {
                const lpSelected = lowPriQuickPick.selectedItems[0];
                if (lpSelected) {
                    lowPriQuickPick.hide();
                    quickPick.hide(); // Close the main picker too
                    await handlePRSelection(lpSelected.pr);
                }
            });

            lowPriQuickPick.onDidHide(() => lowPriQuickPick.dispose());
            return;
          }

          quickPick.hide();

          if (selected.isCurrentPrOption) {
            if (selected.pr) {
              await openChangesForPr(selected.pr);
            } else {
              // Show a new Quick Pick to select a PR
              const prSelection = vscode.window.createQuickPick<
                vscode.QuickPickItem & { pr: PullRequest }
              >();
              prSelection.items = quickPick.items.filter(
                (i): i is vscode.QuickPickItem & { pr: PullRequest } =>
                  !i.isCurrentPrOption && !!i.pr && i.kind !== vscode.QuickPickItemKind.Separator && !i.isViewLowPriority,
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

          await handlePRSelection(selected.pr);
        }
      });

      quickPick.onDidHide(() => {
        isDisposed = true;
        quickPick.dispose();
      });
    },
  );

  context.subscriptions.push(disposable);

  context.subscriptions.push(
    vscode.commands.registerCommand("pullgod.updatePriorities", async () => {
      const quickPick = vscode.window.createQuickPick<
        vscode.QuickPickItem & { pr: PullRequest }
      >();
      quickPick.canSelectMany = true;
      quickPick.placeholder = "Select PRs to mark as Low Priority...";
      quickPick.busy = true;
      quickPick.show();

      try {
        const prs = await provider.listPullRequests();
        const items = prs.map((pr) => {
          const props = createQuickPickItem(pr);
          return {
            ...props,
            pr,
            picked: pr.labels?.some((l) => l.name === "priority:low"),
          };
        });

        quickPick.items = items;
        quickPick.selectedItems = items.filter((i) => i.picked);
        quickPick.busy = false;

        quickPick.onDidAccept(async () => {
          const selectedPRs = new Set(
            quickPick.selectedItems.map((i) => i.pr.number),
          );
          quickPick.hide();

          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Updating PR priorities...",
              cancellable: false,
            },
            async (progress) => {
              try {
                // Ensure label exists
                await provider.ensureLabelExists(
                  "priority:low",
                  "c2e0c6",
                  "Low priority pull request",
                );

                const tasks: (() => Promise<void>)[] = [];

                for (const item of items) {
                  const wasLow = item.picked;
                  const isLow = selectedPRs.has(item.pr.number);

                  if (wasLow && !isLow) {
                    tasks.push(() =>
                      provider.removeLabel(item.pr, "priority:low"),
                    );
                  } else if (!wasLow && isLow) {
                    tasks.push(() => provider.addLabel(item.pr, "priority:low"));
                  }
                }

                const increment = 100 / (tasks.length || 1);
                for (let i = 0; i < tasks.length; i++) {
                  progress.report({
                    message: `Updating PR ${i + 1}/${tasks.length}`,
                    increment,
                  });
                  await tasks[i]();
                  // Rate limit mitigation: sleep 250ms
                  if (i < tasks.length - 1) {
                    await new Promise((r) => setTimeout(r, 250));
                  }
                }

                vscode.window.showInformationMessage(
                  "PR priorities updated successfully.",
                );
              } catch (error) {
                vscode.window.showErrorMessage(
                  `Error updating PR priorities: ${error}`,
                );
              }
            },
          );
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error fetching pull requests: ${error}`,
        );
        quickPick.hide();
      }
    }),
  );
}

export function deactivate() {}
