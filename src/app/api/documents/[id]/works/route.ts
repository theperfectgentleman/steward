import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireActiveOrg,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTasks } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await prisma.libraryDocument.findFirst({
    where: {
      id,
      OR: [{ organizationId: auth.org.organizationId }, { organizationId: null }],
      archivedAt: null,
    },
    include: {
      committee: { select: { organizationId: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.committee && doc.committee.organizationId !== auth.org.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!doc.committeeId) {
    return NextResponse.json(
      { error: "Assign this document to a committee before creating work" },
      { status: 400 },
    );
  }

  const mutation = assertCommitteeMutation(auth.user, doc.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, doc.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, doc.committeeId);
  if (access) return access;

  const body = (await request.json()) as {
    works?: { title: string; description?: string }[];
  };

  if (!body.works?.length) {
    return NextResponse.json({ error: "No work items provided" }, { status: 400 });
  }

  const created = await prisma.$transaction(
    body.works.map((w) =>
      prisma.task.create({
        data: {
          title: w.title.trim(),
          description: w.description?.trim() || null,
          committeeId: doc.committeeId!,
          workClass: "COMMITTEE",
          createdById: auth.user.id,
        },
        select: { id: true, title: true },
      }),
    ),
  );

  // Link accepted work back to the TOR as evidence of the Action
  if (created.length > 0) {
    await prisma.documentLink.createMany({
      data: created.map((task) => ({
        documentId: doc.id,
        entityType: "TASK" as const,
        entityId: task.id,
        relation: "EVIDENCE" as const,
        createdById: auth.user.id,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json(
    {
      created: created.length,
      tasks: created,
      tasksHref: `/tasks?committeeId=${doc.committeeId}`,
    },
    { status: 201 },
  );
}
