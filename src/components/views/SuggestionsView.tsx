"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MessageSquarePlus, Send, X } from "lucide-react";
import { TouchButton } from "@/components/TouchButton";
import { SearchableCommitteeSelect } from "@/components/SearchableCommitteeSelect";
import { PageShimmer } from "@/components/loading/PageShimmer";
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
type PaneMode = "empty" | "compose" | "detail";

function previewMessage(body: string) {
  const trimmed = body.trim();
  return trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed;
}

function statusLabel(status: FeedbackItem["status"]) {
  if (status === "PENDING") return "Pending";
  if (status === "REVIEWED") return "Reviewed";
  return "Dismissed";
}

function statusTone(status: FeedbackItem["status"]) {
  if (status === "PENDING") return "bg-accent/15 text-accent";
  if (status === "REVIEWED") return "bg-primary/15 text-primary-dark";
  return "bg-charcoal/8 text-muted";
}

function TypeToggle({
  value,
  onChange,
}: {
  value: FeedbackType;
  onChange: (value: FeedbackType) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-charcoal/15 bg-slate-50/80 p-0.5">
      {(Object.entries(FEEDBACK_TYPE_LABELS) as [FeedbackType, string][]).map(
        ([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pane, setPane] = useState<PaneMode>("empty");

  const [type, setType] = useState<FeedbackType>("SUGGESTION");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState("");

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
      user.role === "ORG_ADMIN" || user.role === "ORG_PARTICIPANT"
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

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (statusFilter === "pending") return item.status === "PENDING";
        if (statusFilter === "reviewed") return item.status === "REVIEWED";
        if (statusFilter === "dismissed") return item.status === "DISMISSED";
        return true;
      }),
    [items, statusFilter],
  );

  const activeItem = activeId
    ? items.find((i) => i.id === activeId) ?? null
    : null;

  const fixedCommittee = fixedCommitteeId
    ? committees.find((c) => c.id === fixedCommitteeId)
    : null;

  const charsLeft = FEEDBACK_LIMITS.maxMessageLength - message.length;
  const canSubmit =
    message.trim().length >= FEEDBACK_LIMITS.minMessageLength &&
    committeeId &&
    submitState !== "submitting";

  const startCompose = () => {
    setActiveId(null);
    setPane("compose");
    setSubmitState("idle");
    setSubmitError("");
  };

  const openItem = (id: string) => {
    setActiveId(id);
    setPane("detail");
  };

  const closePane = () => {
    setActiveId(null);
    setPane("empty");
  };

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
      load();
    } catch {
      setSubmitState("error");
      setSubmitError("Network error. Please try again.");
    }
  };

  if (loading && items.length === 0) {
    return <PageShimmer variant="list" lines={6} />;
  }

  const listPane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-charcoal/8 px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-accent">
            {canReview ? "Inbox" : "My submissions"}
          </h2>
          {!loading && items.length > 0 && (
            <p className="text-[11px] text-muted">
              {canReview && pendingCount > 0
                ? `${pendingCount} pending · ${items.length} total`
                : `${items.length} total`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={startCompose}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {canReview && (
        <div className="flex flex-wrap gap-1.5 border-b border-charcoal/8 px-3 py-2">
          {(
            [
              ["all", "All"],
              ["pending", "Pending"],
              ["reviewed", "Reviewed"],
              ["dismissed", "Dismissed"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                statusFilter === value
                  ? "bg-primary text-white"
                  : "bg-slate-50 text-muted hover:text-charcoal"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleItems.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted">
            {statusFilter === "pending"
              ? "No pending suggestions."
              : statusFilter !== "all"
                ? "Nothing in this filter."
                : "No suggestions yet."}
          </p>
        ) : (
          <ul className="divide-y divide-charcoal/5">
            {visibleItems.map((item) => {
              const active = item.id === activeId && pane === "detail";
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item.id)}
                    className={`w-full px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-primary/10" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-charcoal leading-snug">
                          {FEEDBACK_TYPE_LABELS[item.type]}
                          {canReview ? ` · ${item.user.name}` : ""}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {!fixedCommitteeId &&
                            `${item.committee.charterLetter}) ${item.committee.name} · `}
                          {previewMessage(item.message)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusTone(item.status)}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                        <p className="mt-1 text-[10px] text-muted">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const composePane = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-charcoal/8 px-3 py-2.5">
        <button
          type="button"
          onClick={closePane}
          className="touch-target inline-flex items-center justify-center rounded-lg border border-charcoal/10 bg-white p-1.5 text-charcoal hover:border-charcoal/20 lg:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-bold text-charcoal">New suggestion</h2>
        <button
          type="button"
          onClick={closePane}
          className="ml-auto hidden touch-target rounded-lg text-muted hover:bg-slate-50 hover:text-charcoal lg:inline-flex"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {submitState === "success" ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-10 text-center">
            <p className="text-base font-bold text-charcoal">Sent for review</p>
            <p className="text-sm text-muted">
              Your {FEEDBACK_TYPE_LABELS[type].toLowerCase()} was submitted.
            </p>
            <div className="flex gap-2">
              <TouchButton variant="secondary" onClick={closePane}>
                Done
              </TouchButton>
              <TouchButton onClick={() => setSubmitState("idle")}>
                Send another
              </TouchButton>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-lg space-y-3">
            <p className="text-sm text-muted">
              Share an idea or concern
              {fixedCommittee
                ? ` with ${fixedCommittee.name}`
                : " with a committee"}
              . Limit: {FEEDBACK_LIMITS.maxPerCommitteePerDay} per committee per
              day.
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
              <p className="mb-1.5 text-xs font-semibold text-charcoal">Type</p>
              <TypeToggle value={type} onChange={setType} />
            </div>

            {!fixedCommitteeId && (
              <div>
                <label
                  htmlFor="suggestion-committee"
                  className="text-xs font-semibold text-charcoal"
                >
                  Committee
                </label>
                <div className="mt-1.5">
                  <SearchableCommitteeSelect
                    id="suggestion-committee"
                    committees={committees}
                    value={committeeId}
                    onChange={setCommitteeId}
                    emptyLabel="Select committee"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="suggestion-message"
                className="text-xs font-semibold text-charcoal"
              >
                Message
              </label>
              <textarea
                id="suggestion-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                maxLength={FEEDBACK_LIMITS.maxMessageLength}
                placeholder="Describe the issue or suggestion clearly…"
                className={`${FORM_TEXTAREA_CLASS} mt-1.5`}
              />
              <p
                className={`mt-1 text-xs ${charsLeft < 100 ? "text-accent" : "text-muted"}`}
              >
                {message.trim().length < FEEDBACK_LIMITS.minMessageLength
                  ? `${FEEDBACK_LIMITS.minMessageLength - message.trim().length} more characters needed`
                  : `${charsLeft} characters remaining`}
              </p>
            </div>

            {submitError && (
              <p className="rounded-lg bg-accent/10 p-2.5 text-sm font-medium text-accent">
                {submitError}
              </p>
            )}
          </div>
        )}
      </div>

      {submitState !== "success" && (
        <div className="flex items-center justify-end gap-2 border-t border-charcoal/8 p-3">
          <TouchButton variant="secondary" onClick={closePane}>
            Cancel
          </TouchButton>
          <TouchButton disabled={!canSubmit} onClick={handleSubmit}>
            <Send className="h-4 w-4" />
            {submitState === "submitting" ? "Sending…" : "Submit"}
          </TouchButton>
        </div>
      )}
    </div>
  );

  const detailPane = activeItem ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-charcoal/8 px-3 py-2.5">
        <button
          type="button"
          onClick={closePane}
          className="touch-target inline-flex items-center justify-center rounded-lg border border-charcoal/10 bg-white p-1.5 text-charcoal hover:border-charcoal/20 lg:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-charcoal">
            {FEEDBACK_TYPE_LABELS[activeItem.type]}
          </h2>
          <p className="truncate text-[11px] text-muted">
            {activeItem.committee.charterLetter}) {activeItem.committee.name}
            {canReview ? ` · ${activeItem.user.name}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusTone(activeItem.status)}`}
        >
          {statusLabel(activeItem.status)}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-charcoal/10 bg-slate-50 px-4 py-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-charcoal">
              {activeItem.message}
            </p>
            <time className="mt-3 block text-[11px] text-muted">
              {formatDateTime(activeItem.createdAt)}
            </time>
          </div>
        </div>
      </div>

      {canReview && activeItem.status === "PENDING" && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-charcoal/8 p-3">
          <TouchButton
            variant="ghost"
            onClick={() => updateStatus(activeItem.id, "DISMISSED")}
          >
            Dismiss
          </TouchButton>
          <TouchButton onClick={() => updateStatus(activeItem.id, "REVIEWED")}>
            Mark reviewed
          </TouchButton>
        </div>
      )}
    </div>
  ) : null;

  const emptyPane = (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted">
        Select a submission or start a new suggestion.
      </p>
      <TouchButton onClick={startCompose}>
        <MessageSquarePlus className="h-4 w-4" />
        New suggestion
      </TouchButton>
    </div>
  );

  const showDetailOnMobile = pane !== "empty";

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-charcoal">Suggestions</h1>
        <p className="mt-0.5 text-sm text-muted">
          {canReview
            ? "Review member ideas and concerns, or submit your own."
            : "Share ideas and concerns with committees."}
        </p>
        {fixedCommittee && (
          <p className="mt-1 text-sm font-semibold text-primary">
            {fixedCommittee.charterLetter.toUpperCase()}) {fixedCommittee.name}
          </p>
        )}
      </div>

      <div className="grid min-h-[min(70vh,720px)] overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-xs lg:grid-cols-[minmax(280px,380px)_1fr] xl:grid-cols-[minmax(320px,420px)_1fr]">
        <aside
          className={`min-h-0 border-charcoal/8 lg:border-r ${
            showDetailOnMobile ? "hidden lg:flex lg:flex-col" : "flex flex-col"
          }`}
        >
          {listPane}
        </aside>

        <main
          className={`min-h-0 min-w-0 ${
            showDetailOnMobile ? "flex flex-col" : "hidden lg:flex lg:flex-col"
          }`}
        >
          {pane === "compose"
            ? composePane
            : pane === "detail"
              ? detailPane
              : emptyPane}
        </main>
      </div>
    </div>
  );
}
