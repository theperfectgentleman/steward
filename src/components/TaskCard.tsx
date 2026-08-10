"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Trash2, User } from "lucide-react";
import { CopyLinkButton } from "./CopyLinkButton";
import { taskPath } from "@/lib/navigation";
import { SegmentedControl } from "./SegmentedControl";
import { PeoplePicker } from "@/components/people/PeoplePicker";
import { TaskHoverPreview } from "./TaskHoverPreview";
import type { TaskStatus, TaskWorkClass } from "@/lib/types";
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_WORK_CLASS_LABELS,
} from "@/lib/types";
import { LIST_STATUS_META } from "@/lib/kanban";
import { formatDate } from "@/lib/dates";
import { richTextToPlain } from "./RichTextEditor";

type TaskCardProps = {
  id: string;
  committeeId?: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  workClass?: TaskWorkClass | null;
  dueDate?: string | null;
  assigneeName?: string | null;
  assignedToId?: string | null;
  currentUserId: string;
  canEdit: boolean;
  isAssignee: boolean;
  layout?: "card" | "kanban";
  isSubtask?: boolean;
  eventTitle?: string | null;
  subtasks?: {
    id: string;
    title: string;
    status: TaskStatus;
    assignedTo?: { id: string; name: string } | null;
  }[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAssign: (id: string, userId: string) => void;
  onDelete?: (id: string) => void;
  /** Multi-hat label e.g. "Finance · Chair" */
  contextLabel?: string | null;
  /** Show Send for review when task can enter review ladder */
  canSubmitReview?: boolean;
  onSubmitReview?: (taskId: string) => void;
  /** Waiting for my review */
  canApproveReview?: boolean;
  onApproveReview?: (taskId: string) => void;
  onReturnReview?: (taskId: string) => void;
};

function workClassBadgeClass(workClass: TaskWorkClass) {
  if (workClass === "DIRECTIVE") {
    return "text-primary bg-primary/10";
  }
  if (workClass === "PERSONAL") {
    return "text-muted bg-slate-100";
  }
  return "text-charcoal-muted bg-slate-100";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

export function TaskCard({
  id,
  committeeId,
  title,
  description,
  status,
  workClass,
  dueDate,
  assigneeName,
  assignedToId,
  currentUserId,
  canEdit,
  isAssignee,
  layout = "card",
  isSubtask = false,
  eventTitle,
  subtasks = [],
  onStatusChange,
  onAssign,
  onDelete,
  contextLabel,
  canSubmitReview = false,
  onSubmitReview,
  canApproveReview = false,
  onApproveReview,
  onReturnReview,
}: TaskCardProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const showSubmitReview =
    canSubmitReview && typeof onSubmitReview === "function";
  const showApprove =
    canApproveReview && typeof onApproveReview === "function";
  const canAssign = canEdit;
  const canUpdateStatus = canEdit || isAssignee;

  const dueLabel = dueDate ? formatDate(dueDate) : null;
  const plainDescription = description ? richTextToPlain(description) : "";

  const handleDragStart = (e: React.DragEvent) => {
    setDragging(true);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  if (layout === "kanban") {
    return (
      <TaskHoverPreview
        disabled={dragging || assignOpen}
        task={{
          title,
          description,
          status,
          dueDate,
          assigneeName,
          eventTitle,
          isSubtask,
          subtasks,
        }}
      >
        <article
          draggable
          onDragStart={handleDragStart}
          onDragEnd={() => setDragging(false)}
          className="bg-white rounded-xl border border-charcoal/5 p-3 shadow-2xs hover:shadow-sm hover:border-charcoal/10 transition-all space-y-2 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {contextLabel && (
                <p className="text-[10px] font-semibold text-muted mb-1 truncate">
                  {contextLabel}
                </p>
              )}
              {workClass ? (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded mb-1 inline-block ${workClassBadgeClass(workClass)}`}
                >
                  {TASK_WORK_CLASS_LABELS[workClass]}
                </span>
              ) : isSubtask ? (
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted bg-slate-100 px-1.5 py-0.5 rounded mb-1 inline-block">
                  Subtask
                </span>
              ) : null}
              {eventTitle && !isSubtask && (
                <p className="text-[10px] font-bold uppercase tracking-wide text-accent mb-1 truncate">
                  {eventTitle}
                </p>
              )}
              {committeeId ? (
                <Link
                  href={taskPath(committeeId, id)}
                  onClick={(e) => e.stopPropagation()}
                  data-task-title
                  className="font-bold text-charcoal leading-snug line-clamp-2 hover:text-primary transition-colors"
                >
                  {title}
                </Link>
              ) : (
                <h3
                  data-task-title
                  className="font-bold text-charcoal leading-snug line-clamp-2"
                >
                  {title}
                </h3>
              )}
              {plainDescription && (
                <p
                  data-task-desc
                  className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed font-medium"
                >
                  {plainDescription}
                </p>
              )}
            </div>
            {canAssign && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(id)}
                className="touch-target flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 shrink-0"
                aria-label="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {dueLabel && (
              <span className="inline-flex items-center gap-1 text-muted bg-slate-50 border border-charcoal/5 px-2 py-1 rounded-lg font-medium">
                <Calendar className="h-3.5 w-3.5" />
                {dueLabel}
              </span>
            )}
            <button
              type="button"
              disabled={!canAssign}
              onClick={(e) => {
                e.stopPropagation();
                setAssignOpen(true);
              }}
              className={`inline-flex min-w-0 items-center gap-1.5 border px-2 py-1 rounded-lg transition-colors ${
                canAssign
                  ? "text-charcoal bg-slate-50 border-charcoal/5 hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                  : "text-charcoal bg-slate-50 border-charcoal/5 cursor-default opacity-90"
              }`}
              aria-label={
                assigneeName
                  ? `Assigned to ${assigneeName}. Click to reassign`
                  : "Assign task"
              }
              title={
                canAssign
                  ? assigneeName
                    ? "Click to reassign"
                    : "Click to assign"
                  : undefined
              }
            >
              {assigneeName ? (
                <>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-charcoal text-white text-[10px] font-extrabold shrink-0">
                    {initials(assigneeName)}
                  </span>
                  <span className="font-bold text-charcoal-muted truncate max-w-[72px]">
                    {assigneeName.split(" ")[0]}
                  </span>
                </>
              ) : (
                <>
                  <User className="h-3.5 w-3.5 text-muted" />
                  <span className="text-muted font-medium truncate">
                    {canAssign ? "Assign" : "Unassigned"}
                  </span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-charcoal/5">
            {committeeId && (
              <CopyLinkButton
                path={taskPath(committeeId, id)}
                label="Share"
                iconOnly
              />
            )}
            {showSubmitReview && (
              <button
                type="button"
                onClick={() => onSubmitReview?.(id)}
                className="text-xs font-bold text-primary hover:underline touch-target px-1"
              >
                Send for review
              </button>
            )}
            {showApprove && (
              <>
                <button
                  type="button"
                  onClick={() => onApproveReview?.(id)}
                  className="text-xs font-bold text-primary hover:underline touch-target px-1"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onReturnReview?.(id)}
                  className="text-xs font-bold text-accent hover:underline touch-target px-1"
                >
                  Return
                </button>
              </>
            )}
            {canUpdateStatus && (
              <select
                value={status}
                onChange={(e) => onStatusChange(id, e.target.value as TaskStatus)}
                className="ml-auto max-w-[40%] truncate text-xs font-bold text-charcoal bg-slate-50 border border-charcoal/10 rounded-lg px-2 py-1.5 outline-none focus:border-primary cursor-pointer"
                aria-label="Move task"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    → {LIST_STATUS_META[s].label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <PeoplePicker
            open={assignOpen}
            onClose={() => setAssignOpen(false)}
            title="Assign Task"
            mode="single"
            committeeId={committeeId}
            excludeIds={assignedToId ? [assignedToId] : []}
            onConfirm={(ids) => {
              if (ids[0]) onAssign(id, ids[0]);
              setAssignOpen(false);
            }}
          />
          {subtasks.length > 0 && (
            <ul className="space-y-2 pt-2 border-t border-charcoal/5">
              {subtasks.map((sub) => (
                <li
                  key={sub.id}
                  className="pl-3 border-l-2 border-primary/30 text-xs font-medium text-charcoal-muted truncate"
                >
                  {sub.title}
                  <span className="ml-2 text-muted">
                    ({TASK_STATUS_LABELS[sub.status]})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </TaskHoverPreview>
    );
  }

  return (
    <article className={`bg-white rounded-xl border border-charcoal/5 p-3 space-y-3 shadow-2xs ${isSubtask ? "ml-3 border-l-4 border-l-primary/40" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {workClass ? (
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded mb-1 inline-block ${workClassBadgeClass(workClass)}`}
            >
              {TASK_WORK_CLASS_LABELS[workClass]}
            </span>
          ) : isSubtask ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted bg-slate-100 px-1.5 py-0.5 rounded mb-1 inline-block">
              Subtask
            </span>
          ) : null}
          {eventTitle && !isSubtask && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-accent mb-1">
              {eventTitle}
            </p>
          )}
          {committeeId ? (
            <Link
              href={taskPath(committeeId, id)}
              className="text-lg font-bold text-charcoal hover:text-primary transition-colors"
            >
              {title}
            </Link>
          ) : (
            <h3 className="text-lg font-bold text-charcoal">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-muted mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        {canAssign && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(id)}
            className="touch-target flex items-center justify-center rounded-xl text-muted hover:text-accent hover:bg-accent/10 shrink-0"
            aria-label="Delete task"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>

      {canUpdateStatus && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Status
          </p>
          <SegmentedControl
            options={TASK_STATUSES.map((s) => ({
              value: s,
              label: TASK_STATUS_LABELS[s],
            }))}
            value={status}
            onChange={(s) => onStatusChange(id, s)}
          />
        </div>
      )}

      {contextLabel && (
        <p className="text-xs font-semibold text-muted">{contextLabel}</p>
      )}

      {showSubmitReview && (
        <button
          type="button"
          onClick={() => onSubmitReview?.(id)}
          className="w-full touch-target rounded-lg bg-primary/15 text-charcoal text-sm font-semibold border border-primary/30"
        >
          Send for review
        </button>
      )}
      {showApprove && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onApproveReview?.(id)}
            className="flex-1 touch-target rounded-lg bg-primary/15 text-charcoal text-sm font-semibold border border-primary/30"
          >
            Approve step
          </button>
          <button
            type="button"
            onClick={() => onReturnReview?.(id)}
            className="flex-1 touch-target rounded-lg bg-accent/10 text-accent text-sm font-semibold border border-accent/30"
          >
            Return
          </button>
        </div>
      )}

      {dueLabel && (
        <p className="text-sm text-charcoal">
          <span className="font-semibold">Due:</span> {dueLabel}
        </p>
      )}

      {committeeId && (
        <CopyLinkButton path={taskPath(committeeId, id)} />
      )}

      <button
        type="button"
        onClick={() => canAssign && setAssignOpen(true)}
        className="w-full flex items-center justify-between touch-target px-3 py-2 rounded-lg bg-surface border border-charcoal/10 text-left text-sm disabled:opacity-70"
        disabled={!canAssign}
      >
        <span className="text-sm font-semibold text-muted">Assigned To</span>
        <span className="text-sm font-bold text-charcoal">
          {assigneeName ?? "Unassigned"}
        </span>
      </button>

      <PeoplePicker
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign Task"
        mode="single"
        committeeId={committeeId}
        excludeIds={assignedToId ? [assignedToId] : []}
        onConfirm={(ids) => {
          if (ids[0]) onAssign(id, ids[0]);
          setAssignOpen(false);
        }}
      />
      {subtasks.length > 0 && (
        <ul className="space-y-2 pt-2 border-t border-charcoal/5">
          {subtasks.map((sub) => (
            <li
              key={sub.id}
              className="pl-3 border-l-2 border-primary/30 text-sm text-charcoal-muted"
            >
              {sub.title}
              <span className="ml-2 text-xs text-muted">
                ({TASK_STATUS_LABELS[sub.status]})
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
