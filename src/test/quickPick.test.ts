import * as assert from "assert";
import { createQuickPickItem } from "../quickPick";
import { PullRequest } from "../adapters/types";

suite("createQuickPickItem", () => {
  test("should format label with PR number", () => {
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

    assert.strictEqual(item.label, "#123");
    assert.strictEqual(item.pr, pr);
  });

  test("should format description with title, author and time ago", () => {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const pr: PullRequest = {
      id: "2",
      number: 456,
      title: "Another PR",
      author: "dev",
      headRefName: "bugfix",
      baseRefName: "main",
      updatedAt: oneHourAgo,
      url: "http://github.com/owner/repo/pull/456",
    };

    const item = createQuickPickItem(pr);

    // Using partial match because toLocaleString format varies by locale
    assert.ok(item.description.includes("Another PR"));
    assert.ok(item.description.includes("by dev"));
    assert.ok(item.description.includes("1 hour ago"));
    assert.strictEqual(item.detail, "bugfix -> main");
  });
});
