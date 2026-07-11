"use client";

import { useEffect, useState } from "react";
import { TouchButton } from "@/components/TouchButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { InviteMemberSheet } from "@/components/InviteMemberSheet";
import { useApp } from "@/providers/AppProvider";
import { USER_ROLE_LABELS, isSuperAdmin, type UserRole } from "@/lib/types";
import { formatDateTime } from "@/lib/dates";
import { FormSelect } from "@/components/FormSelect";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { Check } from "lucide-react";

type User = {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
};

type Committee = {
  id: string;
  charterLetter: string;
  name: string;
  budget?: number | null;
  reportingFrequency?: string | null;
  description?: string | null;
};

const REPORTING_OPTIONS = ["Weekly", "Biweekly", "Monthly", "Quarterly"];

export function AdminView() {
  const { user, appSettings, refreshAppSettings } = useApp();
  const budgetsEnabled = appSettings?.committeeBudgetsEnabled === true;
  const canToggleBudgets = user ? isSuperAdmin(user.role) : false;
  const [users, setUsers] = useState<User[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedCommittees, setSelectedCommittees] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState<"CHAIR" | "SECRETARY" | "MEMBER">("MEMBER");
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "COMMITTEE_PARTICIPANT" as UserRole });
  const [presbytery, setPresbytery] = useState<{ members: { id: string; isHead: boolean; user: User }[] } | null>(null);
  const [auditLogs, setAuditLogs] = useState<{ id: string; action: string; createdAt: string; actor: { name: string } }[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<string | null>(null);
  const [metaForm, setMetaForm] = useState({
    budget: "",
    reportingFrequency: "Monthly",
    description: "",
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCommitteeId, setInviteCommitteeId] = useState<string | null>(null);

  const refresh = () => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/committees?scope=all&meta=true")
      .then((r) => r.json())
      .then(setCommittees);
    fetch("/api/presbytery").then((r) => r.json()).then(setPresbytery).catch(() => undefined);
    fetch("/api/audit?limit=20").then((r) => r.json()).then(setAuditLogs).catch(() => undefined);
  };

  useEffect(() => {
    refresh();
  }, []);

  const createUser = async () => {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ name: "", email: "", phone: "", role: "COMMITTEE_PARTICIPANT" });
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const assignCommittees = async () => {
    if (!selectedUser || selectedCommittees.size === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        [...selectedCommittees].map((committeeId) =>
          fetch("/api/committees/members", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: selectedUser, committeeId, title }),
          }),
        ),
      );
      setSelectedCommittees(new Set());
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleCommittee = (id: string) => {
    setSelectedCommittees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openMetaEditor = (c: Committee) => {
    setEditingCommittee(c.id);
    setMetaForm({
      budget: c.budget != null ? String(c.budget) : "",
      reportingFrequency: c.reportingFrequency ?? "Monthly",
      description: c.description ?? "",
    });
  };

  const saveMeta = async () => {
    if (!editingCommittee) return;
    setSaving(true);
    try {
      await fetch("/api/committees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCommittee,
          ...(budgetsEnabled && {
            budget: metaForm.budget === "" ? null : Number(metaForm.budget),
          }),
          reportingFrequency: metaForm.reportingFrequency,
          description: metaForm.description || null,
        }),
      });
      setEditingCommittee(null);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleBudgets = async () => {
    if (!canToggleBudgets) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          committeeBudgetsEnabled: !budgetsEnabled,
        }),
      });
      if (res.ok) {
        refreshAppSettings();
        refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">Admin</h1>
        <p className="text-muted mt-0.5 text-sm font-medium">User directory, pairing, presbytery roster & committee config</p>
      </div>

      {canToggleBudgets && (
        <section className="rounded-2xl border border-charcoal/10 bg-white p-5 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-charcoal uppercase tracking-wider text-accent">
                Feature settings
              </h2>
              <p className="text-sm text-muted mt-1 max-w-xl">
                Committee budgets are hidden by default. Enable this to show
                operational budget amounts on committee overviews and in admin
                configuration.
              </p>
            </div>
            <TouchButton
              variant={budgetsEnabled ? "primary" : "ghost"}
              disabled={saving}
              onClick={toggleBudgets}
              className="shrink-0"
            >
              {budgetsEnabled ? "Budgets enabled" : "Enable budgets"}
            </TouchButton>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
        <h2 className="text-sm font-bold text-charcoal">Member invites</h2>
        <p className="text-sm text-muted mt-2">
          Invite committee members by email, SMS, or shareable link. They confirm their
          details, verify via OTP, and set a password.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {committees.slice(0, 6).map((c) => (
            <TouchButton
              key={c.id}
              size="md"
              variant="secondary"
              onClick={() => {
                setInviteCommitteeId(c.id);
                setInviteOpen(true);
              }}
            >
              Invite to {c.charterLetter.toUpperCase()}
            </TouchButton>
          ))}
        </div>
      </section>

      <InviteMemberSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        committeeId={inviteCommitteeId ?? ""}
        committeeName={
          committees.find((c) => c.id === inviteCommitteeId)?.name
        }
      />

      <section className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
        <h2 className="text-sm font-bold text-charcoal">Planned</h2>
        <ul className="text-sm text-muted mt-2 space-y-1 list-disc pl-5">
          <li>Document uploads coming soon</li>
        </ul>
      </section>

      <section className="bg-white rounded-2xl border border-charcoal/5 p-6 space-y-4 shadow-xs">
        <h2 className="font-bold text-charcoal text-sm uppercase tracking-wider text-accent">Presbytery Roster</h2>
        <ul className="space-y-2">
          {(presbytery?.members ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-charcoal/10">
              <span className="font-medium text-charcoal">
                {m.user.name} {m.isHead && <span className="text-xs text-accent">(Head)</span>}
              </span>
              <div className="flex gap-2">
                {!m.isHead && (
                  <TouchButton
                    size="md"
                    variant="secondary"
                    onClick={() =>
                      fetch("/api/presbytery", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "set_head", userId: m.user.id }),
                      }).then(refresh)
                    }
                  >
                    Set head
                  </TouchButton>
                )}
                <TouchButton
                  size="md"
                  variant="ghost"
                  onClick={() =>
                    fetch("/api/presbytery", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "remove", userId: m.user.id }),
                    }).then(refresh)
                  }
                >
                  Remove
                </TouchButton>
              </div>
            </li>
          ))}
        </ul>
        <FormSelect
          defaultValue=""
          onChange={(e) => {
            const userId = e.target.value;
            if (!userId) return;
            fetch("/api/presbytery", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, action: "add" }),
            }).then(refresh);
            e.target.value = "";
          }}
        >
          <option value="">Add Presbytery member…</option>
          {users
            .filter((u) => !presbytery?.members.some((m) => m.user.id === u.id))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </FormSelect>
      </section>

      <section className="bg-white rounded-2xl border border-charcoal/5 p-6 space-y-3 shadow-xs">
        <h2 className="font-bold text-charcoal text-sm uppercase tracking-wider text-accent">Audit Log</h2>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-muted">No activity logged yet.</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
            {auditLogs.map((log) => (
              <li key={log.id} className="text-charcoal">
                <span className="font-medium">{log.actor.name}</span> — {log.action}
                <time className="text-xs text-muted block">
                  {formatDateTime(log.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Left Column: Create User and Assign Committee */}
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-charcoal/5 p-6 space-y-4 shadow-xs">
            <h2 className="font-bold text-charcoal text-sm uppercase tracking-wider text-accent">Create New User</h2>
            <div className="space-y-3">
              {(["name", "email", "phone"] as const).map((field) => (
                <input
                  key={field}
                  type={field === "email" ? "email" : "text"}
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className={FORM_FIELD_CLASS}
                />
              ))}
              <FormSelect
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              >
                {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </FormSelect>
              <TouchButton size="lg" className="w-full mt-2" disabled={saving} onClick={createUser}>
                Create User
              </TouchButton>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-charcoal/5 p-6 space-y-4 shadow-xs">
            <h2 className="font-bold text-charcoal text-sm uppercase tracking-wider text-accent">Assign Committee</h2>
            <FormSelect
              value={selectedUser ?? ""}
              onChange={(e) => setSelectedUser(e.target.value || null)}
            >
              <option value="">Select user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {USER_ROLE_LABELS[u.role]}
                </option>
              ))}
            </FormSelect>

            <div>
              <p className="text-xs font-bold text-charcoal-muted uppercase tracking-wider mb-2.5">Committee title</p>
              <SegmentedControl
                options={[
                  { value: "CHAIR" as const, label: "Chair" },
                  { value: "SECRETARY" as const, label: "Secretary" },
                  { value: "MEMBER" as const, label: "Member" },
                ]}
                value={title}
                onChange={setTitle}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-charcoal-muted uppercase tracking-wider">Select Committees</p>
              <ul className="space-y-2 max-h-64 overflow-y-auto border border-charcoal/5 rounded-xl p-3 bg-slate-50/50">
                {committees.map((c) => {
                  const selected = selectedCommittees.has(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => toggleCommittee(c.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left cursor-pointer ${
                          selected
                            ? "border-primary bg-primary/10 shadow-2xs font-bold text-charcoal"
                            : "border-charcoal/5 bg-white hover:border-charcoal/20 text-charcoal-muted"
                        }`}
                      >
                        <span className="font-extrabold text-accent uppercase w-6 shrink-0">
                          {c.charterLetter}
                        </span>
                        <span className="flex-1 font-semibold text-sm truncate">{c.name}</span>
                        {selected && <Check className="h-5 w-5 text-primary-dark shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <TouchButton
              size="lg"
              className="w-full mt-2"
              disabled={!selectedUser || selectedCommittees.size === 0 || saving}
              onClick={assignCommittees}
            >
              Save Assignments
            </TouchButton>
          </section>
        </div>

        {/* Right Column: Committee Configuration */}
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-charcoal/5 p-6 space-y-4 shadow-xs">
            <h2 className="font-bold text-charcoal text-sm uppercase tracking-wider text-accent">Committee Configuration</h2>
            <p className="text-xs text-muted font-medium">
              Set reporting frequencies{budgetsEnabled ? " and budgets" : ""} for
              each of the 19 committees.
            </p>
            <ul className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
              {committees.map((c) => (
                <li key={c.id}>
                  {editingCommittee === c.id ? (
                    <div className="rounded-xl border border-primary bg-primary/5 p-4 space-y-4">
                      <p className="font-bold text-charcoal text-sm">
                        <span className="text-accent uppercase font-extrabold">{c.charterLetter}</span>{" "}
                        {c.name}
                      </p>
                      <label className="block">
                        <span className="text-xs font-bold text-charcoal-muted uppercase tracking-wider">Reporting Frequency</span>
                        <div className="mt-2">
                          <SegmentedControl
                            options={REPORTING_OPTIONS.map((o) => ({
                              value: o,
                              label: o,
                            }))}
                            value={metaForm.reportingFrequency}
                            onChange={(v) =>
                              setMetaForm({ ...metaForm, reportingFrequency: v })
                            }
                          />
                        </div>
                      </label>
                      {budgetsEnabled && (
                        <label className="block">
                          <span className="text-xs font-bold text-charcoal-muted uppercase tracking-wider">
                            Operational Budget ($)
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={metaForm.budget}
                            onChange={(e) =>
                              setMetaForm({ ...metaForm, budget: e.target.value })
                            }
                            className={`mt-2 ${FORM_FIELD_CLASS}`}
                            placeholder="e.g. 5000"
                          />
                        </label>
                      )}
                      <label className="block">
                        <span className="text-xs font-bold text-charcoal-muted uppercase tracking-wider">Description</span>
                        <input
                          type="text"
                          value={metaForm.description}
                          onChange={(e) =>
                            setMetaForm({ ...metaForm, description: e.target.value })
                          }
                          className={`mt-2 ${FORM_FIELD_CLASS}`}
                        />
                      </label>
                      <div className="flex gap-3 pt-2">
                        <TouchButton className="flex-1" disabled={saving} onClick={saveMeta}>
                          Save
                        </TouchButton>
                        <TouchButton
                          variant="ghost"
                          className="flex-1"
                          onClick={() => setEditingCommittee(null)}
                        >
                          Cancel
                        </TouchButton>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openMetaEditor(c)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-charcoal/5 bg-white hover:border-accent hover:shadow-2xs transition-all text-left cursor-pointer"
                    >
                      <span className="font-extrabold text-accent uppercase w-6 shrink-0 text-center bg-accent/5 rounded-lg py-1">
                        {c.charterLetter}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-charcoal truncate">{c.name}</p>
                        <p className="text-xs text-muted font-semibold mt-1">
                          {c.reportingFrequency ?? "No frequency"}
                          {budgetsEnabled && c.budget != null
                            ? ` · Budget $${c.budget.toLocaleString()}`
                            : ""}
                        </p>
                      </div>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
