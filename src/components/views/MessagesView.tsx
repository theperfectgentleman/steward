"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageSquarePlus, Send, X } from "lucide-react";
import { TouchButton } from "@/components/TouchButton";
import { PageShimmer } from "@/components/loading/PageShimmer";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { formatDateTime } from "@/lib/dates";
import { useApp } from "@/providers/AppProvider";
import type { MessageThreadKind } from "@/lib/types";

type Participant = { id: string; name: string; lastReadAt?: string | null };
type LastMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string };
};

type ThreadSummary = {
  id: string;
  kind: MessageThreadKind;
  subject: string | null;
  committee: { id: string; name: string; charterLetter: string | null } | null;
  participants: Participant[];
  lastMessage: LastMessage | null;
  unread: boolean;
  updatedAt: string;
};

type ThreadDetail = {
  id: string;
  kind: MessageThreadKind;
  subject: string | null;
  committee: { id: string; name: string; charterLetter: string | null } | null;
  participants: Participant[];
  messages: {
    id: string;
    body: string;
    createdAt: string;
    sender: { id: string; name: string };
  }[];
};

type OrgUser = { id: string; name: string };
type CommitteeOption = { id: string; name: string; charterLetter: string | null };

function threadTitle(
  thread: {
    kind: MessageThreadKind;
    subject: string | null;
    committee: { name: string } | null;
    participants: { id: string; name: string }[];
  },
  currentUserId: string,
) {
  if (thread.subject?.trim()) return thread.subject.trim();
  if (thread.kind === "COMMITTEE" && thread.committee) {
    return thread.committee.name;
  }
  const others = thread.participants.filter((p) => p.id !== currentUserId);
  if (others.length === 0) return "Conversation";
  return others.map((p) => p.name).join(", ");
}

function previewBody(body: string) {
  const trimmed = body.trim();
  return trimmed.length > 70 ? `${trimmed.slice(0, 70)}…` : trimmed;
}

export function MessagesView() {
  const { user } = useApp();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeKind, setComposeKind] = useState<"DIRECT" | "COMMITTEE">("DIRECT");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedCommitteeId, setSelectedCommitteeId] = useState("");
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [committees, setCommittees] = useState<CommitteeOption[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(() => {
    return fetch("/api/messages")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setThreads(data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadThreads().finally(() => setLoading(false));
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(
            data
              .filter((u: OrgUser) => u.id !== user?.id)
              .map((u: OrgUser) => ({ id: u.id, name: u.name })),
          );
        }
      })
      .catch(() => undefined);
    fetch("/api/committees")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCommittees(data);
      })
      .catch(() => undefined);
  }, [loadThreads, user?.id]);

  const openThread = useCallback(async (threadId: string) => {
    setComposeOpen(false);
    setActiveThreadId(threadId);
    setDetailLoading(true);
    setDetail(null);
    setReply("");
    try {
      const res = await fetch(`/api/messages/${threadId}`);
      const data = await res.json();
      if (res.ok) {
        setDetail(data);
        await fetch(`/api/messages/${threadId}`, { method: "PATCH" });
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, unread: false } : t)),
        );
      }
    } catch {
      /* ignore */
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeThread = () => {
    setActiveThreadId(null);
    setDetail(null);
    setReply("");
    loadThreads();
  };

  const resetCompose = () => {
    setComposeSubject("");
    setComposeBody("");
    setSelectedUserId("");
    setSelectedCommitteeId("");
    setComposeKind("DIRECT");
  };

  const startCompose = () => {
    setActiveThreadId(null);
    setDetail(null);
    setComposeOpen(true);
  };

  const sendReply = async () => {
    if (!activeThreadId || !reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/messages/${activeThreadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const message = await res.json();
      if (res.ok) {
        setDetail((prev) =>
          prev ? { ...prev, messages: [...prev.messages, message] } : prev,
        );
        setReply("");
        loadThreads();
      }
    } finally {
      setSending(false);
    }
  };

  const createThread = async () => {
    if (sending) return;
    if (composeKind === "DIRECT" && !selectedUserId) return;
    if (composeKind === "COMMITTEE" && !selectedCommitteeId) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: composeKind,
          subject: composeSubject.trim() || undefined,
          participantUserIds:
            composeKind === "DIRECT" ? [selectedUserId] : undefined,
          committeeId:
            composeKind === "COMMITTEE" ? selectedCommitteeId : undefined,
          body: composeBody.trim() || undefined,
        }),
      });
      const thread = await res.json();
      if (res.ok) {
        setComposeOpen(false);
        resetCompose();
        await loadThreads();
        openThread(thread.id);
      }
    } finally {
      setSending(false);
    }
  };

  const currentUserId = user?.id ?? "";

  const headerTitle = useMemo(() => {
    if (!detail) return "Messages";
    return threadTitle(detail, currentUserId);
  }, [detail, currentUserId]);

  if (loading) return <PageShimmer variant="list" lines={6} />;

  const threadList = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-charcoal/8 px-3 py-2.5">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-accent">
          Conversations
        </h2>
        <button
          type="button"
          onClick={startCompose}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          New
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted">
            No conversations yet.
          </p>
        ) : (
          <ul className="divide-y divide-charcoal/5">
            {threads.map((t) => {
              const active = t.id === activeThreadId && !composeOpen;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openThread(t.id)}
                    className={`w-full px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-primary/10"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={`truncate text-sm leading-snug ${
                            t.unread || active
                              ? "font-semibold text-charcoal"
                              : "font-medium text-charcoal"
                          }`}
                        >
                          {threadTitle(t, currentUserId)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {t.lastMessage
                            ? `${t.lastMessage.sender.name}: ${previewBody(t.lastMessage.body)}`
                            : "No messages yet"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {t.unread && (
                          <span className="mb-0.5 inline-block h-2 w-2 rounded-full bg-primary" />
                        )}
                        <p className="text-[10px] text-muted">
                          {t.lastMessage
                            ? formatDateTime(t.lastMessage.createdAt)
                            : formatDateTime(t.updatedAt)}
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

  const composePanel = (
    <section className="flex h-full min-h-0 flex-col p-4" aria-labelledby="new-message-heading">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 id="new-message-heading" className="text-base font-bold text-charcoal">
          New message
        </h2>
        <button
          type="button"
          onClick={() => {
            resetCompose();
            setComposeOpen(false);
          }}
          className="touch-target rounded-lg text-muted hover:bg-slate-50 hover:text-charcoal"
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-w-lg space-y-3">
        <div className="inline-flex rounded-lg border border-charcoal/15 bg-slate-50/80 p-0.5">
          {(
            [
              ["DIRECT", "Member"],
              ["COMMITTEE", "Committee"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => setComposeKind(kind)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                composeKind === kind
                  ? "bg-white text-charcoal shadow-xs"
                  : "text-muted hover:text-charcoal"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {composeKind === "DIRECT" ? (
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className={FORM_FIELD_CLASS}
          >
            <option value="">Select member…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={selectedCommitteeId}
            onChange={(e) => setSelectedCommitteeId(e.target.value)}
            className={FORM_FIELD_CLASS}
          >
            <option value="">Select committee…</option>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>
                {c.charterLetter ? `${c.charterLetter} · ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        )}

        <input
          value={composeSubject}
          onChange={(e) => setComposeSubject(e.target.value)}
          placeholder="Subject (optional)"
          className={FORM_FIELD_CLASS}
        />
        <textarea
          value={composeBody}
          onChange={(e) => setComposeBody(e.target.value)}
          placeholder="First message (optional)"
          rows={4}
          className={FORM_TEXTAREA_CLASS}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <TouchButton
            variant="secondary"
            onClick={() => {
              resetCompose();
              setComposeOpen(false);
            }}
          >
            Cancel
          </TouchButton>
          <TouchButton
            onClick={createThread}
            disabled={
              sending ||
              (composeKind === "DIRECT" ? !selectedUserId : !selectedCommitteeId)
            }
          >
            Start conversation
          </TouchButton>
        </div>
      </div>
    </section>
  );

  const conversationPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-charcoal/8 px-3 py-2.5">
        <button
          type="button"
          onClick={closeThread}
          className="touch-target inline-flex items-center justify-center rounded-lg border border-charcoal/10 bg-white p-1.5 text-charcoal hover:border-charcoal/20 lg:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-charcoal">{headerTitle}</h2>
          {detail?.participants && (
            <p className="truncate text-[11px] text-muted">
              {detail.participants.map((p) => p.name).join(", ")}
            </p>
          )}
        </div>
      </div>

      {detailLoading || !detail ? (
        <div className="p-3">
          <PageShimmer variant="list" lines={4} />
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
            {detail.messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                No messages yet. Say hello.
              </p>
            ) : (
              detail.messages.map((m) => {
                const mine = m.sender.id === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-xl px-3 py-2 ${
                        mine
                          ? "bg-primary text-white"
                          : "border border-charcoal/10 bg-slate-50 text-charcoal"
                      }`}
                    >
                      {!mine && (
                        <p className="mb-0.5 text-[11px] font-semibold opacity-80">
                          {m.sender.name}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-snug">{m.body}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          mine ? "text-white/70" : "text-muted"
                        }`}
                      >
                        {formatDateTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-end gap-2 border-t border-charcoal/8 p-3">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a message…"
              rows={2}
              className={`${FORM_TEXTAREA_CLASS} min-h-[44px]`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendReply();
                }
              }}
            />
            <TouchButton
              onClick={sendReply}
              disabled={!reply.trim() || sending}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
              Send
            </TouchButton>
          </div>
        </>
      )}
    </div>
  );

  const emptyPanel = (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted">
        Select a conversation or start a new one.
      </p>
      <TouchButton onClick={startCompose}>
        <MessageSquarePlus className="h-4 w-4" />
        New message
      </TouchButton>
    </div>
  );

  const showDetailOnMobile = Boolean(activeThreadId || composeOpen);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-bold text-charcoal">Messages</h1>
        <p className="mt-0.5 text-sm text-muted">
          Direct and committee conversations in your organization
        </p>
      </div>

      <div className="grid min-h-[min(70vh,720px)] overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-xs lg:grid-cols-[minmax(280px,380px)_1fr] xl:grid-cols-[minmax(320px,420px)_1fr]">
        {/* List — always on desktop; alone on mobile when not in thread/compose */}
        <aside
          className={`min-h-0 border-charcoal/8 lg:border-r ${
            showDetailOnMobile ? "hidden lg:flex lg:flex-col" : "flex flex-col"
          }`}
        >
          {threadList}
        </aside>

        {/* Detail / compose — always on desktop; alone on mobile when active */}
        <main
          className={`min-h-0 min-w-0 ${
            showDetailOnMobile ? "flex flex-col" : "hidden lg:flex lg:flex-col"
          }`}
        >
          {composeOpen
            ? composePanel
            : activeThreadId
              ? conversationPanel
              : emptyPanel}
        </main>
      </div>
    </div>
  );
}
