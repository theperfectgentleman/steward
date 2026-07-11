"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/providers/AppProvider";
import { canEditTasks, canRsvp } from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";
import { TouchButton } from "@/components/TouchButton";
import { DateInput } from "@/components/DateInput";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { formatDateTimeWithWeekday } from "@/lib/dates";
import { BottomSheet } from "@/components/BottomSheet";
import { Plus, ChevronRight } from "lucide-react";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  progress: number;
  doneCount: number;
  totalCount: number;
  committee: { name: string; charterLetter: string };
  rsvps?: { userId: string; status: string; user?: { id: string; name: string } }[];
};

export function ScheduleView({ committeeId }: { committeeId: string }) {
  const router = useRouter();
  const { user } = useApp();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, "GOING" | "DECLINED">>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [createError, setCreateError] = useState("");

  const perm = user ? toPermissionUser(user) : null;
  const canEdit = !!(perm && canEditTasks(perm, committeeId));
  const showRsvp = !!(perm && canRsvp(perm));

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

  const createEvent = async () => {
    if (!eventTitle.trim() || !eventDate || !committeeId) return;
    if (!eventDesc.trim()) {
      setCreateError("Add a description so AI can generate tasks.");
      return;
    }
    setCreateError("");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: eventTitle.trim(),
        description: eventDesc.trim(),
        startDate: new Date(eventDate).toISOString(),
        committeeId,
      }),
    });
    const data = await res.json();
    if (data?.id) {
      setEventTitle("");
      setEventDate("");
      setEventDesc("");
      setCreateOpen(false);
      router.push(`/c/${committeeId}/schedule/${data.id}`);
    } else {
      setCreateError("Failed to create event.");
      load();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Events and deadlines</p>
        {canEdit && (
          <TouchButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-5 w-5" />
            Event
          </TouchButton>
        )}
      </div>

      <section className="space-y-4">
        <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
          Events &amp; progress
        </h2>
        <ul className="space-y-4">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="bg-white rounded-2xl border border-charcoal/5 shadow-2xs hover:shadow-xs transition-all overflow-hidden"
            >
              <Link
                href={`/c/${committeeId}/schedule/${ev.id}`}
                className="block p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-charcoal">{ev.title}</h3>
                    {ev.description && (
                      <p className="text-sm text-muted mt-1 line-clamp-2 font-medium">
                        {ev.description}
                      </p>
                    )}
                    <time className="text-xs font-semibold text-muted bg-slate-50 border border-charcoal/5 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 mt-3">
                      {formatDateTimeWithWeekday(ev.startDate)}
                    </time>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted shrink-0 mt-1" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted">
                      {ev.totalCount > 0
                        ? `${ev.doneCount}/${ev.totalCount} tasks done`
                        : "No tasks yet"}
                    </span>
                    <span className="text-accent">{ev.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${ev.progress}%` }}
                    />
                  </div>
                </div>
              </Link>

              {showRsvp && (
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    type="button"
                    onClick={() => handleRsvp(ev.id, "GOING")}
                    className={`flex-1 touch-target-lg rounded-xl font-bold border transition-all cursor-pointer ${
                      rsvps[ev.id] === "GOING"
                        ? "bg-primary border-primary text-white shadow-2xs"
                        : "bg-white border-charcoal/10 hover:border-primary text-charcoal-muted"
                    }`}
                  >
                    Going
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRsvp(ev.id, "DECLINED")}
                    className={`flex-1 touch-target-lg rounded-xl font-bold border transition-all cursor-pointer ${
                      rsvps[ev.id] === "DECLINED"
                        ? "bg-charcoal border-charcoal text-white shadow-2xs"
                        : "bg-white border-charcoal/10 hover:border-charcoal text-charcoal-muted"
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
          <p className="text-center text-muted font-medium py-8 bg-white/50 rounded-2xl border border-charcoal/5 border-dashed">
            No upcoming events.
          </p>
        )}
      </section>

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="New Event" size="lg">
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Title</span>
            <input
              type="text"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className={`mt-2 ${FORM_FIELD_CLASS}`}
              placeholder="e.g. Site walkthrough"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Date & Time</span>
            <div className="mt-2">
            <DateInput
              type="datetime-local"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">
              Description
            </span>
            <textarea
              value={eventDesc}
              onChange={(e) => setEventDesc(e.target.value)}
              rows={4}
              placeholder="Describe the event in detail — used for AI task generation."
              className={`mt-2 ${FORM_TEXTAREA_CLASS}`}
            />
          </label>
          {createError && (
            <p className="text-sm text-accent font-medium">{createError}</p>
          )}
          <TouchButton size="lg" className="w-full mt-2" onClick={createEvent}>
            Create Event
          </TouchButton>
        </div>
      </BottomSheet>
    </div>
  );
}
