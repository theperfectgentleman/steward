"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Inbox, Lightbulb, MessageSquarePlus } from "lucide-react";
import { TouchButton } from "@/components/TouchButton";
import { SearchableCommitteeSelect } from "@/components/SearchableCommitteeSelect";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  FEEDBACK_LIMITS,
  FEEDBACK_TYPE_LABELS,
  type FeedbackType,
} from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";
import { FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { canReviewFeedback } from "@/lib/types";

type Committee = {
  id: string;
  charterLetter: string;
  name: string;
};

type FeedbackItem = {
  id: string;
  type: FeedbackType;
  message: string;
  status: "PENDING" | "REVIEWED" | "DISMISSED";
  createdAt: string;
  user: { name: string; email: string };
  committee: { id: string; name: string; charterLetter: string };
};

type StatusFilter = "all" | "pending" | "reviewed" | "dismissed";

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
        active
          ? "bg-primary text-white"
          : "bg-white border border-charcoal/15 text-charcoal hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

function TypeToggle({
  value,
  onChange,
}: {
  value: FeedbackType;
  onChange: (value: FeedbackType) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-charcoal/15 bg-slate-50/80 p-1">
      {(Object.entries(FEEDBACK_TYPE_LABELS) as [FeedbackType, string][]).map(
        ([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              value === type
                ? "bg-white text-charcoal shadow-xs"
                : "text-muted hover:text-charcoal"
            }`}
          >
            {label}
          </button>
        ),
      )}
    </div>
  );
}

function SuggestionForm({
  committees,
  committeeId,
  fixedCommitteeId,
  onCommitteeChange,
  onSubmitted,
}: {
  committees: Committee[];
  committeeId: string;
  fixedCommitteeId?: string;
  onCommitteeChange: (id: string) => void;
  onSubmitted: () => void;
}) {
  const [type, setType] = useState<FeedbackType>("SUGGESTION");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState("");

  const charsLeft = FEEDBACK_LIMITS.maxMessageLength - message.length;
  const canSubmit =
    message.trim().length >= FEEDBACK_LIMITS.minMessageLength &&
    committeeId &&
    submitState !== "submitting";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitState("submitting");
    setSubmitError("");

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
        setSubmitState("error");
        setSubmitError(data.error ?? "Could not submit. Please try again.");
        return;
      }

      setSubmitState("success");
      setMessage("");
      onSubmitted();
    } catch {
      setSubmitState("error");
      setSubmitError("Network error. Please try again.");
    }
  };

  if (submitState === "success") {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-6 text-center space-y-4">
        <p className="text-lg font-bold text-charcoal">Thank you!</p>
        <p className="text-sm text-muted">
          Your {FEEDBACK_TYPE_LABELS[type].toLowerCase()} was sent for review.
        </p>
        <TouchButton className="w-full" onClick={() => setSubmitState("idle")}>
          Send another
        </TouchButton>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-charcoal/10 bg-white p-5 lg:p-6 shadow-xs space-y-5">
      <div className="flex items-center gap-2">
        <MessageSquarePlus className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-charcoal">New suggestion</h2>
      </div>

      <p className="text-sm text-muted leading-relaxed">
        Share an idea or concern with a committee. Limit:{" "}
        {FEEDBACK_LIMITS.maxPerCommitteePerDay} per committee per day.
      </p>

      <div className="hidden" aria-hidden="true">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-charcoal mb-2">Type</p>
        <TypeToggle value={type} onChange={setType} />
      </div>

      {!fixedCommitteeId && (
        <div>
          <label htmlFor="suggestion-committee" className="text-sm font-semibold text-charcoal">
            Committee
          </label>
          <div className="mt-2">
            <SearchableCommitteeSelect
              id="suggestion-committee"
              committees={committees}
              value={committeeId}
              onChange={onCommitteeChange}
              emptyLabel="Select committee"
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="suggestion-message" className="text-sm font-semibold text-charcoal">
          Message
        </label>
        <textarea
          id="suggestion-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={FEEDBACK_LIMITS.maxMessageLength}
          placeholder="Describe the issue or suggestion clearly…"
          className={FORM_TEXTAREA_CLASS}
        />
        <p
          className={`text-xs mt-1.5 ${charsLeft < 100 ? "text-accent" : "text-muted"}`}
        >
          {message.trim().length < FEEDBACK_LIMITS.minMessageLength
            ? `${FEEDBACK_LIMITS.minMessageLength - message.trim().length} more characters needed`
            : `${charsLeft} characters remaining`}
        </p>
      </div>

      {submitError && (
        <p className="text-sm font-medium text-accent bg-accent/10 rounded-xl p-3">
          {submitError}
        </p>
      )}

      <TouchButton className="w-full" disabled={!canSubmit} onClick={handleSubmit}>
        {submitState === "submitting" ? "Submitting…" : "Submit suggestion"}
      </TouchButton>
    </div>
  );
}

function SuggestionCard({
  item,
  canReview,
  onReview,
  onDismiss,
}: {
  item: FeedbackItem;
  canReview: boolean;
  onReview: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-charcoal/10 bg-white p-4 lg:p-5 shadow-xs space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <span className="text-xs font-bold text-accent uppercase tracking-wide">
            {item.committee.charterLetter}) {item.committee.name}
          </span>
          <p className="text-sm font-semibold text-charcoal">
            {FEEDBACK_TYPE_LABELS[item.type]}
            {canReview ? ` from ${item.user.name}` : ""}
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 ${
            item.status === "PENDING"
              ? "bg-accent/15 text-accent"
              : item.status === "REVIEWED"
                ? "bg-primary/15 text-primary-dark"
                : "bg-charcoal/8 text-muted"
          }`}
        >
          {item.status === "PENDING"
            ? "Pending"
            : item.status === "REVIEWED"
              ? "Reviewed"
              : "Dismissed"}
        </span>
      </div>

      <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
        {item.message}
      </p>

      <time className="text-xs text-muted block">
        {formatDateTime(item.createdAt)}
      </time>

      {canReview && item.status === "PENDING" && (
        <div className="flex gap-2 pt-1">
          <TouchButton size="md" className="flex-1" onClick={() => onReview(item.id)}>
            Mark reviewed
          </TouchButton>
          <TouchButton
            size="md"
            variant="ghost"
            className="flex-1"
            onClick={() => onDismiss(item.id)}
          >
            Dismiss
          </TouchButton>
        </div>
      )}
    </article>
  );
}

export function SuggestionsView() {
  const { user } = useApp();
  const searchParams = useSearchParams();
  const fixedCommitteeId = searchParams.get("committeeId") ?? undefined;

  const perm = user ? toPermissionUser(user) : null;
  const canReview = Boolean(perm && canReviewFeedback(perm));

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [committees, setCommittees] = useState<Committee[]>([]);
  const [committeeId, setCommitteeId] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const qs = fixedCommitteeId ? `?committeeId=${fixedCommitteeId}` : "";
    fetch(`/api/feedback${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else setItems([]);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [fixedCommitteeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const scope =
      user.role === "SUPER_ADMIN" || user.role === "CHURCH_EXECUTIVE"
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
  }, [user, fixedCommitteeId]);

  const updateStatus = async (id: string, status: "REVIEWED" | "DISMISSED") => {
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  };

  const pendingCount = items.filter((i) => i.status === "PENDING").length;
  const reviewedCount = items.filter((i) => i.status === "REVIEWED").length;
  const dismissedCount = items.filter((i) => i.status === "DISMISSED").length;

  const visibleItems = items.filter((item) => {
    if (statusFilter === "pending") return item.status === "PENDING";
    if (statusFilter === "reviewed") return item.status === "REVIEWED";
    if (statusFilter === "dismissed") return item.status === "DISMISSED";
    return true;
  });

  const fixedCommittee = fixedCommitteeId
    ? committees.find((c) => c.id === fixedCommitteeId)
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-charcoal">Suggestions</h1>
        <p className="text-muted mt-1 max-w-2xl">
          {canReview
            ? "Review member ideas and concerns, or submit your own."
            : "Share ideas and concerns with committees. Chairs review submissions before they are acted on."}
        </p>
        {fixedCommittee && (
          <p className="text-sm font-semibold text-primary mt-2">
            {fixedCommittee.charterLetter.toUpperCase()}) {fixedCommittee.name}
          </p>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:items-start">
        <section className="space-y-4 min-w-0 order-2 lg:order-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-bold text-charcoal">
                {canReview ? "Inbox" : "My submissions"}
              </h2>
              {!loading && items.length > 0 && (
                <span className="text-xs text-muted">
                  {canReview && pendingCount > 0
                    ? `${pendingCount} pending · ${items.length} total`
                    : `${items.length} total`}
                </span>
              )}
            </div>

            {canReview && (
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </FilterChip>
                <FilterChip
                  active={statusFilter === "pending"}
                  onClick={() => setStatusFilter("pending")}
                >
                  Pending{pendingCount > 0 ? ` (${pendingCount})` : ""}
                </FilterChip>
                <FilterChip
                  active={statusFilter === "reviewed"}
                  onClick={() => setStatusFilter("reviewed")}
                >
                  Reviewed{reviewedCount > 0 ? ` (${reviewedCount})` : ""}
                </FilterChip>
                {dismissedCount > 0 && (
                  <FilterChip
                    active={statusFilter === "dismissed"}
                    onClick={() => setStatusFilter("dismissed")}
                  >
                    Dismissed ({dismissedCount})
                  </FilterChip>
                )}
              </div>
            )}
          </div>

          {loading && (
            <p className="text-center text-muted py-12 rounded-2xl border border-charcoal/5 bg-white">
              Loading…
            </p>
          )}

          {!loading && visibleItems.length === 0 && (
            <div className="text-center py-12 rounded-2xl border border-charcoal/5 bg-white space-y-2">
              <p className="text-muted">
                {statusFilter === "pending"
                  ? "No pending suggestions."
                  : statusFilter !== "all"
                    ? "Nothing in this filter."
                    : "No suggestions yet."}
              </p>
              {!canReview && (
                <p className="text-sm text-muted">
                  Use the form to send your first suggestion.
                </p>
              )}
            </div>
          )}

          <ul className="space-y-3">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <SuggestionCard
                  item={item}
                  canReview={canReview}
                  onReview={(id) => updateStatus(id, "REVIEWED")}
                  onDismiss={(id) => updateStatus(id, "DISMISSED")}
                />
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 order-1 lg:order-2">
          <SuggestionForm
            committees={committees}
            committeeId={committeeId}
            fixedCommitteeId={fixedCommitteeId}
            onCommitteeChange={setCommitteeId}
            onSubmitted={load}
          />

          <div className="hidden lg:block rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-charcoal">Tips</p>
            </div>
            <ul className="space-y-1.5 text-sm text-muted leading-relaxed list-disc pl-4">
              <li>Be specific about what you want the committee to consider.</li>
              <li>Issues are for problems; suggestions are for ideas.</li>
              <li>Chairs review before anything is acted on.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
