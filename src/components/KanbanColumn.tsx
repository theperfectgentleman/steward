"use client";

import { useState, type MutableRefObject } from "react";
import type { TaskStatus } from "@/lib/types";
import { LIST_STATUS_META } from "@/lib/kanban";
import { TaskCard } from "@/components/TaskCard";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  assignedTo: { id: string; name: string } | null;
  eventTitle?: string | null;
  isSubtask?: boolean;
  reviewAssignmentId?: string | null;
};

type Member = { id: string; name: string };

type KanbanColumnProps = {
  status: TaskStatus;
  tasks: Task[];
  committeeId?: string;
  userId: string;
  canEdit: boolean;
  members: Member[];
  highlightedTaskId?: string | null;
  taskRefs?: MutableRefObject<Record<string, HTMLElement | null>>;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAssign: (id: string, userId: string) => void;
  onDelete?: (id: string) => void;
  onSubmitReview?: (assignmentId: string) => void;
};

export function KanbanColumn({
  status,
  tasks,
  committeeId,
  userId,
  canEdit,
  members,
  highlightedTaskId,
  taskRefs,
  onStatusChange,
  onAssign,
  onDelete,
  onSubmitReview,
}: KanbanColumnProps) {
  const meta = LIST_STATUS_META[status];
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <section
      id={`kanban-column-${status}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData("text/plain");
        if (taskId) onStatusChange(taskId, status);
      }}
      className={`flex flex-col min-h-[320px] min-w-0 rounded-xl border bg-white overflow-hidden transition-shadow ${
        isDragOver
          ? "border-primary ring-2 ring-primary/20 shadow-sm"
          : "border-charcoal/8 shadow-2xs"
      }`}
    >
      <header className="flex items-center gap-2 px-3 py-2.5 border-b border-charcoal/6">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.pill}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.icon}`} />
          {meta.label}
        </span>
        <span className="ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-charcoal/10 bg-surface px-1.5 text-xs font-bold text-muted tabular-nums">
          {tasks.length}
        </span>
      </header>

      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
        {tasks.map((task) => (
          <div
            key={task.id}
            ref={(el) => {
              if (taskRefs) taskRefs.current[task.id] = el;
            }}
            className={
              highlightedTaskId === task.id
                ? "rounded-xl ring-2 ring-primary ring-offset-1"
                : undefined
            }
          >
            <TaskCard
              layout="kanban"
              id={task.id}
              committeeId={committeeId}
              title={task.title}
              description={task.description}
              status={task.status}
              dueDate={task.dueDate}
              assigneeName={task.assignedTo?.name}
              assignedToId={task.assignedTo?.id}
              currentUserId={userId}
              canEdit={canEdit}
              isAssignee={task.assignedTo?.id === userId}
              members={members}
              isSubtask={task.isSubtask}
              eventTitle={task.eventTitle}
              onStatusChange={onStatusChange}
              onAssign={onAssign}
              onDelete={onDelete}
              reviewAssignmentId={task.reviewAssignmentId}
              onSubmitReview={onSubmitReview}
            />
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-charcoal/12 bg-surface/50 px-3 py-6 text-center">
            <p className="text-sm text-muted">No tasks</p>
          </div>
        )}
      </div>
    </section>
  );
}
