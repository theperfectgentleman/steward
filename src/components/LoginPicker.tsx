"use client";

import { useEffect, useState } from "react";
import { TouchButton } from "./TouchButton";
import { useApp } from "@/providers/AppProvider";
import { USER_ROLE_LABELS, type UserRole } from "@/lib/types";

type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export function LoginPicker() {
  const { login } = useApp();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.error ?? "Could not load profiles");
        }
        if (!Array.isArray(data)) {
          throw new Error("Invalid response from server");
        }
        return data as DemoUser[];
      })
      .then(setUsers)
      .catch((e: Error) => {
        setUsers([]);
        setError(e.message || "Could not load demo profiles");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await login(selected);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 bg-surface">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-charcoal">UnityCommit</h1>
          <p className="text-muted">
            Unified Church Committee Workspace
          </p>
        </div>

        <div className="bg-white rounded-3xl border-2 border-charcoal/10 p-6 space-y-4 shadow-sm">
          <p className="text-sm font-semibold text-charcoal">
            Select a demo profile to continue
          </p>
          {loading && (
            <p className="text-sm text-muted text-center py-6">Loading profiles…</p>
          )}
          {error && (
            <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{error}</p>
          )}
          {!loading && !error && users.length === 0 && (
            <p className="text-sm text-muted text-center py-6">
              No profiles found. Run database seed:{" "}
              <code className="text-xs bg-surface px-1 rounded">npm run db:seed</code>
            </p>
          )}
          <ul className="space-y-3">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelected(u.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left touch-target-lg transition-all ${
                    selected === u.id
                      ? "border-primary bg-primary/10"
                      : "border-charcoal/10 hover:border-charcoal/20"
                  }`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-charcoal text-white font-bold text-sm">
                    {u.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal truncate">{u.name}</p>
                    <p className="text-xs text-muted">
                      {USER_ROLE_LABELS[u.role]}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <TouchButton
            size="lg"
            className="w-full"
            disabled={!selected || submitting}
            onClick={handleLogin}
          >
            {submitting ? "Signing in…" : "Continue"}
          </TouchButton>
        </div>
      </div>
    </div>
  );
}
