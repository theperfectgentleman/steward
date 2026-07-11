"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommitteeGuard } from "@/components/CommitteeGuard";
import { CommitteePageHeader } from "@/components/layout/CommitteePageHeader";
import { EventDetailView } from "@/components/views/EventDetailView";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import { useParams } from "next/navigation";

function EventDetailContent() {
  const { committeeId } = useCommitteeContext();
  const params = useParams();
  const eventId = params?.eventId as string;

  if (!committeeId || !eventId) return null;
  return <EventDetailView committeeId={committeeId} eventId={eventId} />;
}

export default function CommitteeEventDetailPage() {
  return (
    <AuthGate>
      <CommitteeGuard>
        <CommitteePageHeader>
          <EventDetailContent />
        </CommitteePageHeader>
      </CommitteeGuard>
    </AuthGate>
  );
}
