import * as vscode from "vscode";
import { AdapterFactory } from "./adapters/factory";
import { PRCache } from "./cache";
import { PullRequest } from "./adapters/types";
import { DiffContentProvider } from "./providers/diffContentProvider";

const cache = new PRCache();

export function activate(context: vscode.ExtensionContext) {
  console.log("Pullgod is activating...");
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

            try {
              const uri = vscode.Uri.from({
                scheme: "pullgod-pr",
                path: `PR-${selected.pr.number}.diff`,
                query: `number=${selected.pr.number}`,
              });
              const doc = await vscode.workspace.openTextDocument(uri);
              await vscode.languages.setTextDocumentLanguage(doc, "diff");
              await vscode.window.showTextDocument(doc, { preview: true });
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
