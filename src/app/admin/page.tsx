"use client";

import { AuthGate } from "@/components/AuthGate";
import { AdminView } from "@/components/views/AdminView";
import { useApp } from "@/providers/AppProvider";
import { canManageUsers } from "@/lib/types";

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user } = useApp();

  if (!user || !canManageUsers(user.role)) {
    return (
      <p className="text-center text-muted py-12">
        Admin access is restricted to System and Super Admins.
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
