"use client";

import { useCallback, useEffect, useState } from "react";
import { TaskCard } from "@/components/TaskCard";
import { TouchButton } from "@/components/TouchButton";
import { BottomSheet } from "@/components/BottomSheet";
import { useApp } from "@/providers/AppProvider";
import { canEditTasks, type TaskStatus } from "@/lib/types";
import { Plus } from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  assignedTo: { id: string; name: string } | null;
};

type Member = { id: string; name: string };

export function TasksView({ committeeId }: { committeeId: string }) {
  const { user } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const loadTasks = useCallback(() => {
    if (!committeeId) return;
    fetch(`/api/tasks?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTasks(data);
        else setTasks([]);
      })
      .catch(() => setTasks([]));
  }, [committeeId]);

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
        dueDate: newDueDate || undefined,
      }),
    });
    setNewTitle("");
    setNewDueDate("");
    setCreateOpen(false);
    loadTasks();
  };

  if (!committeeId) {
    return (
      <p className="text-muted text-center py-12">
        Select a committee to view tasks.
      </p>
    );
  }

  // Desktop Kanban swimlanes; mobile/tablet card grid
  const byStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Task Board</h1>
          <p className="text-muted text-sm mt-1">Tap to update status</p>
        </div>
        {user && canEditTasks(user.role) && (
          <TouchButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-5 w-5" />
            New
          </TouchButton>
        )}
      </div>

      {/* Mobile / tablet: flat card list */}
      <div className="grid gap-4 md:grid-cols-2 xl:hidden">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            id={task.id}
            title={task.title}
            description={task.description}
            status={task.status}
            dueDate={task.dueDate}
            assigneeName={task.assignedTo?.name}
            assignedToId={task.assignedTo?.id}
            currentUserId={user!.id}
            userRole={user!.role}
            members={members}
            onStatusChange={updateStatus}
            onAssign={assignTask}
            onDelete={canEditTasks(user!.role) ? deleteTask : undefined}
          />
        ))}
      </div>

      {/* Desktop: Kanban swimlanes */}
      <div className="hidden xl:grid xl:grid-cols-4 gap-4">
        {(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as TaskStatus[]).map(
          (status) => (
            <div key={status} className="space-y-3">
              <h2 className="text-xs font-bold text-accent uppercase tracking-wide px-1">
                {status.replace("_", " ")} ({byStatus(status).length})
              </h2>
              {byStatus(status).map((task) => (
                <TaskCard
                  key={task.id}
                  id={task.id}
                  title={task.title}
                  description={task.description}
                  status={task.status}
                  dueDate={task.dueDate}
                  assigneeName={task.assignedTo?.name}
                  assignedToId={task.assignedTo?.id}
                  currentUserId={user!.id}
                  userRole={user!.role}
                  members={members}
                  onStatusChange={updateStatus}
                  onAssign={assignTask}
                  onDelete={canEditTasks(user!.role) ? deleteTask : undefined}
                />
              ))}
            </div>
          ),
        )}
      </div>

      {tasks.length === 0 && (
        <p className="text-center text-muted py-8">No tasks yet.</p>
      )}

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="New Task">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-charcoal">Task Title</span>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-2 w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none text-base"
              placeholder="e.g. Soundboard Installation"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-charcoal">Due Date</span>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="mt-2 w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none text-base"
            />
          </label>
          <TouchButton size="lg" className="w-full" onClick={createTask}>
            Create Task
          </TouchButton>
        </div>
      </BottomSheet>
    </div>
  );
}
