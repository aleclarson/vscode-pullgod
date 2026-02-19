export interface PullRequest {
  id: string;
  number: number;
  title: string;
  author: string;
  headRefName: string;
  baseRefName: string;
  updatedAt: string;
  url: string;
  status?: string;
}

export interface PullRequestProvider {
  listPullRequests(): Promise<PullRequest[]>;
  checkoutPullRequest(pr: PullRequest): Promise<void>;
  getPullRequestDiff(pr: PullRequest): Promise<string>;
  getPullRequestView(pr: PullRequest): Promise<string>;
  openPullRequestOnWeb(pr?: PullRequest): Promise<void>;
  getCurrentPullRequest(): Promise<PullRequest | undefined>;
}
