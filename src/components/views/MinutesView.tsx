"use client";

import { useCallback, useEffect, useState } from "react";
import { TouchButton } from "@/components/TouchButton";
import { BottomSheet } from "@/components/BottomSheet";
import { useApp } from "@/providers/AppProvider";
import { canEditTasks } from "@/lib/types";
import { Plus } from "lucide-react";

type Attendance = {
  user: { id: string; name: string };
  status: "PRESENT" | "EXCUSED" | "ABSENT" | "UNMARKED";
};

type Meeting = {
  id: string;
  title: string;
  date: string;
  approved: boolean;
  minutes: { id: string; content: string; order: number }[];
  attendances: Attendance[];
};

const ATTENDANCE_CYCLE: Record<string, "PRESENT" | "EXCUSED" | "ABSENT"> = {
  UNMARKED: "PRESENT",
  PRESENT: "EXCUSED",
  EXCUSED: "ABSENT",
  ABSENT: "PRESENT",
};

const ATTENDANCE_STYLES = {
  PRESENT: "border-primary ring-2 ring-primary",
  EXCUSED: "border-accent ring-2 ring-accent",
  ABSENT: "border-charcoal ring-2 ring-charcoal",
  UNMARKED: "border-charcoal/20",
};

export function MinutesView() {
  const { user, activeCommitteeId } = useApp();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState<string[]>([""]);

  const loadMeetings = useCallback(() => {
    if (!activeCommitteeId) return;
    fetch(`/api/meetings?committeeId=${activeCommitteeId}`)
      .then((r) => r.json())
      .then(setMeetings)
      .catch(() => setMeetings([]));
  }, [activeCommitteeId]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const toggleAttendance = async (
    meetingId: string,
    userId: string,
    current: string,
  ) => {
    const next = ATTENDANCE_CYCLE[current] ?? "PRESENT";
    await fetch("/api/meetings/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, userId, status: next }),
    });
    loadMeetings();
  };

  const createMeeting = async () => {
    if (!title.trim() || !activeCommitteeId || !user) return;
    const memberIds = meetings[0]?.attendances.map((a) => a.user.id) ?? [];
    await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        date: new Date().toISOString(),
        committeeId: activeCommitteeId,
        createdById: user.id,
        points: points.filter((p) => p.trim()),
        memberIds,
      }),
    });
    setTitle("");
    setPoints([""]);
    setCreateOpen(false);
    loadMeetings();
  };

  const canCreate = user && canEditTasks(user.role);

  if (!activeCommitteeId) {
    return (
      <p className="text-muted text-center py-12">
        Select a committee to view minutes.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Minutes</h1>
          <p className="text-muted text-sm mt-1">Meeting records & attendance</p>
        </div>
        {canCreate && (
          <TouchButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-5 w-5" />
            Log
          </TouchButton>
        )}
      </div>

      {meetings.map((m) => (
        <article
          key={m.id}
          className="bg-white rounded-2xl border border-charcoal/10 p-5 space-y-5"
        >
          <div>
            <h2 className="text-lg font-bold text-charcoal">{m.title}</h2>
            <time className="text-sm text-muted">
              {new Date(m.date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
            {!m.approved && (
              <span className="ml-2 text-xs font-semibold text-accent">
                Pending review
              </span>
            )}
          </div>

          {canCreate && m.attendances.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted uppercase mb-3">
                Attendance — tap to toggle
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {m.attendances.map((a) => (
                  <button
                    key={a.user.id}
                    type="button"
                    onClick={() =>
                      toggleAttendance(m.id, a.user.id, a.status)
                    }
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 bg-white touch-target-lg ${ATTENDANCE_STYLES[a.status]}`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal text-white font-bold text-sm">
                      {a.user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <span className="text-xs font-semibold text-center leading-tight">
                      {a.user.name.split(" ")[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ul className="space-y-2 list-disc list-inside">
            {m.minutes.map((pt) => (
              <li key={pt.id} className="text-sm text-charcoal leading-relaxed">
                {pt.content}
              </li>
            ))}
          </ul>
        </article>
      ))}

      {meetings.length === 0 && (
        <p className="text-center text-muted py-8">No meetings logged yet.</p>
      )}

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Log Meeting">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Meeting Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none"
            />
          </label>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Minute Points</p>
            {points.map((pt, i) => (
              <input
                key={i}
                type="text"
                value={pt}
                onChange={(e) => {
                  const next = [...points];
                  next[i] = e.target.value;
                  setPoints(next);
                }}
                className="w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none"
                placeholder={`Point ${i + 1}`}
              />
            ))}
            <TouchButton
              variant="ghost"
              onClick={() => setPoints([...points, ""])}
            >
              + Add Point
            </TouchButton>
          </div>

          <TouchButton size="lg" className="w-full" onClick={createMeeting}>
            Save Meeting
          </TouchButton>
        </div>
      </BottomSheet>
    </div>
  );
}
