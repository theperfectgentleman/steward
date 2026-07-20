import { NextResponse } from "next/server";
import { getSessionUser, USER_COOKIE, ACTIVE_ORG_COOKIE } from "@/lib/auth";
import { toSessionPayload } from "@/lib/session";
import { listUserOrganizations } from "@/lib/organizations";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.status === "DISABLED") {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const memberships = await listUserOrganizations(user.id);
  const payload = toSessionPayload({
    ...user,
    isPlatformAdmin: user.isPlatformAdmin,
    organizationMemberships: user.organizationMemberships.map((m) => ({
      role: m.role,
      organization: {
        id: m.organization.id,
        name: m.organization.name,
        status: m.organization.status,
      },
    })),
  });

  return NextResponse.json({
    ...payload,
    memberships,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(USER_COOKIE);
  response.cookies.delete(ACTIVE_ORG_COOKIE);
  return response;
}
