"use client";

import { AuthGate } from "@/components/AuthGate";
import { ReportsPipelineView } from "@/components/views/ReportsPipelineView";

export default function ReportsPage() {
  return (
    <AuthGate>
      <ReportsPipelineView />
    </AuthGate>
  );
}
