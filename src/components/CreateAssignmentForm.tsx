"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TouchButton } from "@/components/TouchButton";
import { FormSelect } from "@/components/FormSelect";
import { SearchableCommitteeSelect } from "@/components/SearchableCommitteeSelect";
import { DateInput } from "@/components/DateInput";
import {
  RichTextEditor,
  normalizeRichText,
} from "@/components/RichTextEditor";
import { useApp } from "@/providers/AppProvider";
import type { AssignmentPriority } from "@/lib/types";
import { assignmentPath } from "@/lib/navigation";
import { FORM_FIELD_CLASS } from "@/lib/form-field";

const fieldClass = FORM_FIELD_CLASS;

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-semibold text-charcoal mb-2"
    >
      {children}
    </label>
  );
}

export function CreateAssignmentForm({
  onSuccess,
  showDraft = true,
  embedded = false,
}: {
  onSuccess?: (assignmentId?: string) => void;
  showDraft?: boolean;
  embedded?: boolean;
}) {
  const { refreshAttention } = useApp();
  const router = useRouter();
  const [committees, setCommittees] = useState<
    { id: string; name: string; charterLetter: string }[]
  >([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetCommitteeId, setTargetCommitteeId] = useState("");
  const [priority, setPriority] = useState<AssignmentPriority>("NORMAL");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/committees?scope=all")
      .then((r) => r.json())
      .then(setCommittees)
      .catch(() => undefined);
  }, []);

  const submit = async (asDraft: boolean) => {
    if (!title.trim() || !targetCommitteeId || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: normalizeRichText(description),
          source: "PRESBYTERY",
          targetCommitteeId,
          priority,
          dueDate: dueDate || undefined,
          status: asDraft ? "DRAFT" : "ASSIGNED",
        }),
      });
      const data = (await res.json()) as { id?: string };
      setTitle("");
      setDescription("");
      setTargetCommitteeId("");
      setDueDate("");
      refreshAttention();
      onSuccess?.(data.id);
      if (data.id && !asDraft) {
        router.push(assignmentPath(data.id));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const shellClass = embedded
    ? "space-y-4 p-1"
    : "space-y-6 rounded-2xl border border-charcoal/10 bg-white p-5 lg:p-8 shadow-xs";

  return (
    <div className={shellClass}>
      {!embedded && (
        <div className="border-b border-charcoal/5 pb-5">
          <h2 className="text-lg font-bold text-charcoal">New directive</h2>
          <p className="text-sm text-muted mt-1 leading-relaxed max-w-2xl">
            Draft a directive for a committee. All Presbytery members can assign;
            everyone sees the trail. Distinct from member suggestions and
            chair-to-chair referrals.
          </p>
        </div>
      )}

      {embedded && (
        <p className="text-sm text-muted leading-relaxed">
          Draft a directive for a committee. All Presbytery members can assign;
          everyone sees the trail.
        </p>
      )}

      <div className="space-y-5">
        <div>
          <FieldLabel htmlFor="assignment-title">Title</FieldLabel>
          <input
            id="assignment-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Annual budget review presentation"
            className={fieldClass}
          />
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="What should the committee do? Include context, deliverables, and deadlines."
            minHeight={embedded ? "120px" : "220px"}
            compact={embedded}
          />
        </div>

        <div className={embedded ? "space-y-5" : "grid gap-5 lg:grid-cols-3"}>
          <div className={embedded ? undefined : "lg:col-span-1"}>
            <FieldLabel htmlFor="assignment-committee">Target committee</FieldLabel>
            <SearchableCommitteeSelect
              id="assignment-committee"
              committees={committees}
              value={targetCommitteeId}
              onChange={setTargetCommitteeId}
              emptyLabel="Select committee"
            />
          </div>

          <div>
            <FieldLabel htmlFor="assignment-priority">Priority</FieldLabel>
            <FormSelect
              id="assignment-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as AssignmentPriority)}
            >
              <option value="LOW">Low priority</option>
              <option value="NORMAL">Normal priority</option>
              <option value="HIGH">High priority</option>
            </FormSelect>
          </div>

          <div>
            <FieldLabel htmlFor="assignment-due">Due date</FieldLabel>
            <DateInput
              id="assignment-due"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div
        className={
          embedded
            ? "space-y-3 pt-1"
            : "flex flex-col-reverse sm:flex-row gap-3 pt-2 border-t border-charcoal/5"
        }
      >
        {showDraft && (
          <TouchButton
            variant="secondary"
            className={embedded ? "w-full" : "sm:flex-1"}
            disabled={!title.trim() || !targetCommitteeId || submitting}
            onClick={() => submit(true)}
          >
            Save as draft
          </TouchButton>
        )}
        <TouchButton
          className={embedded ? "w-full" : "sm:flex-[1.4]"}
          disabled={!title.trim() || !targetCommitteeId || submitting}
          onClick={() => submit(false)}
        >
          {submitting ? "Assigning…" : "Assign now"}
        </TouchButton>
      </div>
    </div>
  );
}
