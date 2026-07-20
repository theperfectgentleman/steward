"use client";

import { useCallback, useEffect, useState } from "react";
import { TouchButton } from "@/components/TouchButton";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";
import { InviteMemberSheet } from "@/components/InviteMemberSheet";
import {
  GitBranch,
  Plus,
  Trash2,
  UserPlus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type StructurePayload = {
  organization: {
    id: string;
    name: string;
    settings: {
      supervisoryLabel: string;
      committeeLabel: string;
    };
  };
  supervisory: {
    id: string;
    name: string;
    members: {
      id: string;
      isHead: boolean;
      user: { id: string; name: string; email?: string };
    }[];
  } | null;
  committees: {
    id: string;
    name: string;
    sortOrder: number;
    _count: { members: number };
    members: {
      id: string;
      title: string;
      customTitle?: string | null;
      user: { id: string; name: string };
    }[];
  }[];
  roleTemplates: {
    id: string;
    key: string;
    name: string;
    capabilities: Record<string, boolean>;
  }[];
};

export function StructureBuilderView() {
  const { user, appSettings } = useApp();
  const [data, setData] = useState<StructurePayload | null>(null);
  const [newCommittee, setNewCommittee] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    supervisory: true,
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCommitteeId, setInviteCommitteeId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const supervisoryLabel =
    data?.organization.settings.supervisoryLabel ||
    appSettings?.supervisoryLabel ||
    "Supervisory Group";
  const committeeLabel =
    data?.organization.settings.committeeLabel ||
    appSettings?.committeeLabel ||
    "Committee";

  const refresh = useCallback(() => {
    fetch("/api/structure")
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (payload) setData(payload);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCommittee = async () => {
    if (!newCommittee.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_committee",
          name: newCommittee.trim(),
        }),
      });
      setNewCommittee("");
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const deleteCommittee = async (committeeId: string) => {
    if (!confirm("Delete this committee and its work?")) return;
    setSaving(true);
    try {
      await fetch("/api/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_committee", committeeId }),
      });
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const openInvite = (committeeId: string | null) => {
    if (!committeeId) {
      // Supervisory invites: use roster management in Admin for now
      window.location.href = "/admin?tab=presbytery";
      return;
    }
    setInviteCommitteeId(committeeId);
    setInviteOpen(true);
  };

  if (!data) {
    return (
      <div className="p-4 text-sm text-muted">Loading structure…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-28">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          Org Admin
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-ink">
          <GitBranch className="h-5 w-5" />
          Structure builder
        </h1>
        <p className="mt-1 text-sm text-muted">
          Visual tree for {data.organization.name}. Click a node to invite
          people into roles.
        </p>
      </div>

      {/* Root org node */}
      <div className="rounded-2xl border border-border bg-surface-raised p-4">
        <p className="text-sm font-medium text-muted">Organization</p>
        <p className="text-xl font-semibold text-ink">{data.organization.name}</p>
        <p className="text-sm text-muted">
          You: {user?.organization?.orgRole ?? user?.role}
        </p>
      </div>

      <div className="ml-4 border-l-2 border-dashed border-border pl-4 space-y-4">
        {/* Supervisory node */}
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 p-4">
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left"
            onClick={() =>
              setExpanded((e) => ({ ...e, supervisory: !e.supervisory }))
            }
          >
            {expanded.supervisory ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
            <div className="flex-1">
              <p className="font-semibold text-ink">{supervisoryLabel}</p>
              <p className="text-sm text-muted">
                {data.supervisory?.members.length ?? 0} members
              </p>
            </div>
            <TouchButton
              onClick={(ev) => {
                ev.stopPropagation();
                openInvite(null);
              }}
            >
              <UserPlus className="h-4 w-4" />
              Invite
            </TouchButton>
          </button>
          {expanded.supervisory && (
            <ul className="mt-3 space-y-2">
              {(data.supervisory?.members ?? []).map((m) => (
                <li
                  key={m.id}
                  className="rounded-xl bg-white/70 px-3 py-2 text-sm"
                >
                  {m.user.name}
                  {m.isHead ? " · Head" : ""}
                </li>
              ))}
              {!data.supervisory?.members.length && (
                <li className="text-sm text-muted">No members yet</li>
              )}
            </ul>
          )}
        </div>

        {/* Committees */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-ink">{committeeLabel}s</h2>
          </div>
          {data.committees.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-border bg-surface-raised p-4"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() =>
                  setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))
                }
              >
                {expanded[c.id] ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{c.name}</p>
                  <p className="text-sm text-muted">
                    {c._count.members} members
                  </p>
                </div>
                <TouchButton
                  onClick={(ev) => {
                    ev.stopPropagation();
                    openInvite(c.id);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                </TouchButton>
                <button
                  type="button"
                  className="rounded-xl p-3 text-red-600"
                  aria-label="Delete committee"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    deleteCommittee(c.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </button>
              {expanded[c.id] && (
                <ul className="mt-3 space-y-2">
                  {c.members.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-xl bg-black/5 px-3 py-2 text-sm"
                    >
                      {m.user.name} · {m.customTitle || m.title}
                    </li>
                  ))}
                  {!c.members.length && (
                    <li className="text-sm text-muted">No members yet</li>
                  )}
                </ul>
              )}
            </div>
          ))}

          <div className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-border p-4">
            <input
              className={`${FORM_FIELD_CLASS} flex-1`}
              placeholder={`New ${committeeLabel.toLowerCase()} name`}
              value={newCommittee}
              onChange={(e) => setNewCommittee(e.target.value)}
            />
            <TouchButton onClick={addCommittee} disabled={saving}>
              <Plus className="h-4 w-4" />
              Add
            </TouchButton>
          </div>
        </div>
      </div>

      {inviteOpen && inviteCommitteeId && (
        <InviteMemberSheet
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          committeeId={inviteCommitteeId}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
