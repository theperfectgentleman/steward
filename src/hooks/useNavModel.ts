"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import { canViewAllCommittees } from "@/lib/types";
import { buildNavModel, type NavModel } from "@/lib/nav";
import type { CommitteeRef } from "@/lib/navigation";

export function useNavModel(): {
  model: NavModel | null;
  committees: CommitteeRef[];
  loading: boolean;
} {
  const { user, activeCommitteeId } = useApp();
  const [committees, setCommittees] = useState<CommitteeRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.activeOrganizationId) {
      setCommittees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const perm = toPermissionUser(user);
    const scope = canViewAllCommittees(perm) ? "all" : user.id;
    fetch(`/api/committees?scope=${scope}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setCommittees(data);
        else setCommittees([]);
      })
      .catch(() => setCommittees([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return { model: null, committees: [], loading: false };
  }

  return {
    model: buildNavModel(user, committees, activeCommitteeId),
    committees,
    loading,
  };
}
