"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Link2, Sparkles } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { CommentThread } from "@/components/CommentThread";
import { TouchButton } from "@/components/TouchButton";
import { FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import {
  DOCUMENT_SOURCE_LABELS,
  LIBRARY_DOCUMENT_TAG_LABELS,
  type LibraryDocumentTag,
} from "@/lib/documents";
import { formatDate } from "@/lib/dates";
import { PageShimmer } from "@/components/loading/PageShimmer";

type LibraryDoc = {
  id: string;
  title: string;
  tag: LibraryDocumentTag;
  source: "UPLOAD" | "CREATED";
  body: string | null;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  createdAt: string;
  committee: { id: string; name: string; charterLetter: string } | null;
  uploadedBy: { name: string };
};

function isPdf(doc: LibraryDoc): boolean {
  if (doc.mimeType?.includes("pdf")) return true;
  const name = (doc.fileName ?? doc.fileUrl ?? "").toLowerCase();
  return name.endsWith(".pdf");
}

function DocumentStudioInner({ id }: { id: string }) {
  const [doc, setDoc] = useState<LibraryDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [question, setQuestion] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentPosted, setCommentPosted] = useState(false);
  const [threadKey, setThreadKey] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/documents/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? "Document not found");
          setDoc(null);
          return;
        }
        setDoc(data);
        setError("");
      })
      .catch(() => {
        setError("Failed to load document");
        setDoc(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAi = async (action: "summarize" | "extract" | "ask") => {
    setAiLoading(true);
    setAiError("");
    setCommentPosted(false);
    try {
      const res = await fetch(`/api/documents/${id}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          question: action === "ask" ? question : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "AI request failed");
        return;
      }
      setSuggestion(data.suggestion ?? "");
    } catch {
      setAiError("Network error");
    } finally {
      setAiLoading(false);
    }
  };

  const acceptAsComment = async () => {
    if (!suggestion.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: suggestion.trim(),
          entityType: "LIBRARY_DOCUMENT",
          entityId: id,
        }),
      });
      if (res.ok) {
        setCommentPosted(true);
        setSuggestion("");
        setThreadKey((k) => k + 1);
      } else {
        const data = await res.json();
        setAiError(data.error ?? "Could not post comment");
      }
    } finally {
      setPostingComment(false);
    }
  };

  if (loading) return <PageShimmer variant="detail" />;

  if (error || !doc) {
    return (
      <div className="space-y-4">
        <Link href="/documents" className="text-sm text-primary font-medium">
          ← Documents
        </Link>
        <p className="text-center text-muted py-6">{error || "Not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <div>
        <Link href="/documents" className="text-sm text-primary font-medium">
          ← Documents
        </Link>
        <h1 className="text-xl font-bold text-charcoal mt-2">{doc.title}</h1>
        <p className="text-sm text-muted mt-1">
          {LIBRARY_DOCUMENT_TAG_LABELS[doc.tag]} · {DOCUMENT_SOURCE_LABELS[doc.source]}
          {doc.committee
            ? ` · ${doc.committee.charterLetter.toUpperCase()}) ${doc.committee.name}`
            : " · Church-wide"}
          {" · "}
          {doc.uploadedBy.name}
          {" · "}
          {formatDate(doc.createdAt)}
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-4 lg:items-start space-y-4 lg:space-y-0">
        <div className="space-y-4">
          <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-xs">
            {doc.source === "CREATED" && doc.body ? (
              <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed">
                {doc.body}
              </p>
            ) : doc.fileUrl && isPdf(doc) ? (
              <div className="space-y-3">
                {doc.fileName && (
                  <p className="text-sm font-semibold text-charcoal flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {doc.fileName}
                  </p>
                )}
                <object
                  data={doc.fileUrl}
                  type="application/pdf"
                  className="w-full min-h-[70vh] rounded-xl border border-charcoal/10"
                >
                  <iframe
                    title={doc.title}
                    src={doc.fileUrl}
                    className="w-full min-h-[70vh] rounded-xl border border-charcoal/10"
                  />
                </object>
              </div>
            ) : (
              <div className="space-y-3">
                {doc.fileName && (
                  <p className="text-sm text-charcoal">{doc.fileName}</p>
                )}
                {doc.body && (
                  <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed">
                    {doc.body}
                  </p>
                )}
                {doc.fileUrl && (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    <Link2 className="h-4 w-4" />
                    Open attachment
                  </a>
                )}
                {!doc.body && !doc.fileUrl && (
                  <p className="text-sm text-muted">No content available.</p>
                )}
              </div>
            )}
          </div>

          <CommentThread
            key={threadKey}
            entityType="LIBRARY_DOCUMENT"
            entityId={id}
          />
        </div>

        <aside className="rounded-2xl border border-charcoal/10 bg-white p-4 shadow-xs space-y-4 lg:sticky lg:top-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-charcoal">Document Studio AI</h2>
          </div>
          <p className="text-xs text-muted">
            Suggestions only — nothing is posted until you accept.
          </p>
          <div className="flex flex-wrap gap-2">
            <TouchButton
              size="md"
              variant="secondary"
              disabled={aiLoading}
              onClick={() => runAi("summarize")}
            >
              Summarize
            </TouchButton>
            <TouchButton
              size="md"
              variant="secondary"
              disabled={aiLoading}
              onClick={() => runAi("extract")}
            >
              Risks & actions
            </TouchButton>
          </div>
          <div className="space-y-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              placeholder="Ask a question about this document…"
              className={FORM_TEXTAREA_CLASS}
            />
            <TouchButton
              size="md"
              className="w-full"
              disabled={aiLoading || !question.trim()}
              onClick={() => runAi("ask")}
            >
              Ask
            </TouchButton>
          </div>
          {aiLoading && <p className="text-sm text-muted">Thinking…</p>}
          {aiError && (
            <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{aiError}</p>
          )}
          {suggestion && (
            <div className="space-y-3 border-t border-charcoal/10 pt-3">
              <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed">
                {suggestion}
              </p>
              <TouchButton
                size="md"
                className="w-full"
                disabled={postingComment}
                onClick={acceptAsComment}
              >
                {postingComment ? "Posting…" : "Post as comment"}
              </TouchButton>
            </div>
          )}
          {commentPosted && (
            <p className="text-sm text-primary">Comment posted. Refresh the thread if needed.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

export function DocumentStudioView({ id }: { id: string }) {
  return (
    <AuthGate>
      <DocumentStudioInner id={id} />
    </AuthGate>
  );
}
