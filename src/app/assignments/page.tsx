"use client";

import { AuthGate } from "@/components/AuthGate";
import { PresbyteryAssignmentsView } from "@/components/views/PresbyteryAssignmentsView";

export default function AssignmentsPage() {
  return (
    <AuthGate>
      <PresbyteryAssignmentsView />
    </AuthGate>
  );
}
