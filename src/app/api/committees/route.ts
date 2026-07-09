import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");

  if (scope && scope !== "all") {
    const memberships = await prisma.committeeMember.findMany({
      where: { userId: scope },
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
    select: { id: true, charterLetter: true, name: true },
  });

  return NextResponse.json(committees);
}
