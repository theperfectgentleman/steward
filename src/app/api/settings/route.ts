import { NextResponse } from "next/server";
import { requireRoles, requireUser } from "@/lib/auth";
import { getAppSettings, updateAppSettings } from "@/lib/settings";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const settings = await getAppSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const auth = await requireRoles(["SUPER_ADMIN"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    committeeBudgetsEnabled?: boolean;
  };

  if (
    body.committeeBudgetsEnabled !== undefined &&
    typeof body.committeeBudgetsEnabled !== "boolean"
  ) {
    return NextResponse.json(
      { error: "committeeBudgetsEnabled must be a boolean" },
      { status: 400 },
    );
  }

  const settings = await updateAppSettings({
    ...(body.committeeBudgetsEnabled !== undefined && {
      committeeBudgetsEnabled: body.committeeBudgetsEnabled,
    }),
  });

  return NextResponse.json(settings);
}
