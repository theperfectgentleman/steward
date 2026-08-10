"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { AccessDenied } from "@/components/AccessDenied";
import { BottomSheet } from "@/components/BottomSheet";
import { CommentThread } from "@/components/CommentThread";
import { DocumentList } from "@/components/DocumentList";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DateInput } from "@/components/DateInput";
import { PageShimmer } from "@/components/loading/PageShimmer";
import { PeoplePicker } from "@/components/people/PeoplePicker";
import { TouchButton } from "@/components/TouchButton";
import { useApp } from "@/providers/AppProvider";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { toInputDateValue, formatDate } from "@/lib/dates";
import { taskPath, tasksPath } from "@/lib/navigation";
import { toPermissionUser } from "@/lib/permissions-client";
import { formatGroupRoleLabel } from "@/lib/work-context";
import {
  canEditTasks,
  isCommitteeReadOnly,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_WORK_CLASS_LABELS,
  type TaskStatus,
  type TaskWorkClass,
} from "@/lib/types";

type Subtask = {
  id: string;
  title: string;
  status: TaskStatus;
  workClass?: TaskWorkClass;
  assignedTo: { id: string; name: string } | null;
};

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  workClass: TaskWorkClass;
  approvalStepIndex: number;
  returnComment: string | null;
  dueDate: string | null;
  committeeId: string;
  eventId: string | null;
  parentId: string | null;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  event: { id: string; title: string } | null;
  committee: {
    id: string;
    name: string;
    charterLetter: string;
  };
  parent: { id: string; title: string } | null;
  subtasks: Subtask[];
};

type SubtaskDraft = { title: string; description?: string };

function workClassBadgeClass(workClass: TaskWorkClass) {
  if (workClass === "DIRECTIVE") return "text-primary bg-primary/10";
  if (workClass === "PERSONAL") return "text-muted bg-slate-100";
  return "text-charcoal-muted bg-slate-100";
}

export function TaskDetailView({ taskId }: { taskId: string }) {
  const { user, refreshAttention, setActiveCommitteeId } = useApp();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [saving, setSaving] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [drafts, setDrafts] = useState<SubtaskDraft[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [savingDrafts, setSavingDrafts] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/tasks/${taskId}`)
      .then(async (r) => {
        if (r.status === 403) {
          setAccessDenied(true);
          setTask(null);
          return null;
        }
        if (r.status === 404 || !r.ok) {
          setNotFound(true);
          setTask(null);
          return null;
        }
        return r.json() as Promise<TaskDetail>;
      })
      .then((data) => {
        if (!data) return;
        setAccessDenied(false);
        setNotFound(false);
        setTask(data);
        setActiveCommitteeId(data.committeeId);
        setTitle(data.title);
        setDescription(data.description ?? "");
        setDueDate(toInputDateValue(data.dueDate) || "");
        setStatus(data.status);
      })
      .catch(() => {
        setNotFound(true);
        setTask(null);
      })
      .finally(() => setLoading(false));
  }, [taskId, setActiveCommitteeId]);

  useEffect(() => {
    load();
  }, [load]);

  const perm = user ? toPermissionUser(user) : null;
  const committeeId = task?.committeeId ?? "";
  const canEdit = !!(perm && committeeId && canEditTasks(perm, committeeId));
  const readOnly = !!(perm && committeeId && isCommitteeReadOnly(perm, committeeId));
  const isAssignee = task?.assignedTo?.id === user?.id;
  const canMutate = canEdit || isAssignee;
  const canSubmitReview =
    !!task &&
    task.workClass !== "PERSONAL" &&
    (task.status === "IN_PROGRESS" ||
      task.status === "DONE" ||
      task.status === "BLOCKED") &&
    canMutate;
  const canApproveReview = task?.status === "IN_REVIEW";

  const patchTask = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = (await res.json()) as TaskDetail;
        setTask((prev) =>
          prev
            ? {
                ...prev,
                ...updated,
                subtasks: updated.subtasks ?? prev.subtasks,
                committee: updated.committee ?? prev.committee,
                parent: updated.parent ?? prev.parent,
                event: updated.event ?? prev.event,
                createdBy: updated.createdBy ?? prev.createdBy,
              }
            : updated,
        );
        if (updated.title !== undefined) setTitle(updated.title);
        if (updated.description !== undefined) {
          setDescription(updated.description ?? "");
        }
        if (updated.dueDate !== undefined) {
          setDueDate(toInputDateValue(updated.dueDate) || "");
        }
        if (updated.status) setStatus(updated.status);
        refreshAttention();
      }
    } finally {
      setSaving(false);
    }
  };

  const saveFields = async () => {
    if (!canMutate || !title.trim()) return;
    await patchTask({
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate || null,
      status,
    });
  };

  const createSubtask = async () => {
    if (!subtaskTitle.trim() || !committeeId || !canEdit) return;
    setAddingSubtask(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: subtaskTitle.trim(),
          committeeId,
          parentId: taskId,
          eventId: task?.eventId ?? undefined,
        }),
      });
      setSubtaskTitle("");
      load();
    } finally {
      setAddingSubtask(false);
    }
  };

  const suggestSubtasks = async () => {
    if (!canEdit) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(`/api/tasks/${taskId}/suggest-subtasks`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "Could not suggest subtasks");
        return;
      }
      const next = Array.isArray(data.drafts) ? data.drafts : [];
      if (next.length === 0) {
        setAiError("No suggestions returned. Try adding more detail to the description.");
        return;
      }
      setDrafts(next);
      setDraftOpen(true);
    } catch {
      setAiError("Network error");
    } finally {
      setAiLoading(false);
    }
  };

  const acceptDrafts = async () => {
    if (!committeeId || !canEdit || drafts.length === 0) return;
    setSavingDrafts(true);
    try {
      for (const draft of drafts) {
        if (!draft.title.trim()) continue;
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title.trim(),
            description: draft.description?.trim() || undefined,
            committeeId,
            parentId: taskId,
            eventId: task?.eventId ?? undefined,
          }),
        });
      }
      setDraftOpen(false);
      setDrafts([]);
      load();
    } finally {
      setSavingDrafts(false);
    }
  };

  const acceptDraftAt = async (index: number) => {
    if (!committeeId || !canEdit || savingDrafts) return;
    const draft = drafts[index];
    if (!draft?.title.trim()) return;
    setSavingDrafts(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description?.trim() || undefined,
          committeeId,
          parentId: taskId,
          eventId: task?.eventId ?? undefined,
        }),
      });
      const remaining = drafts.filter((_, j) => j !== index);
      setDrafts(remaining);
      if (remaining.length === 0) setDraftOpen(false);
      load();
    } finally {
      setSavingDrafts(false);
    }
  };

  if (loading) return <PageShimmer variant="detail" lines={6} />;
  if (accessDenied) return <AccessDenied />;
  if (notFound || !task) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted">Work not found.</p>
        <Link
          href={tasksPath()}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Back to Work
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={tasksPath(committeeId, { filter: "all" })}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-charcoal transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Work
          </Link>
          <CopyLinkButton path={taskPath(committeeId, task.id)} label="Share" />
        </div>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${workClassBadgeClass(task.workClass)}`}
          >
            {TASK_WORK_CLASS_LABELS[task.workClass]}
          </span>
          {task.event && (
            <span
              className="text-xs font-semibold text-accent truncate min-w-0"
              title={task.event.title}
            >
              {task.event.title}
            </span>
          )}
          {task.parent && (
            <Link
              href={taskPath(committeeId, task.parent.id)}
              className="text-xs font-semibold text-muted hover:text-primary truncate min-w-0"
              title={task.parent.title}
            >
              Parent: {task.parent.title}
            </Link>
          )}
        </div>
        {canMutate && !readOnly ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveFields}
            title={title}
            className="block w-full min-w-0 text-2xl font-bold text-charcoal tracking-tight bg-transparent border-0 border-b border-transparent focus:border-charcoal/20 outline-none py-1 truncate"
            aria-label="Work title"
          />
        ) : (
          <h1
            className="text-2xl font-bold text-charcoal tracking-tight truncate"
            title={task.title}
          >
            {task.title}
          </h1>
        )}
        <p className="text-sm text-muted truncate" title={task.committee.name}>
          {formatGroupRoleLabel(
            user ? toPermissionUser(user) : null,
            task.committee,
          ) || task.committee.name}
        </p>
      </div>

      {task.returnComment && (
        <p className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-charcoal">
          <span className="font-bold">Returned: </span>
          {task.returnComment}
        </p>
      )}

      <section className="rounded-xl border border-charcoal/8 bg-white p-4 sm:p-5 space-y-4 shadow-2xs">
        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            Description
          </span>
          {canMutate && !readOnly ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveFields}
              rows={5}
              placeholder="What is this work about?"
              className={FORM_TEXTAREA_CLASS}
            />
          ) : (
            <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap min-h-[3rem]">
              {task.description?.trim() || "No description yet."}
            </p>
          )}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Status
            </span>
            <select
              value={status}
              disabled={!canMutate || readOnly || saving}
              onChange={(e) => {
                const next = e.target.value as TaskStatus;
                setStatus(next);
                void patchTask({ status: next });
              }}
              className={FORM_FIELD_CLASS}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Due date
            </span>
            {canMutate && !readOnly ? (
              <DateInput
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={saveFields}
                disabled={saving}
              />
            ) : (
              <p className="text-sm font-semibold text-charcoal h-14 flex items-center px-1">
                {task.dueDate ? formatDate(task.dueDate) : "None"}
              </p>
            )}
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">
            Assignee
          </span>
          <button
            type="button"
            disabled={!canEdit || readOnly}
            onClick={() => setAssignOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-charcoal/10 hover:border-primary/40 touch-target text-left disabled:opacity-70 disabled:cursor-default"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal text-white text-xs font-bold">
              {task.assignedTo
                ? task.assignedTo.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "?"}
            </span>
            <span className="text-sm font-semibold">
              {task.assignedTo?.name ??
                (canEdit && !readOnly ? "Choose person…" : "Unassigned")}
            </span>
          </button>
          <PeoplePicker
            open={assignOpen}
            onClose={() => setAssignOpen(false)}
            title="Assign work"
            mode="single"
            committeeId={committeeId}
            excludeIds={task.assignedTo?.id ? [task.assignedTo.id] : []}
            onConfirm={(ids) => {
              if (ids[0]) void patchTask({ assignedToId: ids[0] });
              setAssignOpen(false);
            }}
          />
        </div>

        {(canSubmitReview || canApproveReview) && !readOnly && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-charcoal/8">
            {canSubmitReview && (
              <TouchButton
                variant="secondary"
                onClick={() => void patchTask({ action: "submit_review" })}
                disabled={saving}
              >
                Send for review
              </TouchButton>
            )}
            {canApproveReview && (
              <>
                <TouchButton
                  onClick={() => void patchTask({ action: "approve_step" })}
                  disabled={saving}
                >
                  Approve
                </TouchButton>
                <TouchButton
                  variant="secondary"
                  onClick={() => {
                    const comment =
                      window.prompt("Return comment (optional)") ?? undefined;
                    void patchTask({ action: "return", comment });
                  }}
                  disabled={saving}
                >
                  Return
                </TouchButton>
              </>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-charcoal/8 bg-white p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            Subtasks
          </h2>
          <span className="text-xs font-bold text-muted tabular-nums">
            {task.subtasks.length}
          </span>
        </div>
        {canEdit && !readOnly && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                placeholder="New subtask title"
                className={FORM_FIELD_CLASS}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void createSubtask();
                  }
                }}
              />
              <TouchButton
                onClick={() => void createSubtask()}
                disabled={addingSubtask || !subtaskTitle.trim()}
              >
                <Plus className="h-4 w-4" />
                Add
              </TouchButton>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TouchButton
                variant="ghost"
                onClick={() => void suggestSubtasks()}
                disabled={aiLoading}
              >
                <Sparkles className="h-4 w-4" />
                {aiLoading ? "Suggesting…" : "Suggest with AI"}
              </TouchButton>
              {aiError && (
                <p className="text-sm text-accent">{aiError}</p>
              )}
            </div>
          </div>
        )}
        {task.subtasks.length === 0 ? (
          <p className="text-sm text-muted">No subtasks yet.</p>
        ) : (
          <ul className="space-y-2">
            {task.subtasks.map((s) => (
              <li key={s.id}>
                <Link
                  href={taskPath(committeeId, s.id)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-charcoal/10 bg-surface/70 px-3 py-3 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <span className="min-w-0 text-sm font-semibold text-charcoal truncate">
                    {s.title}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-muted">
                    {TASK_STATUS_LABELS[s.status]}
                    {s.assignedTo ? ` · ${s.assignedTo.name.split(" ")[0]}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-charcoal/8 bg-white p-4 sm:p-5 shadow-2xs">
        <DocumentList
          entityType="TASK"
          entityId={task.id}
          canUpload={canEdit && !readOnly}
          canDelete={canEdit && !readOnly}
        />
      </section>

      <section className="rounded-xl border border-charcoal/8 bg-white p-4 sm:p-5 shadow-2xs">
        <CommentThread entityType="TASK" entityId={task.id} />
      </section>

      <BottomSheet
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        title="Review suggested subtasks"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Add individually, or add all. Edit or remove any you do not want.
          </p>
          {drafts.map((draft, i) => (
            <div key={i} className="space-y-2 p-3 bg-slate-50 rounded-xl">
              <input
                type="text"
                value={draft.title}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...next[i], title: e.target.value };
                  setDrafts(next);
                }}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/10 font-semibold"
              />
              <input
                type="text"
                value={draft.description ?? ""}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...next[i], description: e.target.value };
                  setDrafts(next);
                }}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 rounded-lg border border-charcoal/10 text-sm"
              />
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  disabled={savingDrafts || !draft.title.trim()}
                  onClick={() => void acceptDraftAt(i)}
                  className="text-xs font-bold text-primary disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  disabled={savingDrafts}
                  onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
                  className="text-xs font-bold text-accent disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {drafts.length > 0 && (
            <TouchButton
              size="lg"
              className="w-full"
              disabled={savingDrafts}
              onClick={() => void acceptDrafts()}
            >
              <Plus className="h-5 w-5" />
              {savingDrafts
                ? "Adding…"
                : `Add all ${drafts.length} subtask${drafts.length === 1 ? "" : "s"}`}
            </TouchButton>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
