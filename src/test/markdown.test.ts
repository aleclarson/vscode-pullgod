import * as assert from "assert";
import { generatePRMarkdown } from "../markdown";

suite("Markdown Generation Test Suite", () => {
  test("generatePRMarkdown formats correctly", () => {
    const prData = {
      number: 123,
      title: "Test PR",
      author: { login: "testuser" },
      baseRefName: "main",
      headRefName: "feature-branch",
      state: "OPEN",
      url: "https://github.com/owner/repo/pull/123",
      body: "This is a test PR body.",
    };
    const diff = "diff content here";

    const expected = [
      "# #123 Test PR",
      "**testuser** wants to merge into `main` from `feature-branch`",
      "State: **OPEN** | [View on GitHub](https://github.com/owner/repo/pull/123)",
      "",
      "This is a test PR body.",
      "",
      "## Diff",
      "```diff",
      "diff content here",
      "```",
    ].join("\n");

    const result = generatePRMarkdown(prData, diff);
    assert.strictEqual(result, expected);
  });
});
