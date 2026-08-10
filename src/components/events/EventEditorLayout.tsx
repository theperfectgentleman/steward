"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  Check,
  ExternalLink,
  FileText,
  Link2,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
} from "lucide-react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TouchButton } from "@/components/TouchButton";
import { PeoplePicker } from "@/components/people/PeoplePicker";
import {
  agendaItemsLabel,
  agendaNotesLabel,
  deliverablesEmptyLabel,
  deliverablesSectionTitle,
  EVENT_KIND_LABELS,
  EVENT_KINDS,
  type EventKindProfile,
} from "@/lib/event-kinds";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { formatDate } from "@/lib/dates";
import { eventDeliverableFilePath } from "@/lib/document-urls";
import {
  SCHEDULE_FORMAT_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type ScheduleFormat,
  type ScheduleKind,
  type TaskStatus,
} from "@/lib/types";
import {
  EventDetailHeader,
  EventProgressBar,
  EventRsvpBar,
  type EventDetail,
  type MeetingDetail,
  type ParentTask,
  type Subtask,
} from "./EventShared";

const ATTENDANCE_STYLES = {
  PRESENT: "border-primary ring-2 ring-primary bg-primary/5",
  EXCUSED: "border-accent ring-2 ring-accent bg-accent/5",
  ABSENT: "border-charcoal ring-2 ring-charcoal bg-charcoal/5",
  UNMARKED: "border-charcoal/10 hover:border-charcoal/20",
};

export function EventEditorLayout({
  event,
  committeeId,
  eventId,
  profile,
  meeting,
  showRsvp,
  rsvp,
  onRsvp,
  descEdit,
  setDescEdit,
  savingDesc,
  onSaveDescription,
  agendaEdit,
  setAgendaEdit,
  savingAgenda,
  onSaveAgenda,
  agendaTitle,
  setAgendaTitle,
  onAddAgendaItem,
  onDeleteAgendaItem,
  kindEdit,
  setKindEdit,
  formatEdit,
  setFormatEdit,
  locationEdit,
  setLocationEdit,
  joinUrlEdit,
  setJoinUrlEdit,
  savingMeta,
  onSaveMeta,
  aiLoading,
  aiError,
  onGenerateTasks,
  expanded,
  setExpanded,
  canUpdateTask,
  onUpdateTaskStatus,
  onAssignTask,
  onOpenSubtask,
  canEdit,
  canMinutes,
  canApprove,
  minutePoints,
  setMinutePoints,
  savingMinutes,
  onSaveMinutes,
  approving,
  onApproveMeeting,
  onToggleAttendance,
  onOpenDeliverable,
  onUploadDeliverable,
  onDeleteDeliverable,
  uploadingDeliverable,
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
  descEdit: string;
  setDescEdit: (v: string) => void;
  savingDesc: boolean;
  onSaveDescription: () => void;
  agendaEdit: string;
  setAgendaEdit: (v: string) => void;
  savingAgenda: boolean;
  onSaveAgenda: () => void;
  agendaTitle: string;
  setAgendaTitle: (v: string) => void;
  onAddAgendaItem: () => void;
  onDeleteAgendaItem: (id: string) => void;
  kindEdit: ScheduleKind;
  setKindEdit: (v: ScheduleKind) => void;
  formatEdit: ScheduleFormat;
  setFormatEdit: (v: ScheduleFormat) => void;
  locationEdit: string;
  setLocationEdit: (v: string) => void;
  joinUrlEdit: string;
  setJoinUrlEdit: (v: string) => void;
  savingMeta: boolean;
  onSaveMeta: () => void;
  aiLoading: boolean;
  aiError: string;
  onGenerateTasks: () => void;
  expanded: Record<string, boolean>;
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
  canUpdateTask: (task: Subtask | ParentTask) => boolean;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
  onAssignTask: (taskId: string, userId: string) => void;
  onOpenSubtask: (taskId: string) => void;
  canEdit: boolean;
  canMinutes: boolean;
  canApprove: boolean;
  minutePoints: string[];
  setMinutePoints: (v: string[]) => void;
  savingMinutes: boolean;
  onSaveMinutes: () => void;
  approving: boolean;
  onApproveMeeting: () => void;
  onToggleAttendance: (
    meetingId: string,
    userId: string,
    current: string,
  ) => void;
  onOpenDeliverable: (kind: "NOTE" | "LINK") => void;
  onUploadDeliverable: (file: File) => void | Promise<void>;
  onDeleteDeliverable: (id: string) => void;
  uploadingDeliverable?: boolean;
  contextUser?: import("@/lib/types").PermissionUser | null;
}) {
  const deliverableFileRef = useRef<HTMLInputElement>(null);
  const showJoinUrl =
    formatEdit === "VIRTUAL" || formatEdit === "HYBRID";
  const kindProfile = profile;
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <EventDetailHeader
        event={event}
        committeeId={committeeId}
        eventId={eventId}
        editing
        contextUser={contextUser}
      />

      {canEdit ? (
        <section className="space-y-3 rounded-xl border border-charcoal/10 bg-white p-4">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
            Event details
          </h2>
          <div>
            <span className="text-xs font-bold text-muted uppercase tracking-wider">
              Type
            </span>
            <div className="mt-2">
              <SegmentedControl
                options={EVENT_KINDS.map((k) => ({
                  value: k,
                  label: EVENT_KIND_LABELS[k],
                }))}
                value={kindEdit}
                onChange={setKindEdit}
              />
            </div>
          </div>
          <div>
            <span className="text-xs font-bold text-muted uppercase tracking-wider">
              Format
            </span>
            <div className="mt-2">
              <SegmentedControl
                options={(
                  Object.keys(SCHEDULE_FORMAT_LABELS) as ScheduleFormat[]
                ).map((f) => ({
                  value: f,
                  label: SCHEDULE_FORMAT_LABELS[f],
                }))}
                value={formatEdit}
                onChange={setFormatEdit}
              />
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-bold text-muted uppercase tracking-wider">
              Location
              {kindProfile.emphasizeLocation ? " (required)" : ""}
            </span>
            <input
              type="text"
              value={locationEdit}
              onChange={(e) => setLocationEdit(e.target.value)}
              className={`mt-2 ${FORM_FIELD_CLASS}`}
              placeholder="Room, building, or address"
            />
          </label>
          {showJoinUrl ? (
            <label className="block">
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                Join URL
              </span>
              <input
                type="url"
                value={joinUrlEdit}
                onChange={(e) => setJoinUrlEdit(e.target.value)}
                className={`mt-2 ${FORM_FIELD_CLASS}`}
                placeholder="https://"
              />
            </label>
          ) : null}
          <TouchButton size="md" onClick={onSaveMeta} disabled={savingMeta}>
            {savingMeta ? "Saving…" : "Save details"}
          </TouchButton>
        </section>
      ) : null}

      {profile.rsvp && showRsvp ? (
        <EventRsvpBar rsvp={rsvp} onRsvp={onRsvp} />
      ) : null}

      {profile.tasks ? <EventProgressBar event={event} /> : null}

      <section className="space-y-3">
        <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
          Description
        </h2>
        <textarea
          value={descEdit}
          onChange={(e) => setDescEdit(e.target.value)}
          rows={5}
          className={FORM_TEXTAREA_CLASS}
          placeholder="Describe the event — this feeds AI task generation."
        />
        <TouchButton size="md" onClick={onSaveDescription} disabled={savingDesc}>
          {savingDesc ? "Saving…" : "Save description"}
        </TouchButton>
      </section>

      {profile.agenda ? (
        <>
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
              {agendaNotesLabel(event.kind)}
            </h2>
            <textarea
              value={agendaEdit}
              onChange={(e) => setAgendaEdit(e.target.value)}
              rows={3}
              className={FORM_TEXTAREA_CLASS}
              placeholder="High-level notes"
            />
            <TouchButton size="md" onClick={onSaveAgenda} disabled={savingAgenda}>
              {savingAgenda ? "Saving…" : "Save notes"}
            </TouchButton>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
              {agendaItemsLabel(event.kind)}
            </h2>
            {event.agendaItems.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center bg-white/50 rounded-2xl border border-charcoal/5 border-dashed">
                None yet.
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
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteAgendaItem(item.id)}
                      className="touch-target text-muted hover:text-accent"
                      aria-label="Delete agenda item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={agendaTitle}
                onChange={(e) => setAgendaTitle(e.target.value)}
                placeholder="Add item…"
                className={`flex-1 ${FORM_FIELD_CLASS}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onAddAgendaItem();
                  }
                }}
              />
              <TouchButton onClick={onAddAgendaItem} disabled={!agendaTitle.trim()}>
                <Plus className="h-4 w-4" />
                Add
              </TouchButton>
            </div>
          </section>
        </>
      ) : null}

      {profile.minutes ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Minutes & attendance
            </h2>
            {meeting ? (
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  meeting.approved
                    ? "bg-primary/10 text-primary-dark"
                    : "bg-accent/10 text-accent"
                }`}
              >
                {meeting.approved ? "Approved" : "Pending"}
              </span>
            ) : null}
          </div>

          {!meeting ? (
            <p className="text-sm text-muted py-4 text-center bg-white/50 rounded-2xl border border-charcoal/5 border-dashed">
              No linked meeting record yet.
            </p>
          ) : (
            <>
              {meeting.attendances.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                    Attendance {canMinutes && !meeting.approved ? "— tap to toggle" : ""}
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
                              onToggleAttendance(meeting.id, a.user.id, a.status)
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
              ) : null}

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
                        {minutePoints.length > 1 ? (
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
                        ) : null}
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
                        onClick={onSaveMinutes}
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
                    {meeting.minutes.length === 0 ? (
                      <p className="text-xs text-muted font-medium py-2">
                        No points entered.
                      </p>
                    ) : null}
                  </ul>
                )}
              </div>

              {canApprove && !meeting.approved ? (
                <TouchButton onClick={onApproveMeeting} disabled={approving}>
                  <Check className="h-4 w-4" />
                  {approving ? "Approving…" : "Approve minutes"}
                </TouchButton>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {profile.tasks ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
              Tasks
            </h2>
            {canEdit && event.tasks.length > 0 ? (
              <TouchButton
                variant="secondary"
                size="md"
                onClick={onGenerateTasks}
                disabled={aiLoading || !event.description?.trim()}
              >
                <Sparkles className="h-4 w-4" />
                {aiLoading ? "Generating…" : "Generate with AI"}
              </TouchButton>
            ) : null}
          </div>
          {aiError ? (
            <p className="text-sm text-accent font-medium">{aiError}</p>
          ) : null}

          {event.tasks.length === 0 ? (
            <div className="py-6 px-4 text-center bg-white/50 rounded-2xl border border-charcoal/5 border-dashed space-y-3">
              <p className="text-sm text-muted">
                {event.description?.trim()
                  ? "No tasks yet. Generate from this event’s details, or create tasks from the Board."
                  : "Add a description, then generate tasks with AI — or create them from the Board."}
              </p>
              {canEdit ? (
                <TouchButton
                  onClick={onGenerateTasks}
                  disabled={aiLoading || !event.description?.trim()}
                >
                  <Sparkles className="h-4 w-4" />
                  {aiLoading
                    ? "Generating…"
                    : event.description?.trim()
                      ? "Generate tasks with AI"
                      : "Add a description first"}
                </TouchButton>
              ) : null}
            </div>
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
                      {task.description ? (
                        <p className="text-xs text-muted mt-1">{task.description}</p>
                      ) : null}
                      {task.assignedTo ? (
                        <p className="text-xs text-muted mt-1">
                          Assigned: {task.assignedTo.name}
                        </p>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => setAssignTaskId(task.id)}
                        className="text-xs font-bold border border-charcoal/10 rounded-lg px-2 py-1.5 hover:border-primary/40 shrink-0"
                        aria-label="Assign task"
                      >
                        {task.assignedTo?.name
                          ? `Reassign`
                          : "Assign…"}
                      </button>
                    ) : null}
                  </div>

                  {canUpdateTask(task) ? (
                    <SegmentedControl
                      options={TASK_STATUSES.map((s) => ({
                        value: s,
                        label: TASK_STATUS_LABELS[s],
                      }))}
                      value={task.status}
                      onChange={(s) => onUpdateTaskStatus(task.id, s)}
                    />
                  ) : null}

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
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => onOpenSubtask(task.id)}
                        className="text-xs font-bold text-charcoal hover:underline ml-auto"
                      >
                        + Subtask
                      </button>
                    ) : null}
                  </div>

                  {expanded[task.id] && task.subtasks.length > 0 ? (
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
                          {canUpdateTask(sub) ? (
                            <SegmentedControl
                              options={TASK_STATUSES.map((s) => ({
                                value: s,
                                label: TASK_STATUS_LABELS[s],
                              }))}
                              value={sub.status}
                              onChange={(s) => onUpdateTaskStatus(sub.id, s)}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {profile.deliverables ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-bold text-accent uppercase tracking-wider flex-1">
              {deliverablesSectionTitle(event.kind)}
            </h2>
            {canEdit ? (
              <>
                <TouchButton
                  variant="ghost"
                  size="md"
                  onClick={() => onOpenDeliverable("NOTE")}
                >
                  <StickyNote className="h-4 w-4" />
                  Note
                </TouchButton>
                <TouchButton
                  variant="ghost"
                  size="md"
                  onClick={() => onOpenDeliverable("LINK")}
                >
                  <Link2 className="h-4 w-4" />
                  Link
                </TouchButton>
                <TouchButton
                  variant="ghost"
                  size="md"
                  disabled={uploadingDeliverable}
                  onClick={() => deliverableFileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploadingDeliverable ? "Uploading…" : "Upload file"}
                </TouchButton>
                <input
                  ref={deliverableFileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onUploadDeliverable(file);
                    e.target.value = "";
                  }}
                />
              </>
            ) : null}
          </div>

          {event.deliverables.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">
              {deliverablesEmptyLabel(event.kind)}
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
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => onDeleteDeliverable(d.id)}
                      className="touch-target text-muted hover:text-accent"
                      aria-label="Delete deliverable"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <PeoplePicker
        open={assignTaskId != null}
        onClose={() => setAssignTaskId(null)}
        title="Assign Task"
        mode="single"
        committeeId={committeeId}
        onConfirm={(ids) => {
          if (assignTaskId && ids[0]) onAssignTask(assignTaskId, ids[0]);
          setAssignTaskId(null);
        }}
      />
    </div>
  );
}
