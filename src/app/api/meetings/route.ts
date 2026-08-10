import { NextResponse } from "next/server";

/** @deprecated Use /api/events/[id]/minutes and /api/events/[id]/attendance */
export async function GET() {
  return NextResponse.json(
    {
      error: "Deprecated. Use GET /api/events/{eventId}/minutes instead.",
    },
    { status: 410, headers: { Deprecation: "true" } },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Deprecated. Create a MEETING event instead." },
    { status: 410, headers: { Deprecation: "true" } },
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Deprecated. Use PATCH /api/events/{eventId}/minutes instead." },
    { status: 410, headers: { Deprecation: "true" } },
  );
}
