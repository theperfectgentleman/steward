import { NextResponse } from "next/server";

/** @deprecated Use PATCH /api/events/[id]/attendance */
export async function PATCH() {
  return NextResponse.json(
    { error: "Deprecated. Use PATCH /api/events/{eventId}/attendance instead." },
    { status: 410, headers: { Deprecation: "true" } },
  );
}
