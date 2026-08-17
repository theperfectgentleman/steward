"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { TouchButton } from "@/components/TouchButton";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";
import type { SessionUser } from "@/providers/AppProvider";

export function CreateAccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { establishSession } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setError("");
  };

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = (await res.json()) as SessionUser & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not create account");
      }
      establishSession(data);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Create account"
    >
      <div className="space-y-4">
        <input
          className={FORM_FIELD_CLASS}
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <input
          type="email"
          className={FORM_FIELD_CLASS}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          type="password"
          className={FORM_FIELD_CLASS}
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        {error && (
          <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>
        )}
        <TouchButton
          className="w-full"
          disabled={submitting || !name.trim() || !email.trim() || password.length < 8}
          onClick={() => void submit()}
        >
          {submitting ? "Creating…" : "Create account"}
        </TouchButton>
      </div>
    </BottomSheet>
  );
}
