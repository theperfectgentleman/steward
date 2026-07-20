"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileDown, FileText, Link2, Paperclip } from "lucide-react";
import { CommentThread } from "@/components/CommentThread";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TouchButton } from "@/components/TouchButton";
import { FormSelect } from "@/components/FormSelect";
import { SearchableCommitteeSelect } from "@/components/SearchableCommitteeSelect";
import { useApp } from "@/providers/AppProvider";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  DOCUMENT_SOURCE_LABELS,
  LIBRARY_DOCUMENT_TAGS,
  LIBRARY_DOCUMENT_TAG_LABELS,
  type LibraryDocumentTag,
} from "@/lib/documents";
import { buildTextPdf } from "@/lib/pdf";
import { formatDate, formatDateWithWeekday } from "@/lib/dates";
import { canViewAllCommittees } from "@/lib/types";

type LibraryDoc = {
  id: string;
  title: string;
  tag: LibraryDocumentTag;
  source: "UPLOAD" | "CREATED";
  body: string | null;
  fileName: string | null;
  fileUrl: string | null;
  createdAt: string;
  committee: { id: string; name: string; charterLetter: string } | null;
  uploadedBy: { name: string };
};

type Committee = { id: string; name: string; charterLetter: string };

type CreateSource = "CREATED" | "UPLOAD";

export function DocumentsView({
  committeeId: lockedCommitteeId,
  committeeName,
}: {
  /** When set, scopes list/create to this committee workspace. */
  committeeId?: string;
  committeeName?: string;
} = {}) {
  const { user } = useApp();
  const searchParams = useSearchParams();
  const initialTag = searchParams.get("tag");
  const scoped = Boolean(lockedCommitteeId);

  const perm = user ? toPermissionUser(user) : null;
  const isExecutive = perm && canViewAllCommittees(perm);

  const [documents, setDocuments] = useState<LibraryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<LibraryDocumentTag | "ALL">(
    initialTag && LIBRARY_DOCUMENT_TAGS.includes(initialTag as LibraryDocumentTag)
      ? (initialTag as LibraryDocumentTag)
      : "ALL",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [committees, setCommittees] = useState<Committee[]>([]);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<LibraryDocumentTag>("OTHER");
  const [source, setSource] = useState<CreateSource>("CREATED");
  const [body, setBody] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [committeeId, setCommitteeId] = useState<string>(lockedCommitteeId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (lockedCommitteeId) setCommitteeId(lockedCommitteeId);
  }, [lockedCommitteeId]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tagFilter !== "ALL") params.set("tag", tagFilter);
    if (lockedCommitteeId) params.set("committeeId", lockedCommitteeId);
    const qs = params.toString();
    fetch(`/api/documents${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDocuments(data);
        else setDocuments([]);
      })
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [tagFilter, lockedCommitteeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user || scoped) return;
    const scope =
      user.role === "ORG_ADMIN" || user.role === "ORG_PARTICIPANT"
        ? "all"
        : user.id;
    fetch(`/api/committees?scope=${scope}`)
      .then((r) => r.json())
      .then((data: Committee[]) => setCommittees(data))
      .catch(() => setCommittees([]));
  }, [user, scoped]);

  const resetCreate = () => {
    setTitle("");
    setBody("");
    setFileName("");
    setFileUrl("");
    setTag("OTHER");
    setSource("CREATED");
    setCommitteeId(lockedCommitteeId ?? "");
    setCreateError("");
  };

  const handleCreate = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setCreateError("");

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          tag,
          source,
          body: source === "CREATED" ? body : undefined,
          fileName: source === "UPLOAD" ? fileName : undefined,
          fileUrl: source === "UPLOAD" ? fileUrl : undefined,
          committeeId: lockedCommitteeId || committeeId || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setCreateError(data.error ?? "Could not save document.");
        return;
      }
      resetCreate();
      setShowCreate(false);
      load();
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportReport = async () => {
    const res = await fetch("/api/dashboard");
    const data = await res.json();
    const stats = (data.stats ?? []) as {
      charterLetter: string;
      name: string;
      total: number;
      done: number;
      blocked: number;
    }[];
    const pipeline = (data.assignmentPipeline ?? []) as { status: string; _count: number }[];
    const totals = stats.reduce(
      (acc, s) => ({
        total: acc.total + s.total,
        done: acc.done + s.done,
        blocked: acc.blocked + s.blocked,
      }),
      { total: 0, done: 0, blocked: 0 },
    );
    const lines = [
      `Generated: ${formatDateWithWeekday(new Date())}`,
      "",
      "Committee Progress Summary",
      "-------------------------",
      ...stats.map((s) => {
        const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
        return `${s.charterLetter.toUpperCase()}) ${s.name}: ${s.done}/${s.total} complete (${pct}%), ${s.blocked} awaiting`;
      }),
      "",
      `Overall: ${totals.done}/${totals.total} tasks complete, ${totals.blocked} awaiting`,
      "",
      "Assignment Pipeline",
      "-------------------",
      ...pipeline.map((p) => `${p.status.replace(/_/g, " ")}: ${p._count}`),
    ];
    const blob = buildTextPdf("UnityCommit — Monthly Presbytery Report", lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presbytery-report-${new Date().toISOString().slice(0, 7)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (user?.role === "ORG_TECH") {
    return (
      <p className="text-center text-muted py-6">
        Document library is not available for system administrators.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-charcoal">Documents</h1>
          <p className="text-muted mt-0.5 text-sm">
            {scoped
              ? `Reports, policies, and attachments for ${committeeName ?? "this committee"}.`
              : "Org-wide and committee library — reports, policies, and attachments."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!scoped && isExecutive && (
            <TouchButton variant="ghost" onClick={handleExportReport}>
              <FileDown className="h-5 w-5" />
              Export presbytery report
            </TouchButton>
          )}
          <TouchButton onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "Add document"}
          </TouchButton>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-xs space-y-3 max-w-xl">
          <SegmentedControl
            options={[
              { value: "CREATED", label: "Create in Steward" },
              { value: "UPLOAD", label: "Add attachment" },
            ]}
            value={source}
            onChange={(v) => setSource(v as CreateSource)}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className={FORM_FIELD_CLASS}
          />
          <FormSelect
            value={tag}
            onChange={(e) => setTag(e.target.value as LibraryDocumentTag)}
          >
            {LIBRARY_DOCUMENT_TAGS.map((t) => (
              <option key={t} value={t}>
                {LIBRARY_DOCUMENT_TAG_LABELS[t]}
              </option>
            ))}
          </FormSelect>
          {scoped ? (
            <p className="rounded-lg border border-charcoal/10 bg-surface/60 px-3 py-2 text-sm text-muted">
              Saving to {committeeName ?? "this committee"}
            </p>
          ) : (
            <SearchableCommitteeSelect
              committees={committees}
              value={committeeId}
              onChange={setCommitteeId}
              allowEmpty
              emptyLabel="Church-wide (no committee)"
            />
          )}
          {source === "CREATED" ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Write the document content…"
              className={FORM_TEXTAREA_CLASS}
            />
          ) : (
            <>
              <input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="File name (e.g. annual-report.pdf)"
                className={FORM_FIELD_CLASS}
              />
              <input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="Link to file (URL)"
                className={FORM_FIELD_CLASS}
              />
            </>
          )}
          {createError && (
            <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">{createError}</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <TouchButton
              disabled={
                !title.trim() ||
                submitting ||
                (source === "CREATED" ? !body.trim() : !fileName.trim() && !fileUrl.trim())
              }
              onClick={handleCreate}
            >
              {submitting ? "Saving…" : "Save document"}
            </TouchButton>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTagFilter("ALL")}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            tagFilter === "ALL"
              ? "bg-primary text-white"
              : "bg-white border border-charcoal/15 text-charcoal hover:border-primary/40"
          }`}
        >
          All
        </button>
        {LIBRARY_DOCUMENT_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTagFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              tagFilter === t
                ? "bg-primary text-white"
                : "bg-white border border-charcoal/15 text-charcoal hover:border-primary/40"
            }`}
          >
            {LIBRARY_DOCUMENT_TAG_LABELS[t]}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-muted py-6">Loading…</p>}

      {!loading && documents.length === 0 && (
        <p className="text-center text-muted py-6 rounded-xl border border-charcoal/5 bg-white text-sm">
          {scoped
            ? "No documents for this committee yet."
            : "No documents yet. Add a report, policy, or attachment to get started."}
        </p>
      )}

      <ul className="max-w-3xl space-y-1.5">
        {documents.map((doc) => {
          const expanded = expandedId === doc.id;
          const SourceIcon = doc.source === "UPLOAD" ? Paperclip : FileText;
          return (
            <li key={doc.id} className="rounded-xl border border-charcoal/10 bg-white shadow-xs overflow-hidden">
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : doc.id)}
                  className="flex-1 text-left px-3 py-2.5 hover:bg-primary/[0.02] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <SourceIcon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-charcoal text-sm">{doc.title}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-accent bg-accent/10 px-1.5 py-0.5 rounded-md">
                          {LIBRARY_DOCUMENT_TAG_LABELS[doc.tag]}
                        </span>
                        <span className="text-xs text-muted">
                          {DOCUMENT_SOURCE_LABELS[doc.source]}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {!scoped &&
                          (doc.committee
                            ? `${doc.committee.charterLetter.toUpperCase()}) ${doc.committee.name}`
                            : "Church-wide")}
                        {!scoped && " · "}
                        {doc.uploadedBy.name}
                        {" · "}
                        {formatDate(doc.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
                <Link
                  href={`/documents/${doc.id}`}
                  className="shrink-0 px-3 flex items-center text-sm font-semibold text-primary border-l border-charcoal/10 hover:bg-primary/5"
                >
                  Open
                </Link>
              </div>
              {expanded && (
                <div className="border-t border-charcoal/10 px-4 pb-4 space-y-3">
                  {doc.source === "CREATED" && doc.body && (
                    <p className="pt-3 text-sm text-charcoal whitespace-pre-wrap leading-relaxed">
                      {doc.body}
                    </p>
                  )}
                  {doc.source === "UPLOAD" && (
                    <div className="pt-3">
                      {doc.fileName && (
                        <p className="text-sm text-charcoal">{doc.fileName}</p>
                      )}
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary mt-2 hover:underline"
                        >
                          <Link2 className="h-4 w-4" />
                          Open attachment
                        </a>
                      )}
                    </div>
                  )}
                  <CommentThread entityType="LIBRARY_DOCUMENT" entityId={doc.id} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
