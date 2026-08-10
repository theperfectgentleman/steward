"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Video,
} from "lucide-react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import {
  EVENT_KIND_LABELS,
  type EventKindProfile,
} from "@/lib/event-kinds";
import { eventsPath, eventPath } from "@/lib/navigation";
import { formatDateTimeWithWeekday } from "@/lib/dates";
import { formatGroupRoleLabel } from "@/lib/work-context";
import {
  SCHEDULE_FORMAT_LABELS,
  type PermissionUser,
  type ScheduleFormat,
  type ScheduleKind,
  type TaskStatus,
} from "@/lib/types";

export type Subtask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedTo: { id: string; name: string } | null;
};

export type ParentTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedTo: { id: string; name: string } | null;
  subtasks: Subtask[];
};

export type Deliverable = {
  id: string;
  title: string;
  kind: "NOTE" | "LINK" | "FILE";
  content: string;
  fileName?: string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
};

export type AgendaItem = {
  id: string;
  title: string;
  order: number;
};

export type Attendance = {
  user: { id: string; name: string };
  status: "PRESENT" | "EXCUSED" | "ABSENT" | "UNMARKED";
};

export type MeetingDetail = {
  id: string;
  title: string;
  approved: boolean;
  minutes: { id: string; content: string; order: number }[];
  attendances: Attendance[];
};

export type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  kind: ScheduleKind;
  format: ScheduleFormat;
  location: string | null;
  joinUrl: string | null;
  agenda: string | null;
  startDate: string;
  committeeId: string;
  committee?: { name: string; charterLetter?: string } | null;
  progress: number;
  doneCount: number;
  totalCount: number;
  tasks: ParentTask[];
  deliverables: Deliverable[];
  agendaItems: AgendaItem[];
  meeting: MeetingDetail | null;
  rsvps: { userId: string; status: string; user?: { id: string; name: string } }[];
};

export function EventDetailHeader({
  event,
  committeeId,
  eventId,
  editing,
  committeeName,
  contextUser,
}: {
  event: EventDetail;
  committeeId: string;
  eventId: string;
  editing?: boolean;
  committeeName?: string;
  contextUser?: PermissionUser | null;
}) {
  const contextLabel =
    contextUser && (committeeName || event.committee?.name)
      ? formatGroupRoleLabel(contextUser, {
          id: committeeId,
          name: committeeName ?? event.committee!.name,
        })
      : committeeName ?? event.committee?.name;

  return (
    <div>
      <Link
        href={eventsPath(committeeId)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-charcoal mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Events
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-xl font-bold text-charcoal">{event.title}</h1>
        {editing ? (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-accent/10 text-accent">
            Editing
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-100 text-charcoal-muted">
          {EVENT_KIND_LABELS[event.kind]}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-50 text-muted border border-charcoal/5">
          {SCHEDULE_FORMAT_LABELS[event.format]}
        </span>
        <CopyLinkButton path={eventPath(committeeId, eventId)} />
      </div>
      <time className="text-sm text-muted mt-2 block">
        {formatDateTimeWithWeekday(event.startDate)}
      </time>
      {contextLabel ? (
        <p className="text-sm text-muted mt-1">{contextLabel}</p>
      ) : null}
      {event.location && (
        <p className="text-sm text-muted mt-1 inline-flex items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0" />
          {event.location}
        </p>
      )}
      {event.joinUrl &&
        (event.format === "VIRTUAL" || event.format === "HYBRID") && (
          <a
            href={event.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent font-semibold mt-1 inline-flex items-center gap-1.5 hover:underline"
          >
            <Video className="h-4 w-4 shrink-0" />
            Join meeting
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
    </div>
  );
}

export function EventRsvpBar({
  rsvp,
  onRsvp,
}: {
  rsvp: "GOING" | "DECLINED" | null;
  onRsvp: (status: "GOING" | "DECLINED") => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onRsvp("GOING")}
        className={`flex-1 touch-target rounded-lg text-sm font-bold border transition-all cursor-pointer ${
          rsvp === "GOING"
            ? "bg-primary border-primary text-white shadow-2xs"
            : "bg-white border-charcoal/10 hover:border-primary text-charcoal-muted"
        }`}
      >
        Going
      </button>
      <button
        type="button"
        onClick={() => onRsvp("DECLINED")}
        className={`flex-1 touch-target rounded-lg text-sm font-bold border transition-all cursor-pointer ${
          rsvp === "DECLINED"
            ? "bg-charcoal border-charcoal text-white shadow-2xs"
            : "bg-white border-charcoal/10 hover:border-charcoal text-charcoal-muted"
        }`}
      >
        Declined
      </button>
    </div>
  );
}

export function EventProgressBar({ event }: { event: EventDetail }) {
  if (event.totalCount === 0) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-accent uppercase tracking-wider">
          Progress
        </span>
        <span className="text-sm font-semibold text-accent">
          {event.progress}% · {event.doneCount}/{event.totalCount} done
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${event.progress}%` }}
        />
      </div>
    </section>
  );
}

export type { EventKindProfile };
