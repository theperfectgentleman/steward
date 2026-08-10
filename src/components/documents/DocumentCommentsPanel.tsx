"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, MessageSquare, X } from "lucide-react";
import { TouchButton } from "@/components/TouchButton";
import { FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { formatDateTime } from "@/lib/dates";

export type DocComment = {
  id: string;
  body: string;
  createdAt: string;
  threadId: string | null;
  parentId: string | null;
  anchorMarkId: string | null;
  anchorText: string | null;
  resolvedAt: string | null;
  author: { id: string; name: string };
  resolvedBy?: { id: string; name: string } | null;
};

type Thread = {
  threadId: string;
  anchorText: string | null;
  resolved: boolean;
  comments: DocComment[];
};

export function DocumentCommentsPanel({
  documentId,
  canComment,
  activeThreadId,
  pendingAnchorText,
  onClearPending,
  onThreadCreated,
  onSelectThread,
  onClose,
  mobileSheet,
}: {
  documentId: string;
  canComment: boolean;
  activeThreadId: string | null;
  pendingAnchorText: string | null;
  onClearPending: () => void;
  onThreadCreated: (threadId: string, anchorText: string) => void;
  onSelectThread: (threadId: string | null) => void;
  onClose?: () => void;
  mobileSheet?: boolean;
}) {
  const [comments, setComments] = useState<DocComment[]>([]);
  const [body, setBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(() => {
    fetch(
      `/api/comments?entityType=LIBRARY_DOCUMENT&entityId=${documentId}&anchored=1`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setComments(data);
      })
      .catch(() => undefined);
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const threads: Thread[] = useMemo(() => {
    const map = new Map<string, Thread>();
    for (const c of comments) {
      const tid = c.threadId || c.id;
      if (!map.has(tid)) {
        map.set(tid, {
          threadId: tid,
          anchorText: c.anchorText,
          resolved: Boolean(c.resolvedAt),
          comments: [],
        });
      }
      const t = map.get(tid)!;
      if (c.anchorText) t.anchorText = c.anchorText;
      if (c.resolvedAt) t.resolved = true;
      t.comments.push(c);
    }
    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.comments[0]?.createdAt ?? "";
      const bTime = b.comments[0]?.createdAt ?? "";
      return bTime.localeCompare(aTime);
    });
  }, [comments]);

  const visible = threads.filter((t) => (showResolved ? true : !t.resolved));

  const createThread = async () => {
    if (!body.trim() || !pendingAnchorText || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          entityType: "LIBRARY_DOCUMENT",
          entityId: documentId,
          anchorMarkId: "pending",
          anchorText: pendingAnchorText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const threadId = data.threadId || data.id;
        onThreadCreated(threadId, pendingAnchorText);
        setBody("");
        onClearPending();
        onSelectThread(threadId);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const reply = async (threadId: string) => {
    if (!replyBody.trim() || saving) return;
    setSaving(true);
    try {
      await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: replyBody.trim(),
          entityType: "LIBRARY_DOCUMENT",
          entityId: documentId,
          threadId,
          parentId: threadId,
        }),
      });
      setReplyBody("");
      load();
    } finally {
      setSaving(false);
    }
  };

  const resolve = async (commentId: string, value: boolean) => {
    await fetch("/api/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: commentId, resolve: value }),
    });
    load();
  };

  return (
    <div
      className={`flex h-full flex-col bg-white ${
        mobileSheet
          ? "rounded-t-2xl border-t border-charcoal/15 shadow-lg"
          : "border-l border-charcoal/15"
      }`}
    >
      <div className="flex items-center justify-between border-b border-charcoal/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-charcoal">Comments</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-[11px] font-medium text-muted hover:text-charcoal"
            onClick={() => setShowResolved((v) => !v)}
          >
            {showResolved ? "Hide resolved" : "Show resolved"}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted hover:bg-charcoal/5"
              aria-label="Close comments"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {pendingAnchorText && canComment && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-xs text-muted">
              Commenting on:{" "}
              <span className="font-medium text-charcoal">
                “{pendingAnchorText.slice(0, 120)}
                {pendingAnchorText.length > 120 ? "…" : ""}”
              </span>
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Add your comment…"
              className={FORM_TEXTAREA_CLASS}
            />
            <div className="flex gap-2">
              <TouchButton
                size="md"
                disabled={saving || !body.trim()}
                onClick={createThread}
              >
                Post
              </TouchButton>
              <TouchButton size="md" variant="secondary" onClick={onClearPending}>
                Cancel
              </TouchButton>
            </div>
          </div>
        )}

        {visible.length === 0 && !pendingAnchorText && (
          <p className="text-sm text-muted">
            Select text in the document and tap the comment button to start a
            thread.
          </p>
        )}

        {visible.map((thread) => (
          <button
            key={thread.threadId}
            type="button"
            onClick={() =>
              onSelectThread(
                activeThreadId === thread.threadId ? null : thread.threadId,
              )
            }
            className={`w-full text-left rounded-xl border p-3 transition-colors ${
              activeThreadId === thread.threadId
                ? "border-primary/40 bg-primary/5"
                : "border-charcoal/10 bg-white hover:bg-slate-50"
            } ${thread.resolved ? "opacity-60" : ""}`}
          >
            {thread.anchorText && (
              <p className="mb-2 border-l-2 border-amber-400 pl-2 text-xs italic text-muted line-clamp-2">
                {thread.anchorText}
              </p>
            )}
            {thread.comments.map((c) => (
              <div key={c.id} className="mb-2 last:mb-0">
                <p className="text-sm text-charcoal">{c.body}</p>
                <p className="text-[11px] text-muted mt-1">
                  {c.author.name} · {formatDateTime(c.createdAt)}
                </p>
              </div>
            ))}
            {activeThreadId === thread.threadId && (
              <div
                className="mt-2 space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                {canComment && !thread.resolved && (
                  <>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={2}
                      placeholder="Reply…"
                      className={FORM_TEXTAREA_CLASS}
                    />
                    <div className="flex flex-wrap gap-2">
                      <TouchButton
                        size="md"
                        disabled={saving || !replyBody.trim()}
                        onClick={() => reply(thread.threadId)}
                      >
                        Reply
                      </TouchButton>
                      <TouchButton
                        size="md"
                        variant="secondary"
                        onClick={() =>
                          resolve(thread.comments[0]!.id, true)
                        }
                      >
                        <Check className="h-3.5 w-3.5 mr-1 inline" />
                        Resolve
                      </TouchButton>
                    </div>
                  </>
                )}
                {thread.resolved && (
                  <TouchButton
                    size="md"
                    variant="secondary"
                    onClick={() => resolve(thread.comments[0]!.id, false)}
                  >
                    Reopen
                  </TouchButton>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
