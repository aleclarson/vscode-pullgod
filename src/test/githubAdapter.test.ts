import * as assert from "assert";
import { GitHubAdapter } from "../adapters/github";
import { Executor, Workspace } from "../adapters/system";
import { PullRequest } from "../adapters/types";
import { Authenticator } from "../adapters/authenticator";
import type { Octokit } from "octokit" with { "resolution-mode": "import" };

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
    if (
      command === "git" &&
      args[0] === "rev-parse" &&
      args[1] === "--abbrev-ref" &&
      args[2] === "HEAD"
    ) {
      return "feature-branch";
    }
    throw new Error(`Unexpected command: ${key}`);
  }
}

class MockWorkspace implements Workspace {
  getWorkspaceFolder(): string | undefined {
    return "/mock/workspace";
  }
}

class MockOctokit {
  public graphqlResponse: any = {};
  public restPullsGetResponse: any = {};
  public calls: any[] = [];

  graphql = async (query: string, variables?: any) => {
    this.calls.push({ type: "graphql", query, variables });
    return this.graphqlResponse;
  };

  rest = {
    pulls: {
      get: async (params: any) => {
        this.calls.push({ type: "rest.pulls.get", params });
        if (params.mediaType?.format === "diff") {
          return { data: this.restPullsGetResponse.diff || "" };
        }
        return { data: this.restPullsGetResponse };
      },
    },
  };
}

class MockAuthenticator implements Authenticator {
  public mockOctokit = new MockOctokit();

  async getOctokit(): Promise<Octokit> {
    return this.mockOctokit as unknown as Octokit;
  }
}

suite("GitHubAdapter Unit Test Suite", () => {
  let adapter: GitHubAdapter;
  let executor: MockExecutor;
  let workspace: MockWorkspace;
  let authenticator: MockAuthenticator;

  setup(() => {
    executor = new MockExecutor();
    workspace = new MockWorkspace();
    authenticator = new MockAuthenticator();
    adapter = new GitHubAdapter(executor, workspace, authenticator);
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
      createdAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
    };

    authenticator.mockOctokit.restPullsGetResponse = { diff: "diff content" };

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
      createdAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
    };

    authenticator.mockOctokit.restPullsGetResponse = {
      number: 123,
      title: "Test PR",
      body: "Body",
      user: { login: "user" },
      state: "open",
      html_url: "url",
      created_at: "date",
      updated_at: "date",
      head: { ref: "feature" },
      base: { ref: "main" },
    };

    const view = await adapter.getPullRequestView(pr);
    const parsed = JSON.parse(view);
    assert.strictEqual(parsed.number, 123);
    assert.strictEqual(parsed.title, "Test PR");
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
      createdAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
      headRepository: { url: "url", owner: { login: "user" } }, // Same owner
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

    // 4. Expect git checkout
    executor.setResponse("git", ["checkout", "feature-branch"], "");

    await adapter.checkoutPullRequest(pr);

    assert.ok(
      executor.calls.includes("git checkout feature-branch"),
      "Should have called git checkout",
    );
    // Should verify it returned early (no fetch)
    assert.ok(
      !executor.calls.some((c) => c.startsWith("git fetch")),
      "Should not fetch",
    );
  });

  test("checkoutPullRequest should fetch and pull if local branch is clean", async () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "user",
      headRefName: "feature-branch",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      url: "http://github.com/user/repo/pull/123",
      headRepository: { url: "url", owner: { login: "user" } },
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

    executor.setResponse("git", ["fetch", "origin"], "");
    executor.setResponse("git", ["checkout", "feature-branch"], "");
    executor.setResponse("git", ["pull", "origin", "feature-branch"], "");

    await adapter.checkoutPullRequest(pr);

    assert.ok(
      executor.calls.includes("git fetch origin"),
      "Should fetch origin",
    );
    assert.ok(
      executor.calls.includes("git pull origin feature-branch"),
      "Should pull origin feature-branch",
    );
  });

  test("checkoutPullRequest should handle fork", async () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "otheruser",
      headRefName: "fork-branch",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      url: "http://github.com/otheruser/repo/pull/123",
      headRepository: {
        url: "https://github.com/otheruser/repo",
        owner: { login: "otheruser" },
      },
    };

    // Branch does not exist locally
    executor.setFailure(
      "git",
      ["rev-parse", "--verify", "fork-branch"],
      "fatal: Needed a single revision",
    );

    // Remote list
    executor.setResponse("git", ["remote"], "origin");

    // Expect:
    // 1. git remote add otheruser ...
    // 2. git fetch otheruser
    // 3. git checkout -b fork-branch otheruser/fork-branch

    executor.setResponse(
      "git",
      ["remote", "add", "otheruser", "https://github.com/otheruser/repo"],
      "",
    );
    executor.setResponse("git", ["fetch", "otheruser"], "");
    executor.setResponse(
      "git",
      ["checkout", "-b", "fork-branch", "otheruser/fork-branch"],
      "",
    );

    await adapter.checkoutPullRequest(pr);

    assert.ok(
      executor.calls.includes(
        "git remote add otheruser https://github.com/otheruser/repo",
      ),
      "Should add remote",
    );
    assert.ok(
      executor.calls.includes("git fetch otheruser"),
      "Should fetch remote",
    );
    assert.ok(
      executor.calls.includes(
        "git checkout -b fork-branch otheruser/fork-branch",
      ),
      "Should checkout branch",
    );
  });

  test("getCurrentPullRequest should return PullRequest object when graphql succeeds", async () => {
    authenticator.mockOctokit.graphqlResponse = {
      repository: {
        pullRequests: {
          nodes: [
            {
              number: 123,
              title: "Current PR",
              author: { login: "user" },
              headRefName: "feature-branch",
              baseRefName: "main",
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              url: "http://github.com/user/repo/pull/123",
              headRepository: { url: "url", owner: { login: "user" } },
              mergeable: "MERGEABLE",
              statusCheckRollup: { state: "SUCCESS" },
            },
          ],
        },
      },
    };

    const pr = await adapter.getCurrentPullRequest();
    assert.ok(pr);
    assert.strictEqual(pr?.number, 123);
    assert.strictEqual(pr?.title, "Current PR");
    assert.strictEqual(pr?.status, "SUCCESS");
  });

  test("getCurrentPullRequest should return undefined when graphql returns no nodes", async () => {
    authenticator.mockOctokit.graphqlResponse = {
      repository: {
        pullRequests: {
          nodes: [],
        },
      },
    };

    const pr = await adapter.getCurrentPullRequest();
    assert.strictEqual(pr, undefined);
  });

  test("listPullRequests should parse statusCheckRollup correctly", async () => {
    authenticator.mockOctokit.graphqlResponse = {
      repository: {
        pullRequests: {
          nodes: [
            {
              number: 1,
              title: "PR 1",
              author: { login: "user1" },
              headRefName: "feature1",
              baseRefName: "main",
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              url: "url1",
              statusCheckRollup: { state: "SUCCESS" },
              mergeable: "MERGEABLE",
            },
            {
              number: 2,
              title: "PR 2",
              author: { login: "user2" },
              headRefName: "feature2",
              baseRefName: "main",
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              url: "url2",
              statusCheckRollup: { state: "FAILURE" },
              mergeable: "MERGEABLE",
            },
            {
              number: 3,
              title: "PR 3",
              author: { login: "user3" },
              headRefName: "feature3",
              baseRefName: "main",
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              url: "url3",
              statusCheckRollup: { state: "PENDING" },
              mergeable: "MERGEABLE",
            },
            {
              number: 4,
              title: "PR 4",
              author: { login: "user4" },
              headRefName: "feature4",
              baseRefName: "main",
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              url: "url4",
              statusCheckRollup: null,
              mergeable: "CONFLICTING",
            },
            {
              number: 5,
              title: "PR 5",
              author: { login: "user5" },
              headRefName: "feature5",
              baseRefName: "main",
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              url: "url5",
              statusCheckRollup: null,
              mergeable: "UNKNOWN",
            },
          ],
        },
      },
    };

    const prs = await adapter.listPullRequests();

    assert.strictEqual(prs.length, 5);
    assert.strictEqual(prs.find((p) => p.number === 1)?.status, "SUCCESS");
    assert.strictEqual(prs.find((p) => p.number === 2)?.status, "FAILURE");
    assert.strictEqual(prs.find((p) => p.number === 3)?.status, "PENDING");
    assert.strictEqual(prs.find((p) => p.number === 4)?.status, "UNKNOWN");
    assert.strictEqual(
      prs.find((p) => p.number === 4)?.mergeable,
      "CONFLICTING",
    );
    // PR 5: UNKNOWN (no checks)
    assert.strictEqual(prs.find((p) => p.number === 5)?.status, "UNKNOWN");
  });

  test("getOwnerRepo should handle repo names with dots", async () => {
    executor.setResponse(
      "git",
      ["remote", "-v"],
      "origin\thttps://github.com/user/my.repo.name.git (fetch)\norigin\thttps://github.com/user/my.repo.name.git (push)",
    );

    authenticator.mockOctokit.graphql = async (
      query: string,
      variables?: any,
    ) => {
      assert.strictEqual(variables.owner, "user");
      assert.strictEqual(variables.repo, "my.repo.name");
      return { repository: { pullRequests: { nodes: [] } } };
    };

    await adapter.listPullRequests();
  });

  test("listPullRequests should move low priority PRs to the end", async () => {
    authenticator.mockOctokit.graphqlResponse = {
      repository: {
        pullRequests: {
          nodes: [
            {
              number: 1,
              title: "PR 1 (Low Priority)",
              author: { login: "user1" },
              headRefName: "feature1",
              baseRefName: "main",
              updatedAt: new Date(Date.now() + 10000).toISOString(), // Newer but low priority
              createdAt: new Date(Date.now() + 10000).toISOString(),
              url: "url1",
              statusCheckRollup: null,
              mergeable: "MERGEABLE",
              labels: { nodes: [{ name: "priority:low" }, { name: "bug" }] },
            },
            {
              number: 2,
              title: "PR 2 (Normal)",
              author: { login: "user2" },
              headRefName: "feature2",
              baseRefName: "main",
              updatedAt: new Date(Date.now()).toISOString(), // Older
              createdAt: new Date(Date.now()).toISOString(),
              url: "url2",
              statusCheckRollup: null,
              mergeable: "MERGEABLE",
              labels: { nodes: [{ name: "enhancement" }] },
            },
          ],
        },
      },
    };

    const prs = await adapter.listPullRequests();

    assert.strictEqual(prs.length, 2);
    assert.strictEqual(prs[0].number, 2, "Normal PR should be first");
    assert.strictEqual(prs[1].number, 1, "Low priority PR should be last");
  });

  test("updateCurrentBranchIfClean should pull if clean and behind", async () => {
    // 1. Get current branch
    executor.setResponse(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      "feature-branch",
    );

    // Mock getCurrentPullRequest -> returns a valid PR
    authenticator.mockOctokit.graphqlResponse = {
      repository: {
        pullRequests: {
          nodes: [
            {
              number: 123,
              title: "PR",
              author: { login: "user" },
              headRefName: "feature-branch",
              baseRefName: "main",
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              url: "url",
              headRepository: { url: "url", owner: { login: "user" } },
              statusCheckRollup: { state: "SUCCESS" },
            },
          ],
        },
      },
    };

    // 2. Check status (clean)
    executor.setResponse("git", ["status", "--porcelain"], "");

    // 3. Fetch
    executor.setResponse("git", ["fetch"], "");

    // 4. Check unpushed commits (clean)
    executor.setResponse(
      "git",
      ["rev-parse", "--abbrev-ref", "feature-branch@{u}"],
      "origin/feature-branch",
    );
    executor.setResponse(
      "git",
      ["log", "feature-branch@{u}..feature-branch", "--oneline"],
      "",
    );

    // 5. Check if behind (yes)
    executor.setResponse(
      "git",
      ["log", "HEAD..@{u}", "--oneline"],
      "new commit",
    );

    // 6. Pull
    executor.setResponse("git", ["pull"], "Already up to date.");

    await adapter.updateCurrentBranchIfClean();

    assert.ok(
      executor.calls.includes("git pull"),
      "Should have called git pull",
    );
  });

  test("updateCurrentBranchIfClean should return early if not a PR branch", async () => {
    // 1. Get current branch
    executor.setResponse(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      "feature-branch",
    );

    // 2. Mock getCurrentPullRequest -> returns undefined (no PRs found)
    authenticator.mockOctokit.graphqlResponse = {
      repository: {
        pullRequests: {
          nodes: [],
        },
      },
    };

    // 3. Mock status (clean) - ensuring it would proceed if not for the PR check
    executor.setResponse("git", ["status", "--porcelain"], "");

    // 4. Mock fetch - ensuring it's available to be called
    executor.setResponse("git", ["fetch"], "");

    await adapter.updateCurrentBranchIfClean();

    assert.ok(
      !executor.calls.includes("git fetch"),
      "Should NOT have fetched if no PR",
    );
    assert.ok(
      !executor.calls.includes("git pull"),
      "Should NOT have pulled if no PR",
    );
  });

  test("updateCurrentBranchIfClean should not pull if dirty", async () => {
    // 1. Get current branch
    executor.setResponse(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      "feature-branch",
    );

    // Mock getCurrentPullRequest -> returns a valid PR
    authenticator.mockOctokit.graphqlResponse = {
      repository: {
        pullRequests: {
          nodes: [
            {
              number: 123,
              title: "PR",
              author: { login: "user" },
              headRefName: "feature-branch",
              baseRefName: "main",
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              url: "url",
              headRepository: { url: "url", owner: { login: "user" } },
              statusCheckRollup: { state: "SUCCESS" },
            },
          ],
        },
      },
    };

    // 2. Check status (dirty)
    executor.setResponse("git", ["status", "--porcelain"], "M file.ts");

    await adapter.updateCurrentBranchIfClean();

    assert.ok(!executor.calls.includes("git fetch"), "Should NOT have fetched");
    assert.ok(!executor.calls.includes("git pull"), "Should NOT have pulled");
  });

  test("updateCurrentBranchIfClean should not pull if unpushed commits", async () => {
    // 1. Get current branch
    executor.setResponse(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      "feature-branch",
    );

    // Mock getCurrentPullRequest -> returns a valid PR
    authenticator.mockOctokit.graphqlResponse = {
      repository: {
        pullRequests: {
          nodes: [
            {
              number: 123,
              title: "PR",
              author: { login: "user" },
              headRefName: "feature-branch",
              baseRefName: "main",
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              url: "url",
              headRepository: { url: "url", owner: { login: "user" } },
              statusCheckRollup: { state: "SUCCESS" },
            },
          ],
        },
      },
    };

    // 2. Check status (clean)
    executor.setResponse("git", ["status", "--porcelain"], "");

    // 3. Fetch
    executor.setResponse("git", ["fetch"], "");

    // 4. Check unpushed commits (yes)
    executor.setResponse(
      "git",
      ["rev-parse", "--abbrev-ref", "feature-branch@{u}"],
      "origin/feature-branch",
    );
    executor.setResponse(
      "git",
      ["log", "feature-branch@{u}..feature-branch", "--oneline"],
      "local commit",
    );

    await adapter.updateCurrentBranchIfClean();

    assert.ok(!executor.calls.includes("git pull"), "Should NOT have pulled");
  });

  test("getBranchBehindCounts should parse behind counts correctly", async () => {
    executor.setResponse(
      "git",
      [
        "for-each-ref",
        "--format=%(refname:short)|%(upstream:track)",
        "refs/heads",
      ],
      "feature|[behind 1]\nmain|[ahead 2]\nother|[ahead 1, behind 3]\nclean|\nunknown|[gone]",
    );

    const counts = await adapter.getBranchBehindCounts();

    assert.strictEqual(counts["feature"], 1);
    assert.strictEqual(counts["main"], undefined); // not behind
    assert.strictEqual(counts["other"], 3);
    assert.strictEqual(counts["clean"], undefined);
  });
});
