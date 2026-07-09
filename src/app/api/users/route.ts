import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
  };

  if (!body.name || !body.email || !body.role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone,
      role: body.role as "SUPER_ADMIN" | "CHURCH_EXECUTIVE" | "COMMITTEE_CHAIRPERSON" | "COMMITTEE_SECRETARY" | "COMMITTEE_MEMBER",
    },
  });

  return NextResponse.json(user, { status: 201 });
}
