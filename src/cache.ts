import * as fs from "fs";
import * as path from "path";
import { PullRequest } from "./adapters/types";

interface CacheData {
  pullRequests: Map<string, PullRequest[]>;
  checkoutTimes: Record<string, number>;
}

export class PRCache {
  private cache: CacheData = {
    pullRequests: new Map(),
    checkoutTimes: {},
  };
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    this.load();
  }

  private load() {
    const filePath = path.join(this.storagePath, "cache.json");
    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, "utf-8");
        const json = JSON.parse(data);
        if (json.pullRequests) {
          for (const key in json.pullRequests) {
            this.cache.pullRequests.set(key, json.pullRequests[key]);
          }
        }
        if (json.checkoutTimes) {
          this.cache.checkoutTimes = json.checkoutTimes;
        }
      } catch (error) {
        console.error(`Failed to load cache from ${filePath}:`, error);
      }
    }
  }

  get(key: string): PullRequest[] | undefined {
    return this.cache.pullRequests.get(key);
  }

  async set(key: string, value: PullRequest[]): Promise<void> {
    this.cache.pullRequests.set(key, value);
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
      const filePath = path.join(this.storagePath, "cache.json");
      const obj: any = {
        pullRequests: {},
        checkoutTimes: this.cache.checkoutTimes,
      };

      this.cache.pullRequests.forEach((value, key) => {
        obj.pullRequests[key] = value;
      });

      fs.writeFile(filePath, JSON.stringify(obj), (err) => {
        if (err) {
          console.error(`Failed to save cache to ${filePath}:`, err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
