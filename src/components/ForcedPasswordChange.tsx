"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TouchButton } from "@/components/TouchButton";
import { BrandLogo } from "@/components/BrandLogo";
import { useApp } from "@/providers/AppProvider";
import { FORM_FIELD_CLASS } from "@/lib/form-field";

export function ForcedPasswordChange() {
  const { refreshSession, logout } = useApp();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (newPassword.length < 8) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not change password");
      await refreshSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 bg-surface">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandLogo size={72} />
          </div>
          <h1 className="text-2xl font-bold text-charcoal">Choose a password</h1>
          <p className="text-sm text-muted">
            An admin created this account. Set your own password before continuing.
          </p>
        </div>
        <div className="bg-white rounded-3xl border-2 border-charcoal/10 p-6 space-y-4 shadow-sm">
          <div className="relative w-full">
            <input
              type={showCurrent ? "text" : "password"}
              placeholder="Temporary password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={`${FORM_FIELD_CLASS} pr-12`}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/45 hover:text-charcoal p-2"
              aria-label={showCurrent ? "Hide password" : "Show password"}
            >
              {showCurrent ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className="relative w-full">
            <input
              type={showNew ? "text" : "password"}
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`${FORM_FIELD_CLASS} pr-12`}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/45 hover:text-charcoal p-2"
              aria-label={showNew ? "Hide password" : "Show password"}
            >
              {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && (
            <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{error}</p>
          )}
          <TouchButton
            size="lg"
            className="w-full"
            disabled={!currentPassword || newPassword.length < 8 || submitting}
            onClick={submit}
          >
            {submitting ? "Saving…" : "Save password"}
          </TouchButton>
          <button
            type="button"
            onClick={logout}
            className="w-full text-sm text-muted"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
