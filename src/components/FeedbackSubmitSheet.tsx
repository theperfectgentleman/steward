"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { SegmentedControl } from "./SegmentedControl";
import { TouchButton } from "./TouchButton";
import { useApp } from "@/providers/AppProvider";
import {
  FEEDBACK_LIMITS,
  FEEDBACK_TYPE_LABELS,
  type FeedbackType,
} from "@/lib/feedback";

type Committee = {
  id: string;
  charterLetter: string;
  name: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function FeedbackSubmitSheet({
  committeeId: fixedCommitteeId,
}: {
  committeeId?: string;
}) {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [committeeId, setCommitteeId] = useState("");
  const [type, setType] = useState<FeedbackType>("SUGGESTION");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const scope = user.role === "SUPER_ADMIN" || user.role === "CHURCH_EXECUTIVE"
      ? "all"
      : user.id;
    fetch(`/api/committees?scope=${scope}`)
      .then((r) => r.json())
      .then((data: Committee[]) => {
        setCommittees(data);
        if (fixedCommitteeId && data.some((c) => c.id === fixedCommitteeId)) {
          setCommitteeId(fixedCommitteeId);
        } else if (data[0]) {
          setCommitteeId(data[0].id);
        }
      })
      .catch(() => setCommittees([]));
  }, [user, fixedCommitteeId, open]);

  const resetForm = () => {
    setType("SUGGESTION");
    setMessage("");
    setHoneypot("");
    setState("idle");
    setError("");
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!committeeId || !message.trim()) return;
    setState("submitting");
    setError("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          committeeId,
          type,
          message,
          website: honeypot,
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setState("error");
        setError(data.error ?? "Could not submit. Please try again.");
        return;
      }

      setState("success");
      setMessage("");
    } catch {
      setState("error");
      setError("Network error. Please try again.");
    }
  };

  const charsLeft = FEEDBACK_LIMITS.maxMessageLength - message.length;
  const canSubmit =
    message.trim().length >= FEEDBACK_LIMITS.minMessageLength &&
    committeeId &&
    state !== "submitting";

  return (
    <>
      <TouchButton
        size="lg"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="h-5 w-5" />
        Report Issue or Suggestion
      </TouchButton>

      <BottomSheet
        open={open}
        onClose={handleClose}
        title="Report to Committee"
      >
        {state === "success" ? (
          <div className="space-y-4 text-center py-4">
            <p className="text-lg font-bold text-charcoal">Thank you!</p>
            <p className="text-muted">
              Your {FEEDBACK_TYPE_LABELS[type].toLowerCase()} was sent to the
              committee for review.
            </p>
            <TouchButton size="lg" className="w-full" onClick={handleClose}>
              Done
            </TouchButton>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted leading-relaxed">
              Share a concern or idea with a committee. Submissions are reviewed
              before being acted on. Limit:{" "}
              {FEEDBACK_LIMITS.maxPerCommitteePerDay} per committee per day.
            </p>

            <div className="hidden" aria-hidden="true">
              <label htmlFor="feedback-website">Website</label>
              <input
                id="feedback-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-charcoal mb-2">Type</p>
              <SegmentedControl
                options={(
                  Object.entries(FEEDBACK_TYPE_LABELS) as [FeedbackType, string][]
                ).map(([value, label]) => ({ value, label }))}
                value={type}
                onChange={setType}
              />
            </div>

            {!fixedCommitteeId && (
            <div>
              <label
                htmlFor="feedback-committee"
                className="text-sm font-semibold text-charcoal"
              >
                Committee
              </label>
              <select
                id="feedback-committee"
                value={committeeId}
                onChange={(e) => setCommitteeId(e.target.value)}
                className="mt-2 w-full input-touch px-4 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none bg-white"
              >
                {committees.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.charterLetter.toUpperCase()}) {c.name}
                  </option>
                ))}
              </select>
            </div>
            )}

            <div>
              <label
                htmlFor="feedback-message"
                className="text-sm font-semibold text-charcoal"
              >
                Message
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={FEEDBACK_LIMITS.maxMessageLength}
                placeholder="Describe the issue or suggestion clearly…"
                className="mt-2 w-full px-4 py-3 rounded-xl border-2 border-charcoal/15 focus:border-primary outline-none text-base resize-none min-h-[120px]"
              />
              <p
                className={`text-xs mt-1 ${charsLeft < 100 ? "text-accent" : "text-muted"}`}
              >
                {message.trim().length < FEEDBACK_LIMITS.minMessageLength
                  ? `${FEEDBACK_LIMITS.minMessageLength - message.trim().length} more characters needed`
                  : `${charsLeft} characters remaining`}
              </p>
            </div>

            {error && (
              <p className="text-sm font-medium text-accent bg-accent/10 rounded-xl p-3">
                {error}
              </p>
            )}

            <TouchButton
              size="lg"
              className="w-full"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {state === "submitting" ? "Submitting…" : "Submit"}
            </TouchButton>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
