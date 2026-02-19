import { PullRequest } from "./adapters/types";

export interface QuickPickItemProps {
  label: string;
  description: string;
  detail: string;
  pr: PullRequest;
}

export function createQuickPickItem(pr: PullRequest): QuickPickItemProps {
  return {
    label: pr.title,
    description: new Date(pr.updatedAt).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit', second: undefined }),
    detail: `(#${pr.number}) By ${pr.author} → "${pr.baseRefName}" branch`,
    pr: pr,
  };
}
