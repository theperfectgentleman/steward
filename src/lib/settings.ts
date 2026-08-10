import { prisma } from "@/lib/prisma";
import {
  CHURCH_COMMITTEE_APPROVAL_STACK,
  CHURCH_DIRECTIVE_APPROVAL_STACK,
  DEFAULT_COMMITTEE_APPROVAL_STACK,
  DEFAULT_DIRECTIVE_APPROVAL_STACK,
  type ApprovalStackStep,
  type OrganizationSettings,
} from "@/lib/types";

export type AppSettingsSnapshot = OrganizationSettings;

function parseApprovalStack(value: unknown): ApprovalStackStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (s): s is ApprovalStackStep =>
        s != null &&
        typeof s === "object" &&
        typeof (s as ApprovalStackStep).order === "number" &&
        typeof (s as ApprovalStackStep).role === "string" &&
        typeof (s as ApprovalStackStep).label === "string",
    )
    .sort((a, b) => a.order - b.order);
}

function mapSettings(row: {
  supervisoryLabel: string;
  committeeLabel: string;
  committeeBudgetsEnabled: boolean;
  allowCrossCommitteeRead: boolean;
  requireOversightOnSelfInitiated: boolean;
  allowSupervisoryAssignMembers: boolean;
  directiveApprovalStack?: unknown;
  committeeApprovalStack?: unknown;
}): OrganizationSettings {
  const committeeStack = parseApprovalStack(row.committeeApprovalStack);
  const directiveStack = parseApprovalStack(row.directiveApprovalStack);

  return {
    supervisoryLabel: row.supervisoryLabel,
    committeeLabel: row.committeeLabel,
    committeeBudgetsEnabled: row.committeeBudgetsEnabled,
    allowCrossCommitteeRead: row.allowCrossCommitteeRead,
    requireOversightOnSelfInitiated: row.requireOversightOnSelfInitiated,
    allowSupervisoryAssignMembers: row.allowSupervisoryAssignMembers,
    directiveApprovalStack:
      directiveStack.length > 0
        ? directiveStack
        : DEFAULT_DIRECTIVE_APPROVAL_STACK,
    committeeApprovalStack:
      committeeStack.length > 0
        ? committeeStack
        : DEFAULT_COMMITTEE_APPROVAL_STACK,
  };
}

export async function getOrgSettings(
  organizationId: string,
): Promise<OrganizationSettings> {
  const row = await prisma.organizationSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      directiveApprovalStack: DEFAULT_DIRECTIVE_APPROVAL_STACK,
      committeeApprovalStack: DEFAULT_COMMITTEE_APPROVAL_STACK,
    },
    update: {},
  });
  return mapSettings(row);
}

/** @deprecated use getOrgSettings */
export async function getAppSettings(): Promise<
  Pick<OrganizationSettings, "committeeBudgetsEnabled">
> {
  const first = await prisma.organizationSettings.findFirst();
  return {
    committeeBudgetsEnabled: first?.committeeBudgetsEnabled ?? false,
  };
}

export async function updateOrgSettings(
  organizationId: string,
  data: Partial<OrganizationSettings>,
): Promise<OrganizationSettings> {
  const row = await prisma.organizationSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      supervisoryLabel: data.supervisoryLabel,
      committeeLabel: data.committeeLabel,
      committeeBudgetsEnabled: data.committeeBudgetsEnabled,
      allowCrossCommitteeRead: data.allowCrossCommitteeRead,
      requireOversightOnSelfInitiated: data.requireOversightOnSelfInitiated,
      allowSupervisoryAssignMembers: data.allowSupervisoryAssignMembers,
      directiveApprovalStack:
        data.directiveApprovalStack ?? DEFAULT_DIRECTIVE_APPROVAL_STACK,
      committeeApprovalStack:
        data.committeeApprovalStack ?? DEFAULT_COMMITTEE_APPROVAL_STACK,
    },
    update: {
      ...(data.supervisoryLabel !== undefined
        ? { supervisoryLabel: data.supervisoryLabel }
        : {}),
      ...(data.committeeLabel !== undefined
        ? { committeeLabel: data.committeeLabel }
        : {}),
      ...(data.committeeBudgetsEnabled !== undefined
        ? { committeeBudgetsEnabled: data.committeeBudgetsEnabled }
        : {}),
      ...(data.allowCrossCommitteeRead !== undefined
        ? { allowCrossCommitteeRead: data.allowCrossCommitteeRead }
        : {}),
      ...(data.requireOversightOnSelfInitiated !== undefined
        ? { requireOversightOnSelfInitiated: data.requireOversightOnSelfInitiated }
        : {}),
      ...(data.allowSupervisoryAssignMembers !== undefined
        ? { allowSupervisoryAssignMembers: data.allowSupervisoryAssignMembers }
        : {}),
      ...(data.directiveApprovalStack !== undefined
        ? { directiveApprovalStack: data.directiveApprovalStack }
        : {}),
      ...(data.committeeApprovalStack !== undefined
        ? { committeeApprovalStack: data.committeeApprovalStack }
        : {}),
    },
  });
  return mapSettings(row);
}

/** @deprecated */
export async function updateAppSettings(
  data: Partial<Pick<OrganizationSettings, "committeeBudgetsEnabled">>,
) {
  const first = await prisma.organizationSettings.findFirst();
  if (!first) {
    return { committeeBudgetsEnabled: false };
  }
  return updateOrgSettings(first.organizationId, data);
}

export {
  parseApprovalStack,
  CHURCH_COMMITTEE_APPROVAL_STACK,
  CHURCH_DIRECTIVE_APPROVAL_STACK,
  DEFAULT_COMMITTEE_APPROVAL_STACK,
  DEFAULT_DIRECTIVE_APPROVAL_STACK,
};
