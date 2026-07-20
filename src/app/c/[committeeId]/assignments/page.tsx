"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommitteeGuard } from "@/components/CommitteeGuard";
import { CommitteePageHeader } from "@/components/layout/CommitteePageHeader";
import { AssignmentsInboxView } from "@/components/views/AssignmentsInboxView";

export default function AssignmentsPage() {
  return (
    <AuthGate>
      <CommitteeGuard>
        <CommitteePageHeader>
          <AssignmentsInboxView />
        </CommitteePageHeader>
      </CommitteeGuard>
    </AuthGate>
  );
}
