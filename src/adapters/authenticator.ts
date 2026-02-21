import * as vscode from "vscode";
// We use 'any' for Octokit return type to avoid complex type import issues
// with ESM-only package in CommonJS environment, or we could use import type.
// For now, let's try to keep it simple.

export interface Authenticator {
  getOctokit(): Promise<any>;
}

export class VSCodeAuthenticator implements Authenticator {
  async getOctokit(): Promise<any> {
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
