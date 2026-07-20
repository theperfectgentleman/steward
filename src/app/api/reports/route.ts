import { NextResponse } from "next/server";
import {
  asPermissionUser,
  requireActiveOrg,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canReviewReport,
  canSubmitReport,
} from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");
  const inbox = searchParams.get("inbox") === "true";

  const orgId = auth.org.organizationId;
  const perm = asPermissionUser(auth.user);

  if (inbox) {
    if (!canReviewReport(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const reports = await prisma.report.findMany({
      where: {
        organizationId: orgId,
        status: { in: ["SUBMITTED", "RETURNED"] },
      },
      include: {
        project: { include: { committee: true } },
        author: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: "desc" },
    });
    return NextResponse.json(reports);
  }

  const reports = await prisma.report.findMany({
    where: {
      organizationId: orgId,
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as "DRAFT" | "SUBMITTED" | "RETURNED" | "FINAL" } : {}),
    },
    include: {
      project: { include: { committee: true } },
      author: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(reports);
}

export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    projectId?: string;
    title?: string;
    body?: string;
  };

  if (!body.projectId || !body.title?.trim()) {
    return NextResponse.json(
      { error: "projectId and title required" },
      { status: 400 },
    );
  }

  const project = await prisma.project.findFirst({
    where: {
      id: body.projectId,
      committee: { organizationId: auth.org.organizationId },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const perm = asPermissionUser(auth.user);
  if (!canSubmitReport(perm, project.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const report = await prisma.report.create({
    data: {
      organizationId: auth.org.organizationId,
      projectId: project.id,
      title: body.title.trim(),
      body: body.body ?? "",
      authorId: auth.user.id,
      status: "DRAFT",
    },
  });

  return NextResponse.json(report, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    id?: string;
    action?: "save" | "submit" | "return" | "approve";
    title?: string;
    body?: string;
    reviewComment?: string;
  };

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "id and action required" }, { status: 400 });
  }

  const report = await prisma.report.findFirst({
    where: { id: body.id, organizationId: auth.org.organizationId },
    include: { project: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const perm = asPermissionUser(auth.user);

  if (body.action === "save") {
    if (!canSubmitReport(perm, report.project.committeeId)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    if (report.status !== "DRAFT" && report.status !== "RETURNED") {
      return NextResponse.json({ error: "Cannot edit this report" }, { status: 400 });
    }
    const updated = await prisma.report.update({
      where: { id: report.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.body !== undefined && { body: body.body }),
        status: "DRAFT",
      },
    });
    return NextResponse.json(updated);
  }

  if (body.action === "submit") {
    if (!canSubmitReport(perm, report.project.committeeId)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const updated = await prisma.report.update({
      where: { id: report.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        ...(body.title !== undefined && { title: body.title }),
        ...(body.body !== undefined && { body: body.body }),
      },
    });
    return NextResponse.json(updated);
  }

  if (body.action === "return" || body.action === "approve") {
    if (!canReviewReport(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    if (report.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: "Only submitted reports can be reviewed" },
        { status: 400 },
      );
    }

    if (body.action === "return") {
      const updated = await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "RETURNED",
          reviewComment: body.reviewComment ?? null,
          reviewedById: auth.user.id,
        },
      });
      return NextResponse.json(updated);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const finalReport = await tx.report.update({
        where: { id: report.id },
        data: {
          status: "FINAL",
          finalizedAt: new Date(),
          reviewedById: auth.user.id,
          reviewComment: body.reviewComment ?? null,
        },
      });
      await tx.project.update({
        where: { id: report.projectId },
        data: { status: "COMPLETE" },
      });
      return finalReport;
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
