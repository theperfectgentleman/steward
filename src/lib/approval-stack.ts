import type {
  ApprovalStackStep,
  PermissionUser,
} from "@/lib/types";
import {
  getCommitteeTitle,
  isOrgAdmin,
  isSupervisoryHead,
  isSupervisorySecretary,
  canOptionallyApprove,
} from "@/lib/types";

/** Whether the user may act on the current approval stack step. */
export function canActOnApprovalStep(
  user: PermissionUser,
  step: ApprovalStackStep | undefined,
  committeeId?: string | null,
): boolean {
  if (!step) return false;
  if (isOrgAdmin(user)) return true;
  if (canOptionallyApprove(user)) return true;

  switch (step.role) {
    case "COMMITTEE_CHAIR":
      return committeeId
        ? getCommitteeTitle(user, committeeId) === "CHAIR"
        : false;
    case "COMMITTEE_SECRETARY":
      return committeeId
        ? getCommitteeTitle(user, committeeId) === "SECRETARY"
        : false;
    case "SUPERVISORY_SECRETARY":
      return isSupervisorySecretary(user);
    case "SUPERVISORY_HEAD":
      return isSupervisoryHead(user);
    case "SUPERVISORY_TITLE":
      return (
        user.supervisoryMembership?.title === "CUSTOM" ||
        user.supervisoryMembership != null
      );
    default:
      return false;
  }
}

export function currentApprovalStep(
  stack: ApprovalStackStep[],
  stepIndex: number,
): ApprovalStackStep | undefined {
  const sorted = [...stack].sort((a, b) => a.order - b.order);
  return sorted[stepIndex];
}

export function isApprovalStackComplete(
  stack: ApprovalStackStep[],
  stepIndex: number,
): boolean {
  return stack.length === 0 || stepIndex >= stack.length;
}
