"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommitteeGuard } from "@/components/CommitteeGuard";
import { CommitteePageHeader } from "@/components/layout/CommitteePageHeader";
import { MinutesView } from "@/components/views/MinutesView";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";

function MinutesContent() {
  const { committeeId } = useCommitteeContext();
  if (!committeeId) return null;
  return <MinutesView committeeId={committeeId} />;
}

export default function CommitteeMinutesPage() {
  return (
    <AuthGate>
      <CommitteeGuard>
        <CommitteePageHeader>
          <MinutesContent />
        </CommitteePageHeader>
      </CommitteeGuard>
    </AuthGate>
  );
}
