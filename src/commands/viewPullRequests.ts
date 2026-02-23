import * as vscode from "vscode";
import { PullRequestProvider, PullRequest } from "../adapters/types";
import { PRCache } from "../cache";
import { createQuickPickItem } from "../quickPick";
import { prefer, preferGreaterNumber, preferLaterDate } from "../utils/prefer";

export const viewPullRequests =
  (
    provider: PullRequestProvider,
    cache: PRCache,
    outputChannel: vscode.OutputChannel,
  ) =>
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
      behindCounts?: Record<string, number>,
    ) => {
      fetchedPRs = prs;
      prs.sort(
        prefer(
          (pr: PullRequest) =>
            !pr.labels?.some((label) => label.name === "priority:low"),
          preferGreaterNumber((pr) => cache.getLastCheckedOut(pr.number) || 0),
          preferLaterDate((pr) => pr.createdAt),
        ),
      );

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
        const behindCount = behindCounts?.[pr.headRefName];
        const props = createQuickPickItem(pr, behindCount);
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
        const [prs, currentPr, branch, behindCounts] = await Promise.all([
          provider.listPullRequests(),
          provider.getCurrentPullRequest(),
          branchPromise,
          provider.getBranchBehindCounts(),
        ]);
        cache.set("github", prs);

        if (!isDisposed) {
          updateQuickPickItems(prs, currentPr, branch, behindCounts);
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
        vscode.window.showInformationMessage(`Checked out PR #${pr.number}`);

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

          const lowPriorityPRs = fetchedPRs.filter((pr) =>
            pr.labels?.some((l) => l.name === "priority:low"),
          );

          lowPriQuickPick.items = lowPriorityPRs.map((pr) => {
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
                !i.isCurrentPrOption &&
                !!i.pr &&
                i.kind !== vscode.QuickPickItemKind.Separator &&
                !i.isViewLowPriority,
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
  };
