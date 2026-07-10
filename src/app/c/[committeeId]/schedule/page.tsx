"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommitteeGuard } from "@/components/CommitteeGuard";
import { CommitteePageHeader } from "@/components/layout/CommitteePageHeader";
import { ScheduleView } from "@/components/views/ScheduleView";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";

function ScheduleContent() {
  const { committeeId } = useCommitteeContext();
  if (!committeeId) return null;
  return <ScheduleView committeeId={committeeId} />;
}

export default function CommitteeSchedulePage() {
  return (
    <AuthGate>
      <CommitteeGuard>
        <CommitteePageHeader>
          <ScheduleContent />
        </CommitteePageHeader>
      </CommitteeGuard>
    </AuthGate>
  );
}
