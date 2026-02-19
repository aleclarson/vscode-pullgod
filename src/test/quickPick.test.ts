import * as assert from "assert";
import { createQuickPickItem } from "../quickPick";
import { PullRequest } from "../adapters/types";

suite("createQuickPickItem", () => {
  test("should format label with title and handle status", () => {
    const pr: PullRequest = {
      id: "1",
      number: 123,
      title: "Test PR",
      author: "user",
      headRefName: "feature",
      baseRefName: "main",
      updatedAt: "2023-01-01T00:00:00Z",
      url: "http://github.com/owner/repo/pull/123",
      status: "SUCCESS",
    };

    const item = createQuickPickItem(pr);

    assert.strictEqual(item.label, "$(check) Test PR");
    assert.strictEqual(item.pr, pr);
  });

  test("should format label with title (no status)", () => {
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

  test("should include details and handle relative time", () => {
    // Mocking timeAgo behavior by using a fixed relative time logic or ensuring the test environment matches
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
      status: "FAILURE",
    };

    const item = createQuickPickItem(pr);

    assert.strictEqual(item.label, "$(x) Another PR");
    // Assert description is roughly "1 hour ago"
    assert.ok(
      item.description === "1 hour ago" ||
        item.description === "59 minutes ago" ||
        item.description === "60 minutes ago",
    );
    assert.ok(item.detail.includes("(#456)"));
    assert.ok(item.detail.includes("By dev"));
    assert.ok(item.detail.includes("main"));
  });
});
