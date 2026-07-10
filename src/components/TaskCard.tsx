"use client";

import { useState } from "react";
import { SegmentedControl } from "./SegmentedControl";
import { BottomSheet } from "./BottomSheet";
import type { TaskStatus, UserRole } from "@/lib/types";
import { TASK_STATUS_LABELS, TASK_STATUSES, canEditTasks } from "@/lib/types";
import { Trash2 } from "lucide-react";

type TaskCardProps = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  dueDate?: string | null;
  assigneeName?: string | null;
  assignedToId?: string | null;
  currentUserId: string;
  userRole: UserRole;
  members?: { id: string; name: string }[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAssign: (id: string, userId: string) => void;
  onDelete?: (id: string) => void;
};

export function TaskCard({
  id,
  title,
  description,
  status,
  dueDate,
  assigneeName,
  assignedToId,
  currentUserId,
  userRole,
  members = [],
  onStatusChange,
  onAssign,
  onDelete,
}: TaskCardProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const canAssign = canEditTasks(userRole);
  const canUpdateStatus =
    canEditTasks(userRole) ||
    (userRole === "COMMITTEE_MEMBER" && assignedToId === currentUserId);

  return (
    <article className="bg-white rounded-2xl border-2 border-charcoal/10 p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-charcoal">{title}</h3>
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

      {dueDate && (
        <p className="text-sm text-charcoal">
          <span className="font-semibold">Due:</span>{" "}
          {new Date(dueDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}

      <button
        type="button"
        onClick={() => canAssign && setAssignOpen(true)}
        className="w-full flex items-center justify-between touch-target-lg px-4 py-3 rounded-xl bg-surface border border-charcoal/10 text-left disabled:opacity-70"
        disabled={!canAssign}
      >
        <span className="text-sm font-semibold text-muted">Assigned To</span>
        <span className="text-sm font-bold text-charcoal">
          {assigneeName ?? "Unassigned"}
        </span>
      </button>

      <BottomSheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign Task"
      >
        <ul className="space-y-4">
          {members.length === 0 && (
            <li className="text-sm text-muted text-center py-4">
              No committee members assigned yet. Add members in Admin.
            </li>
          )}
          {members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onAssign(id, m.id);
                  setAssignOpen(false);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-charcoal/10 hover:border-primary touch-target-lg"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal text-white font-bold">
                  {m.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <span className="font-semibold">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </article>
  );
}
