"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import { canViewAllCommittees } from "@/lib/types";
import { committeePath } from "@/lib/navigation";

export function CommitteeGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useApp();
  const { committeeId, committee, loading } = useCommitteeContext();

  useEffect(() => {
    if (!user || loading) return;
    if (!committeeId) {
      router.replace("/");
      return;
    }
    if (!committee) {
      router.replace("/");
      return;
    }
    localStorage.setItem("unitycommit-committee", committeeId);
  }, [user, committeeId, committee, loading, router]);

  if (loading) {
    return <p className="text-muted text-center py-12">Loading…</p>;
  }

  if (!committee) {
    return (
      <p className="text-muted text-center py-12">
        You do not have access to this committee.
      </p>
    );
  }

  return <>{children}</>;
}

export function HomeRedirect() {
  const router = useRouter();
  const { user, loading } = useApp();

  useEffect(() => {
    if (loading || !user) return;
    if (canViewAllCommittees(user.role)) return;
    if (user.committeeIds.length === 1) {
      router.replace(committeePath(user.committeeIds[0]));
    }
  }, [user, loading, router]);

  return null;
}
