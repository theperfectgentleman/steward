"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/providers/AppProvider";
import { TouchButton } from "@/components/TouchButton";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { FormSelect } from "@/components/FormSelect";
import { Building2, Shield, Plus } from "lucide-react";
import Link from "next/link";

type Org = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  _count: { memberships: number; committees: number };
};

type Admin = {
  id: string;
  user: { id: string; name: string; email: string };
};

export function SuperConsoleView() {
  const { user, logout } = useApp();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    template: "blank",
    supervisoryLabel: "",
  });
  const [adminEmail, setAdminEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    fetch("/api/super/orgs")
      .then((r) => r.json())
      .then(setOrgs)
      .catch(() => undefined);
    fetch("/api/super/admins")
      .then((r) => r.json())
      .then(setAdmins)
      .catch(() => undefined);
  };

  useEffect(() => {
    refresh();
  }, []);

  const createOrg = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/super/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || undefined,
          template: form.template,
          supervisoryLabel: form.supervisoryLabel || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Create failed");
      }
      setForm({ name: "", slug: "", template: "blank", supervisoryLabel: "" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (org: Org) => {
    await fetch("/api/super/orgs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: org.id,
        status: org.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      }),
    });
    refresh();
  };

  const addAdmin = async () => {
    if (!adminEmail.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/super/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail.trim(), action: "add" }),
      });
      setAdminEmail("");
      refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100">
      <header className="border-b border-stone-800 px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-lime-400 uppercase">
              Steward Super
            </p>
            <h1 className="text-xl font-semibold">Platform console</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-xl border border-stone-700 px-3 py-2 text-sm"
            >
              Org picker
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl px-3 py-2 text-sm text-stone-400"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-4">
        <p className="text-stone-400">
          Signed in as {user?.name} ({user?.email})
        </p>

        <section className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Plus className="h-5 w-5 text-lime-400" />
            Create organization
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className={FORM_FIELD_CLASS}
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className={FORM_FIELD_CLASS}
              placeholder="Slug (optional)"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
            <FormSelect
              value={form.template}
              onChange={(e) =>
                setForm((f) => ({ ...f, template: e.target.value }))
              }
            >
              <option value="blank">Blank</option>
              <option value="church">Church template</option>
              <option value="board">Board + committees</option>
            </FormSelect>
            <input
              className={FORM_FIELD_CLASS}
              placeholder="Supervisory label (optional)"
              value={form.supervisoryLabel}
              onChange={(e) =>
                setForm((f) => ({ ...f, supervisoryLabel: e.target.value }))
              }
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <div className="mt-4">
            <TouchButton onClick={createOrg} disabled={saving}>
              Create organization
            </TouchButton>
          </div>
        </section>

        <section className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="h-5 w-5 text-lime-400" />
            Organizations
          </h2>
          <div className="mt-4 space-y-3">
            {orgs.map((org) => (
              <div
                key={org.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-800 bg-stone-950/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{org.name}</p>
                  <p className="text-sm text-stone-400">
                    /{org.slug} · {org._count.memberships} members ·{" "}
                    {org._count.committees} committees · {org.status}
                  </p>
                </div>
                <TouchButton onClick={() => toggleStatus(org)}>
                  {org.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                </TouchButton>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-stone-800 bg-stone-900/60 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5 text-lime-400" />
            Platform admins
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-stone-300">
            {admins.map((a) => (
              <li key={a.id}>
                {a.user.name} — {a.user.email}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              className={FORM_FIELD_CLASS}
              placeholder="Add by email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
            <TouchButton onClick={addAdmin} disabled={saving}>
              Add admin
            </TouchButton>
          </div>
        </section>
      </main>
    </div>
  );
}
