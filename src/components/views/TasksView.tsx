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

export function TasksView() {
  const { user, activeCommitteeId } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const loadTasks = useCallback(() => {
    if (!activeCommitteeId) return;
    fetch(`/api/tasks?committeeId=${activeCommitteeId}`)
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => setTasks([]));
  }, [activeCommitteeId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!activeCommitteeId) return;
    fetch(`/api/meetings?committeeId=${activeCommitteeId}`)
      .then((r) => r.json())
      .then((meetings) => {
        const seen = new Set<string>();
        const m: Member[] = [];
        for (const meeting of meetings) {
          for (const att of meeting.attendances ?? []) {
            if (!seen.has(att.user.id)) {
              seen.add(att.user.id);
              m.push({ id: att.user.id, name: att.user.name });
            }
          }
        }
        setMembers(m);
      })
      .catch(() => setMembers([]));
  }, [activeCommitteeId]);

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

  const createTask = async () => {
    if (!newTitle.trim() || !activeCommitteeId || !user) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        committeeId: activeCommitteeId,
        createdById: user.id,
      }),
    });
    setNewTitle("");
    setCreateOpen(false);
    loadTasks();
  };

  if (!activeCommitteeId) {
    return (
      <p className="text-muted text-center py-12">
        Select a committee to view tasks.
      </p>
    );
  }

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            id={task.id}
            title={task.title}
            description={task.description}
            status={task.status}
            dueDate={task.dueDate}
            assigneeName={task.assignedTo?.name}
            userRole={user!.role}
            members={members}
            onStatusChange={updateStatus}
            onAssign={assignTask}
          />
        ))}
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
          <TouchButton size="lg" className="w-full" onClick={createTask}>
            Create Task
          </TouchButton>
        </div>
      </BottomSheet>
    </div>
  );
}
