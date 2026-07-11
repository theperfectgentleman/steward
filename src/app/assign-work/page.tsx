"use client";

import { AuthGate } from "@/components/AuthGate";
import { AssignWorkView } from "@/components/views/AssignWorkView";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import { canCreatePresbyteryAssignment } from "@/lib/types";
import Link from "next/link";
import { presbyteryAssignmentsPath } from "@/lib/navigation";

export default function AssignWorkPage() {
  return (
    <AuthGate>
      <AssignWorkPageInner />
    </AuthGate>
  );
}

function AssignWorkPageInner() {
  const { user } = useApp();
  const perm = user ? toPermissionUser(user) : null;
  const canAssign = perm && canCreatePresbyteryAssignment(perm);

  if (!canAssign) {
    return (
      <div className="space-y-4 max-w-lg mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-charcoal">Assign work</h1>
        <p className="text-muted">
          Presbytery assignments are available to presbytery members.
        </p>
        <Link
          href={presbyteryAssignmentsPath()}
          className="text-sm font-semibold text-primary hover:underline"
        >
          View assignment pipeline
        </Link>
      </div>
    );
  }

  return <AssignWorkView />;
}
