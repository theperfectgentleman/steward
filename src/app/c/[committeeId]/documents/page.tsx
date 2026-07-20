"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommitteeGuard } from "@/components/CommitteeGuard";
import { CommitteePageHeader } from "@/components/layout/CommitteePageHeader";
import { DocumentsView } from "@/components/views/DocumentsView";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";

function CommitteeDocumentsContent() {
  const { committeeId, committee } = useCommitteeContext();
  if (!committeeId || !committee) return null;
  return (
    <DocumentsView
      committeeId={committeeId}
      committeeName={committee.name}
    />
  );
}

export default function CommitteeDocumentsPage() {
  return (
    <AuthGate>
      <CommitteeGuard>
        <CommitteePageHeader>
          <CommitteeDocumentsContent />
        </CommitteePageHeader>
      </CommitteeGuard>
    </AuthGate>
  );
}
