"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { taskPath } from "@/lib/navigation";
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_WORK_CLASS_LABELS,
  type TaskStatus,
  type TaskWorkClass,
} from "@/lib/types";
import { LIST_STATUS_META } from "@/lib/kanban";
import { formatDate } from "@/lib/dates";

export type TaskListChild = {
  id: string;
  title: string;
  status: TaskStatus;
  workClass?: TaskWorkClass | null;
  dueDate?: string | null;
  assignedTo: { id: string; name: string } | null;
  committeeId?: string | null;
};

export type TaskListRow = {
  id: string;
  title: string;
  status: TaskStatus;
  workClass?: TaskWorkClass | null;
  dueDate?: string | null;
  assignedTo: { id: string; name: string } | null;
  committeeId?: string | null;
  contextLabel?: string;
  subtasks?: TaskListChild[];
};

type SortKey = "title" | "class" | "status" | "assignee" | "due";
type SortDir = "asc" | "desc";

const STATUS_ORDER = Object.fromEntries(
  TASK_STATUSES.map((s, i) => [s, i]),
) as Record<TaskStatus, number>;

const CLASS_ORDER: Record<TaskWorkClass, number> = {
  DIRECTIVE: 0,
  COMMITTEE: 1,
  PERSONAL: 2,
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "class", label: "Class" },
  { key: "status", label: "Status" },
  { key: "assignee", label: "Assignee" },
  { key: "due", label: "Due" },
];

function compareRows(a: TaskListRow, b: TaskListRow, key: SortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title);
    case "class": {
      const aC = a.workClass ? CLASS_ORDER[a.workClass] : 99;
      const bC = b.workClass ? CLASS_ORDER[b.workClass] : 99;
      if (aC !== bC) return aC - bC;
      return a.title.localeCompare(b.title);
    }
    case "status": {
      const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title);
    }
    case "assignee": {
      const aName = a.assignedTo?.name ?? "";
      const bName = b.assignedTo?.name ?? "";
      if (!a.assignedTo && b.assignedTo) return 1;
      if (a.assignedTo && !b.assignedTo) return -1;
      const nameCmp = aName.localeCompare(bName);
      if (nameCmp !== 0) return nameCmp;
      return a.title.localeCompare(b.title);
    }
    case "due": {
      const aDue = a.dueDate
        ? new Date(a.dueDate).getTime()
        : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate
        ? new Date(b.dueDate).getTime()
        : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
      return a.title.localeCompare(b.title);
    }
  }
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-left uppercase tracking-wide transition-colors hover:text-charcoal ${
        active ? "text-charcoal" : "text-muted"
      }`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40" aria-hidden />
      )}
    </button>
  );
}

function StatusPill({ status }: { status: TaskStatus }) {
  const meta = LIST_STATUS_META[status];
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.icon}`} />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

function GridRow({
  href,
  title,
  contextLabel,
  workClass,
  status,
  assignedTo,
  dueDate,
  expandControl,
  detail,
}: {
  href: string;
  title: string;
  contextLabel?: string;
  workClass?: TaskWorkClass | null;
  status: TaskStatus;
  assignedTo: { id: string; name: string } | null;
  dueDate?: string | null;
  expandControl: ReactNode;
  detail?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1.5rem_minmax(0,1fr)] sm:grid-cols-[1.5rem_minmax(0,1.4fr)_7rem_7rem_8rem_6.5rem] gap-2 sm:gap-3 items-center px-4 transition-colors hover:bg-surface/80 ${
        detail ? "py-2.5 bg-surface/40" : "py-3"
      }`}
    >
      {expandControl}
      <Link href={href} className="min-w-0 truncate">
        <span
          className={`block text-sm truncate ${
            detail
              ? "pl-2 border-l-2 border-primary/25 font-medium"
              : "font-semibold"
          } ${status === "DONE" ? "line-through text-muted" : "text-charcoal"}`}
        >
          {title}
        </span>
        {contextLabel ? (
          <span className="block text-[11px] text-muted truncate">{contextLabel}</span>
        ) : null}
      </Link>
      <span className="text-xs font-medium text-muted truncate hidden sm:block">
        {workClass ? TASK_WORK_CLASS_LABELS[workClass] : "—"}
      </span>
      <span className="hidden sm:block">
        <StatusPill status={status} />
      </span>
      <span className="text-xs font-medium text-charcoal-muted truncate hidden sm:block">
        {assignedTo?.name ?? "Unassigned"}
      </span>
      <span className="text-xs font-medium text-muted tabular-nums hidden sm:block">
        {dueDate ? formatDate(dueDate) : "—"}
      </span>
    </div>
  );
}

export function TaskListView({ rows }: { rows: TaskListRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("due");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const cmp = compareRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (rows.length === 0) {
    return (
      <p className="text-center text-muted py-8 text-sm rounded-xl border border-dashed border-charcoal/15 bg-white">
        No items yet. Create work or assign a directive to get started.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-charcoal/8 bg-white overflow-hidden shadow-2xs">
      <div className="hidden sm:grid sm:grid-cols-[1.5rem_minmax(0,1.4fr)_7rem_7rem_8rem_6.5rem] gap-3 px-4 py-2.5 border-b border-charcoal/8 text-[11px] font-bold bg-surface/60">
        <span aria-hidden />
        {COLUMNS.map((col) => (
          <SortHeader
            key={col.key}
            label={col.label}
            active={sortKey === col.key}
            dir={sortDir}
            onClick={() => toggleSort(col.key)}
          />
        ))}
      </div>

      <ul className="divide-y divide-charcoal/6">
        {sorted.map((row) => {
          const href = taskPath(row.committeeId, row.id);
          const children = row.subtasks ?? [];
          const hasChildren = children.length > 0;
          const isOpen = !!expanded[row.id];

          return (
            <li key={row.id}>
              <GridRow
                href={href}
                title={
                  hasChildren
                    ? `${row.title} (${children.length})`
                    : row.title
                }
                contextLabel={row.contextLabel}
                workClass={row.workClass}
                status={row.status}
                assignedTo={row.assignedTo}
                dueDate={row.dueDate}
                expandControl={
                  hasChildren ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [row.id]: !prev[row.id],
                        }))
                      }
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-charcoal/5 hover:text-charcoal"
                      aria-expanded={isOpen}
                      aria-label={
                        isOpen
                          ? `Collapse ${children.length} subtasks`
                          : `Expand ${children.length} subtasks`
                      }
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <span className="h-6 w-6" aria-hidden />
                  )
                }
              />

              {hasChildren && isOpen && (
                <ul className="border-t border-charcoal/5">
                  {children.map((child) => (
                    <li key={child.id} className="border-t border-charcoal/4">
                      <GridRow
                        href={taskPath(
                          child.committeeId ?? row.committeeId,
                          child.id,
                        )}
                        title={child.title}
                        contextLabel={row.contextLabel}
                        workClass={child.workClass}
                        status={child.status}
                        assignedTo={child.assignedTo}
                        dueDate={child.dueDate}
                        detail
                        expandControl={<span className="h-6 w-6" aria-hidden />}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
