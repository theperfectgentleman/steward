import { NextResponse } from "next/server";
import { asPermissionUser, requireUser } from "@/lib/auth";
import { buildAttentionItems } from "@/lib/attention";
import { maybeSendAttentionDigest } from "@/lib/notify/attention-email";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const items = await buildAttentionItems(auth.user);
  const nowCount = items.filter((i) => i.urgency === "NOW").length;

  const dbUser = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      emailAttentionEnabled: true,
      lastAttentionEmailAt: true,
    },
  });

  if (dbUser) {
    void maybeSendAttentionDigest({
      userId: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      emailAttentionEnabled: dbUser.emailAttentionEnabled,
      lastAttentionEmailAt: dbUser.lastAttentionEmailAt,
      items,
    }).catch((err) => console.warn("[attention-email]", err));
  }

  return NextResponse.json({ items, nowCount });
}
