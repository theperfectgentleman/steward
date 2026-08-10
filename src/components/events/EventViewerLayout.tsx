"use client";

import {
  ExternalLink,
  FileText,
  Link2,
  StickyNote,
} from "lucide-react";
import {
  agendaItemsLabel,
  agendaNotesLabel,
  deliverablesEmptyLabel,
  deliverablesSectionTitle,
  type EventKindProfile,
} from "@/lib/event-kinds";
import { formatDate } from "@/lib/dates";
import { eventDeliverableFilePath } from "@/lib/document-urls";
import { TASK_STATUS_LABELS } from "@/lib/types";
import {
  EventDetailHeader,
  EventProgressBar,
  EventRsvpBar,
  type EventDetail,
  type MeetingDetail,
} from "./EventShared";

const ATTENDANCE_STYLES = {
  PRESENT: "border-primary ring-2 ring-primary bg-primary/5",
  EXCUSED: "border-accent ring-2 ring-accent bg-accent/5",
  ABSENT: "border-charcoal ring-2 ring-charcoal bg-charcoal/5",
  UNMARKED: "border-charcoal/10",
};

export function EventViewerLayout({
  event,
  committeeId,
  eventId,
  profile,
  meeting,
  showRsvp,
  rsvp,
  onRsvp,
  contextUser,
}: {
  event: EventDetail;
  committeeId: string;
  eventId: string;
  profile: EventKindProfile;
  meeting: MeetingDetail | null;
  showRsvp: boolean;
  rsvp: "GOING" | "DECLINED" | null;
  onRsvp: (status: "GOING" | "DECLINED") => void;
  contextUser?: import("@/lib/types").PermissionUser | null;
}) {
  return (
    <div className="space-y-5">
      <EventDetailHeader
        event={event}
        committeeId={committeeId}
        eventId={eventId}
        contextUser={contextUser}
      />

      {profile.rsvp && showRsvp ? (
        <EventRsvpBar rsvp={rsvp} onRsvp={onRsvp} />
      ) : null}

      {event.description ? (
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
            Description
          </h2>
          <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
            {event.description}
          </p>
        </section>
      ) : null}

      {profile.agenda && (event.agenda || event.agendaItems.length > 0) ? (
        <>
          {event.agenda ? (
            <section className="space-y-2">
              <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
                {agendaNotesLabel(event.kind)}
              </h2>
              <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
                {event.agenda}
              </p>
            </section>
          ) : null}

          {event.agendaItems.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
                {agendaItemsLabel(event.kind)}
              </h2>
              <ol className="space-y-2">
                {event.agendaItems.map((item, i) => (
                  <li
                    key={item.id}
                    className="bg-white rounded-xl border border-charcoal/5 px-4 py-3 flex items-start gap-3"
                  >
                    <span className="text-xs font-extrabold text-muted mt-0.5">
                      {i + 1}.
                    </span>
                    <p className="font-semibold text-charcoal">{item.title}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}

      {profile.tasks ? (
        <>
          <EventProgressBar event={event} />
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
              Tasks
            </h2>
            {event.tasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks yet.</p>
            ) : (
              <ul className="space-y-2">
                {event.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="bg-white rounded-xl border border-charcoal/5 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-charcoal">{task.title}</p>
                        {task.assignedTo ? (
                          <p className="text-xs text-muted mt-1">
                            {task.assignedTo.name}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-muted shrink-0">
                        {TASK_STATUS_LABELS[task.status]}
                      </span>
                    </div>
                    {task.subtasks.length > 0 ? (
                      <ul className="mt-2 pl-3 border-l-2 border-primary/20 space-y-1">
                        {task.subtasks.map((sub) => (
                          <li
                            key={sub.id}
                            className="text-sm text-charcoal-muted flex justify-between gap-2"
                          >
                            <span>{sub.title}</span>
                            <span className="text-[10px] font-bold uppercase text-muted">
                              {TASK_STATUS_LABELS[sub.status]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {profile.deliverables ? (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
            {deliverablesSectionTitle(event.kind)}
          </h2>
          {event.deliverables.length === 0 ? (
            <p className="text-sm text-muted">
              {deliverablesEmptyLabel(event.kind)}
            </p>
          ) : (
            <ul className="space-y-3">
              {event.deliverables.map((d) => (
                <li
                  key={d.id}
                  className="bg-white rounded-xl border border-charcoal/5 p-4"
                >
                  <div className="flex items-center gap-2">
                    {d.kind === "NOTE" ? (
                      <StickyNote className="h-4 w-4 text-muted shrink-0" />
                    ) : d.kind === "FILE" ? (
                      <FileText className="h-4 w-4 text-muted shrink-0" />
                    ) : (
                      <Link2 className="h-4 w-4 text-muted shrink-0" />
                    )}
                    <span className="font-bold text-charcoal">{d.title}</span>
                  </div>
                  {d.kind === "NOTE" ? (
                    <p className="text-sm text-muted mt-2 whitespace-pre-wrap">
                      {d.content}
                    </p>
                  ) : d.kind === "FILE" ? (
                    <a
                      href={eventDeliverableFilePath(eventId, d.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent font-semibold mt-2 inline-flex items-center gap-1 hover:underline"
                    >
                      {d.fileName || d.content}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <a
                      href={d.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent font-semibold mt-2 inline-flex items-center gap-1 hover:underline"
                    >
                      {d.content}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <p className="text-xs text-muted mt-2">
                    {d.createdBy.name} · {formatDate(d.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {profile.minutes && meeting ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Minutes & attendance
            </h2>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                meeting.approved
                  ? "bg-primary/10 text-primary-dark"
                  : "bg-accent/10 text-accent"
              }`}
            >
              {meeting.approved ? "Approved" : "Pending"}
            </span>
          </div>

          {meeting.attendances.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                Attendance
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {meeting.attendances.map((a) => (
                  <div
                    key={a.user.id}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 bg-white ${ATTENDANCE_STYLES[a.status]}`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal text-white font-extrabold text-xs">
                      {a.user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <span className="text-[10px] font-bold text-charcoal truncate w-full text-center">
                      {a.user.name.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
              Minute points
            </h3>
            <ul className="space-y-2 bg-slate-50/50 border border-charcoal/5 rounded-xl p-4">
              {meeting.minutes.map((pt, i) => (
                <li
                  key={pt.id}
                  className="text-sm text-charcoal leading-relaxed flex items-start gap-3 py-1"
                >
                  <span className="font-extrabold text-muted text-xs select-none mt-0.5">
                    {i + 1}.
                  </span>
                  <span className="flex-1">{pt.content}</span>
                </li>
              ))}
              {meeting.minutes.length === 0 ? (
                <p className="text-xs text-muted font-medium py-2">
                  No points entered.
                </p>
              ) : null}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
