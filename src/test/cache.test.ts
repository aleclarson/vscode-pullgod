import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { PRCache } from "../cache";
import { PullRequest } from "../adapters/types";

suite("PRCache Test Suite", () => {
  let tempDir: string;

  setup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pullgod-test-"));
  });

  teardown(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("should create cache file when setting value", async () => {
    const cache = new PRCache(tempDir);
    const pr: PullRequest = {
      id: "1",
      number: 1,
      title: "Test PR",
      author: "me",
      headRefName: "feature",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      url: "http://example.com",
    };

    await cache.set("test", [pr]);

    const cacheFile = path.join(tempDir, "cache.json");
    assert.strictEqual(fs.existsSync(cacheFile), true);

    const content = fs.readFileSync(cacheFile, "utf-8");
    const json = JSON.parse(content);
    assert.strictEqual(json["test"][0].title, "Test PR");
  });

  test("should load cached value on init", () => {
    const pr: PullRequest = {
      id: "1",
      number: 1,
      title: "Test PR",
      author: "me",
      headRefName: "feature",
      baseRefName: "main",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      url: "http://example.com",
    };

    // Create initial cache file
    const cacheFile = path.join(tempDir, "cache.json");
    fs.writeFileSync(cacheFile, JSON.stringify({ test: [pr] }));

    const cache = new PRCache(tempDir);
    const cached = cache.get("test");

    assert.ok(cached);
    assert.strictEqual(cached![0].title, "Test PR");
  });
});
