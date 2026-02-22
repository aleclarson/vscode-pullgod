import { PullRequest } from "./adapters/types";
import { timeAgo } from "./timeAgo";

export interface QuickPickItemProps {
  label: string;
  description: string;
  detail: string;
  pr: PullRequest;
}

export function createQuickPickItem(
  pr: PullRequest,
  commitsBehind?: number,
): QuickPickItemProps {
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

  let description = timeAgo(pr.updatedAt);
  if (commitsBehind && commitsBehind > 0) {
    description = `$(arrow-down) ${commitsBehind} behind • ${description}`;
  }

  return {
    label: `${icon}${pr.title}`,
    description,
    detail: `(#${pr.number}) By ${pr.author} → "${pr.baseRefName}" branch`,
    pr: pr,
  };
}
