import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  clearSuperUnlockCookie,
  createSuperUnlockToken,
  isSuperUnlocked,
  setSuperUnlockCookie,
  superPasswordConfigured,
  verifySuperPassword,
} from "@/lib/super-gate";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  if (!auth.user.isPlatformAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  return NextResponse.json({
    configured: superPasswordConfigured(),
    unlocked: await isSuperUnlocked(auth.user.id),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  if (!auth.user.isPlatformAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!superPasswordConfigured()) {
    return NextResponse.json(
      { error: "Super password is not configured" },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { password?: string };
  if (!body.password || !verifySuperPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 403 });
  }

  const token = createSuperUnlockToken(auth.user.id);
  if (!token) {
    return NextResponse.json(
      { error: "Super password is not configured" },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ unlocked: true });
  setSuperUnlockCookie(response, token);
  return response;
}

export async function DELETE() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const response = NextResponse.json({ unlocked: false });
  clearSuperUnlockCookie(response);
  return response;
}
