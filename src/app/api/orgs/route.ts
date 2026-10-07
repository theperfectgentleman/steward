import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createOrganization,
  listUserOrganizations,
  slugifyOrganizationName,
  updateOrganizationName,
  type OrgTemplateId,
} from "@/lib/organizations";
import { logActivity } from "@/lib/activity";

const TEMPLATES: OrgTemplateId[] = ["blank", "church", "board"];

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    name?: string;
    slug?: string;
    template?: OrgTemplateId;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const template = TEMPLATES.includes(body.template ?? "blank")
    ? (body.template ?? "blank")
    : "blank";
  const slug =
    body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
    slugifyOrganizationName(body.name);

  try {
    const org = await createOrganization({
      name: body.name.trim(),
      slug,
      ownerUserId: auth.user.id,
      template,
    });
    await logActivity({
      entityType: "STRUCTURE",
      entityId: org.id,
      action: "ORGANIZATION_CREATED",
      actorId: auth.user.id,
      organizationId: org.id,
    });
    const memberships = await listUserOrganizations(auth.user.id);
    return NextResponse.json({ org, memberships }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    const status = message.includes("Unique") ? 409 : 400;
    return NextResponse.json(
      { error: status === 409 ? "That organization slug is taken" : message },
      { status },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    organizationId?: string;
    name?: string;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const organizationId =
    body.organizationId?.trim() || auth.user.orgContext?.organizationId;
  if (!organizationId) {
    return NextResponse.json(
      { error: "organizationId required" },
      { status: 400 },
    );
  }

  let isAuthorized = Boolean(auth.user.isPlatformAdmin);
  if (!isAuthorized) {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: auth.user.id,
        },
      },
    });
    if (
      membership &&
      (membership.role === "ORG_ADMIN" || membership.role === "ORG_TECH")
    ) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Admin role required to edit organization" },
      { status: 403 },
    );
  }

  try {
    const org = await updateOrganizationName({
      organizationId,
      name,
    });

    await logActivity({
      entityType: "STRUCTURE",
      entityId: org.id,
      action: "ORGANIZATION_RENAMED",
      actorId: auth.user.id,
      organizationId: org.id,
      metadata: { name },
    });

    const memberships = await listUserOrganizations(auth.user.id);
    return NextResponse.json({ org, memberships });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

