"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { TouchButton } from "./TouchButton";
import { useApp } from "@/providers/AppProvider";
import { FEEDBACK_TYPE_LABELS, type FeedbackType } from "@/lib/feedback";
import { formatDateTime } from "@/lib/dates";

type FeedbackItem = {
  id: string;
  type: FeedbackType;
  message: string;
  status: "PENDING" | "REVIEWED" | "DISMISSED";
  createdAt: string;
  user: { name: string; email: string };
  committee: { name: string; charterLetter: string };
};

export function FeedbackReviewSheet({
  committeeId: fixedCommitteeId,
  triggerClassName = "",
}: {
  committeeId?: string;
  triggerClassName?: string;
}) {
  const { activeCommitteeId } = useApp();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const scopeId = fixedCommitteeId ?? activeCommitteeId;
    const qs = scopeId ? `?committeeId=${scopeId}` : "";
    fetch(`/api/feedback${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else setItems([]);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedCommitteeId, activeCommitteeId]);

  const updateStatus = async (
    id: string,
    status: "REVIEWED" | "DISMISSED",
  ) => {
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  };

  const pending = items.filter((i) => i.status === "PENDING").length;

  return (
    <>
      <TouchButton
        size="md"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        <Inbox className="h-5 w-5 shrink-0" />
        Review suggestions{pending > 0 ? ` (${pending})` : ""}
      </TouchButton>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Suggestion inbox">
        <div className="space-y-4">
          {loading && (
            <p className="text-center text-muted py-6">Loading…</p>
          )}
          {!loading && items.length === 0 && (
            <p className="text-center text-muted py-6">No feedback yet.</p>
          )}
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border-2 border-charcoal/10 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-xs font-bold text-accent uppercase">
                  {item.committee.charterLetter}) {item.committee.name}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                    item.status === "PENDING"
                      ? "bg-accent/15 text-accent"
                      : item.status === "REVIEWED"
                        ? "bg-primary/20 text-primary-dark"
                        : "bg-charcoal/10 text-muted"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-charcoal">
                {FEEDBACK_TYPE_LABELS[item.type]} from {item.user.name}
              </p>
              <p className="text-sm text-charcoal leading-relaxed">{item.message}</p>
              <time className="text-xs text-muted block">
                {formatDateTime(item.createdAt)}
              </time>
              {item.status === "PENDING" && (
                <div className="flex gap-3 pt-1">
                  <TouchButton
                    className="flex-1"
                    onClick={() => updateStatus(item.id, "REVIEWED")}
                  >
                    Mark Reviewed
                  </TouchButton>
                  <TouchButton
                    variant="ghost"
                    className="flex-1"
                    onClick={() => updateStatus(item.id, "DISMISSED")}
                  >
                    Dismiss
                  </TouchButton>
                </div>
              )}
            </article>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
