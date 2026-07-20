"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommitteeGuard } from "@/components/CommitteeGuard";
import { CommitteePageHeader } from "@/components/layout/CommitteePageHeader";
import { CommitteeDashboardView } from "@/components/views/CommitteeDashboardView";

export default function CommitteePage() {
  return (
    <AuthGate>
      <CommitteeGuard>
        <CommitteePageHeader tabsAfterTitle>
          <CommitteeDashboardView />
        </CommitteePageHeader>
      </CommitteeGuard>
    </AuthGate>
  );
}
