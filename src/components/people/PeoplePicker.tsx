"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Search, Users } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { TouchButton } from "@/components/TouchButton";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import type {
  DirectoryGroup,
  DirectoryPerson,
  DirectoryRoleBucket,
  PeopleDirectory,
} from "@/lib/people-directory";
import { peopleInGroup } from "@/lib/people-directory";

type Lane = "people" | "group" | "role";

type Drill =
  | { kind: "root" }
  | { kind: "group"; group: DirectoryGroup }
  | { kind: "group-role"; group: DirectoryGroup; role: DirectoryRoleBucket }
  | { kind: "shortcut"; role: DirectoryRoleBucket };

export type PeoplePickerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  mode: "single" | "multi";
  committeeId?: string | null;
  excludeIds?: string[];
  /** Controlled multi selection (optional; internal state used if omitted) */
  value?: string[];
  onConfirm: (
    userIds: string[],
    people: { id: string; name: string }[],
  ) => void;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function personSubtitle(p: DirectoryPerson) {
  return p.rolesSummary.slice(0, 2).join(" · ");
}

export function PeoplePicker({
  open,
  onClose,
  title = "Select people",
  mode,
  committeeId,
  excludeIds = [],
  value,
  onConfirm,
}: PeoplePickerProps) {
  const [directory, setDirectory] = useState<PeopleDirectory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lane, setLane] = useState<Lane>("people");
  const [query, setQuery] = useState("");
  const [drill, setDrill] = useState<Drill>({ kind: "root" });
  const [selected, setSelected] = useState<Set<string>>(new Set(value ?? []));

  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    if (!open) return;
    setLane("people");
    setQuery("");
    setDrill({ kind: "root" });
    setSelected(new Set(value ?? []));
    setError("");
    setLoading(true);

    const qs = committeeId
      ? `?committeeId=${encodeURIComponent(committeeId)}`
      : "";
    fetch(`/api/people-directory${qs}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load people");
        return res.json() as Promise<PeopleDirectory>;
      })
      .then((data) => setDirectory(data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load people"),
      )
      .finally(() => setLoading(false));
  }, [open, committeeId, value]);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of directory?.people ?? []) map.set(p.id, p.name);
    for (const g of directory?.groups ?? []) {
      for (const m of g.members) map.set(m.id, m.name);
      for (const role of g.roles) {
        for (const p of role.people) map.set(p.id, p.name);
      }
    }
    for (const role of directory?.roleShortcuts ?? []) {
      for (const p of role.people) map.set(p.id, p.name);
    }
    return map;
  }, [directory]);

  const visiblePeople = useMemo(() => {
    const list = directory?.people ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((p) => {
      if (exclude.has(p.id)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.rolesSummary.some((r) => r.toLowerCase().includes(q))
      );
    });
  }, [directory, query, exclude]);

  const visibleGroups = useMemo(() => {
    const list = directory?.groups ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.members.some(
          (m) => !exclude.has(m.id) && m.name.toLowerCase().includes(q),
        ),
    );
  }, [directory, query, exclude]);

  const visibleRoleShortcuts = useMemo(() => {
    const list = directory?.roleShortcuts ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((role) => {
      const available = role.people.filter((p) => !exclude.has(p.id));
      if (available.length === 0) return false;
      if (!q) return true;
      return (
        role.label.toLowerCase().includes(q) ||
        available.some((p) => p.name.toLowerCase().includes(q))
      );
    });
  }, [directory, query, exclude]);

  const filterMembers = useCallback(
    (people: { id: string; name: string }[]) =>
      people.filter((p) => {
        if (exclude.has(p.id)) return false;
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return p.name.toLowerCase().includes(q);
      }),
    [exclude, query],
  );

  const resolvePeople = (ids: string[]) =>
    ids.map((id) => ({
      id,
      name: nameById.get(id) ?? id,
    }));

  const toggle = (userId: string) => {
    if (mode === "single") {
      const people = resolvePeople([userId]);
      onConfirm([userId], people);
      onClose();
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const addMany = (ids: string[]) => {
    const filtered = ids.filter((id) => !exclude.has(id));
    if (mode === "single") {
      if (filtered.length === 1) {
        onConfirm(filtered, resolvePeople(filtered));
        onClose();
      }
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of filtered) next.add(id);
      return next;
    });
  };

  const confirmMulti = () => {
    const ids = Array.from(selected);
    onConfirm(ids, resolvePeople(ids));
    onClose();
  };

  const goBack = () => {
    if (drill.kind === "group-role") {
      setDrill({ kind: "group", group: drill.group });
    } else {
      setDrill({ kind: "root" });
    }
  };

  const sheetTitle =
    drill.kind === "group"
      ? drill.group.name
      : drill.kind === "group-role"
        ? `${drill.group.name} · ${drill.role.label}`
        : drill.kind === "shortcut"
          ? drill.role.label
          : title;

  return (
    <BottomSheet open={open} onClose={onClose} title={sheetTitle} size="lg">
      <div className="space-y-4">
        {drill.kind !== "root" && (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className={`${FORM_FIELD_CLASS} pl-10`}
            placeholder="Search by name, group, or role…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {drill.kind === "root" && (
          <div className="flex gap-1 rounded-xl bg-surface p-1">
            {(
              [
                ["people", "People"],
                ["group", "By group"],
                ["role", "By role"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setLane(key);
                  setDrill({ kind: "root" });
                }}
                className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold transition-colors ${
                  lane === key
                    ? "bg-white text-charcoal shadow-sm"
                    : "text-muted hover:text-charcoal"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "multi" && selected.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {Array.from(selected).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id)}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
              >
                {nameById.get(id) ?? id}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
        )}

        {loading && (
          <p className="py-6 text-center text-sm text-muted">Loading…</p>
        )}
        {error && (
          <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">
            {error}
          </p>
        )}

        {!loading && !error && directory && (
          <div className="max-h-[50dvh] space-y-2 overflow-y-auto">
            {drill.kind === "root" && lane === "people" && (
              <PersonList
                people={visiblePeople}
                selected={selected}
                mode={mode}
                onToggle={toggle}
              />
            )}

            {drill.kind === "root" && lane === "group" && (
              <ul className="space-y-2">
                {visibleGroups.map((g) => {
                  const count = g.members.filter((m) => !exclude.has(m.id)).length;
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => setDrill({ kind: "group", group: g })}
                        className="flex w-full items-center justify-between rounded-xl border border-charcoal/10 px-3 py-3 text-left touch-target hover:border-primary/40"
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal/10 text-charcoal">
                            <Users className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">
                              {g.name}
                            </span>
                            <span className="text-[11px] text-muted">
                              {g.kind === "supervisory"
                                ? "Governance"
                                : "Committee"}{" "}
                              · {count} people
                            </span>
                          </span>
                        </span>
                        <ChevronLeft className="h-4 w-4 rotate-180 text-muted" />
                      </button>
                    </li>
                  );
                })}
                {visibleGroups.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted">
                    No groups found.
                  </p>
                )}
              </ul>
            )}

            {drill.kind === "root" && lane === "role" && (
              <ul className="space-y-2">
                {visibleRoleShortcuts.map((role) => {
                  const q = query.trim().toLowerCase();
                  const labelMatch = Boolean(
                    q && role.label.toLowerCase().includes(q),
                  );
                  const shown = labelMatch
                    ? role.people.filter((p) => !exclude.has(p.id))
                    : filterMembers(role.people);
                  if (shown.length === 0) return null;
                  return (
                    <li key={role.key}>
                      <button
                        type="button"
                        onClick={() => {
                          if (mode === "multi") {
                            addMany(
                              (labelMatch
                                ? role.people.filter((p) => !exclude.has(p.id))
                                : shown
                              ).map((p) => p.id),
                            );
                          } else {
                            setDrill({ kind: "shortcut", role });
                          }
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-charcoal/10 px-3 py-3 text-left touch-target hover:border-primary/40"
                      >
                        <span>
                          <span className="block text-sm font-semibold">
                            {role.label}
                          </span>
                          <span className="text-[11px] text-muted">
                            {shown.length}{" "}
                            {shown.length === 1 ? "person" : "people"}
                            {mode === "multi" ? " · tap to add all" : ""}
                          </span>
                        </span>
                        <ChevronLeft className="h-4 w-4 rotate-180 text-muted" />
                      </button>
                    </li>
                  );
                })}
                {visibleRoleShortcuts.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted">
                    No roles found.
                  </p>
                )}
              </ul>
            )}

            {drill.kind === "group" && (
              <div className="space-y-3">
                {mode === "multi" && (
                  <TouchButton
                    size="md"
                    variant="secondary"
                    className="w-full"
                    onClick={() =>
                      addMany(
                        peopleInGroup(directory, drill.group.id).map((m) => m.id),
                      )
                    }
                  >
                    Add everyone in {drill.group.name}
                  </TouchButton>
                )}
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Roles
                </p>
                <ul className="space-y-2">
                  {drill.group.roles.map((role) => {
                    const q = query.trim().toLowerCase();
                    const labelMatch = Boolean(
                      q && role.label.toLowerCase().includes(q),
                    );
                    const people = labelMatch
                      ? role.people.filter((p) => !exclude.has(p.id))
                      : filterMembers(role.people);
                    if (people.length === 0) return null;
                    return (
                      <li key={role.key}>
                        <button
                          type="button"
                          onClick={() => {
                            if (mode === "multi") {
                              addMany(people.map((p) => p.id));
                            } else {
                              setDrill({
                                kind: "group-role",
                                group: drill.group,
                                role,
                              });
                            }
                          }}
                          className="flex w-full items-center justify-between rounded-xl border border-charcoal/10 px-3 py-3 text-left touch-target hover:border-primary/40"
                        >
                          <span>
                            <span className="block text-sm font-semibold">
                              {role.label}
                            </span>
                            <span className="text-[11px] text-muted">
                              {people.length}{" "}
                              {people.length === 1 ? "person" : "people"}
                              {mode === "multi" ? " · tap to add all" : ""}
                            </span>
                          </span>
                          <ChevronLeft className="h-4 w-4 rotate-180 text-muted" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="pt-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                  People
                </p>
                <PersonList
                  people={filterMembers(drill.group.members).map((m) => ({
                    id: m.id,
                    name: m.name,
                    rolesSummary: [
                      "roleLabel" in m && typeof m.roleLabel === "string"
                        ? m.roleLabel
                        : "",
                    ].filter(Boolean),
                  }))}
                  selected={selected}
                  mode={mode}
                  onToggle={toggle}
                />
              </div>
            )}

            {(drill.kind === "group-role" || drill.kind === "shortcut") && (
              <PersonList
                people={filterMembers(drill.role.people).map((p) => ({
                  id: p.id,
                  name: p.name,
                  rolesSummary: [drill.role.label],
                }))}
                selected={selected}
                mode={mode}
                onToggle={toggle}
              />
            )}
          </div>
        )}

        {mode === "multi" && (
          <TouchButton
            size="lg"
            className="w-full"
            disabled={selected.size === 0}
            onClick={confirmMulti}
          >
            Confirm{selected.size > 0 ? ` (${selected.size})` : ""}
          </TouchButton>
        )}
      </div>
    </BottomSheet>
  );
}

function PersonList({
  people,
  selected,
  mode,
  onToggle,
}: {
  people: DirectoryPerson[];
  selected: Set<string>;
  mode: "single" | "multi";
  onToggle: (id: string) => void;
}) {
  if (people.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted">No people found.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {people.map((p) => {
        const isOn = selected.has(p.id);
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onToggle(p.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left touch-target ${
                isOn
                  ? "border-primary bg-primary/5"
                  : "border-charcoal/10 hover:border-primary/40"
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-charcoal text-xs font-bold text-white">
                {initials(p.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {p.name}
                </span>
                {p.rolesSummary.length > 0 && (
                  <span className="block truncate text-[11px] text-muted">
                    {personSubtitle(p)}
                  </span>
                )}
              </span>
              {mode === "multi" && (
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] ${
                    isOn
                      ? "border-primary bg-primary text-white"
                      : "border-charcoal/20"
                  }`}
                >
                  {isOn ? "✓" : ""}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
