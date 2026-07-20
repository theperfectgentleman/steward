"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/providers/AppProvider";
import {
  SCHEDULE_FORMAT_LABELS,
  SCHEDULE_KIND_LABELS,
  canEditTasks,
  canRsvp,
  type ScheduleFormat,
  type ScheduleKind,
} from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";
import { TouchButton } from "@/components/TouchButton";
import { DateInput } from "@/components/DateInput";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { formatDateTimeWithWeekday } from "@/lib/dates";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Plus, ChevronRight, X } from "lucide-react";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  kind: ScheduleKind;
  format: ScheduleFormat;
  location: string | null;
  joinUrl: string | null;
  agenda: string | null;
  startDate: string;
  progress: number;
  doneCount: number;
  totalCount: number;
  committee: { name: string; charterLetter: string };
  rsvps?: { userId: string; status: string; user?: { id: string; name: string } }[];
  meeting?: { id: string; approved: boolean } | null;
};

function EventList({
  events,
  committeeId,
  showRsvp,
  rsvps,
  onRsvp,
  emptyLabel,
}: {
  events: EventItem[];
  committeeId: string;
  showRsvp: boolean;
  rsvps: Record<string, "GOING" | "DECLINED">;
  onRsvp: (eventId: string, status: "GOING" | "DECLINED") => void;
  emptyLabel: string;
}) {
  if (events.length === 0) {
    return (
      <p className="text-center text-muted text-sm font-medium py-4 bg-white/50 rounded-xl border border-charcoal/5 border-dashed">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((ev) => (
        <li
          key={ev.id}
          className="bg-white rounded-xl border border-charcoal/5 shadow-2xs hover:shadow-xs transition-all overflow-hidden"
        >
          <Link
            href={`/c/${committeeId}/schedule/${ev.id}`}
            className="block px-3 py-2.5 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-charcoal-muted">
                    {SCHEDULE_KIND_LABELS[ev.kind]}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-50 text-muted border border-charcoal/5">
                    {SCHEDULE_FORMAT_LABELS[ev.format]}
                  </span>
                  {ev.kind === "MEETING" && ev.meeting && (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                        ev.meeting.approved
                          ? "bg-primary/10 text-primary-dark"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {ev.meeting.approved ? "Minutes approved" : "Minutes pending"}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-charcoal leading-snug">{ev.title}</h3>
                {ev.description && (
                  <p className="text-xs text-muted mt-0.5 line-clamp-2 font-medium">
                    {ev.description}
                  </p>
                )}
                <time className="text-[11px] font-semibold text-muted bg-slate-50 border border-charcoal/5 px-2 py-1 rounded-md inline-flex items-center gap-1.5 mt-2">
                  {formatDateTimeWithWeekday(ev.startDate)}
                </time>
                {ev.location && (
                  <p className="text-xs text-muted mt-1 font-medium">{ev.location}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted shrink-0 mt-1" />
            </div>

            {ev.totalCount > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-muted">
                    {ev.doneCount}/{ev.totalCount} tasks done
                  </span>
                  <span className="text-accent">{ev.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${ev.progress}%` }}
                  />
                </div>
              </div>
            )}
          </Link>

          {showRsvp && (
            <div className="flex gap-2 px-3 pb-2.5">
              <button
                type="button"
                onClick={() => onRsvp(ev.id, "GOING")}
                className={`flex-1 touch-target rounded-lg text-sm font-bold border transition-all cursor-pointer ${
                  rsvps[ev.id] === "GOING"
                    ? "bg-primary border-primary text-white shadow-2xs"
                    : "bg-white border-charcoal/10 hover:border-primary text-charcoal-muted"
                }`}
              >
                Going
              </button>
              <button
                type="button"
                onClick={() => onRsvp(ev.id, "DECLINED")}
                className={`flex-1 touch-target rounded-lg text-sm font-bold border transition-all cursor-pointer ${
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
  );
}

export function ScheduleView({ committeeId }: { committeeId: string }) {
  const router = useRouter();
  const { user } = useApp();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, "GOING" | "DECLINED">>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventKind, setEventKind] = useState<ScheduleKind>("EVENT");
  const [eventFormat, setEventFormat] = useState<ScheduleFormat>("IN_PERSON");
  const [eventLocation, setEventLocation] = useState("");
  const [eventJoinUrl, setEventJoinUrl] = useState("");
  const [eventAgenda, setEventAgenda] = useState("");
  const [createError, setCreateError] = useState("");

  const perm = user ? toPermissionUser(user) : null;
  const canEdit = !!(perm && canEditTasks(perm, committeeId));
  const showRsvp = !!(perm && canRsvp(perm));
  const showJoinUrl = eventFormat === "VIRTUAL" || eventFormat === "HYBRID";

  const { upcoming, previous } = useMemo(() => {
    const now = Date.now();
    const upcomingList: EventItem[] = [];
    const previousList: EventItem[] = [];
    for (const ev of events) {
      if (new Date(ev.startDate).getTime() >= now) {
        upcomingList.push(ev);
      } else {
        previousList.push(ev);
      }
    }
    previousList.reverse();
    return { upcoming: upcomingList, previous: previousList };
  }, [events]);

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

  const resetForm = () => {
    setEventTitle("");
    setEventDate("");
    setEventDesc("");
    setEventKind("EVENT");
    setEventFormat("IN_PERSON");
    setEventLocation("");
    setEventJoinUrl("");
    setEventAgenda("");
    setCreateError("");
  };

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
    if (eventKind === "EVENT" && !eventDesc.trim()) {
      setCreateError("Add a description so AI can generate tasks.");
      return;
    }
    setCreateError("");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: eventTitle.trim(),
        description: eventDesc.trim() || undefined,
        startDate: new Date(eventDate).toISOString(),
        committeeId,
        kind: eventKind,
        format: eventFormat,
        location: eventLocation.trim() || null,
        joinUrl: showJoinUrl ? eventJoinUrl.trim() || null : null,
        agenda: eventAgenda.trim() || null,
      }),
    });
    const data = await res.json();
    if (data?.id) {
      resetForm();
      setCreateOpen(false);
      router.push(`/c/${committeeId}/schedule/${data.id}`);
    } else {
      setCreateError(data?.error ?? "Failed to create.");
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Meetings, events, and deadlines</p>
        {canEdit && !createOpen && (
          <TouchButton
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="h-5 w-5" />
            Add
          </TouchButton>
        )}
      </div>

      {canEdit && createOpen && (
        <section
          className="max-w-2xl rounded-xl border border-charcoal/10 bg-white p-4 space-y-4 shadow-2xs"
          aria-labelledby="new-schedule-heading"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="new-schedule-heading"
                className="text-lg font-bold text-charcoal"
              >
                New schedule item
              </h2>
              <p className="text-sm text-muted mt-1">
                Fill in the details below, then create.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setCreateOpen(false);
              }}
              className="touch-target rounded-xl text-muted hover:text-charcoal hover:bg-slate-50 transition-colors"
              aria-label="Cancel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Type
              </span>
              <div className="mt-2">
                <SegmentedControl
                  options={[
                    { value: "MEETING", label: "Meeting" },
                    { value: "EVENT", label: "Event" },
                  ]}
                  value={eventKind}
                  onChange={setEventKind}
                />
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Format
              </span>
              <div className="mt-2">
                <SegmentedControl
                  options={[
                    { value: "IN_PERSON", label: "In person" },
                    { value: "VIRTUAL", label: "Virtual" },
                    { value: "HYBRID", label: "Hybrid" },
                  ]}
                  value={eventFormat}
                  onChange={setEventFormat}
                />
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Title
              </span>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className={`mt-2 ${FORM_FIELD_CLASS}`}
                placeholder={
                  eventKind === "MEETING"
                    ? "e.g. Monthly committee meeting"
                    : "e.g. Site walkthrough"
                }
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Date & Time
              </span>
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
                Location
              </span>
              <input
                type="text"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                className={`mt-2 ${FORM_FIELD_CLASS}`}
                placeholder="Room, building, or address"
              />
            </label>

            {showJoinUrl && (
              <label className="block">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">
                  Join URL
                </span>
                <input
                  type="url"
                  value={eventJoinUrl}
                  onChange={(e) => setEventJoinUrl(e.target.value)}
                  className={`mt-2 ${FORM_FIELD_CLASS}`}
                  placeholder="https://"
                />
              </label>
            )}

            <label className="block">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Agenda
              </span>
              <textarea
                value={eventAgenda}
                onChange={(e) => setEventAgenda(e.target.value)}
                rows={3}
                placeholder="High-level agenda notes"
                className={`mt-2 ${FORM_TEXTAREA_CLASS}`}
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Description
                {eventKind === "EVENT" ? "" : " (optional)"}
              </span>
              <textarea
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                rows={4}
                placeholder={
                  eventKind === "EVENT"
                    ? "Describe the event in detail — used for AI task generation."
                    : "Optional context for this meeting."
                }
                className={`mt-2 ${FORM_TEXTAREA_CLASS}`}
              />
            </label>

            {createError && (
              <p className="text-sm text-accent font-medium">{createError}</p>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <TouchButton
                variant="secondary"
                onClick={() => {
                  resetForm();
                  setCreateOpen(false);
                }}
              >
                Cancel
              </TouchButton>
              <TouchButton onClick={createEvent}>
                Create {eventKind === "MEETING" ? "meeting" : "event"}
              </TouchButton>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
          Upcoming
        </h2>
        <EventList
          events={upcoming}
          committeeId={committeeId}
          showRsvp={showRsvp}
          rsvps={rsvps}
          onRsvp={handleRsvp}
          emptyLabel="No upcoming meetings or events."
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
          Previous
        </h2>
        <EventList
          events={previous}
          committeeId={committeeId}
          showRsvp={false}
          rsvps={rsvps}
          onRsvp={handleRsvp}
          emptyLabel="No previous meetings or events."
        />
      </section>
    </div>
  );
}
