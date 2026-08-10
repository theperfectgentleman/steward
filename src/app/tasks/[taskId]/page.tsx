"use client";

import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TaskDetailView } from "@/components/views/TaskDetailView";

function TaskDetailContent() {
  const params = useParams();
  const taskId = params?.taskId as string;

  if (!taskId) {
    return <p className="text-muted text-center py-12">Work not found.</p>;
  }

  return <TaskDetailView taskId={taskId} />;
}

export default function TaskDetailPage() {
  return (
    <AuthGate>
      <TaskDetailContent />
    </AuthGate>
  );
}
