"use client";

import { useEffect, useState } from "react";
import { TouchButton } from "@/components/TouchButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { USER_ROLE_LABELS, type UserRole } from "@/lib/types";
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
  const [users, setUsers] = useState<User[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedCommittees, setSelectedCommittees] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState<"CHAIR" | "SECRETARY" | "MEMBER">("MEMBER");
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "COMMITTEE_MEMBER" as UserRole });
  const [saving, setSaving] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<string | null>(null);
  const [metaForm, setMetaForm] = useState({
    budget: "",
    reportingFrequency: "Monthly",
    description: "",
  });

  const refresh = () => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/committees?scope=all&meta=true")
      .then((r) => r.json())
      .then(setCommittees);
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
      setForm({ name: "", email: "", phone: "", role: "COMMITTEE_MEMBER" });
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
          budget: metaForm.budget === "" ? null : Number(metaForm.budget),
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal tracking-tight">Admin</h1>
        <p className="text-muted mt-0.5 text-sm font-medium">User directory, pairing & committee config</p>
      </div>

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
                  className="w-full input-touch px-4 rounded-xl border border-charcoal/10 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base font-semibold"
                />
              ))}
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                className="w-full input-touch px-4 rounded-xl border border-charcoal/10 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white text-base font-semibold cursor-pointer"
              >
                {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <TouchButton size="lg" className="w-full mt-2" disabled={saving} onClick={createUser}>
                Create User
              </TouchButton>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-charcoal/5 p-6 space-y-4 shadow-xs">
            <h2 className="font-bold text-charcoal text-sm uppercase tracking-wider text-accent">Assign Committee</h2>
            <select
              value={selectedUser ?? ""}
              onChange={(e) => setSelectedUser(e.target.value || null)}
              className="w-full input-touch px-4 rounded-xl border border-charcoal/10 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white text-base font-semibold cursor-pointer"
            >
              <option value="">Select user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {USER_ROLE_LABELS[u.role]}
                </option>
              ))}
            </select>

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
              Set budgets and reporting frequencies for each of the 19 committees.
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
                        <span className="text-xs font-bold text-charcoal-muted uppercase tracking-wider">Operational Budget ($)</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={metaForm.budget}
                          onChange={(e) =>
                            setMetaForm({ ...metaForm, budget: e.target.value })
                          }
                          className="mt-2 w-full input-touch px-4 rounded-xl border border-charcoal/10 focus:border-primary bg-white outline-none text-base font-semibold"
                          placeholder="e.g. 5000"
                        />
                      </label>
                      <div>
                        <p className="text-xs font-bold text-charcoal-muted uppercase tracking-wider mb-2">Reporting Frequency</p>
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
                      <label className="block">
                        <span className="text-xs font-bold text-charcoal-muted uppercase tracking-wider">Description</span>
                        <input
                          type="text"
                          value={metaForm.description}
                          onChange={(e) =>
                            setMetaForm({ ...metaForm, description: e.target.value })
                          }
                          className="mt-2 w-full input-touch px-4 rounded-xl border border-charcoal/10 focus:border-primary bg-white outline-none text-base font-semibold"
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
                          {c.budget != null
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
