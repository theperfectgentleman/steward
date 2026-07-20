import { prisma } from "@/lib/prisma";
import {
  CHURCH_APPROVAL_STACK,
  DEFAULT_APPROVAL_STACK,
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
  approvalStack: unknown;
}): OrganizationSettings {
  return {
    supervisoryLabel: row.supervisoryLabel,
    committeeLabel: row.committeeLabel,
    committeeBudgetsEnabled: row.committeeBudgetsEnabled,
    allowCrossCommitteeRead: row.allowCrossCommitteeRead,
    requireOversightOnSelfInitiated: row.requireOversightOnSelfInitiated,
    allowSupervisoryAssignMembers: row.allowSupervisoryAssignMembers,
    approvalStack: parseApprovalStack(row.approvalStack),
  };
}

export async function getOrgSettings(
  organizationId: string,
): Promise<OrganizationSettings> {
  const row = await prisma.organizationSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      approvalStack: DEFAULT_APPROVAL_STACK,
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
      ...data,
      approvalStack: data.approvalStack ?? DEFAULT_APPROVAL_STACK,
    },
    update: {
      ...data,
      ...(data.approvalStack !== undefined
        ? { approvalStack: data.approvalStack }
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

export { parseApprovalStack, CHURCH_APPROVAL_STACK, DEFAULT_APPROVAL_STACK };
