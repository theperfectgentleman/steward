"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { EventDetailView } from "@/components/views/EventDetailView";
import { PageShimmer } from "@/components/loading/PageShimmer";

function EventDetailContent() {
  const params = useParams();
  const eventId = params?.eventId as string;
  const [committeeId, setCommitteeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setCommitteeId(data?.committeeId ?? data?.committee?.id ?? null);
      })
      .catch(() => setCommitteeId(null))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <PageShimmer variant="list" lines={4} />;
  if (!committeeId || !eventId) {
    return <p className="text-muted text-center py-12">Event not found.</p>;
  }
  return <EventDetailView committeeId={committeeId} eventId={eventId} />;
}

export default function EventDetailPage() {
  return (
    <AuthGate>
      <EventDetailContent />
    </AuthGate>
  );
}
