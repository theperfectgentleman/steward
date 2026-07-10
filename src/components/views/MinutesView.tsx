"use client";

import { useCallback, useEffect, useState } from "react";
import { TouchButton } from "@/components/TouchButton";
import { BottomSheet } from "@/components/BottomSheet";
import { useApp } from "@/providers/AppProvider";
import { canApproveMinutes, canLogMinutes } from "@/lib/types";
import { Check, Plus } from "lucide-react";

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

type Member = { id: string; name: string };

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

export function MinutesView({ committeeId }: { committeeId: string }) {
  const { user } = useApp();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [roster, setRoster] = useState<Member[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState<string[]>([""]);
  const [approving, setApproving] = useState<string | null>(null);

  const loadMeetings = useCallback(() => {
    if (!committeeId) return;
    fetch(`/api/meetings?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMeetings(data);
        else setMeetings([]);
      })
      .catch(() => setMeetings([]));
  }, [committeeId]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    if (!committeeId) return;
    fetch(`/api/committees/members?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRoster(data.map((m: Member) => ({ id: m.id, name: m.name })));
        } else {
          setRoster([]);
        }
      })
      .catch(() => setRoster([]));
  }, [committeeId]);

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

  const approveMeeting = async (id: string) => {
    setApproving(id);
    try {
      await fetch("/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approved: true }),
      });
      loadMeetings();
    } finally {
      setApproving(null);
    }
  };

  const createMeeting = async () => {
    if (!title.trim() || !committeeId || !user) return;
    const memberIds = roster.map((m) => m.id);
    await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        date: new Date().toISOString(),
        committeeId,
        points: points.filter((p) => p.trim()),
        memberIds,
      }),
    });
    setTitle("");
    setPoints([""]);
    setCreateOpen(false);
    loadMeetings();
  };

  const canCreate = user && canLogMinutes(user.role);
  const canApprove = user && canApproveMinutes(user.role);

  if (!committeeId) {
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
          id={`meeting-${m.id}`}
          className="bg-white rounded-2xl border border-charcoal/10 p-5 space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
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
              {m.approved ? (
                <span className="ml-2 text-xs font-semibold text-primary-dark">
                  Approved
                </span>
              ) : (
                <span className="ml-2 text-xs font-semibold text-accent">
                  Pending review
                </span>
              )}
            </div>
            {canApprove && !m.approved && (
              <TouchButton
                onClick={() => approveMeeting(m.id)}
                disabled={approving === m.id}
              >
                <Check className="h-5 w-5" />
                {approving === m.id ? "Approving…" : "Approve"}
              </TouchButton>
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

          {!canCreate && m.attendances.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted uppercase mb-3">
                Attendance
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {m.attendances.map((a) => (
                  <div
                    key={a.user.id}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 bg-white ${ATTENDANCE_STYLES[a.status]}`}
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
                  </div>
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

          {roster.length > 0 && (
            <p className="text-sm text-muted">
              Attendance grid will include {roster.length} committee member
              {roster.length === 1 ? "" : "s"}.
            </p>
          )}

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
