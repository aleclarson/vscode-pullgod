import * as assert from "assert";
import { createQuickPickItem } from "../quickPick";
import { PullRequest } from "../adapters/types";

suite("createQuickPickItem", () => {
  test("should format label with the PR title", () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "user",
      headRefName: "feature",
      baseRefName: "main",
      updatedAt: "2023-01-01T00:00:00Z",
      url: "http://github.com/owner/repo/pull/123",
    };

    const item = createQuickPickItem(pr);

    assert.strictEqual(item.label, "Test PR");
    assert.strictEqual(item.pr, pr);
  });

  test("should format description with time ago", () => {
    // Mocking timeAgo behavior by using a fixed relative time logic or ensuring the test environment matches
    // Since we can't easily mock timeAgo import without dependency injection or module mocking tools which might be complex here,
    // we will rely on the fact that timeAgo is deterministic for a given input relative to 'now'.

    // However, to make the test robust, let's just check if it returns a string that looks like time ago
    // or use a specific recent time.

    const oneHourAgo = new Date(Date.now() - 3600000);
    const pr: PullRequest = {
      id: "2",
      number: 456,
      title: "Another PR",
      author: "dev",
      headRefName: "bugfix",
      baseRefName: "main",
      updatedAt: oneHourAgo.toISOString(),
      url: "http://github.com/owner/repo/pull/456",
    };

    const item = createQuickPickItem(pr);

    // Assert description is roughly "1 hour ago"
    // Allowing for small timing differences in test execution
    assert.ok(item.description === "1 hour ago" || item.description === "59 minutes ago" || item.description === "60 minutes ago");

    // Check detail format as per original implementation
    assert.strictEqual(item.detail, `(#456) By dev → "main" branch`);
  });
});
