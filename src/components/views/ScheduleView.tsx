"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/providers/AppProvider";
import { canViewAllCommittees } from "@/lib/types";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  committee: { name: string; charterLetter: string };
};

type TimelineGoal = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  progress: number;
};

export function ScheduleView() {
  const { user, activeCommitteeId } = useApp();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [goals, setGoals] = useState<TimelineGoal[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, "GOING" | "DECLINED">>({});

  const isGlobal = user && canViewAllCommittees(user.role);

  useEffect(() => {
    const committeeParam = isGlobal ? "" : `committeeId=${activeCommitteeId}`;
    const globalParam = isGlobal ? "global=true" : "";
    const qs = [committeeParam, globalParam].filter(Boolean).join("&");

    fetch(`/api/events?${qs}`)
      .then((r) => r.json())
      .then(setEvents)
      .catch(() => setEvents([]));

    if (activeCommitteeId && !isGlobal) {
      fetch(`/api/timeline?committeeId=${activeCommitteeId}`)
        .then((r) => r.json())
        .then(setGoals)
        .catch(() => setGoals([]));
    } else if (isGlobal) {
      fetch("/api/timeline")
        .then((r) => r.json())
        .then(setGoals)
        .catch(() => setGoals([]));
    }
  }, [activeCommitteeId, isGlobal]);

  const handleRsvp = async (eventId: string, status: "GOING" | "DECLINED") => {
    if (!user) return;
    await fetch("/api/events/rsvp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, userId: user.id, status }),
    });
    setRsvps((prev) => ({ ...prev, [eventId]: status }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Schedule</h1>
        <p className="text-muted mt-1">Upcoming events and deadlines</p>
      </div>

      {goals.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-accent uppercase tracking-wide">
            Timeline Horizon
          </h2>
          {goals.map((g) => (
            <div
              key={g.id}
              className="bg-white rounded-2xl border border-charcoal/10 p-5 space-y-3"
            >
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-bold text-charcoal">{g.title}</h3>
                <span className="text-sm font-semibold text-accent">{g.progress}%</span>
              </div>
              <div className="h-4 rounded-full bg-primary/30 overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${g.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted">
                {new Date(g.startDate).toLocaleDateString()} —{" "}
                {new Date(g.endDate).toLocaleDateString()}
              </p>
            </div>
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
                <p className="text-xs font-bold text-accent uppercase">
                  {ev.committee.charterLetter}) {ev.committee.name}
                </p>
                <h3 className="text-lg font-bold text-charcoal mt-1">{ev.title}</h3>
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

              {user?.role === "COMMITTEE_MEMBER" && (
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
    </div>
  );
}
