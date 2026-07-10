import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("unitycommit-user")?.value ?? null;
}

export async function getSessionUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    include: { committeeMemberships: true },
  });
}
