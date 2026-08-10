import { prisma } from "@/lib/prisma";
import {
  committeeTitleLabel,
  supervisoryTitleLabel,
  type DirectoryGroup,
  type DirectoryPerson,
  type DirectoryRoleBucket,
  type PeopleDirectory,
} from "@/lib/people-directory";

export async function getPeopleDirectory(
  organizationId: string,
  options?: { committeeId?: string | null },
): Promise<PeopleDirectory> {
  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
  });
  const supervisoryLabel = settings?.supervisoryLabel ?? "Supervisory Group";

  const committeeFilter = options?.committeeId
    ? { organizationId, id: options.committeeId }
    : { organizationId };

  const [memberships, committees, supervisoryGroups] = await Promise.all([
    prisma.organizationMembership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            committeeMemberships: {
              where: { committee: { organizationId } },
              include: { committee: { select: { id: true, name: true } } },
            },
            supervisoryMemberships: {
              where: { group: { organizationId } },
              include: { group: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.committee.findMany({
      where: committeeFilter,
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    options?.committeeId
      ? Promise.resolve([])
      : prisma.supervisoryGroup.findMany({
          where: { organizationId },
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { name: "asc" },
        }),
  ]);

  const people: DirectoryPerson[] = memberships.map((m) => {
    const rolesSummary: string[] = [];
    if (m.role === "ORG_ADMIN") rolesSummary.push("Org Admin");
    if (m.role === "ORG_TECH") rolesSummary.push("Org Tech");

    for (const s of m.user.supervisoryMemberships) {
      const title = supervisoryTitleLabel(s.title, s.customTitle, s.isHead);
      const label = `${supervisoryLabel} · ${title}`;
      if (!rolesSummary.includes(label)) rolesSummary.push(label);
    }
    for (const c of m.user.committeeMemberships) {
      if (options?.committeeId && c.committeeId !== options.committeeId) continue;
      const title = committeeTitleLabel(c.title, c.customTitle);
      const label = `${c.committee.name} · ${title}`;
      if (!rolesSummary.includes(label)) rolesSummary.push(label);
    }
    if (rolesSummary.length === 0) rolesSummary.push("Member");

    return {
      id: m.user.id,
      name: m.user.name,
      rolesSummary,
    };
  });

  const groups: DirectoryGroup[] = [];

  for (const g of supervisoryGroups) {
    const roleMap = new Map<string, DirectoryRoleBucket>();
    const members: DirectoryGroup["members"] = [];

    for (const m of g.members) {
      const roleLabel = supervisoryTitleLabel(m.title, m.customTitle, m.isHead);
      const key = m.isHead ? "HEAD" : m.title;
      members.push({ id: m.user.id, name: m.user.name, roleLabel });
      const existing = roleMap.get(key) ?? {
        key,
        label: roleLabel,
        people: [],
      };
      if (!existing.people.some((p) => p.id === m.user.id)) {
        existing.people.push({ id: m.user.id, name: m.user.name });
      }
      roleMap.set(key, existing);
    }

    groups.push({
      id: g.id,
      kind: "supervisory",
      name: g.name || supervisoryLabel,
      roles: Array.from(roleMap.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
      members: members.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  for (const c of committees) {
    const roleMap = new Map<string, DirectoryRoleBucket>();
    const members: DirectoryGroup["members"] = [];

    for (const m of c.members) {
      const roleLabel = committeeTitleLabel(m.title, m.customTitle);
      members.push({ id: m.user.id, name: m.user.name, roleLabel });
      const existing = roleMap.get(m.title) ?? {
        key: m.title,
        label: roleLabel,
        people: [],
      };
      if (!existing.people.some((p) => p.id === m.user.id)) {
        existing.people.push({ id: m.user.id, name: m.user.name });
      }
      roleMap.set(m.title, existing);
    }

    groups.push({
      id: c.id,
      kind: "committee",
      name: c.name,
      roles: Array.from(roleMap.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
      members: members.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  const shortcutMap = new Map<string, DirectoryRoleBucket>();

  const addShortcut = (
    key: string,
    label: string,
    person: { id: string; name: string },
  ) => {
    const existing = shortcutMap.get(key) ?? { key, label, people: [] };
    if (!existing.people.some((p) => p.id === person.id)) {
      existing.people.push(person);
    }
    shortcutMap.set(key, existing);
  };

  for (const g of groups) {
    if (g.kind === "committee") {
      for (const role of g.roles) {
        if (role.key === "CHAIR") {
          for (const p of role.people) addShortcut("ALL_CHAIRS", "All Chairs", p);
        } else if (role.key === "SECRETARY") {
          for (const p of role.people)
            addShortcut("ALL_SECRETARIES", "All Secretaries", p);
        } else if (role.key === "DEPUTY") {
          for (const p of role.people)
            addShortcut("ALL_DEPUTIES", "All Deputies", p);
        }
      }
    } else {
      for (const role of g.roles) {
        const label =
          role.key === "HEAD"
            ? `${supervisoryLabel} Head`
            : role.key === "SECRETARY"
              ? `${supervisoryLabel} Secretary`
              : `${supervisoryLabel} · ${role.label}`;
        for (const p of role.people) {
          addShortcut(`GOV_${role.key}`, label, p);
        }
      }
    }
  }

  const roleShortcuts = Array.from(shortcutMap.values())
    .filter((r) => r.people.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  const scopedPeople = options?.committeeId
    ? people.filter((p) =>
        groups.some((g) => g.members.some((m) => m.id === p.id)),
      )
    : people;

  return {
    people: scopedPeople,
    groups,
    roleShortcuts,
  };
}
