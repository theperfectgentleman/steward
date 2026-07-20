import { NextResponse } from "next/server";
import { asPermissionUser, requireActiveOrg, requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/settings";
import { canManageCommitteeConfig, canViewAllCommittees } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const orgId = auth.org.organizationId;
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const includeMeta = searchParams.get("meta") === "true";
  const settings = includeMeta ? await getOrgSettings(orgId) : null;
  const exposeBudget = settings?.committeeBudgetsEnabled === true;

  const withMeta = (committee: {
    id: string;
    charterLetter: string | null;
    name: string;
    budget?: number | null;
    reportingFrequency?: string | null;
    description?: string | null;
    sortOrder?: number;
  }) => ({
    id: committee.id,
    charterLetter: committee.charterLetter,
    name: committee.name,
    sortOrder: committee.sortOrder,
    ...(includeMeta && {
      ...(exposeBudget && { budget: committee.budget }),
      reportingFrequency: committee.reportingFrequency,
      description: committee.description,
    }),
  });

  if (scope && scope !== "all") {
    if (
      scope !== auth.user.id &&
      !canViewAllCommittees(perm) &&
      !canManageCommitteeConfig(perm)
    ) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const memberships = await prisma.committeeMember.findMany({
      where: {
        userId: scope,
        committee: { organizationId: orgId },
      },
      include: { committee: true },
    });
    return NextResponse.json(memberships.map((m) => withMeta(m.committee)));
  }

  if (
    scope === "all" &&
    !canViewAllCommittees(perm) &&
    !canManageCommitteeConfig(perm)
  ) {
    const memberships = await prisma.committeeMember.findMany({
      where: {
        userId: auth.user.id,
        committee: { organizationId: orgId },
      },
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
    where: { organizationId: orgId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      charterLetter: true,
      name: true,
      sortOrder: true,
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
  const auth = await requireRoles(["ORG_ADMIN", "ORG_TECH"]);
  if (auth.error) return auth.error;

  const orgId = auth.user.orgContext!.organizationId;
  const body = (await request.json()) as {
    id?: string;
    name?: string;
    description?: string | null;
    budget?: number | null;
    reportingFrequency?: string | null;
    sortOrder?: number;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.committee.findFirst({
    where: { id: body.id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Committee not found" }, { status: 404 });
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
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });

  return NextResponse.json(committee);
}

export async function POST(request: Request) {
  const auth = await requireRoles(["ORG_ADMIN", "ORG_TECH"]);
  if (auth.error) return auth.error;

  const orgId = auth.user.orgContext!.organizationId;
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    charterLetter?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const count = await prisma.committee.count({ where: { organizationId: orgId } });
  const committee = await prisma.committee.create({
    data: {
      organizationId: orgId,
      name: body.name.trim(),
      description: body.description,
      charterLetter: body.charterLetter || null,
      sortOrder: count,
      reportingFrequency: "Monthly",
    },
  });

  return NextResponse.json(committee, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireRoles(["ORG_ADMIN"]);
  if (auth.error) return auth.error;

  const orgId = auth.user.orgContext!.organizationId;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.committee.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.committee.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
