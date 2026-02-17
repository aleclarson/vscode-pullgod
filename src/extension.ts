import * as vscode from "vscode";
import { AdapterFactory } from "./adapters/factory";
import { PRCache } from "./cache";
import { PullRequest } from "./adapters/types";

const cache = new PRCache();

export function activate(context: vscode.ExtensionContext) {
  console.log("Pullgod is activating...");
  const provider = AdapterFactory.getProvider();

  const disposable = vscode.commands.registerCommand(
    "pullgod.viewPullRequests",
    async () => {
      console.log("Pullgod command triggered");
      const quickPick = vscode.window.createQuickPick<
        vscode.QuickPickItem & { pr: PullRequest }
      >();
      let isDisposed = false;
      quickPick.placeholder = "Search Pull Requests...";
      quickPick.busy = true;
      quickPick.show();

      const fetchPRs = async () => {
        try {
          const prs = await provider.listPullRequests();
          cache.set("github", prs);
          if (!isDisposed) {
            updateQuickPickItems(prs);
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

      const updateQuickPickItems = (prs: PullRequest[]) => {
        quickPick.items = prs.map((pr) => ({
          label: `#${pr.number} ${pr.title}`,
          description: `by ${pr.author} (updated: ${new Date(pr.updatedAt).toLocaleString()})`,
          detail: `${pr.headRefName} -> ${pr.baseRefName}`,
          pr: pr,
        }));
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
