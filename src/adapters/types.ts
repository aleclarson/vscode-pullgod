export interface PullRequest {
  id: string;
  number: number;
  title: string;
  author: string;
  headRefName: string;
  baseRefName: string;
  updatedAt: string;
  createdAt: string;
  url: string;
  status?: string;
  mergeable?: string;
  headRepository?: { url: string; owner: { login: string } };
  labels?: { name: string }[];
}

export interface PullRequestProvider {
  listPullRequests(ownerRepo?: { owner: string; repo: string }): Promise<PullRequest[]>;
  getRemotes(): Promise<{ name: string; owner: string; repo: string }[]>;
  checkoutPullRequest(pr: PullRequest): Promise<void>;
  getPullRequestDiff(pr: PullRequest): Promise<string>;
  getPullRequestView(pr: PullRequest): Promise<string>;
  openPullRequestOnWeb(pr?: PullRequest): Promise<void>;
  getCurrentPullRequest(): Promise<PullRequest | undefined>;
  getCurrentBranch(): Promise<string>;
  updateCurrentBranchIfClean(): Promise<void>;
  ensureLabelExists(
    label: string,
    color: string,
    description: string,
  ): Promise<void>;
  addLabel(pr: PullRequest, label: string): Promise<void>;
  removeLabel(pr: PullRequest, label: string): Promise<void>;
  postComment(pr: PullRequest, body: string): Promise<void>;
  closePullRequest(pr: PullRequest): Promise<void>;
  getBranchBehindCounts(): Promise<Record<string, number>>;
}
