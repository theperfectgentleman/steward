"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { HomeRedirect } from "@/components/CommitteeGuard";
import { OverallDashboardView } from "@/components/views/OverallDashboardView";
import { useApp } from "@/providers/AppProvider";
import { isAllGroups } from "@/lib/navigation";

function HomeContent() {
  const { setActiveCommitteeId } = useApp();
  const searchParams = useSearchParams();
  const queryCommitteeId = searchParams.get("committeeId");

  useEffect(() => {
    if (queryCommitteeId && !isAllGroups(queryCommitteeId)) {
      setActiveCommitteeId(queryCommitteeId);
    }
  }, [queryCommitteeId, setActiveCommitteeId]);

  return (
    <>
      <HomeRedirect />
      <OverallDashboardView />
    </>
  );
}

export default function HomePage() {
  return (
    <AuthGate>
      <HomeContent />
    </AuthGate>
  );
}
