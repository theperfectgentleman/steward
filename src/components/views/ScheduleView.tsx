"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import { canEditTasks, canRsvp } from "@/lib/types";
import { TimelineEditor } from "@/components/TimelineEditor";
import { TouchButton } from "@/components/TouchButton";
import { BottomSheet } from "@/components/BottomSheet";
import { Plus } from "lucide-react";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  committee: { name: string; charterLetter: string };
  rsvps?: { userId: string; status: string; user?: { id: string; name: string } }[];
};

type TimelineGoal = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  progress: number;
};

export function ScheduleView({ committeeId }: { committeeId: string }) {
  const { user } = useApp();
  const { committee } = useCommitteeContext();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [goals, setGoals] = useState<TimelineGoal[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, "GOING" | "DECLINED">>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDesc, setEventDesc] = useState("");

  const canEdit = !!(user && canEditTasks(user.role));
  const showRsvp = !!(user && canRsvp(user.role));

  const load = useCallback(() => {
    if (!user || !committeeId) return;

    fetch(`/api/events?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEvents(data);
          const mine: Record<string, "GOING" | "DECLINED"> = {};
          for (const ev of data as EventItem[]) {
            const match = ev.rsvps?.find(
              (r) => r.userId === user.id || r.user?.id === user.id,
            );
            if (match && (match.status === "GOING" || match.status === "DECLINED")) {
              mine[ev.id] = match.status;
            }
          }
          setRsvps(mine);
        } else {
          setEvents([]);
        }
      })
      .catch(() => setEvents([]));

    fetch(`/api/timeline?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setGoals(data);
        else setGoals([]);
      })
      .catch(() => setGoals([]));
  }, [committeeId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRsvp = async (eventId: string, status: "GOING" | "DECLINED") => {
    if (!user) return;
    await fetch("/api/events/rsvp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, status }),
    });
    setRsvps((prev) => ({ ...prev, [eventId]: status }));
  };

  const saveGoal = async (goal: TimelineGoal) => {
    await fetch("/api/timeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: goal.id,
        progress: goal.progress,
        startDate: goal.startDate,
        endDate: goal.endDate,
      }),
    });
    load();
  };

  const createEvent = async () => {
    if (!eventTitle.trim() || !eventDate || !committeeId) return;
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: eventTitle.trim(),
        description: eventDesc.trim() || undefined,
        startDate: new Date(eventDate).toISOString(),
        committeeId,
      }),
    });
    setEventTitle("");
    setEventDate("");
    setEventDesc("");
    setCreateOpen(false);
    load();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Schedule</h1>
          <p className="text-muted mt-1">
            {committee?.name ?? "Committee"} — events and deadlines
          </p>
        </div>
        {canEdit && (
          <TouchButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-5 w-5" />
            Event
          </TouchButton>
        )}
      </div>

      {goals.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-accent uppercase tracking-wide">
            Timeline Horizon
          </h2>
          {goals.map((g) => (
            <TimelineEditor
              key={g.id}
              goal={g}
              canEdit={canEdit}
              onSave={saveGoal}
            />
          ))}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-bold text-accent uppercase tracking-wide">
          Agenda
        </h2>
        <ul className="space-y-4">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="bg-white rounded-2xl border border-charcoal/10 p-5 space-y-4"
            >
              <div>
                <h3 className="text-lg font-bold text-charcoal">{ev.title}</h3>
                {ev.description && (
                  <p className="text-sm text-muted mt-1">{ev.description}</p>
                )}
                <time className="text-sm font-medium text-charcoal mt-2 block">
                  {new Date(ev.startDate).toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>

              {showRsvp && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => handleRsvp(ev.id, "GOING")}
                    className={`flex-1 touch-target-lg rounded-xl font-semibold border-2 transition-all ${
                      rsvps[ev.id] === "GOING"
                        ? "bg-primary border-primary text-charcoal"
                        : "border-charcoal/15 hover:border-primary"
                    }`}
                  >
                    Going
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRsvp(ev.id, "DECLINED")}
                    className={`flex-1 touch-target-lg rounded-xl font-semibold border-2 transition-all ${
                      rsvps[ev.id] === "DECLINED"
                        ? "bg-charcoal border-charcoal text-white"
                        : "border-charcoal/15 hover:border-charcoal"
                    }`}
                  >
                    Declined
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {events.length === 0 && (
          <p className="text-center text-muted py-8">No upcoming events.</p>
        )}
      </section>

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="New Event">
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Title</span>
            <input
              type="text"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="mt-2 w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none"
              placeholder="e.g. Site walkthrough"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Date & Time</span>
            <input
              type="datetime-local"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="mt-2 w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Description (optional)</span>
            <input
              type="text"
              value={eventDesc}
              onChange={(e) => setEventDesc(e.target.value)}
              className="mt-2 w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none"
            />
          </label>
          <TouchButton size="lg" className="w-full" onClick={createEvent}>
            Create Event
          </TouchButton>
        </div>
      </BottomSheet>
    </div>
  );
}
