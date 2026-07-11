import { NextResponse } from "next/server";
import { asPermissionUser, requireRoles, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { canManageCommitteeConfig, canViewAllCommittees } from "@/lib/types";
export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const includeMeta = searchParams.get("meta") === "true";
  const settings = includeMeta ? await getAppSettings() : null;
  const exposeBudget = settings?.committeeBudgetsEnabled === true;

  const withMeta = (committee: {
    id: string;
    charterLetter: string;
    name: string;
    budget?: number | null;
    reportingFrequency?: string | null;
    description?: string | null;
  }) => ({
    id: committee.id,
    charterLetter: committee.charterLetter,
    name: committee.name,
    ...(includeMeta && {
      ...(exposeBudget && { budget: committee.budget }),
      reportingFrequency: committee.reportingFrequency,
      description: committee.description,
    }),
  });

  if (scope && scope !== "all") {
    // Users may only query their own memberships unless they have global access
    if (
      scope !== auth.user.id &&
      !canViewAllCommittees(perm) &&
      !canManageCommitteeConfig(perm.role)
    ) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const memberships = await prisma.committeeMember.findMany({
      where: { userId: scope },
      include: { committee: true },
    });
    return NextResponse.json(
      memberships.map((m) => withMeta(m.committee)),
    );
  }

  if (scope === "all" && !canViewAllCommittees(perm) && !canManageCommitteeConfig(perm.role)) {
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

  return NextResponse.json(committees.map(withMeta));
}

export async function PATCH(request: Request) {
  const auth = await requireRoles(["SUPER_ADMIN", "SYSTEM_ADMIN"]);
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

  if (body.budget !== undefined) {
    const settings = await getAppSettings();
    if (!settings.committeeBudgetsEnabled) {
      return NextResponse.json(
        { error: "Committee budgets are disabled" },
        { status: 403 },
      );
    }
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
