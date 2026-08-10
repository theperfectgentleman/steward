import {
  COMMITTEE_TITLE_LABELS,
  SUPERVISORY_TITLE_LABELS,
  type CommitteeTitle,
  type SupervisoryTitle,
} from "@/lib/types";

export type DirectoryPerson = {
  id: string;
  name: string;
  rolesSummary: string[];
};

export type DirectoryRoleBucket = {
  key: string;
  label: string;
  people: { id: string; name: string }[];
};

export type DirectoryGroup = {
  id: string;
  kind: "supervisory" | "committee";
  name: string;
  roles: DirectoryRoleBucket[];
  members: { id: string; name: string; roleLabel: string }[];
};

export type PeopleDirectory = {
  people: DirectoryPerson[];
  groups: DirectoryGroup[];
  /** Org-wide role shortcuts (All Chairs, Governance Head, …) */
  roleShortcuts: DirectoryRoleBucket[];
};

export function committeeTitleLabel(
  title: CommitteeTitle,
  customTitle?: string | null,
) {
  if (title === "CUSTOM" && customTitle) return customTitle;
  return COMMITTEE_TITLE_LABELS[title] ?? title;
}

export function supervisoryTitleLabel(
  title: SupervisoryTitle,
  customTitle?: string | null,
  isHead?: boolean,
) {
  if (isHead) return "Head";
  if (title === "CUSTOM" && customTitle) return customTitle;
  return SUPERVISORY_TITLE_LABELS[title] ?? title;
}

export function filterDirectoryPeople(
  people: DirectoryPerson[],
  query: string,
  excludeIds: Set<string>,
): DirectoryPerson[] {
  const q = query.trim().toLowerCase();
  return people.filter((p) => {
    if (excludeIds.has(p.id)) return false;
    if (!q) return true;
    if (p.name.toLowerCase().includes(q)) return true;
    return p.rolesSummary.some((r) => r.toLowerCase().includes(q));
  });
}

export function peopleInGroup(
  directory: PeopleDirectory,
  groupId: string,
): { id: string; name: string }[] {
  const group = directory.groups.find((g) => g.id === groupId);
  if (!group) return [];
  return group.members.map((m) => ({ id: m.id, name: m.name }));
}

/** Org shortcut key (e.g. ALL_CHAIRS) or `groupId:roleKey` for a group role. */
export function peopleInRole(
  directory: PeopleDirectory,
  roleKey: string,
  groupId?: string,
): { id: string; name: string }[] {
  if (groupId) {
    const group = directory.groups.find((g) => g.id === groupId);
    const role = group?.roles.find((r) => r.key === roleKey);
    return role?.people.slice() ?? [];
  }
  const shortcut = directory.roleShortcuts.find((r) => r.key === roleKey);
  return shortcut?.people.slice() ?? [];
}
