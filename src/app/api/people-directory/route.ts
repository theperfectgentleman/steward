import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { getPeopleDirectory } from "@/lib/people-directory.server";

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");

  const directory = await getPeopleDirectory(auth.org.organizationId, {
    committeeId: committeeId || null,
  });

  return NextResponse.json(directory, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
