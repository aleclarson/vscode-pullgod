import * as assert from "assert";
import { createQuickPickItem } from "../quickPick";
import { PullRequest } from "../adapters/types";

suite("createQuickPickItem", () => {
  test("should format label with PR title", () => {
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

  test("should format detail with number and author", () => {
    const pr: PullRequest = {
      id: "2",
      number: 456,
      title: "Another PR",
      author: "dev",
      headRefName: "bugfix",
      baseRefName: "main",
      updatedAt: "2023-01-02T12:00:00Z",
      url: "http://github.com/owner/repo/pull/456",
    };

    const item = createQuickPickItem(pr);

    // Detail format: (#456) By dev → "main" branch
    assert.ok(item.detail.includes("(#456)"));
    assert.ok(item.detail.includes("By dev"));
    assert.ok(item.detail.includes('"main" branch'));
  });
});
