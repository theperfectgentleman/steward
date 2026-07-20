import { NextResponse } from "next/server";

/** Guard for Event.committeeId after it became optional. */
export function requireEventCommitteeId(committeeId: string | null) {
  if (!committeeId) {
    return NextResponse.json(
      { error: "Event is not linked to a committee" },
      { status: 400 },
    );
  }
  return null;
}
