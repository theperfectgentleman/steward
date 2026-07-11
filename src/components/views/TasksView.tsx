"use client";



import { useCallback, useEffect, useState } from "react";

import { TaskCard } from "@/components/TaskCard";

import { KanbanColumn } from "@/components/KanbanColumn";

import { TouchButton } from "@/components/TouchButton";

import { BottomSheet } from "@/components/BottomSheet";

import { useApp } from "@/providers/AppProvider";

import { useCommitteeContext } from "@/hooks/useCommitteeContext";

import { canEditTasks, type TaskStatus } from "@/lib/types";

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

  subtasks: Subtask[];

};



type EventOption = { id: string; title: string };



type Member = { id: string; name: string };



export function TasksView({ committeeId }: { committeeId: string }) {

  const { user } = useApp();

  const { committee } = useCommitteeContext();

  const [tasks, setTasks] = useState<Task[]>([]);

  const [events, setEvents] = useState<EventOption[]>([]);

  const [eventFilter, setEventFilter] = useState<string>("all");

  const [members, setMembers] = useState<Member[]>([]);

  const [createOpen, setCreateOpen] = useState(false);

  const [newTitle, setNewTitle] = useState("");

  const [newDueDate, setNewDueDate] = useState("");



  const loadTasks = useCallback(() => {

    if (!committeeId) return;

    const qs =

      eventFilter !== "all"

        ? `committeeId=${committeeId}&eventId=${eventFilter}`

        : `committeeId=${committeeId}`;

    fetch(`/api/tasks?${qs}`)

      .then((r) => r.json())

      .then((data) => {

        if (Array.isArray(data)) setTasks(data);

        else setTasks([]);

      })

      .catch(() => setTasks([]));

  }, [committeeId, eventFilter]);



  useEffect(() => {

    loadTasks();

  }, [loadTasks]);



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



  const canDelete = canEditTasks(user.role);



  return (

    <div className="space-y-5">

      <div className="flex items-center justify-between gap-3 flex-wrap">

        <div>

          <h1 className="text-2xl font-bold text-charcoal">Task Board</h1>

          <p className="text-muted text-sm mt-1">

            {committee?.name ?? "Committee"} — drag-free board; move tasks via

            the status menu on each card

          </p>

        </div>

        {canEditTasks(user.role) && (

          <TouchButton onClick={() => setCreateOpen(true)}>

            <Plus className="h-5 w-5" />

            New Task

          </TouchButton>

        )}

      </div>



      <div className="flex items-center gap-3">

        <label className="text-xs font-bold text-accent uppercase tracking-wider shrink-0">

          Event

        </label>

        <select

          value={eventFilter}

          onChange={(e) => setEventFilter(e.target.value)}

          className="flex-1 max-w-xs px-3 py-2 rounded-xl border border-charcoal/10 font-semibold text-sm bg-white"

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

          <div key={task.id} className="space-y-3">

            <TaskCard

              layout="card"

              id={task.id}

              title={task.title}

              description={task.description}

              status={task.status}

              dueDate={task.dueDate}

              assigneeName={task.assignedTo?.name}

              assignedToId={task.assignedTo?.id}

              currentUserId={user.id}

              userRole={user.role}

              members={members}

              eventTitle={task.event?.title}

              subtasks={task.subtasks}

              onStatusChange={updateStatus}

              onAssign={assignTask}

              onDelete={canDelete ? deleteTask : undefined}

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

                userRole={user.role}

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

            userRole={user.role}

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

              className="mt-2 w-full input-touch px-4 rounded-xl border border-charcoal/10 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base font-semibold"

              placeholder="e.g. Soundboard Installation"

            />

          </label>

          <label className="block">

            <span className="text-xs font-bold text-accent uppercase tracking-wider">Due Date</span>

            <input

              type="date"

              value={newDueDate}

              onChange={(e) => setNewDueDate(e.target.value)}

              className="mt-2 w-full input-touch px-4 rounded-xl border border-charcoal/10 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base font-semibold"

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

