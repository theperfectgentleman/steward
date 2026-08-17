"use client";

import { AuthGate } from "@/components/AuthGate";
import { AdminView } from "@/components/views/AdminView";
import { useApp } from "@/providers/AppProvider";
import { canManageUsers } from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const perm = user ? toPermissionUser(user) : null;

  if (!perm || !canManageUsers(perm)) {
    return (
      <p className="text-center text-muted py-12">
        Admin access is restricted to Org Admin and Org Tech.
      </p>
    );
  }

  return <>{children}</>;
}

export default function AdminPage() {
  return (
    <AuthGate>
      <AdminGate>
        <AdminView />
      </AdminGate>
    </AuthGate>
  );
}
