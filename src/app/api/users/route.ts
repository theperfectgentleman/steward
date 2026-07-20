import { NextResponse } from "next/server";
import { getSessionUser, requireActiveOrg, requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers, type UserRole } from "@/lib/types";
import { asPermissionUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireActiveOrg();
  if (auth.error) {
    // Allow listing without org for limited cases — return empty
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
  const auth = await requireRoles(["ORG_ADMIN", "ORG_TECH"]);
  if (auth.error) return auth.error;

  const orgId = auth.user.orgContext!.organizationId;
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    role?: UserRole;
  };

  if (!body.name || !body.email || !body.role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (body.role === "ORG_ADMIN" && auth.user.orgContext?.orgRole !== "ORG_ADMIN") {
    return NextResponse.json(
      { error: "Only Org Admin can create Org Admin" },
      { status: 403 },
    );
  }

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
      organizationMemberships: {
        create: {
          organizationId: orgId,
          role: body.role,
        },
      },
    },
  });

  return NextResponse.json(user, { status: 201 });
}
