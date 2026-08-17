import { NextResponse } from "next/server";
import { getSessionUser, requireActiveOrg, requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers, type OrganizationMemberRole } from "@/lib/types";
import { asPermissionUser } from "@/lib/auth";
import { addOrgMember } from "@/lib/invites";

export async function GET() {
  const auth = await requireActiveOrg();
  if (auth.error) {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    return NextResponse.json([]);
  }

  const perm = asPermissionUser(auth.user);
  const isAdmin = canManageUsers(perm);
  const orgId = auth.org.organizationId;

  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId: orgId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          ...(isAdmin ? { email: true } : {}),
          committeeMemberships: isAdmin
            ? {
                where: { committee: { organizationId: orgId } },
                select: { committeeId: true, title: true, customTitle: true },
              }
            : false,
        },
      },
    },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(
    memberships.map((m) => ({
      ...m.user,
      orgRole: m.role,
    })),
    {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    },
  );
}

export async function POST(request: Request) {
  const auth = await requireRoles(["ORG_ADMIN"]);
  if (auth.error) return auth.error;

  const orgId = auth.user.orgContext!.organizationId;
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    role?: OrganizationMemberRole;
    mode?: "invite" | "create";
    sendNotifications?: boolean;
  };

  if (!body.role) {
    return NextResponse.json({ error: "Role is required" }, { status: 400 });
  }

  if (body.role === "ORG_ADMIN" && auth.user.orgContext?.orgRole !== "ORG_ADMIN") {
    return NextResponse.json(
      { error: "Only Org Admin can add Org Admin" },
      { status: 403 },
    );
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await addOrgMember({
      organizationId: orgId,
      createdById: auth.user.id,
      origin,
      name: body.name,
      email: body.email,
      phone: body.phone,
      orgRole: body.role,
      mode: body.mode === "create" ? "create" : "invite",
      sendNotifications: body.sendNotifications ?? true,
    });
    return NextResponse.json(result, {
      status: result.type === "existing" ? 200 : 201,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not add user";
    const status = message.includes("Already a member") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
