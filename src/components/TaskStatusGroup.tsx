"use client";

import { useState, type MutableRefObject } from "react";
import { Check, GripVertical, ListTodo } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { taskPath } from "@/lib/navigation";
import { LIST_STATUS_META } from "@/lib/kanban";
import { TASK_STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "@/lib/types";
import { formatDate } from "@/lib/dates";

export type TaskListItem = {
  id: string;
  title: string;
  status: TaskStatus;
  description?: string | null;
  dueDate?: string | null;
  assignedTo: { id: string; name: string } | null;
  eventTitle?: string | null;
  isSubtask?: boolean;
  reviewAssignmentId?: string | null;
};

type Member = { id: string; name: string };

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type TaskStatusGroupProps = {
  status: TaskStatus;
  tasks: TaskListItem[];
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

export function TaskStatusGroup({
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
}: TaskStatusGroupProps) {
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
      className={`rounded-xl border bg-white overflow-hidden transition-shadow ${
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
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-charcoal/10 bg-surface px-1.5 text-xs font-bold text-muted tabular-nums">
          {tasks.length}
        </span>
      </header>

      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <ListTodo className="h-3 w-3" />
          Task Name
        </div>
      </div>

      <ul className="divide-y divide-charcoal/6">
        {tasks.map((task) => (
          <TaskListRow
            key={task.id}
            task={task}
            committeeId={committeeId}
            userId={userId}
            canEdit={canEdit}
            members={members}
            highlighted={highlightedTaskId === task.id}
            rowRef={(el) => {
              if (taskRefs) taskRefs.current[task.id] = el;
            }}
            onStatusChange={onStatusChange}
            onAssign={onAssign}
            onDelete={onDelete}
            onSubmitReview={onSubmitReview}
          />
        ))}
        {tasks.length === 0 && (
          <li className="px-3 py-5 text-center text-sm text-muted">
            No tasks
          </li>
        )}
      </ul>
    </section>
  );
}

function TaskListRow({
  task,
  committeeId,
  userId,
  canEdit,
  members,
  highlighted,
  rowRef,
  onStatusChange,
  onAssign,
  onDelete,
  onSubmitReview,
}: {
  task: TaskListItem;
  committeeId?: string;
  userId: string;
  canEdit: boolean;
  members: Member[];
  highlighted?: boolean;
  rowRef?: (el: HTMLElement | null) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAssign: (id: string, userId: string) => void;
  onDelete?: (id: string) => void;
  onSubmitReview?: (assignmentId: string) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const isAssignee = task.assignedTo?.id === userId;
  const canUpdateStatus = canEdit || isAssignee;
  const done = task.status === "DONE";
  const dueLabel = task.dueDate ? formatDate(task.dueDate) : null;

  const showSubmitReview =
    Boolean(task.reviewAssignmentId) &&
    isAssignee &&
    done &&
    typeof onSubmitReview === "function";

  const toggleDone = () => {
    if (!canUpdateStatus) return;
    onStatusChange(task.id, done ? "TODO" : "DONE");
  };

  return (
    <li
      ref={rowRef}
      draggable={canUpdateStatus}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group flex items-center gap-1.5 px-2 py-1.5 transition-colors ${
        highlighted ? "bg-primary/8 ring-1 ring-inset ring-primary/30" : "hover:bg-surface/80"
      } ${done ? "opacity-70" : ""}`}
    >
      {canUpdateStatus && (
        <span
          className="shrink-0 cursor-grab active:cursor-grabbing text-charcoal/25 group-hover:text-charcoal/45 touch-none"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}

      <button
        type="button"
        onClick={toggleDone}
        disabled={!canUpdateStatus}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          done
            ? "border-primary bg-primary text-white"
            : "border-charcoal/25 bg-white hover:border-primary"
        } disabled:opacity-50`}
        aria-label={done ? "Mark as not done" : "Mark as done"}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="min-w-0 flex-1 text-left py-0.5"
      >
        <span
          className={`block text-sm font-medium leading-snug truncate ${
            done ? "text-muted line-through" : "text-charcoal"
          }`}
        >
          {task.isSubtask ? `↳ ${task.title}` : task.title}
        </span>
        {(task.eventTitle || dueLabel) && (
          <span className="mt-0.5 block text-[11px] text-muted truncate">
            {[task.eventTitle, dueLabel ? `Due ${dueLabel}` : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => canEdit && setSheetOpen(true)}
        className="shrink-0"
        aria-label={
          task.assignedTo
            ? `Assigned to ${task.assignedTo.name}`
            : "Unassigned"
        }
        title={task.assignedTo?.name ?? "Unassigned"}
      >
        {task.assignedTo ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-charcoal text-[10px] font-bold text-white">
            {initials(task.assignedTo.name)}
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-charcoal/20 text-[10px] font-bold text-muted">
            —
          </span>
        )}
      </button>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={task.title}>
        <div className="space-y-4">
          {task.description && (
            <p className="text-sm text-muted leading-relaxed">{task.description}</p>
          )}

          {canUpdateStatus && (
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Status
              </span>
              <select
                value={task.status}
                onChange={(e) => {
                  onStatusChange(task.id, e.target.value as TaskStatus);
                  setSheetOpen(false);
                }}
                className="mt-1.5 w-full rounded-lg border border-charcoal/10 bg-surface px-3 py-2.5 text-sm font-semibold text-charcoal"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {canEdit && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Assign to
              </p>
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {members.length === 0 && (
                  <li className="text-sm text-muted py-2">No members yet.</li>
                )}
                {members.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onAssign(task.id, m.id);
                        setSheetOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border touch-target text-left ${
                        task.assignedTo?.id === m.id
                          ? "border-primary bg-primary/5"
                          : "border-charcoal/10 hover:border-primary/40"
                      }`}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal text-white text-xs font-bold">
                        {initials(m.name)}
                      </span>
                      <span className="text-sm font-semibold">{m.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showSubmitReview && task.reviewAssignmentId && (
            <button
              type="button"
              onClick={() => {
                onSubmitReview?.(task.reviewAssignmentId!);
                setSheetOpen(false);
              }}
              className="w-full touch-target rounded-lg bg-primary/15 text-charcoal text-sm font-semibold border border-primary/30"
            >
              Submit assignment for review
            </button>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-charcoal/8">
            {committeeId && (
              <CopyLinkButton path={taskPath(committeeId, task.id)} label="Copy link" />
            )}
            {canEdit && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(task.id);
                  setSheetOpen(false);
                }}
                className="text-sm font-semibold text-accent hover:underline"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </BottomSheet>
    </li>
  );
}
