"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { EventsView } from "@/components/views/EventsView";
import { useApp } from "@/providers/AppProvider";
import { isAllGroups } from "@/lib/navigation";

function EventsContent() {
  const { activeCommitteeId, setActiveCommitteeId } = useApp();
  const searchParams = useSearchParams();
  const queryCommitteeId = searchParams.get("committeeId");

  useEffect(() => {
    if (queryCommitteeId && !isAllGroups(queryCommitteeId)) {
      setActiveCommitteeId(queryCommitteeId);
    }
  }, [queryCommitteeId, setActiveCommitteeId]);

  const committeeId = useMemo(() => {
    if (queryCommitteeId && !isAllGroups(queryCommitteeId)) {
      return queryCommitteeId;
    }
    if (activeCommitteeId && !isAllGroups(activeCommitteeId)) {
      return activeCommitteeId;
    }
    return null;
  }, [queryCommitteeId, activeCommitteeId]);

  return <EventsView committeeId={committeeId} />;
}

export default function EventsPage() {
  return (
    <AuthGate>
      <EventsContent />
    </AuthGate>
  );
}
