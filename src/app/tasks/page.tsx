"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TasksView } from "@/components/views/TasksView";
import { useApp } from "@/providers/AppProvider";
import { isAllGroups } from "@/lib/navigation";

function TasksContent() {
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

  return <TasksView committeeId={committeeId} />;
}

export default function TasksPage() {
  return (
    <AuthGate>
      <TasksContent />
    </AuthGate>
  );
}
