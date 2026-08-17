import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  createOrganization,
  listUserOrganizations,
  slugifyOrganizationName,
  type OrgTemplateId,
} from "@/lib/organizations";
import { logActivity } from "@/lib/activity";

const TEMPLATES: OrgTemplateId[] = ["blank", "church", "board"];

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    name?: string;
    slug?: string;
    template?: OrgTemplateId;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const template = TEMPLATES.includes(body.template ?? "blank")
    ? (body.template ?? "blank")
    : "blank";
  const slug =
    body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
    slugifyOrganizationName(body.name);

  try {
    const org = await createOrganization({
      name: body.name.trim(),
      slug,
      ownerUserId: auth.user.id,
      template,
    });
    await logActivity({
      entityType: "STRUCTURE",
      entityId: org.id,
      action: "ORGANIZATION_CREATED",
      actorId: auth.user.id,
      organizationId: org.id,
    });
    const memberships = await listUserOrganizations(auth.user.id);
    return NextResponse.json({ org, memberships }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    const status = message.includes("Unique") ? 409 : 400;
    return NextResponse.json(
      { error: status === 409 ? "That organization slug is taken" : message },
      { status },
    );
  }
}
