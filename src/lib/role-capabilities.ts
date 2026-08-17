import type { CommitteeTitle, SupervisoryTitle } from "@/lib/types";

export type RoleCapabilities = {
  editTasks: boolean;
  logMinutes: boolean;
  approveMinutes: boolean;
  invite: boolean;
  updateAssignedTasks: boolean;
  canViewAll: boolean;
  canCreateDirective: boolean;
  canApproveOptional: boolean;
};

export const EMPTY_ROLE_CAPABILITIES: RoleCapabilities = {
  editTasks: false,
  logMinutes: false,
  approveMinutes: false,
  invite: false,
  updateAssignedTasks: false,
  canViewAll: false,
  canCreateDirective: false,
  canApproveOptional: false,
};

export const ROLE_CAPABILITY_KEYS = [
  "editTasks",
  "logMinutes",
  "approveMinutes",
  "invite",
  "updateAssignedTasks",
  "canViewAll",
  "canCreateDirective",
  "canApproveOptional",
] as const satisfies readonly (keyof RoleCapabilities)[];

export type RoleTemplateSeed = {
  key: string;
  name: string;
  description: string;
  sortOrder: number;
  capabilities: RoleCapabilities;
};

const CHAIR_CAPS: RoleCapabilities = {
  ...EMPTY_ROLE_CAPABILITIES,
  editTasks: true,
  logMinutes: true,
  approveMinutes: true,
  updateAssignedTasks: true,
};

const SECRETARY_CAPS: RoleCapabilities = {
  ...EMPTY_ROLE_CAPABILITIES,
  editTasks: true,
  logMinutes: true,
  updateAssignedTasks: true,
};

const MEMBER_CAPS: RoleCapabilities = {
  ...EMPTY_ROLE_CAPABILITIES,
  updateAssignedTasks: true,
};

const GOVERNANCE_LEAD_CAPS: RoleCapabilities = {
  ...EMPTY_ROLE_CAPABILITIES,
  canViewAll: true,
  canCreateDirective: true,
  canApproveOptional: true,
};

export const DEFAULT_ROLE_TEMPLATE_SEEDS: RoleTemplateSeed[] = [
  {
    key: "CHAIR",
    name: "Chair",
    description: "Committee chairperson",
    sortOrder: 1,
    capabilities: CHAIR_CAPS,
  },
  {
    key: "DEPUTY",
    name: "Deputy",
    description: "Deputy chair",
    sortOrder: 2,
    capabilities: SECRETARY_CAPS,
  },
  {
    key: "SECRETARY",
    name: "Secretary",
    description: "Committee secretary",
    sortOrder: 3,
    capabilities: SECRETARY_CAPS,
  },
  {
    key: "MEMBER",
    name: "Member",
    description: "Committee member",
    sortOrder: 4,
    capabilities: MEMBER_CAPS,
  },
  {
    key: "SUPERVISORY_HEAD",
    name: "Governance Head",
    description: "Sees all groups and assigns directives",
    sortOrder: 10,
    capabilities: GOVERNANCE_LEAD_CAPS,
  },
  {
    key: "SUPERVISORY_SECRETARY",
    name: "Governance Secretary",
    description: "Sees all groups and assigns directives",
    sortOrder: 11,
    capabilities: GOVERNANCE_LEAD_CAPS,
  },
  {
    key: "SUPERVISORY_MEMBER",
    name: "Governance Member",
    description: "Governance participant without org-wide view",
    sortOrder: 12,
    capabilities: EMPTY_ROLE_CAPABILITIES,
  },
];

export const CHURCH_ROLE_TEMPLATE_SEEDS: RoleTemplateSeed[] =
  DEFAULT_ROLE_TEMPLATE_SEEDS.map((t) => {
    if (t.key === "SUPERVISORY_HEAD") {
      return { ...t, name: "General Overseer" };
    }
    if (t.key === "SUPERVISORY_SECRETARY") {
      return { ...t, name: "General Secretary" };
    }
    if (t.key === "SUPERVISORY_MEMBER") {
      return { ...t, name: "Presbytery member" };
    }
    if (t.key === "CHAIR") {
      return { ...t, name: "Chairperson" };
    }
    return t;
  });

export function parseRoleCapabilities(value: unknown): RoleCapabilities {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    editTasks: raw.editTasks === true,
    logMinutes: raw.logMinutes === true,
    approveMinutes: raw.approveMinutes === true,
    invite: raw.invite === true,
    updateAssignedTasks: raw.updateAssignedTasks === true,
    canViewAll: raw.canViewAll === true,
    canCreateDirective: raw.canCreateDirective === true,
    canApproveOptional: raw.canApproveOptional === true,
  };
}

export function committeeTitleTemplateKey(title: CommitteeTitle): string {
  if (title === "CUSTOM") return "MEMBER";
  return title;
}

export function supervisoryTitleTemplateKey(
  title: SupervisoryTitle | null | undefined,
  isHead: boolean,
): string {
  if (isHead || title === "HEAD") return "SUPERVISORY_HEAD";
  if (title === "SECRETARY") return "SUPERVISORY_SECRETARY";
  return "SUPERVISORY_MEMBER";
}

export function capsFromTemplates(
  templates: { key: string; capabilities: unknown }[],
  key: string,
): RoleCapabilities {
  const match = templates.find((t) => t.key === key);
  if (!match) return EMPTY_ROLE_CAPABILITIES;
  return parseRoleCapabilities(match.capabilities);
}
