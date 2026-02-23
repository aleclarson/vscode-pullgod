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
      createdAt: "2023-01-01T00:00:00Z",
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
      createdAt: "2023-01-01T00:00:00Z",
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
      createdAt: oneHourAgo.toISOString(),
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

  test("should show warning icon if conflicting even if CI passed", () => {
    const pr: PullRequest = {
      id: "3",
      number: 789,
      title: "Conflicting PR",
      author: "user",
      headRefName: "conflict",
      baseRefName: "main",
      updatedAt: "2023-01-03T12:00:00Z",
      createdAt: "2023-01-03T12:00:00Z",
      url: "http://github.com/owner/repo/pull/789",
      status: "SUCCESS",
      mergeable: "CONFLICTING",
    };

    const item = createQuickPickItem(pr);

    assert.strictEqual(item.label, "$(warning) Conflicting PR");
  });

  test("should show check icon if mergeable and CI passed", () => {
    const pr: PullRequest = {
      id: "4",
      number: 101,
      title: "Clean PR",
      author: "user",
      headRefName: "clean",
      baseRefName: "main",
      updatedAt: "2023-01-04T12:00:00Z",
      createdAt: "2023-01-04T12:00:00Z",
      url: "http://github.com/owner/repo/pull/101",
      status: "SUCCESS",
      mergeable: "MERGEABLE",
    };

    const item = createQuickPickItem(pr);

    assert.strictEqual(item.label, "$(check) Clean PR");
  });

  test("should NOT append (low priority) to label even if priority:low label exists", () => {
    const pr: PullRequest = {
      id: "5",
      number: 102,
      title: "Low Priority PR",
      author: "user",
      headRefName: "low-pri",
      baseRefName: "main",
      updatedAt: "2023-01-05T12:00:00Z",
      createdAt: "2023-01-05T12:00:00Z",
      url: "http://github.com/owner/repo/pull/102",
      status: "SUCCESS",
      labels: [{ name: "bug" }, { name: "priority:low" }]
    };

    const item = createQuickPickItem(pr);

    assert.strictEqual(item.label, "$(check) Low Priority PR");
  });

  test("should include commits behind in description", () => {
    const pr: PullRequest = {
      id: "6",
      number: 202,
      title: "Behind PR",
      author: "user",
      headRefName: "behind-branch",
      baseRefName: "main",
      updatedAt: "2023-01-05T12:00:00Z",
      url: "http://github.com/owner/repo/pull/202",
      status: "SUCCESS",
    };

    const item = createQuickPickItem(pr, 5);

    assert.strictEqual(item.label, "$(check) Behind PR");
    assert.ok(item.description.startsWith("$(arrow-down) 5 behind •"));
  });
});
