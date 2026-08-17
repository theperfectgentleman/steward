"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { TouchButton } from "@/components/TouchButton";
import { FormSelect } from "@/components/FormSelect";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";

type OrgTemplateId = "blank" | "church" | "board";

export function CreateOrgSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { refreshSession, enterOrganization } = useApp();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [template, setTemplate] = useState<OrgTemplateId>("blank");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setSlug("");
    setTemplate("blank");
    setError("");
  };

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
          template,
        }),
      });
      const data = (await res.json()) as { org?: { id: string }; error?: string };
      if (!res.ok || !data.org) {
        throw new Error(data.error ?? "Could not create organization");
      }
      await refreshSession();
      await enterOrganization(data.org.id);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create organization");
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
      title="Create organization"
    >
      <div className="space-y-4">
        <input
          className={FORM_FIELD_CLASS}
          placeholder="Organization name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={FORM_FIELD_CLASS}
          placeholder="Slug (optional)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <FormSelect
          value={template}
          onChange={(e) => setTemplate(e.target.value as OrgTemplateId)}
        >
          <option value="blank">Blank</option>
          <option value="church">Church template</option>
          <option value="board">Board + committees</option>
        </FormSelect>
        {error && (
          <p className="rounded-xl bg-accent/10 p-3 text-sm text-accent">{error}</p>
        )}
        <TouchButton
          className="w-full"
          disabled={submitting || !name.trim()}
          onClick={() => void submit()}
        >
          {submitting ? "Creating…" : "Create"}
        </TouchButton>
      </div>
    </BottomSheet>
  );
}
