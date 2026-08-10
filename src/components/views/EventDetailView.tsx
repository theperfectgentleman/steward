"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { AccessDenied } from "@/components/AccessDenied";
import { TouchButton } from "@/components/TouchButton";
import { PageShimmer } from "@/components/loading/PageShimmer";
import { EventEditorLayout } from "@/components/events/EventEditorLayout";
import { EventViewerLayout } from "@/components/events/EventViewerLayout";
import type {
  EventDetail,
  MeetingDetail,
  ParentTask,
  Subtask,
} from "@/components/events/EventShared";
import { useApp } from "@/providers/AppProvider";
import { getEventKindProfile } from "@/lib/event-kinds";
import { eventsPath } from "@/lib/navigation";
import { toPermissionUser } from "@/lib/permissions-client";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import {
  canApproveMinutes,
  canEditTasks,
  canLogMinutes,
  canRsvp,
  getCommitteeTitle,
  isCommitteeReadOnly,
  type ScheduleFormat,
  type ScheduleKind,
  type TaskStatus,
} from "@/lib/types";

type TaskDraft = { title: string; description?: string };

export function EventDetailView({
  committeeId,
  eventId,
}: {
  committeeId: string;
  eventId: string;
}) {
  const { user } = useApp();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [descEdit, setDescEdit] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [agendaEdit, setAgendaEdit] = useState("");
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [kindEdit, setKindEdit] = useState<ScheduleKind>("OTHER");
  const [formatEdit, setFormatEdit] = useState<ScheduleFormat>("IN_PERSON");
  const [locationEdit, setLocationEdit] = useState("");
  const [joinUrlEdit, setJoinUrlEdit] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [subtaskOpen, setSubtaskOpen] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [deliverableOpen, setDeliverableOpen] = useState<"NOTE" | "LINK" | null>(
    null,
  );
  const [delTitle, setDelTitle] = useState("");
  const [delContent, setDelContent] = useState("");
  const [uploadingDeliverable, setUploadingDeliverable] = useState(false);
  const [rsvp, setRsvp] = useState<"GOING" | "DECLINED" | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [agendaTitle, setAgendaTitle] = useState("");
  const [minutePoints, setMinutePoints] = useState<string[]>([""]);
  const [savingMinutes, setSavingMinutes] = useState(false);
  const [approving, setApproving] = useState(false);

  const perm = user ? toPermissionUser(user) : null;
  const canEdit = !!(perm && canEditTasks(perm, committeeId));
  const canMinutes = !!(perm && canLogMinutes(perm, committeeId));
  const canApprove = !!(perm && canApproveMinutes(perm, committeeId));
  const showRsvp = !!(perm && canRsvp(perm));
  const readOnlyViewer = !!(perm && isCommitteeReadOnly(perm, committeeId));
  const isEditor = !readOnlyViewer && (canEdit || canMinutes);

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
          const kind = (data.kind === "EVENT" ? "OTHER" : data.kind) ?? "OTHER";
          setEvent({
            ...data,
            agendaItems: data.agendaItems ?? [],
            meeting: data.meeting ?? null,
            kind,
            format: data.format ?? "IN_PERSON",
          });
          setDescEdit(data.description ?? "");
          setAgendaEdit(data.agenda ?? "");
          setKindEdit(kind);
          setFormatEdit(data.format ?? "IN_PERSON");
          setLocationEdit(data.location ?? "");
          setJoinUrlEdit(data.joinUrl ?? "");
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

  const saveAgenda = async () => {
    if (!event) return;
    setSavingAgenda(true);
    await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agenda: agendaEdit }),
    });
    setSavingAgenda(false);
    load();
  };

  const saveMeta = async () => {
    if (!event) return;
    const profile = getEventKindProfile(kindEdit);
    if (profile.emphasizeLocation && !locationEdit.trim()) {
      setAiError("Location is required for a working visit.");
      return;
    }
    setSavingMeta(true);
    setAiError("");
    await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: kindEdit,
        format: formatEdit,
        location: locationEdit.trim() || null,
        joinUrl:
          formatEdit === "VIRTUAL" || formatEdit === "HYBRID"
            ? joinUrlEdit.trim() || null
            : null,
      }),
    });
    setSavingMeta(false);
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
    if (!event || !deliverableOpen || !delTitle.trim() || !delContent.trim()) {
      return;
    }
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
    if (!event || !confirm("Remove this item?")) return;
    await fetch(
      `/api/events/${event.id}/deliverables?deliverableId=${deliverableId}`,
      { method: "DELETE" },
    );
    load();
  };

  const uploadDeliverable = async (file: File) => {
    if (!event) return;
    setUploadingDeliverable(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, "") || file.name);
      const res = await fetch(`/api/events/${event.id}/deliverables`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Upload failed");
        return;
      }
      load();
    } catch {
      alert("Upload failed");
    } finally {
      setUploadingDeliverable(false);
    }
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

  const meeting = event?.meeting ?? null;

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

  const ATTENDANCE_CYCLE: Record<string, "PRESENT" | "EXCUSED" | "ABSENT"> = {
    UNMARKED: "PRESENT",
    PRESENT: "EXCUSED",
    EXCUSED: "ABSENT",
    ABSENT: "PRESENT",
  };

  const toggleAttendance = async (
    _meetingId: string,
    userId: string,
    current: string,
  ) => {
    const next = ATTENDANCE_CYCLE[current] ?? "PRESENT";
    await fetch(`/api/events/${eventId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status: next }),
    });
    load();
  };

  const saveMinutes = async () => {
    if (!event) return;
    setSavingMinutes(true);
    try {
      await fetch(`/api/events/${eventId}/minutes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: minutePoints.filter((p) => p.trim()),
        }),
      });
      load();
    } finally {
      setSavingMinutes(false);
    }
  };

  const approveMeeting = async () => {
    if (!event) return;
    setApproving(true);
    try {
      await fetch(`/api/events/${eventId}/minutes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true }),
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
      !!perm &&
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
          href={eventsPath(committeeId)}
          className="text-accent font-semibold hover:underline"
        >
          Back to Events
        </Link>
      </div>
    );
  }

  const profile = getEventKindProfile(event.kind);

  return (
    <>
      {isEditor ? (
        <EventEditorLayout
          event={event}
          committeeId={committeeId}
          eventId={eventId}
          profile={profile}
          meeting={meeting}
          showRsvp={showRsvp}
          rsvp={rsvp}
          onRsvp={handleRsvp}
          descEdit={descEdit}
          setDescEdit={setDescEdit}
          savingDesc={savingDesc}
          onSaveDescription={saveDescription}
          agendaEdit={agendaEdit}
          setAgendaEdit={setAgendaEdit}
          savingAgenda={savingAgenda}
          onSaveAgenda={saveAgenda}
          agendaTitle={agendaTitle}
          setAgendaTitle={setAgendaTitle}
          onAddAgendaItem={addAgendaItem}
          onDeleteAgendaItem={deleteAgendaItem}
          kindEdit={kindEdit}
          setKindEdit={setKindEdit}
          formatEdit={formatEdit}
          setFormatEdit={setFormatEdit}
          locationEdit={locationEdit}
          setLocationEdit={setLocationEdit}
          joinUrlEdit={joinUrlEdit}
          setJoinUrlEdit={setJoinUrlEdit}
          savingMeta={savingMeta}
          onSaveMeta={saveMeta}
          aiLoading={aiLoading}
          aiError={aiError}
          onGenerateTasks={generateTasks}
          expanded={expanded}
          setExpanded={setExpanded}
          canUpdateTask={canUpdateTask}
          onUpdateTaskStatus={updateTaskStatus}
          onAssignTask={assignTask}
          onOpenSubtask={(id) => {
            setSubtaskOpen(id);
            setSubtaskTitle("");
          }}
          canEdit={canEdit}
          canMinutes={canMinutes}
          canApprove={canApprove}
          minutePoints={minutePoints}
          setMinutePoints={setMinutePoints}
          savingMinutes={savingMinutes}
          onSaveMinutes={saveMinutes}
          approving={approving}
          onApproveMeeting={approveMeeting}
          onToggleAttendance={toggleAttendance}
          onOpenDeliverable={(kind) => {
            setDeliverableOpen(kind);
            setDelTitle("");
            setDelContent("");
          }}
          onUploadDeliverable={uploadDeliverable}
          uploadingDeliverable={uploadingDeliverable}
          onDeleteDeliverable={deleteDeliverable}
          contextUser={perm}
        />
      ) : (
        <EventViewerLayout
          event={event}
          committeeId={committeeId}
          eventId={eventId}
          profile={profile}
          meeting={meeting}
          showRsvp={showRsvp}
          rsvp={rsvp}
          onRsvp={handleRsvp}
          contextUser={perm}
        />
      )}

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
    </>
  );
}
