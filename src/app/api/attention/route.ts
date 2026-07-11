import { NextResponse } from "next/server";
import { asPermissionUser, requireUser } from "@/lib/auth";
import { buildAttentionItems } from "@/lib/attention";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const items = await buildAttentionItems(auth.user);
  const nowCount = items.filter((i) => i.urgency === "NOW").length;

  return NextResponse.json({ items, nowCount });
}
