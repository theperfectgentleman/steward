"use client";

import { useState } from "react";
import type { TaskStatus } from "@/lib/types";
import { COLUMN_META } from "@/lib/kanban";
import { TaskCard } from "@/components/TaskCard";
import type { UserRole } from "@/lib/types";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  assignedTo: { id: string; name: string } | null;
  eventTitle?: string | null;
  isSubtask?: boolean;
};

type Member = { id: string; name: string };

type KanbanColumnProps = {
  status: TaskStatus;
  tasks: Task[];
  userId: string;
  userRole: UserRole;
  members: Member[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAssign: (id: string, userId: string) => void;
  onDelete?: (id: string) => void;
};

export function KanbanColumn({
  status,
  tasks,
  userId,
  userRole,
  members,
  onStatusChange,
  onAssign,
  onDelete,
}: KanbanColumnProps) {
  const meta = COLUMN_META[status];
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      onStatusChange(taskId, status);
    }
  };

  return (
    <section
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col min-h-[420px] rounded-2xl border transition-all duration-200 ${
        isDragOver
          ? "border-primary ring-3 ring-primary/20 bg-slate-50 shadow-md scale-[1.01]"
          : `${meta.border} ${meta.header}`
      } overflow-hidden`}
    >
      <header className="flex items-center gap-2 px-4 py-3 border-b border-charcoal/10 bg-white/80">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.dot}`} />
        <h2 className="text-sm font-bold text-charcoal">{meta.label}</h2>
        <span className="ml-auto text-xs font-semibold text-muted bg-surface px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </header>

      <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-16rem)]">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            layout="kanban"
            id={task.id}
            title={task.title}
            description={task.description}
            status={task.status}
            dueDate={task.dueDate}
            assigneeName={task.assignedTo?.name}
            assignedToId={task.assignedTo?.id}
            currentUserId={userId}
            userRole={userRole}
            members={members}
            isSubtask={task.isSubtask}
            eventTitle={task.eventTitle}
            onStatusChange={onStatusChange}
            onAssign={onAssign}
            onDelete={onDelete}
          />
        ))}

        {tasks.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-charcoal/10 bg-white/60 px-4 py-8 text-center">
            <p className="text-sm text-muted">No tasks here</p>
          </div>
        )}
      </div>
    </section>
  );
}
