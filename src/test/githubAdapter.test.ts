import * as assert from "assert";
import { GitHubAdapter } from "../adapters/github";
import { Executor, Workspace } from "../adapters/system";
import { PullRequest } from "../adapters/types";

class MockExecutor implements Executor {
  private responses: Record<string, string> = {};

  setResponse(command: string, args: string[], output: string) {
    const key = `${command} ${args.join(" ")}`;
    this.responses[key] = output;
  }

  async exec(command: string, args: string[], cwd: string): Promise<string> {
    const key = `${command} ${args.join(" ")}`;
    if (this.responses[key] !== undefined) {
      return this.responses[key];
    }
    // Default mock behavior for setup checks
    if (command === "gh" && args[0] === "--version") {
      return "gh version 2.0.0";
    }
    if (command === "git" && args[0] === "rev-parse") {
      return "true";
    }
    if (command === "git" && args[0] === "remote") {
      return "origin\thttps://github.com/user/repo.git (fetch)\norigin\thttps://github.com/user/repo.git (push)";
    }
    throw new Error(`Unexpected command: ${key}`);
  }
}

class MockWorkspace implements Workspace {
  getWorkspaceFolder(): string | undefined {
    return "/mock/workspace";
  }
}

suite("GitHubAdapter Unit Test Suite", () => {
  let adapter: GitHubAdapter;
  let executor: MockExecutor;
  let workspace: MockWorkspace;

  setup(() => {
    executor = new MockExecutor();
    workspace = new MockWorkspace();
    adapter = new GitHubAdapter(executor, workspace);
  });

  test("getPullRequestDiff should return diff output", async () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "user",
      headRefName: "feature",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
    };

    executor.setResponse("gh", ["pr", "diff", "123"], "diff content");

    const diff = await adapter.getPullRequestDiff(pr);
    assert.strictEqual(diff, "diff content");
  });

  test("getPullRequestView should return view output", async () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "user",
      headRefName: "feature",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
    };

    executor.setResponse(
      "gh",
      [
        "pr",
        "view",
        "123",
        "--json",
        "number,title,body,author,state,url,createdAt,updatedAt,headRefName,baseRefName",
      ],
      '{"number":123,"title":"Test PR"}',
    );

    const view = await adapter.getPullRequestView(pr);
    assert.strictEqual(view, '{"number":123,"title":"Test PR"}');
  });

  test("openPullRequestOnWeb should run gh pr view --web", async () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "user",
      headRefName: "feature",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
    };

    executor.setResponse("gh", ["pr", "view", "123", "--web"], "");

    await adapter.openPullRequestOnWeb(pr);
    // If no error is thrown, the test passes (mock executor would throw if command mismatch)
  });

  test("openPullRequestOnWeb should run gh pr view --web without PR number", async () => {
    executor.setResponse("gh", ["pr", "view", "--web"], "");

    await adapter.openPullRequestOnWeb();
    // Success if no exception
  });
});
