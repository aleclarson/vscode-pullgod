import * as vscode from "vscode";
import { PullRequestProvider, PullRequest } from "../adapters/types";
import { createQuickPickItem } from "../quickPick";

export const updatePriorities = (provider: PullRequestProvider) => async () => {
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
};
