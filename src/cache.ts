import * as fs from "fs";
import * as path from "path";
import { PullRequest } from "./adapters/types";

export class PRCache {
  private cache: Map<string, any> = new Map();
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
        for (const key in json) {
          this.cache.set(key, json[key]);
        }
      } catch (error) {
        console.error(`Failed to load cache from ${filePath}:`, error);
      }
    }
  }

  get(key: string): PullRequest[] | undefined {
    return this.cache.get(key);
  }

  async set(key: string, value: PullRequest[]): Promise<void> {
    this.cache.set(key, value);
    await this.save();
  }

  async setLastCheckedOut(prNumber: number, timestamp: number): Promise<void> {
    const checkoutTimes = this.cache.get("checkoutTimes") || {};
    checkoutTimes[prNumber] = timestamp;
    this.cache.set("checkoutTimes", checkoutTimes);
    await this.save();
  }

  getLastCheckedOut(prNumber: number): number | undefined {
    const checkoutTimes = this.cache.get("checkoutTimes");
    return checkoutTimes ? checkoutTimes[prNumber] : undefined;
  }

  private save(): Promise<void> {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.storagePath, "cache.json");
      const obj: Record<string, any> = {};
      this.cache.forEach((value, key) => {
        obj[key] = value;
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
