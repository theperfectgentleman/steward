import type { SessionUser } from "@/lib/auth";

type UserWithRelations = {
  id: string;
  name: string;
  email: string;
  role: SessionUser["role"];
  committeeMemberships: { committeeId: string; title: SessionUser["committeeMemberships"][number]["title"] }[];
  presbyteryMembership: { isHead: boolean } | null;
};

export function toSessionPayload(user: UserWithRelations) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    committeeIds: user.committeeMemberships.map((m) => m.committeeId),
    committeeMemberships: user.committeeMemberships.map((m) => ({
      committeeId: m.committeeId,
      title: m.title,
    })),
    presbyteryMembership: user.presbyteryMembership
      ? { isHead: user.presbyteryMembership.isHead }
      : null,
  };
}

export function setSessionCookie(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
  userId: string,
) {
  response.cookies.set("unitycommit-user", userId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}
