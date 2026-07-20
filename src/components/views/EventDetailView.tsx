"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Link2,
  MapPin,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { AccessDenied } from "@/components/AccessDenied";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TouchButton } from "@/components/TouchButton";
import { useApp } from "@/providers/AppProvider";
import {
  SCHEDULE_FORMAT_LABELS,
  SCHEDULE_KIND_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  canApproveMinutes,
  canEditTasks,
  canLogMinutes,
  canRsvp,
  getCommitteeTitle,
  type ScheduleFormat,
  type ScheduleKind,
  type TaskStatus,
} from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";
import { eventPath } from "@/lib/navigation";
import { formatDate, formatDateTimeWithWeekday } from "@/lib/dates";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { PageShimmer } from "@/components/loading/PageShimmer";

type Subtask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedTo: { id: string; name: string } | null;
};

type ParentTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignedTo: { id: string; name: string } | null;
  subtasks: Subtask[];
};

type Deliverable = {
  id: string;
  title: string;
  kind: "NOTE" | "LINK";
  content: string;
  createdBy: { id: string; name: string };
  createdAt: string;
};

type AgendaItem = {
  id: string;
  title: string;
  order: number;
  assignmentId: string | null;
  assignment?: { id: string; title: string } | null;
};

type Attendance = {
  user: { id: string; name: string };
  status: "PRESENT" | "EXCUSED" | "ABSENT" | "UNMARKED";
};

type MeetingDetail = {
  id: string;
  title: string;
  approved: boolean;
  minutes: { id: string; content: string; order: number }[];
  attendances: Attendance[];
};

type EventDetail = {
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
  progress: number;
  doneCount: number;
  totalCount: number;
  tasks: ParentTask[];
  deliverables: Deliverable[];
  agendaItems: AgendaItem[];
  meeting: MeetingDetail | null;
  rsvps: { userId: string; status: string; user?: { id: string; name: string } }[];
};

type Member = { id: string; name: string };

type TaskDraft = { title: string; description?: string };

const ATTENDANCE_CYCLE: Record<string, "PRESENT" | "EXCUSED" | "ABSENT"> = {
  UNMARKED: "PRESENT",
  PRESENT: "EXCUSED",
  EXCUSED: "ABSENT",
  ABSENT: "PRESENT",
};

const ATTENDANCE_STYLES = {
  PRESENT: "border-primary ring-2 ring-primary bg-primary/5",
  EXCUSED: "border-accent ring-2 ring-accent bg-accent/5",
  ABSENT: "border-charcoal ring-2 ring-charcoal bg-charcoal/5",
  UNMARKED: "border-charcoal/10 hover:border-charcoal/20",
};

export function EventDetailView({
  committeeId,
  eventId,
}: {
  committeeId: string;
  eventId: string;
}) {
  const { user } = useApp();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [descEdit, setDescEdit] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [subtaskOpen, setSubtaskOpen] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [deliverableOpen, setDeliverableOpen] = useState<"NOTE" | "LINK" | null>(null);
  const [delTitle, setDelTitle] = useState("");
  const [delContent, setDelContent] = useState("");
  const [rsvp, setRsvp] = useState<"GOING" | "DECLINED" | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [agendaTitle, setAgendaTitle] = useState("");
  const [minutePoints, setMinutePoints] = useState<string[]>([""]);
  const [savingMinutes, setSavingMinutes] = useState(false);
  const [approving, setApproving] = useState(false);
  const [meetingFallback, setMeetingFallback] = useState<MeetingDetail | null>(null);

  const perm = user ? toPermissionUser(user) : null;
  const canEdit = !!(perm && canEditTasks(perm, committeeId));
  const canMinutes = !!(perm && canLogMinutes(perm, committeeId));
  const canApprove = !!(perm && canApproveMinutes(perm, committeeId));
  const showRsvp = !!(perm && canRsvp(perm));

  const load = useCallback(() => {
    if (!eventId) return;
    setLoading(true);
    fetch(`/api/events/${eventId}`)
      .then((r) => {
        if (r.status === 403) {
          setAccessDenied(true);
          return null;
        }
        return r.json();
      })
      .then(async (data) => {
        if (!data) return;
        if (data?.id) {
          setEvent({
            ...data,
            agendaItems: data.agendaItems ?? [],
            meeting: data.meeting ?? null,
            kind: data.kind ?? "EVENT",
            format: data.format ?? "IN_PERSON",
          });
          setDescEdit(data.description ?? "");
          if (data.meeting?.minutes) {
            setMinutePoints(
              data.meeting.minutes.length > 0
                ? data.meeting.minutes.map((m: { content: string }) => m.content)
                : [""],
            );
          }
          if (user) {
            const mine = data.rsvps?.find(
              (r: { userId: string; user?: { id: string } }) =>
                r.userId === user.id || r.user?.id === user.id,
            );
            if (mine?.status === "GOING" || mine?.status === "DECLINED") {
              setRsvp(mine.status);
            }
          }

          if (data.kind === "MEETING" && !data.meeting) {
            const res = await fetch(`/api/meetings?eventId=${eventId}`);
            const meetings = await res.json();
            const found = Array.isArray(meetings) ? meetings[0] : null;
            setMeetingFallback(found ?? null);
            if (found?.minutes) {
              setMinutePoints(
                found.minutes.length > 0
                  ? found.minutes.map((m: { content: string }) => m.content)
                  : [""],
              );
            }
          } else {
            setMeetingFallback(null);
          }
        } else {
          setEvent(null);
        }
      })
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [eventId, user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch(`/api/committees/members?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMembers(data.map((m: Member) => ({ id: m.id, name: m.name })));
        }
      })
      .catch(() => setMembers([]));
  }, [committeeId]);

  const saveDescription = async () => {
    if (!event) return;
    setSavingDesc(true);
    await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: descEdit }),
    });
    setSavingDesc(false);
    load();
  };

  const generateTasks = async () => {
    if (!event) return;
    setAiLoading(true);
    setAiError("");
    const res = await fetch(`/api/events/${event.id}/generate-tasks`, {
      method: "POST",
    });
    const data = await res.json();
    setAiLoading(false);
    if (!res.ok) {
      setAiError(data.error ?? "Generation failed");
      return;
    }
    setDrafts(data.drafts ?? []);
    setDraftOpen(true);
  };

  const saveDrafts = async () => {
    if (!event || drafts.length === 0) return;
    await fetch(`/api/events/${event.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: drafts }),
    });
    setDraftOpen(false);
    setDrafts([]);
    load();
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const assignTask = async (taskId: string, userId: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: userId }),
    });
    load();
  };

  const createSubtask = async (parentId: string) => {
    if (!subtaskTitle.trim() || !committeeId) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: subtaskTitle.trim(),
        committeeId,
        parentId,
        eventId,
      }),
    });
    setSubtaskTitle("");
    setSubtaskOpen(null);
    setExpanded((prev) => ({ ...prev, [parentId]: true }));
    load();
  };

  const createDeliverable = async () => {
    if (!event || !deliverableOpen || !delTitle.trim() || !delContent.trim()) return;
    await fetch(`/api/events/${event.id}/deliverables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: delTitle.trim(),
        kind: deliverableOpen,
        content: delContent.trim(),
      }),
    });
    setDelTitle("");
    setDelContent("");
    setDeliverableOpen(null);
    load();
  };

  const deleteDeliverable = async (deliverableId: string) => {
    if (!event || !confirm("Remove this deliverable?")) return;
    await fetch(
      `/api/events/${event.id}/deliverables?deliverableId=${deliverableId}`,
      { method: "DELETE" },
    );
    load();
  };

  const handleRsvp = async (status: "GOING" | "DECLINED") => {
    if (!event) return;
    await fetch("/api/events/rsvp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id, status }),
    });
    setRsvp(status);
  };

  const meeting = event?.meeting ?? meetingFallback;

  const addAgendaItem = async () => {
    if (!event || !agendaTitle.trim()) return;
    await fetch(`/api/events/${event.id}/agenda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: agendaTitle.trim() }),
    });
    setAgendaTitle("");
    load();
  };

  const deleteAgendaItem = async (agendaItemId: string) => {
    if (!event || !confirm("Remove this agenda item?")) return;
    await fetch(
      `/api/events/${event.id}/agenda?agendaItemId=${agendaItemId}`,
      { method: "DELETE" },
    );
    load();
  };

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
    load();
  };

  const saveMinutes = async () => {
    if (!meeting) return;
    setSavingMinutes(true);
    try {
      await fetch("/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: meeting.id,
          points: minutePoints.filter((p) => p.trim()),
        }),
      });
      load();
    } finally {
      setSavingMinutes(false);
    }
  };

  const approveMeeting = async () => {
    if (!meeting) return;
    setApproving(true);
    try {
      await fetch("/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meeting.id, approved: true }),
      });
      load();
    } finally {
      setApproving(false);
    }
  };

  const canUpdateTask = (task: Subtask | ParentTask) => {
    if (!user) return false;
    if (perm && canEditTasks(perm, committeeId)) return true;
    return (
      perm &&
      getCommitteeTitle(perm, committeeId) === "MEMBER" &&
      task.assignedTo?.id === user.id
    );
  };

  if (loading) {
    return <PageShimmer variant="detail" />;
  }

  if (accessDenied) {
    return <AccessDenied itemLabel="event" />;
  }

  if (!event) {
    return (
      <div className="text-center py-6 space-y-4">
        <p className="text-muted">Event not found.</p>
        <Link
          href={`/c/${committeeId}/schedule`}
          className="text-accent font-semibold hover:underline"
        >
          Back to Schedule
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/c/${committeeId}/schedule`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-charcoal mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Schedule
        </Link>
        <h1 className="text-xl font-bold text-charcoal">{event.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-100 text-charcoal-muted">
            {SCHEDULE_KIND_LABELS[event.kind]}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-50 text-muted border border-charcoal/5">
            {SCHEDULE_FORMAT_LABELS[event.format]}
          </span>
          <CopyLinkButton path={eventPath(committeeId, eventId)} />
        </div>
        <time className="text-sm text-muted mt-2 block">
          {formatDateTimeWithWeekday(event.startDate)}
        </time>
        {event.location && (
          <p className="text-sm text-muted mt-1 inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" />
            {event.location}
          </p>
        )}
        {event.joinUrl && (event.format === "VIRTUAL" || event.format === "HYBRID") && (
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
        <p className="text-xs text-muted">
          Calculated from completed tasks — not manually adjusted.
        </p>
      </section>

      {showRsvp && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleRsvp("GOING")}
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
            onClick={() => handleRsvp("DECLINED")}
            className={`flex-1 touch-target rounded-lg text-sm font-bold border transition-all cursor-pointer ${
              rsvp === "DECLINED"
                ? "bg-charcoal border-charcoal text-white shadow-2xs"
                : "bg-white border-charcoal/10 hover:border-charcoal text-charcoal-muted"
            }`}
          >
            Declined
          </button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
          Description
        </h2>
        {canEdit ? (
          <>
            <textarea
              value={descEdit}
              onChange={(e) => setDescEdit(e.target.value)}
              rows={5}
              className={FORM_TEXTAREA_CLASS}
              placeholder="Describe the event in detail — this feeds AI task generation."
            />
            <TouchButton
              size="md"
              onClick={saveDescription}
              disabled={savingDesc}
            >
              {savingDesc ? "Saving…" : "Save description"}
            </TouchButton>
          </>
        ) : (
          <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
            {event.description || "No description yet."}
          </p>
        )}
      </section>

      {(event.agenda || canEdit) && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
            Agenda notes
          </h2>
          {event.agenda ? (
            <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
              {event.agenda}
            </p>
          ) : (
            <p className="text-sm text-muted">No agenda notes yet.</p>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
            Agenda items
          </h2>
        </div>
        {event.agendaItems.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center bg-white/50 rounded-2xl border border-charcoal/5 border-dashed">
            No agenda items yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {event.agendaItems.map((item, i) => (
              <li
                key={item.id}
                className="bg-white rounded-xl border border-charcoal/5 px-4 py-3 flex items-start gap-3"
              >
                <span className="text-xs font-extrabold text-muted mt-0.5">
                  {i + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-charcoal">{item.title}</p>
                  {item.assignment && (
                    <p className="text-xs text-muted mt-1">
                      Linked: {item.assignment.title}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => deleteAgendaItem(item.id)}
                    className="touch-target text-muted hover:text-accent"
                    aria-label="Delete agenda item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="flex gap-2">
            <input
              type="text"
              value={agendaTitle}
              onChange={(e) => setAgendaTitle(e.target.value)}
              placeholder="Add agenda item…"
              className={`flex-1 ${FORM_FIELD_CLASS}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAgendaItem();
                }
              }}
            />
            <TouchButton onClick={addAgendaItem} disabled={!agendaTitle.trim()}>
              <Plus className="h-4 w-4" />
              Add
            </TouchButton>
          </div>
        )}
      </section>

      {event.kind === "MEETING" && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Minutes & attendance
            </h2>
            {meeting && (
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  meeting.approved
                    ? "bg-primary/10 text-primary-dark"
                    : "bg-accent/10 text-accent"
                }`}
              >
                {meeting.approved ? "Approved" : "Pending"}
              </span>
            )}
          </div>

          {!meeting ? (
            <p className="text-sm text-muted py-4 text-center bg-white/50 rounded-2xl border border-charcoal/5 border-dashed">
              No linked meeting record yet.
            </p>
          ) : (
            <>
              {meeting.attendances.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                    Attendance {canMinutes && "— tap to toggle"}
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                    {meeting.attendances.map((a) => {
                      const buttonContent = (
                        <>
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
                        </>
                      );

                      if (canMinutes && !meeting.approved) {
                        return (
                          <button
                            key={a.user.id}
                            type="button"
                            onClick={() =>
                              toggleAttendance(meeting.id, a.user.id, a.status)
                            }
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 bg-white touch-target transition-all ${ATTENDANCE_STYLES[a.status]}`}
                          >
                            {buttonContent}
                          </button>
                        );
                      }

                      return (
                        <div
                          key={a.user.id}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 bg-white ${ATTENDANCE_STYLES[a.status]}`}
                        >
                          {buttonContent}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                  Minute points
                </h3>
                {canMinutes && !meeting.approved ? (
                  <div className="space-y-2">
                    {minutePoints.map((pt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted w-5 text-right shrink-0">
                          {i + 1}.
                        </span>
                        <input
                          type="text"
                          value={pt}
                          onChange={(e) => {
                            const next = [...minutePoints];
                            next[i] = e.target.value;
                            setMinutePoints(next);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const next = [...minutePoints];
                              next.splice(i + 1, 0, "");
                              setMinutePoints(next);
                            } else if (
                              e.key === "Backspace" &&
                              minutePoints[i] === "" &&
                              minutePoints.length > 1
                            ) {
                              e.preventDefault();
                              setMinutePoints(
                                minutePoints.filter((_, j) => j !== i),
                              );
                            }
                          }}
                          className={`flex-1 ${FORM_FIELD_CLASS}`}
                          placeholder="Minute point…"
                        />
                        {minutePoints.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setMinutePoints(
                                minutePoints.filter((_, j) => j !== i),
                              )
                            }
                            className="touch-target text-muted hover:text-accent"
                            aria-label="Remove point"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <TouchButton
                        variant="ghost"
                        size="md"
                        onClick={() => setMinutePoints([...minutePoints, ""])}
                      >
                        <Plus className="h-4 w-4" />
                        Add point
                      </TouchButton>
                      <TouchButton
                        size="md"
                        onClick={saveMinutes}
                        disabled={savingMinutes}
                      >
                        {savingMinutes ? "Saving…" : "Save minutes"}
                      </TouchButton>
                    </div>
                  </div>
                ) : (
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
                    {meeting.minutes.length === 0 && (
                      <p className="text-xs text-muted font-medium py-2">
                        No points entered.
                      </p>
                    )}
                  </ul>
                )}
              </div>

              {canApprove && !meeting.approved && (
                <TouchButton onClick={approveMeeting} disabled={approving}>
                  <Check className="h-4 w-4" />
                  {approving ? "Approving…" : "Approve minutes"}
                </TouchButton>
              )}
            </>
          )}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
            Tasks
          </h2>
          {canEdit && (
            <TouchButton
              variant="secondary"
              size="md"
              onClick={generateTasks}
              disabled={aiLoading}
            >
              <Sparkles className="h-4 w-4" />
              {aiLoading ? "Generating…" : "Generate with AI"}
            </TouchButton>
          )}
        </div>
        {aiError && (
          <p className="text-sm text-accent font-medium">{aiError}</p>
        )}

        {event.tasks.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center bg-white/50 rounded-2xl border border-charcoal/5 border-dashed">
            No tasks yet. Add a description and generate with AI, or create tasks from the Board.
          </p>
        ) : (
          <ul className="space-y-3">
            {event.tasks.map((task) => (
              <li
                key={task.id}
                className="bg-white rounded-2xl border border-charcoal/5 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-charcoal">{task.title}</h3>
                    {task.description && (
                      <p className="text-xs text-muted mt-1">{task.description}</p>
                    )}
                    {task.assignedTo && (
                      <p className="text-xs text-muted mt-1">
                        Assigned: {task.assignedTo.name}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <select
                      value={task.assignedTo?.id ?? ""}
                      onChange={(e) =>
                        e.target.value && assignTask(task.id, e.target.value)
                      }
                      className="text-xs font-bold border border-charcoal/10 rounded-lg px-2 py-1"
                      aria-label="Assign task"
                    >
                      <option value="">Assign…</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {canUpdateTask(task) && (
                  <SegmentedControl
                    options={TASK_STATUSES.map((s) => ({
                      value: s,
                      label: TASK_STATUS_LABELS[s],
                    }))}
                    value={task.status}
                    onChange={(s) => updateTaskStatus(task.id, s)}
                  />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [task.id]: !prev[task.id],
                      }))
                    }
                    className="text-xs font-bold text-accent hover:underline"
                  >
                    {expanded[task.id] ? "Hide" : "Show"} subtasks (
                    {task.subtasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubtaskOpen(task.id);
                      setSubtaskTitle("");
                    }}
                    className="text-xs font-bold text-charcoal hover:underline ml-auto"
                  >
                    + Subtask
                  </button>
                </div>

                {expanded[task.id] && task.subtasks.length > 0 && (
                  <ul className="space-y-2 pl-3 border-l-2 border-primary/30">
                    {task.subtasks.map((sub) => (
                      <li
                        key={sub.id}
                        className="bg-slate-50 rounded-xl p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted bg-white px-1.5 py-0.5 rounded">
                            Subtask
                          </span>
                          <span className="font-semibold text-sm text-charcoal">
                            {sub.title}
                          </span>
                        </div>
                        {canUpdateTask(sub) && (
                          <SegmentedControl
                            options={TASK_STATUSES.map((s) => ({
                              value: s,
                              label: TASK_STATUS_LABELS[s],
                            }))}
                            value={sub.status}
                            onChange={(s) => updateTaskStatus(sub.id, s)}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider flex-1">
            Deliverables
          </h2>
          {canEdit && (
            <>
              <TouchButton
                variant="ghost"
                size="md"
                onClick={() => {
                  setDeliverableOpen("NOTE");
                  setDelTitle("");
                  setDelContent("");
                }}
              >
                <StickyNote className="h-4 w-4" />
                Note
              </TouchButton>
              <TouchButton
                variant="ghost"
                size="md"
                onClick={() => {
                  setDeliverableOpen("LINK");
                  setDelTitle("");
                  setDelContent("");
                }}
              >
                <Link2 className="h-4 w-4" />
                Link
              </TouchButton>
              <TouchButton
                variant="ghost"
                size="md"
                disabled
                title="Coming soon"
                className="opacity-50"
              >
                <Upload className="h-4 w-4" />
                Upload file
              </TouchButton>
            </>
          )}
        </div>

        {event.deliverables.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">
            No deliverables yet. Attach notes or links as end products.
          </p>
        ) : (
          <ul className="space-y-3">
            {event.deliverables.map((d) => (
              <li
                key={d.id}
                className="bg-white rounded-xl border border-charcoal/5 p-4 flex items-start gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {d.kind === "NOTE" ? (
                      <StickyNote className="h-4 w-4 text-muted shrink-0" />
                    ) : (
                      <Link2 className="h-4 w-4 text-muted shrink-0" />
                    )}
                    <span className="font-bold text-charcoal">{d.title}</span>
                  </div>
                  {d.kind === "NOTE" ? (
                    <p className="text-sm text-muted mt-2 whitespace-pre-wrap">
                      {d.content}
                    </p>
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
                    {d.createdBy.name} ·{" "}
                    {formatDate(d.createdAt)}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => deleteDeliverable(d.id)}
                    className="touch-target text-muted hover:text-accent"
                    aria-label="Delete deliverable"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <BottomSheet
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        title="Review AI tasks"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Edit or remove tasks before adding them to this event.
          </p>
          {drafts.map((draft, i) => (
            <div key={i} className="space-y-2 p-3 bg-slate-50 rounded-xl">
              <input
                type="text"
                value={draft.title}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...next[i], title: e.target.value };
                  setDrafts(next);
                }}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/10 font-semibold"
              />
              <input
                type="text"
                value={draft.description ?? ""}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...next[i], description: e.target.value };
                  setDrafts(next);
                }}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 rounded-lg border border-charcoal/10 text-sm"
              />
              <button
                type="button"
                onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
                className="text-xs font-bold text-accent"
              >
                Remove
              </button>
            </div>
          ))}
          <TouchButton size="lg" className="w-full" onClick={saveDrafts}>
            <Plus className="h-5 w-5" />
            Add {drafts.length} task{drafts.length !== 1 ? "s" : ""} to event
          </TouchButton>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!subtaskOpen}
        onClose={() => setSubtaskOpen(null)}
        title="New subtask"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            placeholder="What needs to be done?"
            className={FORM_FIELD_CLASS}
          />
          <TouchButton
            size="lg"
            className="w-full"
            onClick={() => subtaskOpen && createSubtask(subtaskOpen)}
          >
            Create subtask
          </TouchButton>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!deliverableOpen}
        onClose={() => setDeliverableOpen(null)}
        title={deliverableOpen === "LINK" ? "Add link" : "Add note"}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold text-accent uppercase">Title</span>
            <input
              type="text"
              value={delTitle}
              onChange={(e) => setDelTitle(e.target.value)}
              className={`mt-2 ${FORM_FIELD_CLASS}`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-accent uppercase">
              {deliverableOpen === "LINK" ? "URL" : "Note"}
            </span>
            {deliverableOpen === "LINK" ? (
              <input
                type="url"
                value={delContent}
                onChange={(e) => setDelContent(e.target.value)}
                placeholder="https://"
                className={`mt-2 ${FORM_FIELD_CLASS}`}
              />
            ) : (
              <textarea
                value={delContent}
                onChange={(e) => setDelContent(e.target.value)}
                rows={4}
                className={`mt-2 ${FORM_TEXTAREA_CLASS}`}
              />
            )}
          </label>
          <TouchButton size="lg" className="w-full" onClick={createDeliverable}>
            Save
          </TouchButton>
        </div>
      </BottomSheet>
    </div>
  );
}
