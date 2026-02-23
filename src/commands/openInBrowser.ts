import * as vscode from "vscode";
import { PullRequest, PullRequestProvider } from "../adapters/types";

export const openInBrowser = (provider: PullRequestProvider) => async (uri?: vscode.Uri) => {
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
};
