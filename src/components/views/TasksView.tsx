"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TaskStatusGroup } from "@/components/TaskStatusGroup";
import { KanbanColumn } from "@/components/KanbanColumn";
import { TouchButton } from "@/components/TouchButton";
import { DateInput } from "@/components/DateInput";
import { FORM_FIELD_CLASS, FORM_FILTER_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";
import { canEditTasks, type TaskStatus } from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";
import { KANBAN_COLUMNS } from "@/lib/kanban";
import { Plus, X } from "lucide-react";

type Subtask = {
  id: string;
  title: string;
  status: TaskStatus;
  assignedTo: { id: string; name: string } | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  assignedTo: { id: string; name: string } | null;
  event: { id: string; title: string } | null;
  project?: {
    id: string;
    title: string;
    assignmentId?: string | null;
    assignment?: { id: string; status: string } | null;
  } | null;
  assignmentAsRoot?: { id: string; status: string } | null;
  subtasks: Subtask[];
};

type EventOption = { id: string; title: string };

type Member = { id: string; name: string };

export function TasksView({ committeeId }: { committeeId: string }) {
  const { user, refreshAttention } = useApp();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const initialFilter = searchParams.get("filter");
  const [taskFilter, setTaskFilter] = useState<"mine" | "all" | "standalone" | "project">(
    initialFilter === "all" || initialFilter === "standalone" || initialFilter === "project"
      ? initialFilter
      : "mine",
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const deepLinkTaskId = searchParams.get("task");
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const taskRefs = useRef<Record<string, HTMLElement | null>>({});

  const loadTasks = useCallback(() => {
    if (!committeeId) return;
    const qs = new URLSearchParams({ committeeId });
    if (eventFilter !== "all") qs.set("eventId", eventFilter);
    if (taskFilter === "mine") qs.set("assignedToMe", "true");
    if (taskFilter === "standalone") qs.set("standalone", "true");
    if (taskFilter === "project") qs.set("inProject", "true");
    fetch(`/api/tasks?${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
        else setTasks([]);
      })
      .catch(() => setTasks([]));
  }, [committeeId, eventFilter, taskFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const columnParam = searchParams.get("column") as TaskStatus | null;

  useEffect(() => {
    if (
      !columnParam ||
      !["TODO", "IN_PROGRESS", "BLOCKED", "DONE"].includes(columnParam)
    ) {
      return;
    }
    setTaskFilter("all");
    const timer = setTimeout(() => {
      document
        .getElementById(`kanban-column-${columnParam}`)
        ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, 150);
    return () => clearTimeout(timer);
  }, [columnParam, tasks.length]);

  useEffect(() => {
    if (!deepLinkTaskId || tasks.length === 0) return;
    setTaskFilter("all");
    setHighlightedTaskId(deepLinkTaskId);
    const el = taskRefs.current[deepLinkTaskId];
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    const timer = setTimeout(() => setHighlightedTaskId(null), 4000);
    return () => clearTimeout(timer);
  }, [deepLinkTaskId, tasks]);

  useEffect(() => {
    if (!committeeId) return;
    fetch(`/api/committees/members?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMembers(data.map((m: Member) => ({ id: m.id, name: m.name })));
        } else {
          setMembers([]);
        }
      })
      .catch(() => setMembers([]));

    fetch(`/api/events?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEvents(data.map((e: EventOption) => ({ id: e.id, title: e.title })));
        }
      })
      .catch(() => setEvents([]));
  }, [committeeId]);

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
    loadTasks();
  };

  const assignTask = async (id: string, userId: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: userId }),
    });
    loadTasks();
  };

  const reviewableStatuses = new Set(["ACCEPTED", "IN_PROGRESS", "RETURNED"]);

  const getReviewAssignmentId = (task: Task) => {
    const fromProject = task.project?.assignment;
    if (fromProject && reviewableStatuses.has(fromProject.status)) {
      return fromProject.id;
    }
    if (task.assignmentAsRoot && reviewableStatuses.has(task.assignmentAsRoot.status)) {
      return task.assignmentAsRoot.id;
    }
    return null;
  };

  const submitAssignmentReview = async (assignmentId: string) => {
    await fetch("/api/assignments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assignmentId, action: "submit_review" }),
    });
    refreshAttention();
    loadTasks();
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    loadTasks();
  };

  const createTask = async () => {
    if (!newTitle.trim() || !committeeId || !user) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        committeeId,
        eventId: eventFilter !== "all" ? eventFilter : undefined,
        dueDate: newDueDate || undefined,
      }),
    });
    resetForm();
    setCreateOpen(false);
    loadTasks();
  };

  if (!committeeId || !user) {
    return (
      <p className="text-muted text-center py-6">
        Select a committee to view tasks.
      </p>
    );
  }

  const flatTasks = tasks.flatMap((t) => [
    {
      id: t.id,
      title: t.title,
      status: t.status,
      description: t.description,
      dueDate: t.dueDate,
      assignedTo: t.assignedTo,
      eventTitle: t.event?.title,
      isSubtask: false,
      reviewAssignmentId: getReviewAssignmentId(t),
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
      reviewAssignmentId: null as string | null,
    })),
  ]);

  const byStatus = (status: TaskStatus) =>
    flatTasks.filter((t) => t.status === status);

  const perm = user ? toPermissionUser(user) : null;
  const canDelete = perm ? canEditTasks(perm, committeeId) : false;
  const canCreate = perm ? canEditTasks(perm, committeeId) : false;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-charcoal tracking-tight">
            Task Board
          </h2>
          <p className="mt-1 text-sm text-muted">
            {flatTasks.length} task{flatTasks.length === 1 ? "" : "s"}
            {taskFilter === "mine" ? " · assigned to you" : ""}
          </p>
        </div>
        {canCreate && !createOpen && (
          <TouchButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Task
          </TouchButton>
        )}
      </div>

      {canCreate && createOpen && (
        <section
          className="max-w-xl rounded-xl border border-charcoal/10 bg-white p-4 space-y-3 shadow-2xs"
          aria-labelledby="new-task-heading"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="new-task-heading" className="text-lg font-bold text-charcoal">
              New task
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
              This task will be linked to:{" "}
              <span className="font-semibold text-charcoal">
                {events.find((e) => e.id === eventFilter)?.title}
              </span>
            </p>
          )}

          <label className="block">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">
              Task Title
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
            <TouchButton onClick={createTask}>Create Task</TouchButton>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={taskFilter}
          onChange={(e) =>
            setTaskFilter(e.target.value as "mine" | "all" | "standalone" | "project")
          }
          className={FORM_FILTER_CLASS}
          aria-label="Filter tasks"
        >
          <option value="mine">Assigned to me</option>
          <option value="all">All tasks</option>
          <option value="project">Project tasks</option>
          <option value="standalone">Standalone only</option>
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
      </div>

      {flatTasks.length === 0 ? (
        <p className="text-center text-muted py-8 text-sm rounded-xl border border-dashed border-charcoal/15 bg-white">
          No tasks yet. Create one to get started.
        </p>
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
                committeeId={committeeId}
                userId={user.id}
                canEdit={canCreate}
                members={members}
                highlightedTaskId={highlightedTaskId}
                taskRefs={taskRefs}
                onStatusChange={updateStatus}
                onAssign={assignTask}
                onDelete={canDelete ? deleteTask : undefined}
                onSubmitReview={submitAssignmentReview}
              />
            ))}
          </div>

          {/* Wide screen: horizontal Kanban columns */}
          <div className="hidden lg:grid lg:grid-cols-4 lg:gap-3 min-h-0">
            {KANBAN_COLUMNS.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={byStatus(status)}
                committeeId={committeeId}
                userId={user.id}
                canEdit={canCreate}
                members={members}
                highlightedTaskId={highlightedTaskId}
                taskRefs={taskRefs}
                onStatusChange={updateStatus}
                onAssign={assignTask}
                onDelete={canDelete ? deleteTask : undefined}
                onSubmitReview={submitAssignmentReview}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
