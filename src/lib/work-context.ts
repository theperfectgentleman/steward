import {
  COMMITTEE_TITLE_LABELS,
  SUPERVISORY_TITLE_LABELS,
  type CommitteeTitle,
  type PermissionUser,
  type SupervisoryTitle,
} from "@/lib/types";

/**
 * Multi-hat card label: `{Group} · {My role there}`
 * Falls back to group name only when the viewer has no role in that group.
 */
export function formatGroupRoleLabel(
  user: PermissionUser | null | undefined,
  committee: { id: string; name: string } | null | undefined,
  opts?: { supervisoryLabel?: string },
): string {
  if (!committee) return "";
  if (!user) return committee.name;

  const membership = user.committeeMemberships.find(
    (m) => m.committeeId === committee.id,
  );
  if (membership) {
    const role =
      membership.customTitle ||
      COMMITTEE_TITLE_LABELS[membership.title as CommitteeTitle] ||
      membership.title;
    return `${committee.name} · ${role}`;
  }

  if (user.supervisoryMembership) {
    const sm = user.supervisoryMembership;
    const role =
      sm.customTitle ||
      SUPERVISORY_TITLE_LABELS[(sm.title as SupervisoryTitle) ?? "MEMBER"] ||
      opts?.supervisoryLabel ||
      "Member";
    return `${committee.name} · ${role}`;
  }

  return committee.name;
}
