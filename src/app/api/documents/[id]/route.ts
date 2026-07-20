import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth";
import {
  asPermissionUser,
  assertCommitteeAccess,
  requireActiveOrg,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadDocuments, canViewAllCommittees } from "@/lib/types";

function authorizeLibraryDoc(
  user: SessionUser,
  committeeId: string | null,
): NextResponse | null {
  const perm = asPermissionUser(user);
  if (committeeId) {
    const access = assertCommitteeAccess(user, committeeId);
    if (access) return access;
    if (!canReadDocuments(perm, committeeId) && !canViewAllCommittees(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    return null;
  }
  if (canViewAllCommittees(perm) || canReadDocuments(perm)) return null;
  if (user.committeeMemberships.length === 0) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await prisma.libraryDocument.findFirst({
    where: {
      id,
      OR: [{ organizationId: auth.org.organizationId }, { organizationId: null }],
    },
    include: {
      committee: {
        select: { id: true, name: true, charterLetter: true, organizationId: true },
      },
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.committee && doc.committee.organizationId !== auth.org.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const denied = authorizeLibraryDoc(auth.user, doc.committeeId);
  if (denied) return denied;

  return NextResponse.json(doc);
}
