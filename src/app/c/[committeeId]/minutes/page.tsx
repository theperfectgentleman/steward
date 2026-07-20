"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { committeePath } from "@/lib/navigation";

function MinutesToScheduleRedirect() {
  const router = useRouter();
  const params = useParams();
  const committeeId = typeof params.committeeId === "string" ? params.committeeId : null;

  useEffect(() => {
    if (committeeId) {
      router.replace(committeePath(committeeId, "schedule"));
    } else {
      router.replace("/schedule");
    }
  }, [router, committeeId]);

  return <p className="text-muted text-center py-12">Redirecting to schedule…</p>;
}

export default function CommitteeMinutesPage() {
  return (
    <AuthGate>
      <MinutesToScheduleRedirect />
    </AuthGate>
  );
}
