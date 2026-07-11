"use client";

import { use } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AssignmentDetailView } from "@/components/views/AssignmentDetailView";

export default function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGate>
      <AssignmentDetailView assignmentId={id} />
    </AuthGate>
  );
}
