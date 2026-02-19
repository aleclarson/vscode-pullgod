import { PullRequest } from "./adapters/types";
import { timeAgo } from "./timeAgo";

export interface QuickPickItemProps {
  label: string;
  description: string;
  detail: string;
  pr: PullRequest;
}

export function createQuickPickItem(pr: PullRequest): QuickPickItemProps {
  return {
    label: `#${pr.number}`,
    description: `${pr.title} by ${pr.author} ${timeAgo(pr.updatedAt)}`,
    detail: `${pr.headRefName} -> ${pr.baseRefName}`,
    pr: pr,
  };
}
