import { NextResponse } from "next/server";
import { getSessionUser, requireUser } from "@/lib/auth";
import {
  clearActiveOrgCookie,
  setActiveOrgCookie,
  toSessionPayload,
} from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { listUserOrganizations } from "@/lib/organizations";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const memberships = await listUserOrganizations(user.id);
  return NextResponse.json({
    activeOrganizationId: user.orgContext?.organizationId ?? null,
    memberships,
    session: toSessionPayload(user),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as { organizationId?: string };
  if (!body.organizationId) {
    return NextResponse.json(
      { error: "organizationId required" },
      { status: 400 },
    );
  }

  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: body.organizationId,
        userId: auth.user.id,
      },
    },
    include: { organization: true },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 },
    );
  }
  if (membership.organization.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "Organization is suspended" },
      { status: 403 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    organizationId: body.organizationId,
  });
  setActiveOrgCookie(response, body.organizationId);
  return response;
}

export async function DELETE() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const response = NextResponse.json({ ok: true });
  clearActiveOrgCookie(response);
  return response;
}
