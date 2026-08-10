"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, Sparkles, X, RefreshCw, ListTodo } from "lucide-react";
import { TouchButton } from "@/components/TouchButton";
import { BottomSheet } from "@/components/BottomSheet";

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
};

type WorkDraft = {
  title: string;
  description?: string;
};

export function AiDocumentAssistant({
  documentId,
  documentTitle,
  documentTag,
  committeeId,
  canSuggestWork = false,
  onClose,
  onApplyText,
}: {
  documentId: string;
  documentTitle: string;
  documentTag?: string;
  committeeId?: string | null;
  canSuggestWork?: boolean;
  onClose: () => void;
  onApplyText?: (text: string) => void;
}) {
  const router = useRouter();
  const isTor = documentTag === "TOR";
  const showWorkSuggest = Boolean(canSuggestWork && committeeId);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: isTor
        ? `This is the Terms of Reference for **${documentTitle}**. Paste or edit the TOR, then ask me to suggest Work your committee can take up.`
        : `Hello! I am your AI Document Assistant for **${documentTitle}**. Ask me to summarize this document, analyze spreadsheet formulas, or draft key points.`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<WorkDraft[]>([]);
  const [draftOpen, setDraftOpen] = useState(false);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [workError, setWorkError] = useState("");

  const sendMessage = async (customPrompt?: string) => {
    const promptToSend = customPrompt || input;
    if (!promptToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: promptToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/documents/${documentId}/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToSend.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || "Failed to get AI response");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "ai",
          text: "I encountered an issue processing your request. Please try again.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestWorks = async () => {
    setLoading(true);
    setWorkError("");
    try {
      const res = await fetch(`/api/documents/${documentId}/suggest-works`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkError(data.error ?? "Could not suggest work");
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: "ai",
            text: data.error ?? "Could not suggest work from this document.",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        return;
      }
      const next = (data.drafts ?? []) as WorkDraft[];
      setDrafts(next);
      setDraftOpen(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: `I suggested ${next.length} work item${next.length === 1 ? "" : "s"} from the TOR. Review and accept the ones you want to take up.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch {
      setWorkError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const acceptWorks = async () => {
    if (drafts.length === 0 || savingDrafts) return;
    setSavingDrafts(true);
    setWorkError("");
    try {
      const res = await fetch(`/api/documents/${documentId}/works`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ works: drafts }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWorkError(data.error ?? "Could not create work");
        return;
      }
      setDraftOpen(false);
      setDrafts([]);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "ai",
          text: `Created ${data.created} work item${data.created === 1 ? "" : "s"}. You can open them under Work.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      if (data.tasksHref) {
        router.push(data.tasksHref);
      }
    } catch {
      setWorkError("Network error");
    } finally {
      setSavingDrafts(false);
    }
  };

  return (
    <div className="flex h-full flex-col border-l border-charcoal/15 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-charcoal/10 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2 text-primary font-bold">
          <Bot className="h-5 w-5" />
          <span className="text-sm">
            {isTor ? "TOR assistant" : "AI Document Assistant"}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-charcoal/60 hover:bg-charcoal/10 hover:text-charcoal"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-charcoal/10 bg-surface/60 p-2 text-xs">
        {showWorkSuggest && (
          <button
            type="button"
            onClick={suggestWorks}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <ListTodo className="h-3 w-3" />
            Suggest work
          </button>
        )}
        <button
          type="button"
          onClick={() => sendMessage("Summarize this document")}
          className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          Summarize
        </button>
        {!isTor && (
          <button
            type="button"
            onClick={() => sendMessage("Help with spreadsheet formulas")}
            className="inline-flex items-center gap-1 rounded-full border border-charcoal/15 bg-white px-2.5 py-1 font-medium text-charcoal/80 hover:bg-charcoal/5 transition-colors"
          >
            Formulas help
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                msg.sender === "user"
                  ? "bg-primary text-white"
                  : "bg-surface border border-charcoal/10 text-charcoal"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>
              {msg.sender === "ai" && onApplyText && (
                <button
                  type="button"
                  onClick={() => onApplyText(msg.text)}
                  className="mt-2 text-xs font-semibold text-primary underline hover:text-primary-dark"
                >
                  Insert into document
                </button>
              )}
            </div>
            <span className="mt-1 text-[10px] text-muted">{msg.timestamp}</span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Analyzing document context…
          </div>
        )}
        {workError && (
          <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">
            {workError}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="border-t border-charcoal/10 p-3 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isTor
              ? "Ask about the TOR or request more ideas…"
              : "Ask AI about this document…"
          }
          className="flex-1 rounded-xl border border-charcoal/20 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-40 hover:bg-primary-dark"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      <BottomSheet
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        title="Review suggested work"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Accept items to create Work. Edit or remove any you do not
            want.
          </p>
          {drafts.map((draft, i) => (
            <div key={i} className="space-y-2 p-3 bg-slate-50 rounded-xl">
              <input
                type="text"
                value={draft.title}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...next[i], title: e.target.value };
                  setDrafts(next);
                }}
                className="w-full px-3 py-2 rounded-lg border border-charcoal/10 font-semibold"
              />
              <input
                type="text"
                value={draft.description ?? ""}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...next[i], description: e.target.value };
                  setDrafts(next);
                }}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 rounded-lg border border-charcoal/10 text-sm"
              />
              <button
                type="button"
                onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
                className="text-xs font-bold text-accent"
              >
                Remove
              </button>
            </div>
          ))}
          <TouchButton
            size="lg"
            className="w-full"
            disabled={drafts.length === 0 || savingDrafts}
            onClick={acceptWorks}
          >
            {savingDrafts
              ? "Creating…"
              : `Accept ${drafts.length} as work`}
          </TouchButton>
        </div>
      </BottomSheet>
    </div>
  );
}
