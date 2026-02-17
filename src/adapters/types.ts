export interface PullRequest {
  id: string;
  number: number;
  title: string;
  author: string;
  headRefName: string;
  baseRefName: string;
  updatedAt: string;
  url: string;
}

export interface PullRequestProvider {
  listPullRequests(): Promise<PullRequest[]>;
  checkoutPullRequest(pr: PullRequest): Promise<void>;
}
