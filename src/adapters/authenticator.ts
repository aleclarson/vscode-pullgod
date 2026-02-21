import * as vscode from "vscode";
import type { Octokit } from "octokit" with { "resolution-mode": "import" };

export interface Authenticator {
  getOctokit(): Promise<Octokit>;
}

export class VSCodeAuthenticator implements Authenticator {
  async getOctokit(): Promise<Octokit> {
    const session = await vscode.authentication.getSession(
      "github",
      ["repo", "read:user"],
      { createIfNone: true },
    );

    // Dynamic import is required because 'octokit' is an ESM-only package
    // and this extension is compiled to CommonJS.
    const { Octokit } = await import("octokit");

    return new Octokit({
      auth: session.accessToken,
    });
  }
}
