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
    label: pr.title,
    description: timeAgo(pr.updatedAt),
    detail: `(#${pr.number}) By ${pr.author} → "${pr.baseRefName}" branch`,
    pr: pr,
  };
}
