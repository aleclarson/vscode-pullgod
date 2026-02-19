import * as assert from "assert";
import { GitHubAdapter } from "../adapters/github";
import { Executor, Workspace } from "../adapters/system";
import { PullRequest } from "../adapters/types";

class MockExecutor implements Executor {
  private responses: Record<string, string> = {};
  private failures: Record<string, string> = {};
  public calls: string[] = [];

  setResponse(command: string, args: string[], output: string) {
    const key = `${command} ${args.join(" ")}`;
    this.responses[key] = output;
  }

  setFailure(command: string, args: string[], error: string) {
    const key = `${command} ${args.join(" ")}`;
    this.failures[key] = error;
  }

  async exec(command: string, args: string[], cwd: string): Promise<string> {
    const key = `${command} ${args.join(" ")}`;
    this.calls.push(key);

    if (this.failures[key] !== undefined) {
      throw new Error(this.failures[key]);
    }
    if (this.responses[key] !== undefined) {
      return this.responses[key];
    }
    // Default mock behavior for setup checks
    if (command === "gh" && args[0] === "--version") {
      return "gh version 2.0.0";
    }
    if (
      command === "git" &&
      args[0] === "rev-parse" &&
      args[1] === "--is-inside-work-tree"
    ) {
      return "true";
    }
    if (command === "git" && args[0] === "remote" && args[1] === "-v") {
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

  test("checkoutPullRequest should not pull if local branch has unpushed commits", async () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "user",
      headRefName: "feature-branch",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
    };

    // 1. Check if local branch exists
    executor.setResponse(
      "git",
      ["rev-parse", "--verify", "feature-branch"],
      "hash",
    );

    // 2. Check upstream
    executor.setResponse(
      "git",
      ["rev-parse", "--abbrev-ref", "feature-branch@{u}"],
      "origin/feature-branch",
    );

    // 3. Check unpushed commits (returns output)
    executor.setResponse(
      "git",
      ["log", "feature-branch@{u}..feature-branch", "--oneline"],
      "deadbeef commit message",
    );

    // 4. Expect git checkout instead of gh pr checkout
    executor.setResponse("git", ["checkout", "feature-branch"], "");

    await adapter.checkoutPullRequest(pr);

    assert.ok(
      executor.calls.includes("git checkout feature-branch"),
      "Should have called git checkout",
    );
    assert.ok(
      !executor.calls.includes("gh pr checkout 123"),
      "Should NOT have called gh pr checkout",
    );
  });

  test("checkoutPullRequest should pull if local branch is clean", async () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "user",
      headRefName: "feature-branch",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
    };

    executor.setResponse(
      "git",
      ["rev-parse", "--verify", "feature-branch"],
      "hash",
    );
    executor.setResponse(
      "git",
      ["rev-parse", "--abbrev-ref", "feature-branch@{u}"],
      "origin/feature-branch",
    );
    // Empty output means clean
    executor.setResponse(
      "git",
      ["log", "feature-branch@{u}..feature-branch", "--oneline"],
      "",
    );

    executor.setResponse("gh", ["pr", "checkout", "123"], "");

    await adapter.checkoutPullRequest(pr);

    assert.ok(
      executor.calls.includes("gh pr checkout 123"),
      "Should have called gh pr checkout",
    );
  });

  test("checkoutPullRequest should pull if local branch does not exist", async () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "user",
      headRefName: "feature-branch",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
    };

    // Branch check fails
    executor.setFailure(
      "git",
      ["rev-parse", "--verify", "feature-branch"],
      "fatal: Needed a single revision",
    );

    executor.setResponse("gh", ["pr", "checkout", "123"], "");

    await adapter.checkoutPullRequest(pr);

    assert.ok(
      executor.calls.includes("gh pr checkout 123"),
      "Should have called gh pr checkout",
    );
  });

  test("checkoutPullRequest should not pull if local branch has no upstream (unpushed)", async () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "user",
      headRefName: "feature-branch",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
    };

    executor.setResponse(
      "git",
      ["rev-parse", "--verify", "feature-branch"],
      "hash",
    );

    // Upstream check fails
    executor.setFailure(
      "git",
      ["rev-parse", "--abbrev-ref", "feature-branch@{u}"],
      "fatal: no upstream configured for branch 'feature-branch'",
    );

    executor.setResponse("git", ["checkout", "feature-branch"], "");

    await adapter.checkoutPullRequest(pr);

    assert.ok(
      executor.calls.includes("git checkout feature-branch"),
      "Should have called git checkout",
    );
    assert.ok(
      !executor.calls.includes("gh pr checkout 123"),
      "Should NOT have called gh pr checkout",
    );
  });

  test("getCurrentPullRequest should return PullRequest object when gh pr view succeeds", async () => {
    executor.setResponse(
      "gh",
      [
        "pr",
        "view",
        "--json",
        "number,title,author,headRefName,baseRefName,updatedAt,url",
      ],
      JSON.stringify({
        number: 123,
        title: "Current PR",
        author: { login: "user" },
        headRefName: "feature",
        baseRefName: "main",
        updatedAt: new Date().toISOString(),
        url: "http://github.com/user/repo/pull/123",
      }),
    );

    const pr = await adapter.getCurrentPullRequest();
    assert.ok(pr);
    assert.strictEqual(pr?.number, 123);
    assert.strictEqual(pr?.title, "Current PR");
    assert.strictEqual(pr?.author, "user");
  });

  test("getCurrentPullRequest should return undefined when gh pr view fails", async () => {
    executor.setFailure(
      "gh",
      [
        "pr",
        "view",
        "--json",
        "number,title,author,headRefName,baseRefName,updatedAt,url",
      ],
      "no pull requests found for this branch",
    );

    const pr = await adapter.getCurrentPullRequest();
    assert.strictEqual(pr, undefined);
  });

  test("listPullRequests should parse statusCheckRollup correctly", async () => {
    const mockOutput = [
      {
        number: 1,
        title: "PR 1",
        author: { login: "user1" },
        headRefName: "feature1",
        baseRefName: "main",
        updatedAt: new Date().toISOString(),
        url: "url1",
        statusCheckRollup: [{ state: "SUCCESS" }, { state: "SUCCESS" }], // Array success
      },
      {
        number: 2,
        title: "PR 2",
        author: { login: "user2" },
        headRefName: "feature2",
        baseRefName: "main",
        updatedAt: new Date().toISOString(),
        url: "url2",
        statusCheckRollup: [{ state: "SUCCESS" }, { state: "FAILURE" }], // Array failure
      },
      {
        number: 3,
        title: "PR 3",
        author: { login: "user3" },
        headRefName: "feature3",
        baseRefName: "main",
        updatedAt: new Date().toISOString(),
        url: "url3",
        statusCheckRollup: { state: "PENDING" }, // Object pending
      },
      {
        number: 4,
        title: "PR 4",
        author: { login: "user4" },
        headRefName: "feature4",
        baseRefName: "main",
        updatedAt: new Date().toISOString(),
        url: "url4",
        statusCheckRollup: [], // Empty array
      },
      {
        number: 5,
        title: "PR 5",
        author: { login: "user5" },
        headRefName: "feature5",
        baseRefName: "main",
        updatedAt: new Date().toISOString(),
        url: "url5",
        statusCheckRollup: null, // Null
      },
    ];

    executor.setResponse(
      "gh",
      [
        "pr",
        "list",
        "--json",
        "number,title,author,headRefName,baseRefName,updatedAt,url,statusCheckRollup",
        "--limit",
        "100",
      ],
      JSON.stringify(mockOutput),
    );

    const prs = await adapter.listPullRequests();

    assert.strictEqual(prs.length, 5);
    // PR 1: SUCCESS (all checks passed)
    assert.strictEqual(prs.find((p) => p.number === 1)?.status, "SUCCESS");
    // PR 2: FAILURE (one check failed)
    assert.strictEqual(prs.find((p) => p.number === 2)?.status, "FAILURE");
    // PR 3: PENDING (rollup state is pending)
    assert.strictEqual(prs.find((p) => p.number === 3)?.status, "PENDING");
    // PR 4: UNKNOWN (empty checks)
    assert.strictEqual(prs.find((p) => p.number === 4)?.status, "UNKNOWN");
    // PR 5: UNKNOWN (no checks)
    assert.strictEqual(prs.find((p) => p.number === 5)?.status, "UNKNOWN");
  });
});
