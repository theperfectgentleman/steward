import { NextResponse } from "next/server";
import { requireActiveOrg, requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transferOrgAdmin } from "@/lib/organizations";

export async function GET() {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const [group, committees, roleTemplates, memberships] = await Promise.all([
    prisma.supervisoryGroup.findFirst({
      where: { organizationId: auth.org.organizationId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.committee.findMany({
      where: { organizationId: auth.org.organizationId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { members: true } },
      },
    }),
    prisma.roleTemplate.findMany({
      where: { organizationId: auth.org.organizationId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: auth.org.organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  return NextResponse.json({
    organization: {
      id: auth.org.organizationId,
      name: auth.org.organizationName,
      settings: auth.org.settings,
    },
    supervisory: group,
    committees,
    roleTemplates,
    memberships,
  });
}

export async function POST(request: Request) {
  const auth = await requireRoles(["ORG_ADMIN", "ORG_TECH"]);
  if (auth.error) return auth.error;

  const orgId = auth.user.orgContext!.organizationId;
  const body = (await request.json()) as {
    action?:
      | "add_committee"
      | "rename_committee"
      | "delete_committee"
      | "reorder_committees"
      | "ensure_supervisory"
      | "transfer_admin"
      | "upsert_role_template"
      | "delete_role_template";
    name?: string;
    committeeId?: string;
    committeeIds?: string[];
    toUserId?: string;
    template?: {
      id?: string;
      key?: string;
      name?: string;
      description?: string;
      capabilities?: Record<string, boolean>;
      sortOrder?: number;
    };
  };

  switch (body.action) {
    case "add_committee": {
      if (!body.name?.trim()) {
        return NextResponse.json({ error: "name required" }, { status: 400 });
      }
      const count = await prisma.committee.count({
        where: { organizationId: orgId },
      });
      const committee = await prisma.committee.create({
        data: {
          organizationId: orgId,
          name: body.name.trim(),
          sortOrder: count,
          reportingFrequency: "Monthly",
        },
      });
      return NextResponse.json(committee, { status: 201 });
    }
    case "rename_committee": {
      if (!body.committeeId || !body.name?.trim()) {
        return NextResponse.json({ error: "committeeId and name required" }, { status: 400 });
      }
      const committee = await prisma.committee.updateMany({
        where: { id: body.committeeId, organizationId: orgId },
        data: { name: body.name.trim() },
      });
      return NextResponse.json({ ok: true, count: committee.count });
    }
    case "delete_committee": {
      if (!body.committeeId) {
        return NextResponse.json({ error: "committeeId required" }, { status: 400 });
      }
      await prisma.committee.deleteMany({
        where: { id: body.committeeId, organizationId: orgId },
      });
      return NextResponse.json({ ok: true });
    }
    case "reorder_committees": {
      if (!body.committeeIds?.length) {
        return NextResponse.json({ error: "committeeIds required" }, { status: 400 });
      }
      await prisma.$transaction(
        body.committeeIds.map((id, index) =>
          prisma.committee.updateMany({
            where: { id, organizationId: orgId },
            data: { sortOrder: index },
          }),
        ),
      );
      return NextResponse.json({ ok: true });
    }
    case "ensure_supervisory": {
      const label =
        auth.user.orgContext!.settings.supervisoryLabel || "Supervisory Group";
      const existing = await prisma.supervisoryGroup.findFirst({
        where: { organizationId: orgId },
      });
      const group = existing
        ? await prisma.supervisoryGroup.update({
            where: { id: existing.id },
            data: { name: body.name?.trim() || label },
          })
        : await prisma.supervisoryGroup.create({
            data: {
              organizationId: orgId,
              name: body.name?.trim() || label,
            },
          });
      return NextResponse.json(group);
    }
    case "transfer_admin": {
      if (auth.user.orgContext?.orgRole !== "ORG_ADMIN") {
        return NextResponse.json({ error: "Org Admin required" }, { status: 403 });
      }
      if (!body.toUserId) {
        return NextResponse.json({ error: "toUserId required" }, { status: 400 });
      }
      await transferOrgAdmin({
        organizationId: orgId,
        fromUserId: auth.user.id,
        toUserId: body.toUserId,
      });
      return NextResponse.json({ ok: true });
    }
    case "upsert_role_template": {
      if (!body.template?.key || !body.template?.name) {
        return NextResponse.json({ error: "template key and name required" }, { status: 400 });
      }
      const template = await prisma.roleTemplate.upsert({
        where: {
          organizationId_key: {
            organizationId: orgId,
            key: body.template.key,
          },
        },
        create: {
          organizationId: orgId,
          key: body.template.key,
          name: body.template.name,
          description: body.template.description,
          capabilities: body.template.capabilities ?? {},
          sortOrder: body.template.sortOrder ?? 0,
        },
        update: {
          name: body.template.name,
          description: body.template.description,
          capabilities: body.template.capabilities ?? {},
          sortOrder: body.template.sortOrder,
        },
      });
      return NextResponse.json(template);
    }
    case "delete_role_template": {
      if (!body.template?.key) {
        return NextResponse.json({ error: "template key required" }, { status: 400 });
      }
      await prisma.roleTemplate.deleteMany({
        where: { organizationId: orgId, key: body.template.key },
      });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
