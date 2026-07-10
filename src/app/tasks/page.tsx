"use client";

import { AuthGate } from "@/components/AuthGate";
import { TasksView } from "@/components/views/TasksView";

export default function TasksPage() {
  return (
    <AuthGate>
      <TasksView />
    </AuthGate>
  );
}
