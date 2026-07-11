"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TouchButton } from "@/components/TouchButton";
import { BottomSheet } from "@/components/BottomSheet";
import { useApp } from "@/providers/AppProvider";
import { canLogMinutes, canApproveMinutes, isCommitteeReadOnly } from "@/lib/types";
import { formatDate, formatDateWithWeekday } from "@/lib/dates";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  Check,
  Plus,
  Bold,
  Italic,
  Trash2,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
} from "lucide-react";

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
  PRESENT: "border-primary ring-2 ring-primary bg-primary/5",
  EXCUSED: "border-accent ring-2 ring-accent bg-accent/5",
  ABSENT: "border-charcoal ring-2 ring-charcoal bg-charcoal/5",
  UNMARKED: "border-charcoal/10 hover:border-charcoal/20",
};

function parseMarkdown(text: string) {
  const parts = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
  const splitText = text.split(regex);
  return splitText.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-bold text-charcoal">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic text-charcoal">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function MinutesView({ committeeId }: { committeeId: string }) {
  const { user } = useApp();
  const searchParams = useSearchParams();
  const deepLinkMeetingId = searchParams.get("meeting");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [roster, setRoster] = useState<Member[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState<string[]>([""]);
  const [approving, setApproving] = useState<string | null>(null);

  // Split-screen desktop states
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

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

  // Sync first selection on desktop load
  useEffect(() => {
    if (deepLinkMeetingId && meetings.some((m) => m.id === deepLinkMeetingId)) {
      setSelectedMeetingId(deepLinkMeetingId);
      setIsCreating(false);
      return;
    }
    if (searchParams.get("pending") === "1") {
      const pending = meetings.find((m) => !m.approved);
      if (pending) {
        setSelectedMeetingId(pending.id);
        setIsCreating(false);
        return;
      }
    }
    if (meetings.length > 0 && !selectedMeetingId && !isCreating) {
      setSelectedMeetingId(meetings[0].id);
    }
  }, [meetings, selectedMeetingId, isCreating, deepLinkMeetingId, searchParams]);

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

  const createMeeting = async (pointsOverride?: string[]) => {
    if (!title.trim() || !committeeId || !user) return;
    const finalPoints = pointsOverride ?? points.filter((p) => p.trim());
    const memberIds = roster.map((m) => m.id);
    await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        date: new Date().toISOString(),
        committeeId,
        points: finalPoints,
        memberIds,
      }),
    });
    setTitle("");
    setPoints([""]);
    setCreateOpen(false);
    setIsCreating(false);
    loadMeetings();
  };

  // Keyboard navigation & bullet manager dynamic focus sync
  useEffect(() => {
    if (focusedIndex !== null) {
      const el = document.querySelector(`input[data-point-index="${focusedIndex}"]`) as HTMLInputElement | null;
      if (el) el.focus();
    }
  }, [focusedIndex, points.length]);

  const perm = user ? toPermissionUser(user) : null;
  const canCreate = perm ? canLogMinutes(perm, committeeId) : false;
  const canApprove = perm ? canApproveMinutes(perm, committeeId) : false;
  const readOnlyViewer = perm ? isCommitteeReadOnly(perm, committeeId) : false;

  if (!committeeId) {
    return (
      <p className="text-muted text-center py-12 font-medium">
        Select a committee to view minutes.
      </p>
    );
  }

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) || meetings[0];

  // Sharing the rich text points/editor pane template
  const renderEditor = (cancelFn?: () => void) => (
    <MeetingEditor
      title={title}
      setTitle={setTitle}
      points={points}
      setPoints={setPoints}
      rosterLength={roster.length}
      focusedIndex={focusedIndex}
      setFocusedIndex={setFocusedIndex}
      onSave={createMeeting}
      onCancel={cancelFn}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex items-center justify-between gap-3 border-b border-charcoal/5 pb-4">
        <p className="text-sm text-muted">Meeting logs, minutes &amp; attendance</p>
        {canCreate && (
          <div className="flex items-center gap-2">
            <TouchButton
              onClick={() => {
                setTitle("");
                setPoints([""]);
                if (typeof window !== "undefined" && window.innerWidth >= 1024) {
                  setIsCreating(true);
                  setSelectedMeetingId(null);
                } else {
                  setCreateOpen(true);
                }
              }}
            >
              <Plus className="h-4 w-4 shrink-0" />
              Log Meeting
            </TouchButton>
          </div>
        )}
      </div>

      {/* Desktop Split-Screen Layout */}
      <div className="hidden lg:grid grid-cols-12 gap-6 items-start">
        {/* Left Side: Meeting list panel */}
        <div className="col-span-4 space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
          <span className="text-xs font-bold text-accent uppercase tracking-wider block mb-1">
            Meeting History ({meetings.length})
          </span>
          <div className="space-y-2">
            {meetings.map((m) => {
              const active = selectedMeetingId === m.id && !isCreating;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMeetingId(m.id);
                    setIsCreating(false);
                  }}
                  className={`w-full flex flex-col items-start text-left p-4 rounded-xl border transition-all ${
                    active
                      ? "bg-white border-primary ring-2 ring-primary/20 shadow-xs"
                      : "bg-white border-charcoal/5 hover:border-charcoal/20 shadow-2xs"
                  }`}
                >
                  <div className="flex justify-between w-full gap-2">
                    <span className="font-semibold text-sm text-charcoal truncate">{m.title}</span>
                    <span className={`text-[10px] font-bold uppercase shrink-0 px-2 py-0.5 rounded-full ${
                      m.approved
                        ? "bg-primary/10 text-primary-dark"
                        : "bg-accent/10 text-accent"
                    }`}>
                      {m.approved ? "Approved" : "Pending"}
                    </span>
                  </div>
                  <span className="text-xs text-muted font-medium mt-2 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(m.date)}
                  </span>
                </button>
              );
            })}
            {meetings.length === 0 && (
              <p className="text-sm text-muted font-medium py-6 text-center">No meetings logged yet.</p>
            )}
          </div>
        </div>

        {/* Right Side: Detail View or Live Editor Workspace */}
        <div className="col-span-8">
          {isCreating ? (
            renderEditor(() => {
              setIsCreating(false);
              if (meetings.length > 0) setSelectedMeetingId(meetings[0].id);
            })
          ) : selectedMeeting ? (
            <article className="bg-white rounded-2xl border border-charcoal/5 p-6 space-y-6 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-charcoal/5 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-charcoal tracking-tight">{selectedMeeting.title}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <time className="text-xs font-semibold text-muted flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDateWithWeekday(selectedMeeting.date)}
                    </time>
                    <span className="text-xs text-muted font-bold">·</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase ${
                      selectedMeeting.approved ? "text-primary-dark" : "text-accent"
                    }`}>
                      {selectedMeeting.approved ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approved
                        </>
                      ) : (
                        <>
                          <Clock className="h-3.5 w-3.5 animate-pulse" />
                          Pending Review
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {canApprove && !selectedMeeting.approved && (
                  <TouchButton
                    onClick={() => approveMeeting(selectedMeeting.id)}
                    disabled={approving === selectedMeeting.id}
                  >
                    <Check className="h-4 w-4 shrink-0" />
                    {approving === selectedMeeting.id ? "Approving…" : "Approve Minutes"}
                  </TouchButton>
                )}
              </div>

              {readOnlyViewer && selectedMeeting && !selectedMeeting.approved && (
                <p className="rounded-xl border border-charcoal/10 bg-surface px-4 py-3 text-sm text-muted">
                  These minutes are waiting on the <strong>committee chair</strong> to
                  approve. As presbytery you can review them here, but approval is not
                  your step.
                </p>
              )}

              {/* Attendance Tracker Grid */}
              {selectedMeeting.attendances.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-accent uppercase tracking-wider">
                    Attendance {canCreate && "— tap to toggle"}
                  </h3>
                  <div className="grid grid-cols-4 xl:grid-cols-6 gap-3">
                    {selectedMeeting.attendances.map((a) => {
                      const buttonContent = (
                        <>
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal text-white font-extrabold text-xs">
                            {a.user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                          <span className="text-[11px] font-bold text-charcoal truncate w-full text-center">
                            {a.user.name.split(" ")[0]}
                          </span>
                        </>
                      );

                      if (canCreate) {
                        return (
                          <button
                            key={a.user.id}
                            type="button"
                            onClick={() => toggleAttendance(selectedMeeting.id, a.user.id, a.status)}
                            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 bg-white touch-target transition-all ${ATTENDANCE_STYLES[a.status]}`}
                          >
                            {buttonContent}
                          </button>
                        );
                      }

                      return (
                        <div
                          key={a.user.id}
                          className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 bg-white transition-all ${ATTENDANCE_STYLES[a.status]}`}
                        >
                          {buttonContent}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bullet points display */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Minute Bullet Points
                </h3>
                <ul className="space-y-2 bg-slate-50/50 border border-charcoal/5 rounded-xl p-4 divide-y divide-charcoal/5">
                  {selectedMeeting.minutes.map((pt, i) => (
                    <li key={pt.id} className={`text-sm text-charcoal leading-relaxed py-2.5 flex items-start gap-3 ${i === 0 ? "pt-0" : ""}`}>
                      <span className="font-extrabold text-muted text-xs select-none mt-0.5">
                        {i + 1}.
                      </span>
                      <span className="flex-1">{parseMarkdown(pt.content)}</span>
                    </li>
                  ))}
                  {selectedMeeting.minutes.length === 0 && (
                    <p className="text-xs text-muted font-medium py-3">No points entered.</p>
                  )}
                </ul>
              </div>
            </article>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-charcoal/10 rounded-2xl text-center bg-white">
              <FileText className="h-10 w-10 text-muted/60 mb-2" />
              <p className="text-sm font-semibold text-muted">Select meeting to view or log a new session.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Stack Layout */}
      <div className="block lg:hidden space-y-4">
        {meetings.map((m) => (
          <article
            key={m.id}
            id={`meeting-mobile-${m.id}`}
            className="bg-white rounded-2xl border border-charcoal/5 p-5 space-y-5 shadow-2xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-charcoal/5 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-charcoal tracking-tight">{m.title}</h2>
                <time className="text-xs text-muted font-medium mt-1 block">
                  {formatDateWithWeekday(m.date)}
                </time>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    m.approved
                      ? "bg-primary/10 text-primary-dark"
                      : "bg-accent/10 text-accent"
                  }`}>
                    {m.approved ? "Approved" : "Pending"}
                  </span>
                </div>
              </div>
              {canApprove && !m.approved && (
                <TouchButton
                  onClick={() => approveMeeting(m.id)}
                  disabled={approving === m.id}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </TouchButton>
              )}
            </div>

            {/* Attendance (Mobile version) */}
            {m.attendances.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                  Attendance {canCreate && "— tap to toggle"}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {m.attendances.map((a) => {
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

                    if (canCreate) {
                      return (
                        <button
                          key={a.user.id}
                          type="button"
                          onClick={() => toggleAttendance(m.id, a.user.id, a.status)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border bg-white touch-target ${ATTENDANCE_STYLES[a.status]}`}
                        >
                          {buttonContent}
                        </button>
                      );
                    }

                    return (
                      <div
                        key={a.user.id}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border bg-white ${ATTENDANCE_STYLES[a.status]}`}
                      >
                        {buttonContent}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bullet points display (Mobile version) */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Minutes</p>
              <ul className="space-y-2 list-none divide-y divide-charcoal/5">
                {m.minutes.map((pt, index) => (
                  <li key={pt.id} className={`text-sm text-charcoal leading-relaxed flex items-start gap-2.5 py-2 ${index === 0 ? "pt-0" : ""}`}>
                    <span className="font-extrabold text-muted text-xs select-none mt-0.5">
                      {index + 1}.
                    </span>
                    <span className="flex-1">{parseMarkdown(pt.content)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}

        {meetings.length === 0 && (
          <p className="text-center text-muted py-8 font-medium">No meetings logged yet.</p>
        )}
      </div>

      {/* Mobile Bottom Sheet Editor */}
      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Log Meeting">
        {renderEditor(() => setCreateOpen(false))}
      </BottomSheet>
    </div>
  );
}

// Inner Component for Interactive Bullet/Meeting Editor Panel
type MeetingEditorProps = {
  title: string;
  setTitle: (t: string) => void;
  points: string[];
  setPoints: (p: string[]) => void;
  rosterLength: number;
  focusedIndex: number | null;
  setFocusedIndex: (i: number | null) => void;
  onSave: (finalPoints: string[]) => void;
  onCancel?: () => void;
};

function parseRawTextToPoints(text: string): string[] {
  return text
    .split("\n")
    .map((line) => {
      // Remove bullets or number prefixes: •, -, *, 1. etc.
      return line.replace(/^[\s•\-\*]+|^\d+[\.\)\s]+/, "").trim();
    })
    .filter(Boolean);
}

function MeetingEditor({
  title,
  setTitle,
  points,
  setPoints,
  rosterLength,
  focusedIndex,
  setFocusedIndex,
  onSave,
  onCancel,
}: MeetingEditorProps) {
  const [mode, setMode] = useState<"structured" | "freeform">("structured");
  const [rawText, setRawText] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const next = [...points];
      next.splice(index + 1, 0, "");
      setPoints(next);
      setFocusedIndex(index + 1);
    } else if (e.key === "Backspace" && points[index] === "" && points.length > 1) {
      e.preventDefault();
      const next = [...points];
      next.splice(index, 1);
      setPoints(next);
      setFocusedIndex(index > 0 ? index - 1 : 0);
    }
  };

  const handleModeChange = (nextMode: "structured" | "freeform") => {
    if (nextMode === mode) return;
    if (nextMode === "freeform") {
      // Join points to bullets
      const text = points.filter((p) => p.trim()).map((p) => `• ${p}`).join("\n");
      setRawText(text);
    } else {
      // Parse bullets to points list
      const parsed = parseRawTextToPoints(rawText);
      setPoints(parsed.length > 0 ? parsed : [""]);
    }
    setMode(nextMode);
  };

  const handleToolbarFormat = (format: "bold" | "italic") => {
    if (mode === "freeform") {
      const el = document.querySelector("textarea[data-editor-textarea]") as HTMLTextAreaElement | null;
      if (!el) return;

      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const text = el.value;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const selected = text.substring(start, end);

      let replacement = "";
      let cursorOffset = 0;
      if (format === "bold") {
        replacement = selected ? `**${selected}**` : `**bold**`;
        cursorOffset = selected ? selected.length + 4 : 2;
      } else {
        replacement = selected ? `*${selected}*` : `*italic*`;
        cursorOffset = selected ? selected.length + 2 : 1;
      }

      setRawText(before + replacement + after);

      setTimeout(() => {
        el.focus();
        const newPos = start + cursorOffset;
        el.setSelectionRange(newPos, newPos);
      }, 0);
      return;
    }

    if (focusedIndex === null) return;
    const el = document.querySelector(`input[data-point-index="${focusedIndex}"]`) as HTMLInputElement | null;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const text = el.value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const selected = text.substring(start, end);

    let replacement = "";
    let cursorOffset = 0;
    if (format === "bold") {
      replacement = selected ? `**${selected}**` : `**bold**`;
      cursorOffset = selected ? selected.length + 4 : 2;
    } else {
      replacement = selected ? `*${selected}*` : `*italic*`;
      cursorOffset = selected ? selected.length + 2 : 1;
    }

    const nextPoints = [...points];
    nextPoints[focusedIndex] = before + replacement + after;
    setPoints(nextPoints);

    setTimeout(() => {
      el.focus();
      const newPos = start + cursorOffset;
      el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleSave = () => {
    if (mode === "freeform") {
      const parsed = parseRawTextToPoints(rawText);
      onSave(parsed);
    } else {
      onSave(points.filter((p) => p.trim()));
    }
  };

  return (
    <div className="space-y-5 bg-white rounded-2xl border border-charcoal/5 p-5 shadow-xs">
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-bold text-accent uppercase tracking-wider">Meeting Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`mt-2 ${FORM_FIELD_CLASS}`}
            placeholder="e.g. Soundboard Setup Review"
          />
        </label>

        {rosterLength > 0 && (
          <p className="text-[11px] text-muted font-semibold bg-slate-50 border border-charcoal/5 px-3 py-2 rounded-xl inline-block">
            👥 Attendance roster includes <span className="font-bold text-charcoal">{rosterLength}</span> members.
          </p>
        )}

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Minute Points</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-charcoal/5 select-none">
              <button
                type="button"
                onClick={() => handleModeChange("structured")}
                className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all cursor-pointer ${
                  mode === "structured"
                    ? "bg-white text-charcoal shadow-2xs"
                    : "text-muted hover:text-charcoal"
                }`}
              >
                Bullet Points
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("freeform")}
                className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all cursor-pointer ${
                  mode === "freeform"
                    ? "bg-white text-charcoal shadow-2xs"
                    : "text-muted hover:text-charcoal"
                }`}
              >
                Full Document
              </button>
            </div>
          </div>

          {mode === "freeform" ? (
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className={`${FORM_TEXTAREA_CLASS} h-64 text-sm font-medium leading-relaxed resize-none`}
              placeholder="Paste or write meeting minutes here. Each paragraph or line starting with a bullet will save as a distinct point."
              data-editor-textarea
            />
          ) : (
            <div className="space-y-2 border border-charcoal/5 rounded-xl p-3 bg-slate-50/50 max-h-[300px] overflow-y-auto">
              {points.map((pt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted w-5 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <input
                    type="text"
                    value={pt}
                    data-point-index={i}
                    onFocus={() => setFocusedIndex(i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    onChange={(e) => {
                      const next = [...points];
                      next[i] = e.target.value;
                      setPoints(next);
                    }}
                    className="flex-1 min-h-[40px] px-3 bg-white rounded-lg border border-charcoal/5 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
                    placeholder={`Add note... (Press Enter for next point)`}
                  />
                  {points.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...points];
                        next.splice(i, 1);
                        setPoints(next);
                        setFocusedIndex(i > 0 ? i - 1 : 0);
                      }}
                      className="touch-target flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-accent/10 shrink-0"
                      aria-label="Remove point"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Formatting Toolbar */}
          <div className="flex items-center justify-between gap-2 p-1.5 bg-slate-100 rounded-xl border border-charcoal/5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleToolbarFormat("bold")}
                disabled={mode === "structured" && focusedIndex === null}
                className="flex h-9 px-3 items-center justify-center gap-1 rounded-lg hover:bg-white text-xs font-bold text-charcoal border border-transparent hover:border-charcoal/5 disabled:opacity-50"
                title="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Bold</span>
              </button>
              <button
                type="button"
                onClick={() => handleToolbarFormat("italic")}
                disabled={mode === "structured" && focusedIndex === null}
                className="flex h-9 px-3 items-center justify-center gap-1 rounded-lg hover:bg-white text-xs italic font-semibold text-charcoal border border-transparent hover:border-charcoal/5 disabled:opacity-50"
                title="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Italic</span>
              </button>
              {mode === "freeform" ? (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.querySelector("textarea[data-editor-textarea]") as HTMLTextAreaElement | null;
                    if (!el) return;
                    const start = el.selectionStart ?? 0;
                    const text = el.value;
                    const before = text.substring(0, start);
                    const after = text.substring(start);
                    const insert = before.endsWith("\n") || before === "" ? "• " : "\n• ";
                    setRawText(before + insert + after);
                    setTimeout(() => {
                      el.focus();
                      const newPos = start + insert.length;
                      el.setSelectionRange(newPos, newPos);
                    }, 0);
                  }}
                  className="flex h-9 px-3 items-center justify-center gap-1 rounded-lg hover:bg-white text-xs font-semibold text-charcoal border border-transparent hover:border-charcoal/5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Line</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPoints([...points, ""]);
                    setFocusedIndex(points.length);
                  }}
                  className="flex h-9 px-3 items-center justify-center gap-1 rounded-lg hover:bg-white text-xs font-semibold text-charcoal border border-transparent hover:border-charcoal/5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Point</span>
                </button>
              )}
            </div>
            <span className="text-[10px] text-muted font-semibold pr-2 hidden md:inline">
              {mode === "freeform" ? "Markdown text block editor" : "↵ Enter for next point"}
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-3">
          <TouchButton size="lg" className="flex-1" onClick={handleSave}>
            Save Minutes
          </TouchButton>
          {onCancel && (
            <TouchButton variant="ghost" size="lg" className="flex-1" onClick={onCancel}>
              Cancel
            </TouchButton>
          )}
        </div>
      </div>
    </div>
  );
}
