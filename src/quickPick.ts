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
    icon = "$(x) ";
  } else if (pr.mergeStateStatus === "BEHIND") {
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

  return {
    label: `${icon}${pr.title}`,
    description: timeAgo(pr.updatedAt),
    detail: `(#${pr.number}) By ${pr.author} → "${pr.baseRefName}" branch`,
    pr: pr,
  };
}
