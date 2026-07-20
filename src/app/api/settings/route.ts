import { NextResponse } from "next/server";
import { requireActiveOrg, requireRoles } from "@/lib/auth";
import { getOrgSettings, updateOrgSettings } from "@/lib/settings";

export async function GET() {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const settings = await getOrgSettings(auth.org.organizationId);
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const auth = await requireRoles(["ORG_ADMIN"]);
  if (auth.error) return auth.error;
  const orgId = auth.user.orgContext!.organizationId;

  const body = (await request.json()) as Partial<{
    committeeBudgetsEnabled: boolean;
    allowCrossCommitteeRead: boolean;
    requireOversightOnSelfInitiated: boolean;
    allowSupervisoryAssignMembers: boolean;
    supervisoryLabel: string;
    committeeLabel: string;
    approvalStack: import("@/lib/types").ApprovalStackStep[];
  }>;

  const settings = await updateOrgSettings(orgId, body);
  return NextResponse.json(settings);
}
