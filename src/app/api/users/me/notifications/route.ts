import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { emailAttentionEnabled: true },
  });

  return NextResponse.json({
    emailAttentionEnabled: user?.emailAttentionEnabled ?? true,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as { emailAttentionEnabled?: boolean };
  if (typeof body.emailAttentionEnabled !== "boolean") {
    return NextResponse.json(
      { error: "emailAttentionEnabled boolean required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data: { emailAttentionEnabled: body.emailAttentionEnabled },
    select: { emailAttentionEnabled: true },
  });

  return NextResponse.json(user);
}
