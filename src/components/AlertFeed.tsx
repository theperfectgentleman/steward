"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  FilterX,
  Search,
  X,
} from "lucide-react";
import { FORM_FILTER_CLASS } from "@/lib/form-field";

export type AlertItem = {
  id: string;
  type: "blocked" | "completed" | "minutes";
  message: string;
  time: string;
  href?: string;
  committeeId?: string;
  committeeName?: string;
  contextLabel?: string;
  meetingId?: string;
};

type Props = {
  alerts: AlertItem[];
  onAlertClick?: (alert: AlertItem) => void;
};

type StatusFilter = "all" | "blocked" | "completed" | "minutes";

const ITEMS_PER_PAGE = 8;

const STATUS_CHIPS: {
  value: StatusFilter;
  label: string;
  short: string;
  dot?: string;
}[] = [
  { value: "all", label: "All", short: "All" },
  { value: "blocked", label: "Blocked", short: "Blocked", dot: "bg-accent" },
  {
    value: "completed",
    label: "Completed",
    short: "Done",
    dot: "bg-primary",
  },
  {
    value: "minutes",
    label: "Minutes",
    short: "Minutes",
    dot: "bg-charcoal/45",
  },
];

const STATUS_BADGE: Record<AlertItem["type"], string> = {
  blocked: "bg-accent/10 text-accent border-accent/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  minutes: "bg-charcoal/6 text-charcoal border-charcoal/12",
};

const STATUS_DOT: Record<AlertItem["type"], string> = {
  blocked: "bg-accent",
  completed: "bg-primary",
  minutes: "bg-charcoal/45",
};

function committeeLabel(alert: AlertItem, fallbackMap: Map<string, string>) {
  if (alert.contextLabel) return alert.contextLabel;
  if (alert.committeeName) return alert.committeeName;
  if (alert.committeeId) {
    return fallbackMap.get(alert.committeeId) ?? "Group";
  }
  return null;
}

function StatusBadge({ type }: { type: AlertItem["type"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_BADGE[type]}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[type]} ${
          type === "blocked" ? "animate-pulse" : ""
        }`}
      />
      {type}
    </span>
  );
}

export function AlertFeed({ alerts, onAlertClick }: Props) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [committeeFilter, setCommitteeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const uniqueCommittees = useMemo(() => {
    const map = new Map<string, string>();
    alerts.forEach((a) => {
      if (!a.committeeId) return;
      if (a.committeeName) {
        map.set(a.committeeId, a.committeeName);
        return;
      }
      map.set(a.committeeId, `Group ${a.committeeId.substring(0, 4)}`);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [alerts]);

  const committeeNameById = useMemo(
    () => new Map(uniqueCommittees.map((c) => [c.id, c.name])),
    [uniqueCommittees],
  );

  const filteredAlerts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return alerts.filter((a) => {
      if (statusFilter !== "all" && a.type !== statusFilter) return false;
      if (committeeFilter !== "all" && a.committeeId !== committeeFilter)
        return false;
      if (q) {
        const group = committeeLabel(a, committeeNameById)?.toLowerCase() ?? "";
        const hay = `${a.message} ${group} ${a.type}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, statusFilter, committeeFilter, search, committeeNameById]);

  const filtersActive =
    statusFilter !== "all" || committeeFilter !== "all" || search.trim() !== "";

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAlerts.length / ITEMS_PER_PAGE),
  );
  const safePage = Math.min(page, totalPages);
  const paginatedAlerts = filteredAlerts.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const resetFilters = () => {
    setStatusFilter("all");
    setCommitteeFilter("all");
    setSearch("");
    setSearchOpen(false);
    setPage(1);
  };

  if (alerts.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-xs">
        <div className="flex items-center gap-2 border-b border-charcoal/10 px-4 py-3">
          <span className="h-2 w-2 rounded-full bg-accent/35" />
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-accent">
            Activity
          </h2>
        </div>
        <p className="px-4 py-8 text-center text-sm text-muted">
          No alerts right now. All groups are on track.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-xs">
      {/* Header */}
      <div className="space-y-3 border-b border-charcoal/10 px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" />
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-accent">
              Activity
            </h2>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted">
              {filteredAlerts.length === alerts.length
                ? filteredAlerts.length
                : `${filteredAlerts.length}/${alerts.length}`}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent/5"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              className={`rounded-lg p-1.5 transition-colors ${
                searchOpen || search
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-surface hover:text-charcoal"
              }`}
              aria-label="Search alerts"
              aria-pressed={searchOpen}
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Status chips — single scroll row */}
        <div
          className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1"
          role="group"
          aria-label="Filter by status"
        >
          {STATUS_CHIPS.map((chip) => {
            const active = statusFilter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => {
                  setStatusFilter(chip.value);
                  setPage(1);
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-charcoal text-white"
                    : "bg-surface text-muted hover:text-charcoal"
                }`}
              >
                {chip.dot && !active ? (
                  <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                ) : null}
                <span className="sm:hidden">{chip.short}</span>
                <span className="hidden sm:inline">{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Secondary filters */}
        {(searchOpen || uniqueCommittees.length > 1) && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {searchOpen && (
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  autoFocus
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter alerts…"
                  className={`${FORM_FILTER_CLASS} h-9 w-full bg-surface pl-8 pr-8 text-xs font-medium`}
                  aria-label="Search alerts"
                />
                {search ? (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-charcoal"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            )}
            {uniqueCommittees.length > 1 && (
              <select
                className={`${FORM_FILTER_CLASS} h-9 w-full bg-surface text-xs font-medium sm:max-w-[200px]`}
                value={committeeFilter}
                onChange={(e) => {
                  setCommitteeFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by group"
              >
                <option value="all">All groups</option>
                {uniqueCommittees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Feed list */}
      {filteredAlerts.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-muted">
            <FilterX className="h-4 w-4" />
          </div>
          <p className="text-sm font-semibold text-charcoal">No matches</p>
          <p className="mt-1 text-xs text-muted">
            Try another filter or clear search.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-charcoal/5">
          {paginatedAlerts.map((alert) => {
            const group = committeeLabel(alert, committeeNameById);
            return (
              <li key={alert.id}>
                <button
                  type="button"
                  onClick={() => alert.href && onAlertClick?.(alert)}
                  className="flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-surface/80 sm:px-4"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[alert.type]}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusBadge type={alert.type} />
                      <span className="text-[11px] tabular-nums text-muted">
                        {format(new Date(alert.time), "dd-MMM-yyyy")}
                      </span>
                      {group ? (
                        <span className="truncate text-[11px] font-semibold text-muted">
                          · {group}
                        </span>
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-charcoal">
                      {alert.message}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {filteredAlerts.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-charcoal/10 bg-surface/40 px-3 py-2.5 text-[11px] text-muted sm:px-4">
          <span className="tabular-nums">
            {(safePage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(safePage * ITEMS_PER_PAGE, filteredAlerts.length)} of{" "}
            {filteredAlerts.length}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded border border-charcoal/15 bg-white p-1 hover:bg-surface disabled:opacity-40"
                disabled={safePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 tabular-nums">
                {safePage}/{totalPages}
              </span>
              <button
                type="button"
                className="rounded border border-charcoal/15 bg-white p-1 hover:bg-surface disabled:opacity-40"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
