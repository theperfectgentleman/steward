"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { TouchButton } from "@/components/TouchButton";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import {
  DOCUMENT_STATUS_LABELS,
  LIBRARY_DOCUMENT_TAG_LABELS,
  LINK_RELATIONS,
  defaultLinkRelation,
  linkRelationDisplayLabel,
  type LibraryDocumentStatus,
  type LibraryDocumentTag,
  type LinkRelation,
} from "@/lib/documents";

export type DocumentLinkRow = {
  id: string;
  entityType: string;
  entityId: string;
  relation?: LinkRelation;
  linkKind?: string;
  direction?: "outgoing" | "incoming";
  href?: string | null;
  title?: string | null;
  tag?: LibraryDocumentTag | null;
  status?: LibraryDocumentStatus | null;
};

type DocOption = {
  id: string;
  title: string;
  tag: LibraryDocumentTag;
  status?: LibraryDocumentStatus;
};

type LinkTarget = "document" | "task";

export function DocumentLinksPanel({
  documentId,
  links,
  canManageLinks,
  onLinksChange,
  onClose,
}: {
  documentId: string;
  links: DocumentLinkRow[];
  canManageLinks: boolean;
  onLinksChange: (links: DocumentLinkRow[]) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<LinkTarget>("document");
  const [relation, setRelation] = useState<LinkRelation>(
    defaultLinkRelation("LIBRARY_DOCUMENT"),
  );
  const [taskId, setTaskId] = useState("");
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DocOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocOption | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const linkedDocIds = new Set(
    links
      .filter((l) => l.linkKind === "LIBRARY_DOCUMENT" || l.entityType === "LIBRARY_DOCUMENT")
      .map((l) => l.entityId),
  );

  const refresh = useCallback(async () => {
    const list = await fetch(`/api/documents/${documentId}/links`).then((r) =>
      r.json(),
    );
    if (Array.isArray(list)) onLinksChange(list);
  }, [documentId, onLinksChange]);

  useEffect(() => {
    if (target !== "document") return;
    const q = query.trim();
    if (q.length < 1) {
      setOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      const params = new URLSearchParams({ q });
      fetch(`/api/documents?${params}`)
        .then((r) => r.json())
        .then((data: DocOption[]) => {
          if (!Array.isArray(data)) {
            setOptions([]);
            return;
          }
          setOptions(
            data.filter((d) => d.id !== documentId && !linkedDocIds.has(d.id)),
          );
        })
        .catch(() => setOptions([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(timer);
    // linkedDocIds is derived from links; use links in deps
  }, [query, target, documentId, links]);

  useEffect(() => {
    setRelation(
      defaultLinkRelation(target === "document" ? "LIBRARY_DOCUMENT" : "TASK"),
    );
    setSelectedDoc(null);
    setTaskId("");
    setQuery("");
    setError("");
  }, [target]);

  const addLink = async () => {
    if (!canManageLinks || saving) return;
    setError("");
    setSaving(true);
    try {
      const payload =
        target === "document"
          ? {
              entityType: "LIBRARY_DOCUMENT",
              entityId: selectedDoc?.id,
              relation,
            }
          : {
              entityType: "TASK",
              entityId: taskId.trim(),
              relation,
            };

      if (!payload.entityId) {
        setError(
          target === "document"
            ? "Select a document to link."
            : "Enter a task ID.",
        );
        return;
      }

      const res = await fetch(`/api/documents/${documentId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add link.");
        return;
      }
      setSelectedDoc(null);
      setQuery("");
      setTaskId("");
      await refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async (linkId: string) => {
    if (!canManageLinks) return;
    await fetch(`/api/documents/${documentId}/links?linkId=${linkId}`, {
      method: "DELETE",
    });
    await refresh();
  };

  const related = links.filter(
    (l) =>
      l.linkKind === "LIBRARY_DOCUMENT" || l.entityType === "LIBRARY_DOCUMENT",
  );
  const other = links.filter(
    (l) =>
      l.linkKind !== "LIBRARY_DOCUMENT" && l.entityType !== "LIBRARY_DOCUMENT",
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Links</h2>
        <button type="button" onClick={onClose} className="text-xs text-muted">
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Related documents
          </p>
          {related.length === 0 ? (
            <p className="text-sm text-muted">
              No related documents yet. Link briefs, reports, or appendices here.
            </p>
          ) : (
            <ul className="space-y-2">
              {related.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-charcoal/10 px-3 py-2"
                >
                  <Link
                    href={l.href || `/documents/${l.entityId}`}
                    className="min-w-0 flex-1 hover:text-primary"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {l.title || "Untitled document"}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          {l.tag
                            ? LIBRARY_DOCUMENT_TAG_LABELS[l.tag]
                            : "Document"}
                          {l.relation
                            ? ` · ${linkRelationDisplayLabel(
                                l.relation,
                                "LIBRARY_DOCUMENT",
                              )}`
                            : ""}
                          {l.direction === "incoming" ? " · linked here" : ""}
                          {l.status
                            ? ` · ${DOCUMENT_STATUS_LABELS[l.status]}`
                            : ""}
                        </span>
                      </span>
                    </span>
                  </Link>
                  {canManageLinks && (
                    <button
                      type="button"
                      className="shrink-0 text-xs text-accent"
                      onClick={() => removeLink(l.id)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Tasks & events
          </p>
          {other.length === 0 ? (
            <p className="text-sm text-muted">No linked tasks or events.</p>
          ) : (
            <ul className="space-y-2">
              {other.map((l) => {
                const isEvent =
                  l.linkKind === "EVENT" || l.entityId.startsWith("event:");
                const kindLabel = isEvent ? "Event" : "Task";
                return (
                  <li
                    key={l.id}
                    className="flex items-center justify-between rounded-xl border border-charcoal/10 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {l.title || l.entityId.replace(/^event:/, "")}
                      </p>
                      <p className="text-[11px] text-muted">
                        {kindLabel}
                        {l.relation
                          ? ` · ${linkRelationDisplayLabel(
                              l.relation,
                              isEvent ? "EVENT" : "TASK",
                            )}`
                          : ""}
                      </p>
                    </div>
                    {canManageLinks && (
                      <button
                        type="button"
                        className="text-xs text-accent"
                        onClick={() => removeLink(l.id)}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canManageLinks && (
          <div className="space-y-2 border-t border-charcoal/10 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Add link
            </p>
            <div className="flex gap-1 rounded-xl bg-surface p-1">
              {(
                [
                  ["document", "Document"],
                  ["task", "Task"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTarget(key)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                    target === key
                      ? "bg-white text-charcoal shadow-sm"
                      : "text-muted hover:text-charcoal"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {target === "document" ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    className={`${FORM_FIELD_CLASS} pl-10`}
                    placeholder="Search documents by title…"
                    value={selectedDoc ? selectedDoc.title : query}
                    onChange={(e) => {
                      setSelectedDoc(null);
                      setQuery(e.target.value);
                    }}
                  />
                </div>
                {selectedDoc && (
                  <p className="text-xs text-primary font-medium">
                    Selected: {selectedDoc.title}
                  </p>
                )}
                {!selectedDoc && query.trim() && (
                  <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-charcoal/10">
                    {searching && (
                      <li className="px-3 py-2 text-xs text-muted">Searching…</li>
                    )}
                    {!searching && options.length === 0 && (
                      <li className="px-3 py-2 text-xs text-muted">
                        No matching documents.
                      </li>
                    )}
                    {options.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50"
                          onClick={() => {
                            setSelectedDoc(d);
                            setQuery("");
                            setOptions([]);
                          }}
                        >
                          <span className="text-sm font-medium">{d.title}</span>
                          <span className="text-[11px] text-muted">
                            {LIBRARY_DOCUMENT_TAG_LABELS[d.tag]}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <input
                className={FORM_FIELD_CLASS}
                placeholder="Task ID to link…"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              />
            )}

            <select
              className={FORM_FIELD_CLASS}
              value={relation}
              onChange={(e) => setRelation(e.target.value as LinkRelation)}
              aria-label="Link relation"
            >
              {LINK_RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {linkRelationDisplayLabel(
                    r,
                    target === "document" ? "LIBRARY_DOCUMENT" : "TASK",
                  )}
                  {r ===
                  defaultLinkRelation(
                    target === "document" ? "LIBRARY_DOCUMENT" : "TASK",
                  )
                    ? " (default)"
                    : ""}
                </option>
              ))}
            </select>

            {error && (
              <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">
                {error}
              </p>
            )}

            <TouchButton
              size="md"
              className="w-full"
              disabled={
                saving ||
                (target === "document" ? !selectedDoc : !taskId.trim())
              }
              onClick={addLink}
            >
              {saving ? "Linking…" : "Add link"}
            </TouchButton>
          </div>
        )}
      </div>
    </div>
  );
}
