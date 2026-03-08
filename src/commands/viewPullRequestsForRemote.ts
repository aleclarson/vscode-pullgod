import * as vscode from "vscode";
import { PullRequestProvider } from "../adapters/types";
import { PRCache } from "../cache";
import { viewPullRequests } from "./viewPullRequests";

export const viewPullRequestsForRemote =
  (
    provider: PullRequestProvider,
    cache: PRCache,
    outputChannel: vscode.OutputChannel,
  ) =>
  async () => {
    const remotes = await provider.getRemotes();
    if (remotes.length === 0) {
      vscode.window.showInformationMessage("No GitHub remotes found.");
      return;
    }

    const remoteQuickPick = vscode.window.createQuickPick<
      vscode.QuickPickItem & {
        remote: { name: string; owner: string; repo: string };
      }
    >();
    remoteQuickPick.placeholder = "Select a remote to view its Pull Requests";

    remoteQuickPick.items = remotes.map((r) => ({
      label: `$(repo) ${r.name}`,
      description: `${r.owner}/${r.repo}`,
      remote: r,
    }));

    remoteQuickPick.show();

    remoteQuickPick.onDidAccept(async () => {
      const selected = remoteQuickPick.selectedItems[0];
      if (selected) {
        remoteQuickPick.hide();
        // Forward the chosen remote to the viewPullRequests logic
        const viewCommand = viewPullRequests(provider, cache, outputChannel);
        await viewCommand(selected.remote);
      }
    });

    remoteQuickPick.onDidHide(() => {
      remoteQuickPick.dispose();
    });
  };
