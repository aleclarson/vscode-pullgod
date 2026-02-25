import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PullRequest } from "./adapters/types";

interface CacheData {
  pullRequests: Record<string, PullRequest[]>;
  checkoutTimes: Record<string, number>;
}

export class PRCache {
  private cache: CacheData = {
    pullRequests: {},
    checkoutTimes: {},
  };
  private cacheFilePath: string;

  constructor(globalStoragePath: string, workspacePath?: string) {
    this.cacheFilePath = this.determineCachePath(
      globalStoragePath,
      workspacePath,
    );
    this.load();
  }

  private determineCachePath(
    globalStoragePath: string,
    workspacePath?: string,
  ): string {
    // If no workspace path, use global storage (fallback)
    if (!workspacePath) {
      const globalDir = path.join(globalStoragePath, "global");
      if (!fs.existsSync(globalDir)) {
        fs.mkdirSync(globalDir, { recursive: true });
      }
      return path.join(globalDir, "cache.json");
    }

    // Check for .git folder in workspace root
    const gitPath = path.join(workspacePath, ".git");
    if (fs.existsSync(gitPath) && fs.statSync(gitPath).isDirectory()) {
      const gitCacheDir = path.join(gitPath, "pullgod");
      if (!fs.existsSync(gitCacheDir)) {
        fs.mkdirSync(gitCacheDir, { recursive: true });
      }
      return path.join(gitCacheDir, "cache.json");
    }

    // Fallback: Use hashed workspace path in global storage
    const workspaceHash = crypto
      .createHash("md5")
      .update(workspacePath)
      .digest("hex");
    const workspaceCacheDir = path.join(globalStoragePath, workspaceHash);
    if (!fs.existsSync(workspaceCacheDir)) {
      fs.mkdirSync(workspaceCacheDir, { recursive: true });
    }
    return path.join(workspaceCacheDir, "cache.json");
  }

  private load() {
    if (fs.existsSync(this.cacheFilePath)) {
      try {
        const data = fs.readFileSync(this.cacheFilePath, "utf-8");
        const json = JSON.parse(data);
        if (json.pullRequests) {
          this.cache.pullRequests = json.pullRequests;
        }
        if (json.checkoutTimes) {
          this.cache.checkoutTimes = json.checkoutTimes;
        }
      } catch (error) {
        console.error(
          `Failed to load cache from ${this.cacheFilePath}:`,
          error,
        );
      }
    }
  }

  get(key: string): PullRequest[] | undefined {
    return this.cache.pullRequests[key];
  }

  async set(key: string, value: PullRequest[]): Promise<void> {
    this.cache.pullRequests[key] = value;
    await this.save();
  }

  async setLastCheckedOut(prNumber: number, timestamp: number): Promise<void> {
    this.cache.checkoutTimes[prNumber] = timestamp;
    await this.save();
  }

  getLastCheckedOut(prNumber: number): number | undefined {
    return this.cache.checkoutTimes[prNumber];
  }

  private save(): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(this.cacheFilePath, JSON.stringify(this.cache), (err) => {
        if (err) {
          console.error(`Failed to save cache to ${this.cacheFilePath}:`, err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
