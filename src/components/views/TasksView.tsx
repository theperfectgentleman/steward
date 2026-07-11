"use client";



import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { TaskCard } from "@/components/TaskCard";

import { KanbanColumn } from "@/components/KanbanColumn";

import { TouchButton } from "@/components/TouchButton";
import { DateInput } from "@/components/DateInput";
import { FORM_FIELD_CLASS, FORM_FILTER_CLASS } from "@/lib/form-field";

import { BottomSheet } from "@/components/BottomSheet";

import { useApp } from "@/providers/AppProvider";

import { useCommitteeContext } from "@/hooks/useCommitteeContext";

import { canEditTasks, getCommitteeTitle, type TaskStatus } from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";

import { KANBAN_COLUMNS } from "@/lib/kanban";

import { Plus } from "lucide-react";



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

  const { committee } = useCommitteeContext();

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
  const taskRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

    setNewTitle("");

    setNewDueDate("");

    setCreateOpen(false);

    loadTasks();

  };



  if (!committeeId || !user) {

    return (

      <p className="text-muted text-center py-12">

        Select a committee to view tasks.

      </p>

    );

  }



  const flatTasks = tasks.flatMap((t) => [

    t,

    ...t.subtasks.map((s) => ({

      ...s,

      description: null as string | null,

      dueDate: null as string | null,

      event: t.event,

      subtasks: [] as Subtask[],

      _isSubtask: true,

      _parentId: t.id,

    })),

  ]);



  const byStatus = (status: TaskStatus) =>

    flatTasks.filter((t) => t.status === status);



  const perm = user ? toPermissionUser(user) : null;
  const canDelete = perm ? canEditTasks(perm, committeeId) : false;
  const canCreate = perm ? canEditTasks(perm, committeeId) : false;



  return (

    <div className="space-y-5">

      <div className="flex items-center justify-between gap-3 flex-wrap">

        <p className="text-sm text-muted">
          Drag-free board — move tasks via the status menu on each card
        </p>

        {canCreate && (

          <TouchButton onClick={() => setCreateOpen(true)}>

            <Plus className="h-5 w-5" />

            New Task

          </TouchButton>

        )}

      </div>



      <div className="flex flex-wrap items-center gap-3">

        <label className="text-xs font-bold text-accent uppercase tracking-wider shrink-0">
          Filter
        </label>
        <select
          value={taskFilter}
          onChange={(e) => setTaskFilter(e.target.value as "mine" | "all" | "standalone" | "project")}
          className={FORM_FILTER_CLASS}
        >
          <option value="mine">Assigned to me</option>
          <option value="all">All tasks</option>
          <option value="project">Project tasks</option>
          <option value="standalone">Standalone only</option>
        </select>

        <label className="text-xs font-bold text-accent uppercase tracking-wider shrink-0">

          Event

        </label>

        <select

          value={eventFilter}

          onChange={(e) => setEventFilter(e.target.value)}

          className={`flex-1 max-w-xs ${FORM_FILTER_CLASS}`}

        >

          <option value="all">All tasks</option>

          {events.map((e) => (

            <option key={e.id} value={e.id}>

              {e.title}

            </option>

          ))}

        </select>

      </div>



      <div className="grid gap-4 md:grid-cols-2 xl:hidden">

        {tasks.map((task) => (

          <div
            key={task.id}
            ref={(el) => {
              taskRefs.current[task.id] = el;
            }}
            className={`space-y-3 transition-shadow rounded-2xl ${
              highlightedTaskId === task.id
                ? "ring-2 ring-primary ring-offset-2"
                : ""
            }`}
          >

            <TaskCard

              layout="card"

              id={task.id}
              committeeId={committeeId}

              title={task.title}

              description={task.description}

              status={task.status}

              dueDate={task.dueDate}

              assigneeName={task.assignedTo?.name}

              assignedToId={task.assignedTo?.id}

              currentUserId={user.id}

              canEdit={canCreate}
              isAssignee={task.assignedTo?.id === user.id}

              members={members}

              eventTitle={task.event?.title}

              subtasks={task.subtasks}

              onStatusChange={updateStatus}

              onAssign={assignTask}

              onDelete={canDelete ? deleteTask : undefined}

              reviewAssignmentId={getReviewAssignmentId(task)}

              onSubmitReview={submitAssignmentReview}

            />

            {task.subtasks.map((sub) => (

              <TaskCard

                key={sub.id}

                layout="card"

                id={sub.id}

                title={sub.title}

                status={sub.status}

                assigneeName={sub.assignedTo?.name}

                assignedToId={sub.assignedTo?.id}

                currentUserId={user.id}

                canEdit={canCreate}
              isAssignee={sub.assignedTo?.id === user.id}

                members={members}

                isSubtask

                onStatusChange={updateStatus}

                onAssign={assignTask}

              />

            ))}

          </div>

        ))}

        {tasks.length === 0 && (

          <p className="text-center text-muted py-8 col-span-full">

            No tasks yet. Create one to get started.

          </p>

        )}

      </div>



      <div className="hidden xl:grid xl:grid-cols-4 gap-4 min-h-0">

        {KANBAN_COLUMNS.map((status) => (

          <KanbanColumn

            key={status}

            status={status}

            tasks={byStatus(status).map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              description: "description" in t ? t.description : null,
              dueDate: "dueDate" in t ? t.dueDate : null,
              assignedTo: t.assignedTo,
              eventTitle: t.event?.title,
              isSubtask: "_isSubtask" in t && Boolean(t._isSubtask),
            }))}

            userId={user.id}
            canEdit={canCreate}
            members={members}

            onStatusChange={updateStatus}

            onAssign={assignTask}

            onDelete={canDelete ? deleteTask : undefined}

          />

        ))}

      </div>



      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="New Task">

        <div className="space-y-4">

          {eventFilter !== "all" && (

            <p className="text-sm text-muted">

              This task will be linked to:{" "}

              <span className="font-semibold text-charcoal">

                {events.find((e) => e.id === eventFilter)?.title}

              </span>

            </p>

          )}

          <label className="block">

            <span className="text-xs font-bold text-accent uppercase tracking-wider">Task Title</span>

            <input

              type="text"

              value={newTitle}

              onChange={(e) => setNewTitle(e.target.value)}

              className={`mt-2 ${FORM_FIELD_CLASS}`}

              placeholder="e.g. Soundboard Installation"

            />

          </label>

          <label className="block">

            <span className="text-xs font-bold text-accent uppercase tracking-wider">Due Date</span>

            <DateInput

              value={newDueDate}

              onChange={(e) => setNewDueDate(e.target.value)}

              className={`mt-2 ${FORM_FIELD_CLASS}`}

            />

          </label>

          <TouchButton size="lg" className="w-full mt-2" onClick={createTask}>

            Create Task

          </TouchButton>

        </div>

      </BottomSheet>

    </div>

  );

}

