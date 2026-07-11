"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import { canViewAllCommittees } from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";
import { committeePath } from "@/lib/navigation";
import { PageShimmer } from "@/components/loading/PageShimmer";
import { AccessDenied } from "@/components/AccessDenied";

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
    if (committee) {
      localStorage.setItem("unitycommit-committee", committeeId);
    }
  }, [user, committeeId, committee, loading, router]);

  if (loading) {
    return <PageShimmer variant="list" lines={4} />;
  }

  if (!committee) {
    return <AccessDenied itemLabel="committee" />;
  }

  return <>{children}</>;
}

export function HomeRedirect() {
  const router = useRouter();
  const { user, loading } = useApp();

  useEffect(() => {
    if (loading || !user) return;
    if (user && canViewAllCommittees(toPermissionUser(user))) return;
    if (user.committeeIds.length === 1) {
      router.replace(committeePath(user.committeeIds[0]));
    }
  }, [user, loading, router]);

  return null;
}
