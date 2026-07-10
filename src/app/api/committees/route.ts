import { NextResponse } from "next/server";
import { requireRoles, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers, canViewAllCommittees } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const includeMeta = searchParams.get("meta") === "true";

  if (scope && scope !== "all") {
    // Users may only query their own memberships unless they have global access
    if (
      scope !== auth.user.id &&
      !canViewAllCommittees(auth.user.role) &&
      !canManageUsers(auth.user.role)
    ) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const memberships = await prisma.committeeMember.findMany({
      where: { userId: scope },
      include: { committee: true },
    });
    return NextResponse.json(
      memberships.map((m) => ({
        id: m.committee.id,
        charterLetter: m.committee.charterLetter,
        name: m.committee.name,
        ...(includeMeta && {
          budget: m.committee.budget,
          reportingFrequency: m.committee.reportingFrequency,
          description: m.committee.description,
        }),
      })),
    );
  }

  if (scope === "all" && !canViewAllCommittees(auth.user.role) && !canManageUsers(auth.user.role)) {
    // Non-global users requesting "all" get only their memberships
    const memberships = await prisma.committeeMember.findMany({
      where: { userId: auth.user.id },
      include: { committee: true },
    });
    return NextResponse.json(
      memberships.map((m) => ({
        id: m.committee.id,
        charterLetter: m.committee.charterLetter,
        name: m.committee.name,
      })),
    );
  }

  const committees = await prisma.committee.findMany({
    orderBy: { charterLetter: "asc" },
    select: {
      id: true,
      charterLetter: true,
      name: true,
      ...(includeMeta && {
        budget: true,
        reportingFrequency: true,
        description: true,
      }),
    },
  });

  return NextResponse.json(committees);
}

export async function PATCH(request: Request) {
  const auth = await requireRoles(["SUPER_ADMIN"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    description?: string | null;
    budget?: number | null;
    reportingFrequency?: string | null;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const committee = await prisma.committee.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.budget !== undefined && { budget: body.budget }),
      ...(body.reportingFrequency !== undefined && {
        reportingFrequency: body.reportingFrequency,
      }),
    },
  });

  return NextResponse.json(committee);
}
