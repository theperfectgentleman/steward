import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createOrganization,
  slugifyOrganizationName,
  transferOrgAdmin,
} from "@/lib/organizations";
import type { OrgTemplateId } from "@/lib/organizations";
import { createOrgAdminInviteForUser } from "@/lib/invites";
import { isValidEmail, normalizeEmail } from "@/lib/identity";
import { logActivity } from "@/lib/activity";

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
    template?: OrgTemplateId;
    supervisoryLabel?: string;
    ownerEmail?: string;
    ownerName?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const ownerEmail = body.ownerEmail?.trim()
    ? normalizeEmail(body.ownerEmail)
    : "";
  if (!ownerEmail || !isValidEmail(ownerEmail)) {
    return NextResponse.json(
      { error: "Org Admin email is required" },
      { status: 400 },
    );
  }

  const slug =
    body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
    slugifyOrganizationName(body.name);

  const existingOwner = await prisma.user.findUnique({
    where: { email: ownerEmail },
  });

  let ownerUserId: string;
  let pendingInvite = false;

  if (!existingOwner) {
    const created = await prisma.user.create({
      data: {
        name: body.ownerName?.trim() || ownerEmail.split("@")[0],
        email: ownerEmail,
        status: "PENDING",
      },
    });
    ownerUserId = created.id;
    pendingInvite = true;
  } else {
    ownerUserId = existingOwner.id;
    pendingInvite =
      existingOwner.status !== "ACTIVE" || !existingOwner.passwordHash;
  }

  try {
    const org = await createOrganization({
      name: body.name.trim(),
      slug,
      ownerUserId,
      template: body.template ?? "church",
      supervisoryLabel: body.supervisoryLabel,
    });

    let inviteUrl: string | null = null;
    if (pendingInvite) {
      const invited = await createOrgAdminInviteForUser({
        organizationId: org.id,
        userId: ownerUserId,
        createdById: auth.user.id,
        origin: new URL(request.url).origin,
        organizationName: org.name,
      });
      inviteUrl = invited.inviteUrl;
    }

    await logActivity({
      entityType: "STRUCTURE",
      entityId: org.id,
      action: "ORGANIZATION_CREATED",
      actorId: auth.user.id,
      organizationId: org.id,
      metadata: { ownerEmail, pendingInvite },
    });

    return NextResponse.json({ ...org, inviteUrl, pendingInvite }, { status: 201 });
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
