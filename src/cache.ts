import { PullRequest } from './adapters/types';

export class PRCache {
  private cache: Map<string, PullRequest[]> = new Map();

  get(key: string): PullRequest[] | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: PullRequest[]): void {
    this.cache.set(key, value);
  }
}
