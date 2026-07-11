import { NextResponse } from "next/server";
import { getSessionUser, requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers, type UserRole } from "@/lib/types";

export async function GET() {
  const session = await getSessionUser();
  const isAdmin = session ? canManageUsers(session.role) : false;

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      ...(isAdmin ? { email: true } : {}),
      committeeMemberships: isAdmin
        ? { select: { committeeId: true, title: true } }
        : false,
    },
  });

  return NextResponse.json(users, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}

export async function POST(request: Request) {
  const auth = await requireRoles(["SUPER_ADMIN", "SYSTEM_ADMIN"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    role?: UserRole;
  };

  if (!body.name || !body.email || !body.role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (body.role === "SUPER_ADMIN" && auth.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only Super Admin can create Super Admin" }, { status: 403 });
  }

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
