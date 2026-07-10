"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommitteeGuard } from "@/components/CommitteeGuard";
import { CommitteePageHeader } from "@/components/layout/CommitteePageHeader";
import { TasksView } from "@/components/views/TasksView";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";

function TasksContent() {
  const { committeeId } = useCommitteeContext();
  if (!committeeId) return null;
  return <TasksView committeeId={committeeId} />;
}

export default function CommitteeTasksPage() {
  return (
    <AuthGate>
      <CommitteeGuard>
        <CommitteePageHeader>
          <TasksContent />
        </CommitteePageHeader>
      </CommitteeGuard>
    </AuthGate>
  );
}
