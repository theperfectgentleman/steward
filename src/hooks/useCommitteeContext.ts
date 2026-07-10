"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/providers/AppProvider";
import type { CommitteeRef } from "@/lib/navigation";

export function useCommitteeContext() {
  const params = useParams();
  const { user } = useApp();
  const committeeId = typeof params?.committeeId === "string" ? params.committeeId : null;
  const [committee, setCommittee] = useState<CommitteeRef | null>(null);
  const [loading, setLoading] = useState(!!committeeId);

  useEffect(() => {
    if (!committeeId || !user) {
      setCommittee(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const scope =
      user.role === "SUPER_ADMIN" || user.role === "CHURCH_EXECUTIVE"
        ? "all"
        : user.id;

    fetch(`/api/committees?scope=${scope}`)
      .then((r) => r.json())
      .then((list: CommitteeRef[]) => {
        const found = list.find((c) => c.id === committeeId) ?? null;
        setCommittee(found);
      })
      .catch(() => setCommittee(null))
      .finally(() => setLoading(false));
  }, [committeeId, user]);

  return { committeeId, committee, loading };
}
