import * as vscode from "vscode";
import { PullRequestProvider } from "../adapters/types";

export const openInBrowser = (provider: PullRequestProvider) => async () => {
  try {
    const pr = await provider.getCurrentPullRequest();
    await provider.openPullRequestOnWeb(pr);
  } catch (error) {
    vscode.window.showErrorMessage(`Error opening PR on GitHub: ${error}`);
  }
};
