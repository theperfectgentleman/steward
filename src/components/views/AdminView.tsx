"use client";

import { useEffect, useState } from "react";
import { TouchButton } from "@/components/TouchButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { USER_ROLE_LABELS, type UserRole } from "@/lib/types";
import { Check } from "lucide-react";

type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type Committee = {
  id: string;
  charterLetter: string;
  name: string;
};

export function AdminView() {
  const [users, setUsers] = useState<User[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedCommittees, setSelectedCommittees] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState<"CHAIR" | "SECRETARY" | "MEMBER">("MEMBER");
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "COMMITTEE_MEMBER" as UserRole });
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/committees?scope=all").then((r) => r.json()).then(setCommittees);
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Admin</h1>
        <p className="text-muted mt-1">User directory & committee pairing</p>
      </div>

      <section className="bg-white rounded-2xl border border-charcoal/10 p-5 space-y-4">
        <h2 className="font-bold text-charcoal">Create New User</h2>
        <div className="space-y-3">
          {(["name", "email", "phone"] as const).map((field) => (
            <input
              key={field}
              type={field === "email" ? "email" : "text"}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              className="w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none capitalize-placeholder"
            />
          ))}
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            className="w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none bg-white"
          >
            {Object.entries(USER_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <TouchButton size="lg" className="w-full" disabled={saving} onClick={createUser}>
            Create User
          </TouchButton>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-charcoal/10 p-5 space-y-4">
        <h2 className="font-bold text-charcoal">Assign Committee</h2>
        <select
          value={selectedUser ?? ""}
          onChange={(e) => setSelectedUser(e.target.value || null)}
          className="w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none bg-white"
        >
          <option value="">Select user…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {USER_ROLE_LABELS[u.role]}
            </option>
          ))}
        </select>

        <div>
          <p className="text-sm font-semibold mb-2">Committee title</p>
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

        <ul className="space-y-3 max-h-64 overflow-y-auto">
          {committees.map((c) => {
            const selected = selectedCommittees.has(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggleCommittee(c.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 touch-target-lg text-left ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-charcoal/10 hover:border-charcoal/20"
                  }`}
                >
                  <span className="font-bold text-accent uppercase w-6">
                    {c.charterLetter}
                  </span>
                  <span className="flex-1 font-semibold">{c.name}</span>
                  {selected && <Check className="h-6 w-6 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>

        <TouchButton
          size="lg"
          className="w-full"
          disabled={!selectedUser || selectedCommittees.size === 0 || saving}
          onClick={assignCommittees}
        >
          Save Assignments
        </TouchButton>
      </section>
    </div>
  );
}
