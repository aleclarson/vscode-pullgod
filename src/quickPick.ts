import { PullRequest } from "./adapters/types";

export interface QuickPickItemProps {
  label: string;
  description: string;
  detail: string;
  pr: PullRequest;
}

export function createQuickPickItem(pr: PullRequest): QuickPickItemProps {
  return {
    label: `#${pr.number}`,
    description: `${pr.title} by ${pr.author} (updated: ${new Date(pr.updatedAt).toLocaleString()})`,
    detail: `${pr.headRefName} -> ${pr.baseRefName}`,
    pr: pr,
  };
}
