import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { toSessionPayload } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      committeeMemberships: true,
      presbyteryMembership: true,
    },
  });

  if (!user || user.status === "DISABLED") {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  return NextResponse.json(toSessionPayload(user));
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("unitycommit-user");
  return response;
}
