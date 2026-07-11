"use client";

import { AuthGate } from "@/components/AuthGate";
import { AssignmentsInboxView } from "@/components/views/AssignmentsInboxView";

export default function AssignmentsPage() {
  return (
    <AuthGate>
      <AssignmentsInboxView />
    </AuthGate>
  );
}
