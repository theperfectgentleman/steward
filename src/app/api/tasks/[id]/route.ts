import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TaskStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    status?: TaskStatus;
    assignedToId?: string | null;
  };

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.assignedToId !== undefined && { assignedToId: body.assignedToId }),
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  return NextResponse.json(task);
}
