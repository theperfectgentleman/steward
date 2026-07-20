import type { SessionUser } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  canManageUsers,
  canReviewReport,
  canCreateSupervisoryAssignment,
  canViewAllCommittees,
  isOrgAdmin,
  isOrgTech,
  isSupervisoryMember,
} from "@/lib/types";
import { committeePath } from "@/lib/navigation";
import type { CommitteeRef } from "@/lib/navigation";

export type NavLink = {
  key: string;
  label: string;
  href: string;
  icon:
    | "home"
    | "inbox"
    | "assignments"
    | "tasks"
    | "projects"
    | "schedule"
    | "minutes"
    | "reports"
    | "reportInbox"
    | "documents"
    | "messages"
    | "myWork"
    | "admin"
    | "structure"
    | "rbac"
    | "assign"
    | "committee";
};

export type NavCommitteeNode = {
  id: string;
  name: string;
  children: NavLink[];
};

export type NavModel = {
  top: NavLink[];
  committees: NavCommitteeNode[];
  governance: NavLink[];
  admin: NavLink[];
  /** Mobile dock (max 5), last may be "more" */
  mobileDock: (NavLink | { key: "more"; label: "More" })[];
  /** Items only reachable via More on mobile */
  mobileMore: NavLink[];
  flags: {
    showCommittees: boolean;
    showGovernance: boolean;
    showAdmin: boolean;
    canSeeAllCommittees: boolean;
  };
};

const COMMITTEE_SECTIONS = [
  { key: "overview", label: "Overview", section: undefined },
  { key: "tasks", label: "Board", section: "tasks" as const },
  { key: "projects", label: "Projects", section: "projects" as const },
  { key: "assignments", label: "Assignments", section: "assignments" as const },
  { key: "schedule", label: "Schedule", section: "schedule" as const },
  { key: "documents", label: "Documents", section: "documents" as const },
] as const;

function committeeChildren(committeeId: string): NavLink[] {
  return COMMITTEE_SECTIONS.map((s) => ({
    key: `${committeeId}-${s.key}`,
    label: s.label,
    href: s.section
      ? committeePath(committeeId, s.section)
      : committeePath(committeeId),
    icon:
      s.key === "tasks"
        ? "tasks"
        : s.key === "projects"
          ? "projects"
          : s.key === "assignments"
            ? "inbox"
            : s.key === "schedule"
              ? "schedule"
              : s.key === "documents"
                ? "documents"
                : "committee",
  }));
}

export function buildNavModel(
  user: SessionUser,
  committees: CommitteeRef[],
  activeCommitteeId: string | null,
): NavModel {
  const perm = toPermissionUser(user);
  const supervisory = isSupervisoryMember(perm);
  const admin = canManageUsers(perm);
  const orgAdmin = isOrgAdmin(perm) || isOrgTech(perm);
  const seeAll = canViewAllCommittees(perm);
  const hasCommittees = committees.length > 0;
  const workCommitteeId =
    activeCommitteeId && committees.some((c) => c.id === activeCommitteeId)
      ? activeCommitteeId
      : committees[0]?.id ?? null;

  const top: NavLink[] = [
    { key: "home", label: "Home", href: "/", icon: "home" },
    { key: "my-work", label: "My work", href: "/my-work", icon: "myWork" },
    { key: "messages", label: "Messages", href: "/messages", icon: "messages" },
  ];

  if (canReviewReport(perm) || supervisory) {
    top.push({
      key: "reports",
      label: "Reports",
      href: "/reports",
      icon: "reports",
    });
  }

  const committeeNodes: NavCommitteeNode[] = committees.map((c) => ({
    id: c.id,
    name: c.name,
    children: committeeChildren(c.id),
  }));

  const governance: NavLink[] = [];
  if (supervisory || canCreateSupervisoryAssignment(perm)) {
    governance.push({
      key: "assign-work",
      label: "Assign work",
      href: "/assign-work",
      icon: "assign",
    });
    governance.push({
      key: "assignments-org",
      label: "Assignments",
      href: "/assignments",
      icon: "assignments",
    });
  }
  if (canReviewReport(perm) || supervisory) {
    governance.push({
      key: "reports-gov",
      label: "Report inbox",
      href: "/reports",
      icon: "reportInbox",
    });
  }
  if (supervisory || seeAll || hasCommittees) {
    governance.push({
      key: "documents",
      label: "All documents",
      href: "/documents",
      icon: "documents",
    });
  }

  const adminLinks: NavLink[] = [];
  if (admin || orgAdmin) {
    adminLinks.push(
      { key: "admin", label: "Admin", href: "/admin", icon: "admin" },
      {
        key: "structure",
        label: "Structure",
        href: "/admin/structure",
        icon: "structure",
      },
      { key: "rbac", label: "RBAC", href: "/admin/rbac", icon: "rbac" },
    );
  }

  // Mobile dock: curated by role, max 5 including More
  const dock: (NavLink | { key: "more"; label: "More" })[] = [
    { key: "home", label: "Home", href: "/", icon: "home" },
    { key: "my-work", label: "My work", href: "/my-work", icon: "myWork" },
  ];

  if (workCommitteeId && hasCommittees && !supervisory) {
    dock.push({
      key: "tasks",
      label: "Board",
      href: committeePath(workCommitteeId, "tasks"),
      icon: "tasks",
    });
    dock.push({
      key: "messages",
      label: "Messages",
      href: "/messages",
      icon: "messages",
    });
  } else if (supervisory && !hasCommittees) {
    dock.push({
      key: "reports",
      label: "Reports",
      href: "/reports",
      icon: "reports",
    });
    dock.push({
      key: "messages",
      label: "Messages",
      href: "/messages",
      icon: "messages",
    });
  } else if (supervisory && hasCommittees) {
    dock.push({
      key: "messages",
      label: "Messages",
      href: "/messages",
      icon: "messages",
    });
    dock.push({
      key: "reports",
      label: "Reports",
      href: "/reports",
      icon: "reports",
    });
  } else if (orgAdmin && adminLinks.length) {
    dock.push(adminLinks[0]);
    dock.push({
      key: "messages",
      label: "Messages",
      href: "/messages",
      icon: "messages",
    });
  } else if (workCommitteeId) {
    dock.push({
      key: "tasks",
      label: "Board",
      href: committeePath(workCommitteeId, "tasks"),
      icon: "tasks",
    });
    dock.push({
      key: "messages",
      label: "Messages",
      href: "/messages",
      icon: "messages",
    });
  } else {
    dock.push({
      key: "messages",
      label: "Messages",
      href: "/messages",
      icon: "messages",
    });
  }

  while (dock.length > 4) dock.pop();
  dock.push({ key: "more", label: "More" });

  const dockKeys = new Set(dock.map((d) => d.key));
  const mobileMore: NavLink[] = [];

  const pushMore = (link: NavLink) => {
    if (dockKeys.has(link.key)) return;
    if (mobileMore.some((m) => m.key === link.key || m.href === link.href)) return;
    mobileMore.push(link);
  };

  for (const t of top) pushMore(t);
  if (workCommitteeId) {
    for (const child of committeeChildren(workCommitteeId)) {
      pushMore({ ...child, key: `more-${child.key}` });
    }
  }
  for (const g of governance) pushMore(g);
  for (const a of adminLinks) pushMore(a);

  // Switch-committee entries in More
  for (const c of committees.slice(0, 12)) {
    pushMore({
      key: `goto-${c.id}`,
      label: c.name,
      href: committeePath(c.id),
      icon: "committee",
    });
  }

  return {
    top,
    committees: committeeNodes,
    governance,
    admin: adminLinks,
    mobileDock: dock,
    mobileMore,
    flags: {
      showCommittees: hasCommittees,
      showGovernance: governance.length > 0,
      showAdmin: adminLinks.length > 0,
      canSeeAllCommittees: seeAll,
    },
  };
}
