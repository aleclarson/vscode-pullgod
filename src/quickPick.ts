import { PullRequest } from "./adapters/types";
import { timeAgo } from "./timeAgo";

export interface QuickPickItemProps {
  label: string;
  description: string;
  detail: string;
  pr: PullRequest;
}

export function createQuickPickItem(pr: PullRequest): QuickPickItemProps {
  let icon = "";
  if (pr.mergeable === "CONFLICTING") {
    icon = "$(warning) ";
  } else {
    switch (pr.status) {
      case "SUCCESS":
        icon = "$(check) ";
        break;
      case "FAILURE":
        icon = "$(x) ";
        break;
      case "PENDING":
        icon = "$(circle-filled) ";
        break;
    }
  }

  let label = `${icon}${pr.title}`;
  if (pr.labels?.some((l) => l.name === "priority:low")) {
    label += " (low priority)";
  }

  return {
    label,
    description: timeAgo(pr.updatedAt),
    detail: `(#${pr.number}) By ${pr.author} → "${pr.baseRefName}" branch`,
    pr: pr,
  };
}
