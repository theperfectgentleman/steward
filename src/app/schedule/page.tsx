"use client";

import { AuthGate } from "@/components/AuthGate";
import { ScheduleView } from "@/components/views/ScheduleView";

export default function SchedulePage() {
  return (
    <AuthGate>
      <ScheduleView />
    </AuthGate>
  );
}
