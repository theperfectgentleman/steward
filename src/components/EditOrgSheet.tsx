"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { TouchButton } from "@/components/TouchButton";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";

export function EditOrgSheet({
  open,
  onClose,
  organizationId,
  initialName,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  organizationId?: string;
  initialName?: string;
  slug?: string;
}) {
  const { user, refreshSession } = useApp();

  const activeOrg = user?.organization;
  const targetOrgId = organizationId ?? activeOrg?.id ?? "";
  const currentName = initialName ?? activeOrg?.name ?? "";
  const displaySlug = slug ?? activeOrg?.slug ?? "";

  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError("");
    }
  }, [open, currentName]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || !targetOrgId) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/orgs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: targetOrgId,
          name: trimmed,
        }),
      });

      const data = (await res.json()) as { org?: { id: string; name: string }; error?: string };
      if (!res.ok || !data.org) {
        throw new Error(data.error ?? "Could not update organization");
      }

      await refreshSession();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update organization");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        setError("");
        onClose();
      }}
      title="Edit organization"
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-org-name" className="block text-xs font-semibold text-charcoal/80 mb-1.5">
            Organization label
          </label>
          <input
            id="edit-org-name"
            className={FORM_FIELD_CLASS}
            placeholder="Organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="edit-org-slug" className="block text-xs font-semibold text-charcoal/80">
              Slug
            </label>
            <span className="text-[11px] text-muted font-medium">Read-only</span>
          </div>
          <input
            id="edit-org-slug"
            className={`${FORM_FIELD_CLASS} bg-surface/60 text-muted cursor-not-allowed`}
            value={displaySlug}
            readOnly
            disabled
          />
          <p className="mt-1.5 text-xs text-muted">
            The organization slug cannot be changed because it is used for identifiers and system routing.
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <TouchButton
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </TouchButton>
          <TouchButton
            type="button"
            className="flex-1"
            disabled={submitting || !name.trim() || name.trim() === currentName}
            onClick={() => void submit()}
          >
            {submitting ? "Saving…" : "Save changes"}
          </TouchButton>
        </div>
      </div>
    </BottomSheet>
  );
}
