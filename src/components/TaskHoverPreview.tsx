"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, User } from "lucide-react";
import { LIST_STATUS_META } from "@/lib/kanban";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { RichTextContent } from "@/components/RichTextContent";

const PREVIEW_WIDTH = 380;
const OPEN_DELAY_MS = 280;
const CLOSE_DELAY_MS = 160;

export type TaskHoverPreviewData = {
  title: string;
  description?: string | null;
  status: TaskStatus;
  dueDate?: string | null;
  assigneeName?: string | null;
  eventTitle?: string | null;
  isSubtask?: boolean;
  subtasks?: {
    id: string;
    title: string;
    status: TaskStatus;
    assignedTo?: { id: string; name: string } | null;
  }[];
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isClipped(el: HTMLElement | null) {
  if (!el) return false;
  return (
    el.scrollWidth > el.clientWidth + 1 ||
    el.scrollHeight > el.clientHeight + 1
  );
}

/**
 * Wraps a Kanban card. When title/description are clipped by the narrow
 * column, hovering opens a wider floating preview with the full task.
 */
export function TaskHoverPreview({
  task,
  children,
  disabled,
}: {
  task: TaskHoverPreviewData;
  children: ReactNode;
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLElement | null>(null);
  const descRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [clipped, setClipped] = useState(false);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const measureClip = useCallback(() => {
    const root = triggerRef.current;
    if (!root) return;
    const title =
      root.querySelector<HTMLElement>("[data-task-title]") ??
      root.querySelector<HTMLElement>("h3");
    const desc = root.querySelector<HTMLElement>("[data-task-desc]");
    titleRef.current = title;
    descRef.current = desc;
    setClipped(isClipped(title) || isClipped(desc));
  }, []);

  useLayoutEffect(() => {
    measureClip();
  }, [measureClip, task.title, task.description]);

  useEffect(() => {
    const root = triggerRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureClip());
    ro.observe(root);
    return () => ro.disconnect();
  }, [measureClip]);

  const placePanel = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 12;
    const preferRight = rect.right + gap + PREVIEW_WIDTH < window.innerWidth;
    const left = preferRight
      ? rect.right + gap
      : Math.max(12, rect.left - gap - PREVIEW_WIDTH);
    const maxTop = window.innerHeight - 24;
    const estimatedHeight = 280;
    let top = rect.top;
    if (top + estimatedHeight > maxTop) {
      top = Math.max(12, maxTop - estimatedHeight);
    }
    setCoords({ top, left });
  }, []);

  const scheduleOpen = () => {
    if (disabled || !clipped) return;
    clearTimers();
    openTimer.current = setTimeout(() => {
      placePanel();
      setOpen(true);
    }, OPEN_DELAY_MS);
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current || !coords) return;
    const panel = panelRef.current;
    const rect = panel.getBoundingClientRect();
    const overflow = rect.bottom - (window.innerHeight - 12);
    if (overflow > 0) {
      setCoords((c) =>
        c ? { ...c, top: Math.max(12, c.top - overflow) } : c,
      );
    }
  }, [open, coords]);

  const dueLabel = task.dueDate ? formatDate(task.dueDate) : null;
  const meta = LIST_STATUS_META[task.status];

  const panel =
    open && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="tooltip"
            onMouseEnter={() => {
              clearTimers();
              setOpen(true);
            }}
            onMouseLeave={scheduleClose}
            className="fixed z-[100] w-[min(100vw-1.5rem,380px)] rounded-xl border border-charcoal/10 bg-white p-4 shadow-xl"
            style={{ top: coords.top, left: coords.left }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.pill}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.icon}`} />
                {meta.label}
              </span>
              {task.isSubtask && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted bg-slate-100 px-1.5 py-0.5 rounded">
                  Subtask
                </span>
              )}
            </div>

            {task.eventTitle && !task.isSubtask && (
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent mb-1.5">
                {task.eventTitle}
              </p>
            )}

            <h3 className="text-base font-bold text-charcoal leading-snug">
              {task.title}
            </h3>

            {task.description && (
              <div className="mt-2 max-h-40 overflow-y-auto text-sm text-muted">
                {/<[a-z][\s\S]*>/i.test(task.description) ? (
                  <RichTextContent
                    html={task.description}
                    className="text-sm text-muted"
                  />
                ) : (
                  <p className="leading-relaxed whitespace-pre-wrap">
                    {task.description}
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {dueLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal/8 bg-surface px-2.5 py-1.5 font-medium text-charcoal">
                  <Calendar className="h-3.5 w-3.5 text-muted" />
                  Due {dueLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal/8 bg-surface px-2.5 py-1.5 font-medium text-charcoal">
                {task.assigneeName ? (
                  <>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-charcoal text-[10px] font-bold text-white">
                      {initials(task.assigneeName)}
                    </span>
                    {task.assigneeName}
                  </>
                ) : (
                  <>
                    <User className="h-3.5 w-3.5 text-muted" />
                    Unassigned
                  </>
                )}
              </span>
            </div>

            {task.subtasks && task.subtasks.length > 0 && (
              <div className="mt-3 border-t border-charcoal/8 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted mb-2">
                  Subtasks ({task.subtasks.length})
                </p>
                <ul className="space-y-1.5">
                  {task.subtasks.map((sub) => (
                    <li
                      key={sub.id}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <span className="text-charcoal font-medium leading-snug">
                        {sub.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {TASK_STATUS_LABELS[sub.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={triggerRef}
      className="relative"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={scheduleOpen}
      onBlur={scheduleClose}
      aria-describedby={open ? panelId : undefined}
    >
      {children}
      {panel}
    </div>
  );
}
