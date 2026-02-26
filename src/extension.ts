import * as vscode from "vscode";
import { AdapterFactory } from "./adapters/factory";
import { PRCache } from "./cache";
import { openInBrowser } from "./commands/openInBrowser";
import { copyPRSummary } from "./commands/copyPRSummary";
import { viewPullRequests } from "./commands/viewPullRequests";
import { updatePriorities } from "./commands/updatePriorities";
import { replyToPR } from "./commands/replyToPR";
import { closePR } from "./commands/closePR";
import { ReplyViewProvider } from "./providers/replyViewProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("Pullgod is activating...");
  const outputChannel = vscode.window.createOutputChannel("Pullgod");
  context.subscriptions.push(outputChannel);

  const storagePath = context.globalStorageUri.fsPath;
  const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  const cache = new PRCache(storagePath, workspacePath);
  const provider = AdapterFactory.getProvider();

  const replyViewProvider = new ReplyViewProvider(
    context.extensionUri,
    provider,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "pullgod.replyView",
      replyViewProvider,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pullgod.openInBrowser",
      openInBrowser(provider),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pullgod.copyPRSummary",
      copyPRSummary(provider),
    ),
  );

  const refreshPRs = async () => {
    try {
      const prs = await provider.listPullRequests();
      await cache.set("github", prs);
    } catch (error) {
      console.error("Failed to refresh PRs:", error);
    }
  };

  const interval = setInterval(() => {
    provider.updateCurrentBranchIfClean().catch((error) => {
      console.error("Failed to update branch:", error);
    });
    refreshPRs();
  }, 60000); // Check every minute

  context.subscriptions.push({
    dispose: () => clearInterval(interval),
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pullgod.viewPullRequests",
      viewPullRequests(provider, cache, outputChannel),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pullgod.updatePriorities",
      updatePriorities(provider),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "pullgod.replyToPR",
      replyToPR(provider, replyViewProvider),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("pullgod.closePR", closePR(provider)),
  );
}

export function deactivate() {}
