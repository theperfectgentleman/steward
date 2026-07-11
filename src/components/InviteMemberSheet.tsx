"use client";

import { useState } from "react";
import { TouchButton } from "@/components/TouchButton";
import { BottomSheet } from "@/components/BottomSheet";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { FormSelect } from "@/components/FormSelect";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { Check } from "lucide-react";

type InviteMemberSheetProps = {
  open: boolean;
  onClose: () => void;
  committeeId: string;
  committeeName?: string;
  onSuccess?: () => void;
};

export function InviteMemberSheet({
  open,
  onClose,
  committeeId,
  committeeName,
  onSuccess,
}: InviteMemberSheetProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    title: "MEMBER" as "CHAIR" | "SECRETARY" | "MEMBER",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [existingAdded, setExistingAdded] = useState(false);

  const reset = () => {
    setForm({ name: "", email: "", phone: "", title: "MEMBER" });
    setError("");
    setInviteUrl(null);
    setExistingAdded(false);
  };

  const submit = async (sendNotifications: boolean) => {
    if (!form.name.trim() || !form.email.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          committeeId,
          sendNotifications,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not invite member");

      if (data.type === "existing") {
        setExistingAdded(true);
        onSuccess?.();
      } else {
        setInviteUrl(data.inviteUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not invite member");
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
      title={committeeName ? `Invite to ${committeeName}` : "Invite member"}
    >
      {inviteUrl ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Invite created. Share this link via WhatsApp or any channel:
          </p>
          <p className="text-xs break-all bg-surface rounded-xl p-3 border border-charcoal/10">
            {inviteUrl}
          </p>
          <CopyLinkButton url={inviteUrl} label="Copy invite link" />
          <TouchButton
            className="w-full"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Done
          </TouchButton>
        </div>
      ) : existingAdded ? (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <Check className="h-10 w-10 text-primary" />
          </div>
          <p className="text-sm text-charcoal">
            They already have an account and were added to the committee. We sent them a
            notification.
          </p>
          <TouchButton
            className="w-full"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Done
          </TouchButton>
        </div>
      ) : (
        <div className="space-y-4">
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={FORM_FIELD_CLASS}
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={FORM_FIELD_CLASS}
          />
          <input
            type="tel"
            placeholder="Phone (for SMS)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className={FORM_FIELD_CLASS}
          />
          <FormSelect
            value={form.title}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                title: e.target.value as "CHAIR" | "SECRETARY" | "MEMBER",
              }))
            }
          >
            <option value="MEMBER">Member</option>
            <option value="SECRETARY">Secretary</option>
            <option value="CHAIR">Chair</option>
          </FormSelect>
          {error && (
            <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{error}</p>
          )}
          <TouchButton
            className="w-full"
            disabled={submitting || !form.name.trim() || !form.email.trim()}
            onClick={() => submit(true)}
          >
            Send email & SMS
          </TouchButton>
          <TouchButton
            variant="secondary"
            className="w-full"
            disabled={submitting || !form.name.trim() || !form.email.trim()}
            onClick={() => submit(false)}
          >
            Create invite link only
          </TouchButton>
        </div>
      )}
    </BottomSheet>
  );
}
