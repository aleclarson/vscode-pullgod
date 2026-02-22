import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { PRCache } from "../cache";
import { PullRequest } from "../adapters/types";

suite("PRCache Test Suite", () => {
  let tempDir: string;
  let workspaceDir: string;

  setup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pullgod-test-global-"));
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "pullgod-test-workspace-"));
  });

  teardown(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  test("should use global cache when no workspace is provided", async () => {
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

    const globalDir = path.join(tempDir, "global");
    const cacheFile = path.join(globalDir, "cache.json");
    assert.strictEqual(fs.existsSync(cacheFile), true, "Global cache file should exist");

    const content = fs.readFileSync(cacheFile, "utf-8");
    const json = JSON.parse(content);
    assert.strictEqual(json.pullRequests["test"][0].title, "Test PR");
  });

  test("should use .git/pullgod/cache.json when .git exists in workspace", async () => {
    const gitDir = path.join(workspaceDir, ".git");
    fs.mkdirSync(gitDir);

    const cache = new PRCache(tempDir, workspaceDir);
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

    const cacheFile = path.join(gitDir, "pullgod", "cache.json");
    assert.strictEqual(fs.existsSync(cacheFile), true, "Cache file should exist in .git/pullgod");
  });

  test("should use hashed workspace path in global storage when .git does not exist", async () => {
    const cache = new PRCache(tempDir, workspaceDir);
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

    const workspaceHash = crypto.createHash("md5").update(workspaceDir).digest("hex");
    const cacheFile = path.join(tempDir, workspaceHash, "cache.json");
    assert.strictEqual(fs.existsSync(cacheFile), true, `Cache file should exist at ${cacheFile}`);
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

    // Simulate global cache setup
    const globalDir = path.join(tempDir, "global");
    fs.mkdirSync(globalDir, { recursive: true });
    const cacheFile = path.join(globalDir, "cache.json");

    const initialData = {
      pullRequests: { test: [pr] },
      checkoutTimes: {},
    };
    fs.writeFileSync(cacheFile, JSON.stringify(initialData));

    const cache = new PRCache(tempDir);
    const cached = cache.get("test");

    assert.ok(cached);
    assert.strictEqual(cached![0].title, "Test PR");
  });
});
