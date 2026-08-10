import type { SessionUser } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  canManageUsers,
  isOrgAdmin,
  isOrgTech,
} from "@/lib/types";
import type { CommitteeRef } from "@/lib/navigation";

export type NavLink = {
  key: string;
  label: string;
  href: string;
  icon:
    | "home"
    | "tasks"
    | "events"
    | "documents"
    | "messages"
    | "admin"
    | "structure"
    | "rbac"
    | "committee";
};

export type NavModel = {
  /** Five peer tabs (Home · Work · Events · Docs · Messages) */
  peers: NavLink[];
  /** Admin links — UserMenu / header only, not in the dock */
  admin: NavLink[];
  /** @deprecated use peers */
  top: NavLink[];
  /** @deprecated empty — committees are group-filter, not nav */
  committees: { id: string; name: string; children: NavLink[] }[];
  /** @deprecated empty — no governance nav section */
  governance: NavLink[];
  /** Mobile dock mirrors peers (no More) */
  mobileDock: NavLink[];
  /** @deprecated empty */
  mobileMore: NavLink[];
  flags: {
    showCommittees: boolean;
    showGovernance: boolean;
    showAdmin: boolean;
    canSeeAllCommittees: boolean;
  };
};

const PEERS: NavLink[] = [
  { key: "home", label: "Home", href: "/", icon: "home" },
  { key: "tasks", label: "Work", href: "/tasks", icon: "tasks" },
  { key: "events", label: "Events", href: "/events", icon: "events" },
  { key: "documents", label: "Docs", href: "/documents", icon: "documents" },
  { key: "messages", label: "Messages", href: "/messages", icon: "messages" },
];

export function buildNavModel(
  user: SessionUser,
  _committees: CommitteeRef[] = [],
  _activeCommitteeId: string | null = null,
): NavModel {
  const perm = toPermissionUser(user);
  const admin = canManageUsers(perm);
  const orgAdmin = isOrgAdmin(perm) || isOrgTech(perm);

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

  return {
    peers: PEERS,
    admin: adminLinks,
    top: PEERS,
    committees: [],
    governance: [],
    mobileDock: PEERS,
    mobileMore: [],
    flags: {
      showCommittees: false,
      showGovernance: false,
      showAdmin: adminLinks.length > 0,
      canSeeAllCommittees: false,
    },
  };
}
