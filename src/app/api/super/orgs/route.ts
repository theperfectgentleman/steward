import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOrganization, transferOrgAdmin } from "@/lib/organizations";
import type { OrgTemplateId } from "@/lib/organizations";

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;

  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      settings: true,
      _count: {
        select: {
          memberships: true,
          committees: true,
        },
      },
    },
  });

  return NextResponse.json(orgs);
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    name?: string;
    slug?: string;
    ownerUserId?: string;
    ownerEmail?: string;
    template?: OrgTemplateId;
    supervisoryLabel?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const slug =
    body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
    body.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  let ownerUserId = body.ownerUserId ?? auth.user.id;
  if (body.ownerEmail) {
    const owner = await prisma.user.findUnique({
      where: { email: body.ownerEmail.trim().toLowerCase() },
    });
    if (!owner) {
      return NextResponse.json({ error: "Owner email not found" }, { status: 404 });
    }
    ownerUserId = owner.id;
  }

  try {
    const org = await createOrganization({
      name: body.name.trim(),
      slug,
      ownerUserId,
      template: body.template ?? "blank",
      supervisoryLabel: body.supervisoryLabel,
    });
    return NextResponse.json(org, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    organizationId?: string;
    status?: "ACTIVE" | "SUSPENDED";
    transferToUserId?: string;
  };

  if (!body.organizationId) {
    return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  }

  if (body.status) {
    const org = await prisma.organization.update({
      where: { id: body.organizationId },
      data: { status: body.status },
    });
    return NextResponse.json(org);
  }

  if (body.transferToUserId) {
    const currentAdmin = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: body.organizationId,
        role: "ORG_ADMIN",
      },
    });
    if (!currentAdmin) {
      return NextResponse.json({ error: "No current org admin" }, { status: 400 });
    }
    await transferOrgAdmin({
      organizationId: body.organizationId,
      fromUserId: currentAdmin.userId,
      toUserId: body.transferToUserId,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}
