"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TaskStatusGroup } from "@/components/TaskStatusGroup";
import { KanbanColumn } from "@/components/KanbanColumn";
import { TaskListView } from "@/components/TaskListView";
import {
  TaskStatusBreakdown,
  countsFromTasks,
} from "@/components/TaskStatusBreakdown";
import { TouchButton } from "@/components/TouchButton";
import { DateInput } from "@/components/DateInput";
import { FORM_FIELD_CLASS, FORM_FILTER_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";
import {
  canEditTasks,
  canCreateDirective,
  canManageTor,
  type TaskStatus,
  type TaskWorkClass,
} from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";
import { KANBAN_COLUMNS } from "@/lib/kanban";
import { formatGroupRoleLabel } from "@/lib/work-context-client";
import { documentsPath, taskPath } from "@/lib/navigation";
import { LayoutGrid, List, Plus, X } from "lucide-react";

const TASKS_VIEW_KEY = "steward.tasksView";

type Subtask = {
  id: string;
  title: string;
  status: TaskStatus;
  workClass?: TaskWorkClass;
  assignedTo: { id: string; name: string } | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  workClass?: TaskWorkClass;
  approvalStepIndex?: number;
  dueDate: string | null;
  assignedTo: { id: string; name: string } | null;
  event: { id: string; title: string } | null;
  committee?: { id: string; name: string; charterLetter: string } | null;
  subtasks: Subtask[];
};

type EventOption = { id: string; title: string };

export function TasksView({
  committeeId,
}: {
  /** null = All my groups */
  committeeId: string | null;
}) {
  const { user, refreshAttention } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [torDoc, setTorDoc] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [eventFilter, setEventFilter] = useState<string>("all");
  const initialFilter = searchParams.get("filter");
  const [taskFilter, setTaskFilter] = useState<
    "all" | "needs-me" | "waiting-review"
  >(
    initialFilter === "all" || initialFilter === "waiting-review"
      ? initialFilter
      : "needs-me",
  );
  const [layoutView, setLayoutView] = useState<"board" | "list">("board");

  const [statusCounts, setStatusCounts] = useState(() =>
    countsFromTasks([]),
  );
  const wantsCreate =
    searchParams.get("create") === "1" || searchParams.get("assign") === "1";
  const [createOpen, setCreateOpen] = useState(wantsCreate);
  const [lastCreateSignal, setLastCreateSignal] = useState(wantsCreate);
  if (wantsCreate !== lastCreateSignal) {
    setLastCreateSignal(wantsCreate);
    if (wantsCreate) setCreateOpen(true);
  }
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const deepLinkTaskId = searchParams.get("task");
  const columnParam = searchParams.get("column") as TaskStatus | null;
  const forceAllFilter =
    !!columnParam &&
    ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "IN_REVIEW"].includes(
      columnParam,
    );
  const effectiveFilter = forceAllFilter ? "all" : taskFilter;
  const taskRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TASKS_VIEW_KEY);
      if (stored === "list" || stored === "board") setLayoutView(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!deepLinkTaskId) return;
    router.replace(taskPath(committeeId, deepLinkTaskId));
  }, [deepLinkTaskId, committeeId, router]);

  const setViewMode = (mode: "board" | "list") => {
    setLayoutView(mode);
    try {
      localStorage.setItem(TASKS_VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const loadTasks = useCallback(() => {
    if (!user) return;
    const qs = new URLSearchParams();
    if (committeeId) {
      qs.set("committeeId", committeeId);
    } else {
      qs.set("scope", "mine");
    }
    if (eventFilter !== "all") qs.set("eventId", eventFilter);
    if (effectiveFilter === "needs-me") {
      qs.set("assignedToMe", "true");
    }
    if (effectiveFilter === "waiting-review") qs.set("waitingReview", "true");
    fetch(`/api/tasks?${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
        else setTasks([]);
      })
      .catch(() => setTasks([]));
  }, [committeeId, eventFilter, effectiveFilter, user]);

  const loadStatusCounts = useCallback(() => {
    if (!committeeId) {
      setStatusCounts(countsFromTasks([]));
      setTorDoc(null);
      return;
    }
    fetch(`/api/dashboard?committeeId=${encodeURIComponent(committeeId)}`)
      .then((r) => r.json())
      .then((data) => {
        const s = Array.isArray(data.stats) ? data.stats[0] : null;
        if (!s) {
          setStatusCounts(countsFromTasks([]));
          setTorDoc(null);
          return;
        }
        setStatusCounts({
          TODO: s.todo ?? 0,
          IN_PROGRESS: s.inProgress ?? 0,
          IN_REVIEW: s.inReview ?? 0,
          DONE: s.done ?? 0,
          BLOCKED: s.blocked ?? 0,
          total: s.total ?? 0,
        });
        if (s.torDocumentId) {
          setTorDoc({ id: s.torDocumentId, title: s.torTitle ?? "Terms of Reference" });
        } else {
          setTorDoc(null);
        }
      })
      .catch(() => {
        setStatusCounts(countsFromTasks([]));
        setTorDoc(null);
      });
  }, [committeeId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    loadStatusCounts();
  }, [loadStatusCounts]);

  useEffect(() => {
    if (
      !columnParam ||
      !["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "IN_REVIEW"].includes(
        columnParam,
      )
    ) {
      return;
    }
    const timer = setTimeout(() => {
      document
        .getElementById(`kanban-column-${columnParam}`)
        ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, 150);
    return () => clearTimeout(timer);
  }, [columnParam, tasks.length]);

  useEffect(() => {
    if (!committeeId) {
      setEvents([]);
      return;
    }

    fetch(`/api/events?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEvents(data.map((e: EventOption) => ({ id: e.id, title: e.title })));
        }
      })
      .catch(() => setEvents([]));
  }, [committeeId]);

  const refreshTasks = () => {
    loadTasks();
    loadStatusCounts();
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDueDate("");
  };

  const updateStatus = async (id: string, status: TaskStatus) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refreshTasks();
  };

  const assignTask = async (id: string, userId: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: userId }),
    });
    loadTasks();
  };

  const submitTaskReview = async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_review" }),
    });
    refreshAttention();
    refreshTasks();
  };

  const approveTaskReview = async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_step" }),
    });
    refreshAttention();
    refreshTasks();
  };

  const returnTaskReview = async (taskId: string) => {
    const comment = window.prompt("Return comment (optional)") ?? undefined;
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "return", comment }),
    });
    refreshAttention();
    refreshTasks();
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    refreshTasks();
  };

  const createTask = async () => {
    if (!newTitle.trim() || !committeeId || !user) return;
    const assign = searchParams.get("assign") === "1";
    const userPerm = toPermissionUser(user);
    const canDirective =
      canCreateDirective(userPerm) ||
      canEditTasks(userPerm, committeeId);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        committeeId,
        eventId: eventFilter !== "all" ? eventFilter : undefined,
        dueDate: newDueDate || undefined,
        workClass: assign && canDirective ? "DIRECTIVE" : "COMMITTEE",
      }),
    });
    resetForm();
    setCreateOpen(false);
    refreshTasks();
  };

  if (!user) {
    return (
      <p className="text-muted text-center py-6">
        Sign in to view work.
      </p>
    );
  }

  const perm = toPermissionUser(user);
  const supervisoryLabel =
    user.organization?.settings.supervisoryLabel ?? "Governance";

  const flatTasks = tasks.flatMap((t) => {
    const contextLabel = formatGroupRoleLabel(perm, t.committee ?? null, {
      supervisoryLabel,
    });
    const canSubmit =
      t.workClass !== "PERSONAL" &&
      (t.status === "IN_PROGRESS" || t.status === "DONE" || t.status === "BLOCKED");
    const canApprove = t.status === "IN_REVIEW";
    return [
      {
        id: t.id,
        title: t.title,
        status: t.status,
        description: t.description,
        dueDate: t.dueDate,
        assignedTo: t.assignedTo,
        eventTitle: t.event?.title,
        isSubtask: false,
        contextLabel,
        canSubmitReview: canSubmit,
        canApproveReview: canApprove,
        workClass: t.workClass,
        committeeId: t.committee?.id ?? committeeId,
      },
      ...t.subtasks.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        description: null as string | null,
        dueDate: null as string | null,
        assignedTo: s.assignedTo,
        eventTitle: t.event?.title,
        isSubtask: true,
        contextLabel,
        canSubmitReview: false,
        canApproveReview: s.status === "IN_REVIEW",
        workClass: s.workClass,
        committeeId: t.committee?.id ?? committeeId,
      })),
    ];
  });

  const byStatus = (status: TaskStatus) =>
    flatTasks.filter((t) => t.status === status);

  const canDelete = !!(perm && committeeId && canEditTasks(perm, committeeId));
  const canCreate = !!(
    perm &&
    committeeId &&
    (canEditTasks(perm, committeeId) || canCreateDirective(perm))
  );
  const assignMode = searchParams.get("assign") === "1";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-charcoal tracking-tight">
            Work
          </h2>
          <p className="mt-1 text-sm text-muted">
            {tasks.length} item{tasks.length === 1 ? "" : "s"}
            {!committeeId ? " · all groups" : ""}
            {effectiveFilter === "needs-me" ? " · needs you" : ""}
            {effectiveFilter === "waiting-review" ? " · waiting for your review" : ""}
          </p>
        </div>
        {canCreate && !createOpen && (
          <TouchButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {assignMode ? "Assign directive" : "New work"}
          </TouchButton>
        )}
      </div>

      {committeeId ? (
        <p className="text-sm rounded-xl border border-charcoal/8 bg-white px-3 py-2 text-muted">
          {torDoc ? (
            <>
              TOR:{" "}
              <Link
                href={`/documents/${torDoc.id}`}
                className="font-semibold text-primary hover:underline"
              >
                {torDoc.title}
              </Link>
              {" · "}
              open it to get AI work suggestions
            </>
          ) : (
            <>
              No TOR yet.
              {perm && canManageTor(perm, committeeId) ? (
                <>
                  {" "}
                  <Link
                    href={documentsPath({ committeeId, tag: "TOR" })}
                    className="font-semibold text-primary hover:underline"
                  >
                    Add Terms of Reference
                  </Link>{" "}
                  so AI can suggest work for this group.
                </>
              ) : (
                <> Ask the chair to add one so AI can suggest work.</>
              )}
            </>
          )}
        </p>
      ) : null}

      {committeeId ? (
        <TaskStatusBreakdown counts={statusCounts} title="Status breakdown" />
      ) : null}

      {canCreate && createOpen && (
        <section
          className="max-w-xl rounded-xl border border-charcoal/10 bg-white p-4 space-y-3 shadow-2xs"
          aria-labelledby="new-task-heading"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="new-task-heading" className="text-lg font-bold text-charcoal">
              {assignMode ? "Assign directive" : "New work"}
            </h2>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setCreateOpen(false);
              }}
              className="touch-target rounded-xl text-muted hover:text-charcoal hover:bg-slate-50"
              aria-label="Cancel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {eventFilter !== "all" && (
            <p className="text-sm text-muted">
              This {assignMode ? "directive" : "work"} will be linked to:{" "}
              <span className="font-semibold text-charcoal">
                {events.find((e) => e.id === eventFilter)?.title}
              </span>
            </p>
          )}

          <label className="block">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">
              {assignMode ? "Directive title" : "Work title"}
            </span>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className={`mt-2 ${FORM_FIELD_CLASS}`}
              placeholder="e.g. Soundboard Installation"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">
              Due Date
            </span>
            <DateInput
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className={`mt-2 ${FORM_FIELD_CLASS}`}
            />
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <TouchButton
              variant="secondary"
              onClick={() => {
                resetForm();
                setCreateOpen(false);
              }}
            >
              Cancel
            </TouchButton>
            <TouchButton onClick={createTask}>
              {assignMode ? "Assign directive" : "Create work"}
            </TouchButton>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={taskFilter}
          onChange={(e) =>
            setTaskFilter(
              e.target.value as "all" | "needs-me" | "waiting-review",
            )
          }
          className={FORM_FILTER_CLASS}
          aria-label="Filter work"
        >
          <option value="needs-me">Needs me</option>
          <option value="waiting-review">Waiting for my review</option>
          <option value="all">All in group</option>
        </select>

        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className={`flex-1 max-w-xs ${FORM_FILTER_CLASS}`}
          aria-label="Filter by event"
        >
          <option value="all">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>

        <div
          className="inline-flex h-10 rounded-xl border border-charcoal/15 bg-white p-0.5"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            onClick={() => setViewMode("board")}
            className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold transition-colors ${
              layoutView === "board"
                ? "bg-charcoal text-white"
                : "text-muted hover:text-charcoal"
            }`}
            aria-pressed={layoutView === "board"}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Board
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold transition-colors ${
              layoutView === "list"
                ? "bg-charcoal text-white"
                : "text-muted hover:text-charcoal"
            }`}
            aria-pressed={layoutView === "list"}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
        </div>
      </div>

      {flatTasks.length === 0 ? (
        <p className="text-center text-muted py-8 text-sm rounded-xl border border-dashed border-charcoal/15 bg-white">
          No items yet. Create work or assign a directive to get started.
        </p>
      ) : layoutView === "list" ? (
        <TaskListView
          rows={tasks.map((t) => {
            const contextLabel = formatGroupRoleLabel(perm, t.committee ?? null, {
              supervisoryLabel,
            });
            return {
              id: t.id,
              title: t.title,
              status: t.status,
              workClass: t.workClass,
              dueDate: t.dueDate,
              assignedTo: t.assignedTo,
              committeeId: t.committee?.id ?? committeeId,
              contextLabel,
              subtasks: t.subtasks.map((s) => ({
                id: s.id,
                title: s.title,
                status: s.status,
                workClass: s.workClass,
                dueDate: null,
                assignedTo: s.assignedTo,
                committeeId: t.committee?.id ?? committeeId,
              })),
            };
          })}
        />
      ) : (
        <>
          {/* Mobile / tablet: dense vertical list */}
          <div className="space-y-3 lg:hidden">
            {KANBAN_COLUMNS.filter(
              (status) =>
                byStatus(status).length > 0 ||
                status === "TODO" ||
                status === "IN_PROGRESS",
            ).map((status) => (
              <TaskStatusGroup
                key={status}
                status={status}
                tasks={byStatus(status)}
                committeeId={committeeId ?? ""}
                userId={user.id}
                canEdit={canCreate}
                taskRefs={taskRefs}
                onStatusChange={updateStatus}
                onAssign={assignTask}
                onDelete={canDelete ? deleteTask : undefined}
                onSubmitReview={submitTaskReview}
                onApproveReview={approveTaskReview}
                onReturnReview={returnTaskReview}
              />
            ))}
          </div>

          {/* Wide screen: horizontal Kanban columns */}
          <div className="hidden lg:grid lg:grid-cols-5 lg:gap-3 min-h-0">
            {KANBAN_COLUMNS.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={byStatus(status)}
                committeeId={committeeId ?? ""}
                userId={user.id}
                canEdit={canCreate}
                taskRefs={taskRefs}
                onStatusChange={updateStatus}
                onAssign={assignTask}
                onDelete={canDelete ? deleteTask : undefined}
                onSubmitReview={submitTaskReview}
                onApproveReview={approveTaskReview}
                onReturnReview={returnTaskReview}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
