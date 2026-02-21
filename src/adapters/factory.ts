import { GitHubAdapter } from "./github";
import { PullRequestProvider } from "./types";
import { VSCodeAuthenticator } from "./authenticator";

export class AdapterFactory {
  static getProvider(): PullRequestProvider {
    // For now, only GitHub is supported.
    // In the future, this could detect the remote origin and return the correct provider.
    return new GitHubAdapter(undefined, undefined, new VSCodeAuthenticator());
  }
}
