"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bot,
  Download,
  ArrowLeft,
  Users,
  MessageSquare,
  History,
  Link2,
  CheckCircle2,
  Send,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { UniverSheetEditor } from "./UniverSheetEditor";
import { AiDocumentAssistant } from "./AiDocumentAssistant";
import {
  CollaborativeDocEditor,
  applyCommentMark,
  type PresencePerson,
} from "@/components/editor/CollaborativeDocEditor";
import { DocumentCommentsPanel } from "@/components/documents/DocumentCommentsPanel";
import { buildTextPdf } from "@/lib/pdf";
import {
  DOCUMENT_ROLE_LABELS,
  DOCUMENT_STATUS_LABELS,
  NATIVE_DOC_KIND_LABELS,
  type DocumentMemberRole,
  type LibraryDocumentStatus,
  type NativeDocKind,
} from "@/lib/documents";
import { formatPresenceSummary } from "@/lib/document-presence";
import { TouchButton } from "@/components/TouchButton";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import { canEditTasks } from "@/lib/types";
import { PeoplePickerField } from "@/components/people/PeoplePickerField";
import {
  DocumentLinksPanel,
  type DocumentLinkRow,
} from "@/components/documents/DocumentLinksPanel";

type Member = {
  id: string;
  userId: string;
  role: DocumentMemberRole;
  user: { id: string; name: string };
};

type DocData = {
  id: string;
  title: string;
  tag?: string;
  kind: NativeDocKind;
  status: LibraryDocumentStatus;
  body: string | null;
  contentJson: Record<string, unknown> | null;
  committee: { id: string; name: string; charterLetter: string } | null;
  uploadedBy: { id?: string; name: string };
  createdAt: string;
  members?: Member[];
  myRole?: DocumentMemberRole | null;
  canEdit?: boolean;
  canComment?: boolean;
  canManage?: boolean;
  canSubmit?: boolean;
  canCompleteReview?: boolean;
  canPublish?: boolean;
  canReturn?: boolean;
  canManageLinks?: boolean;
  /** @deprecated use canPublish */
  canApprove?: boolean;
};

type Panel = "comments" | "people" | "ai" | "history" | "links" | null;

export function UniverEditorContainer({ initialDoc }: { initialDoc: DocData }) {
  const { user } = useApp();
  const [doc, setDoc] = useState<DocData>(initialDoc);
  const [title, setTitle] = useState(initialDoc.title);
  const [body, setBody] = useState(initialDoc.body || "");
  const [contentJson, setContentJson] = useState<Record<string, unknown> | null>(
    initialDoc.contentJson,
  );
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );
  const [panel, setPanel] = useState<Panel>("comments");
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const [pendingRange, setPendingRange] = useState<{ from: number; to: number } | null>(
    null,
  );
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [presence, setPresence] = useState<PresencePerson[]>([]);
  const [syncState, setSyncState] = useState<"live" | "connecting" | "local">(
    "connecting",
  );
  const [inviteRole, setInviteRole] = useState<"EDITOR" | "REVIEWER" | "APPROVER">(
    "EDITOR",
  );
  const [versions, setVersions] = useState<
    { id: string; createdAt: string; createdBy: { name: string } }[]
  >([]);
  const [links, setLinks] = useState<DocumentLinkRow[]>([]);
  const editorRef = useRef<Editor | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canEdit = Boolean(doc.canEdit);
  const canComment = Boolean(doc.canComment);
  const canManage = Boolean(doc.canManage);
  const canManageLinks = Boolean(doc.canManageLinks ?? doc.canEdit);
  const canSubmit = Boolean(doc.canSubmit);
  const canCompleteReview = Boolean(doc.canCompleteReview);
  const canPublish = Boolean(doc.canPublish ?? doc.canApprove);
  const canReturn = Boolean(doc.canReturn);
  const isDoc = doc.kind === "DOCUMENT" || doc.kind === "PRESENTATION";
  const perm = user ? toPermissionUser(user) : null;
  const canSuggestWork = Boolean(
    doc.committee?.id &&
      perm &&
      canEditTasks(perm, doc.committee.id),
  );

  const refreshDoc = useCallback(async () => {
    const res = await fetch(`/api/documents/${doc.id}`);
    if (res.ok) {
      const data = await res.json();
      setDoc((prev) => ({ ...prev, ...data }));
      if (typeof data.title === "string") setTitle(data.title);
    }
  }, [doc.id]);

  // Keep status / members in sync when returning to this tab (e.g. approved on laptop)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshDoc();
      }
    };
    const onFocus = () => {
      void refreshDoc();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshDoc();
    }, 30000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [refreshDoc]);

  const saveChanges = async (
    newTitle?: string,
    newBody?: string,
    newJson?: Record<string, unknown>,
  ) => {
    if (!canEdit) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle !== undefined ? newTitle : title,
          body: newBody !== undefined ? newBody : body,
          contentJson:
            newJson !== undefined
              ? newJson
              : { ...(contentJson || {}), html: newBody ?? body },
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDoc((prev) => ({ ...prev, ...updated }));
        setSaveStatus("saved");
      } else {
        setSaveStatus("unsaved");
      }
    } catch {
      setSaveStatus("unsaved");
    }
  };

  const scheduleSave = (html: string) => {
    setBody(html);
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveChanges(title, html, { ...(contentJson || {}), html });
    }, 800);
  };

  const setStatus = async (status: LibraryDocumentStatus) => {
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDoc((prev) => ({ ...prev, ...updated }));
      // Re-fetch so capability flags stay accurate for the new stage
      void refreshDoc();
    }
  };

  const handleExportPdf = () => {
    const lines = [
      `Document: ${title}`,
      `Status: ${DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}`,
      `Committee: ${doc.committee?.name || "Org-wide"}`,
      `Author: ${doc.uploadedBy.name}`,
      `Date: ${new Date(doc.createdAt).toLocaleDateString()}`,
      "",
      "----------------------------------------",
      "",
      ...body.replace(/<[^>]+>/g, "\n").split("\n"),
    ];
    const blob = buildTextPdf(title, lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSheetChange = (json: Record<string, unknown>, text: string) => {
    setContentJson(json);
    setBody(text);
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveChanges(title, text, json);
    }, 800);
  };

  const togglePanel = (p: Panel) => {
    setPanel((cur) => (cur === p ? null : p));
    if (p === "history") {
      fetch(`/api/documents/${doc.id}/versions`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setVersions(data);
        })
        .catch(() => undefined);
    }
    if (p === "links") {
      fetch(`/api/documents/${doc.id}/links`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setLinks(data);
        })
        .catch(() => undefined);
    }
  };

  const inviteMembers = async (userIds: string[]) => {
    if (!canManage || userIds.length === 0) return;
    for (const userId of userIds) {
      await fetch(`/api/documents/${doc.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: inviteRole }),
      });
    }
    await refreshDoc();
  };

  const removeMember = async (userId: string) => {
    await fetch(`/api/documents/${doc.id}/members?userId=${userId}`, {
      method: "DELETE",
    });
    await refreshDoc();
  };

  const restoreVersion = async (versionId: string) => {
    const res = await fetch(`/api/documents/${doc.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBody(updated.body || "");
      setContentJson(updated.contentJson);
      window.location.reload();
    }
  };

  const sideOpen = panel != null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-charcoal/15 bg-white px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/documents"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-charcoal/15 text-charcoal hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                disabled={!canEdit}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSaveStatus("unsaved");
                }}
                onBlur={() => saveChanges(title)}
                className="min-w-0 truncate font-bold text-charcoal text-base outline-none bg-transparent hover:bg-slate-100 focus:bg-white rounded px-1.5 py-0.5 border border-transparent focus:border-primary/40 disabled:opacity-70"
              />
              <span className="hidden sm:inline rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary uppercase shrink-0">
                {NATIVE_DOC_KIND_LABELS[doc.kind]}
              </span>
              <span className="rounded-md bg-charcoal/5 px-2 py-0.5 text-[11px] font-semibold text-charcoal/70 shrink-0">
                {DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
              </span>
            </div>
            <p className="truncate text-xs text-muted">
              {doc.committee
                ? `${doc.committee.charterLetter?.toUpperCase() ?? ""}) ${doc.committee.name}`
                : "Org-wide"}
              {doc.myRole ? ` · You: ${DOCUMENT_ROLE_LABELS[doc.myRole]}` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {presence.length > 0 && (
            <div
              className="hidden md:flex items-center gap-2 mr-1 max-w-[220px]"
              title={formatPresenceSummary(presence, {
                excludeSelfFromCount: false,
              })}
            >
              <div className="flex items-center -space-x-1.5">
                {presence.slice(0, 4).map((p) => (
                  <span
                    key={p.userId}
                    title={
                      p.isSelf
                        ? `You · ${p.devices.join(" + ")}`
                        : `${p.name}${p.connectionCount > 1 ? ` (${p.connectionCount} devices)` : ""}`
                    }
                    className="relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {(p.isSelf ? "Y" : p.name.slice(0, 1)).toUpperCase()}
                    {p.connectionCount > 1 && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-charcoal px-0.5 text-[8px] text-white ring-1 ring-white">
                        {p.connectionCount}
                      </span>
                    )}
                  </span>
                ))}
              </div>
              <span className="truncate text-[11px] font-medium text-muted">
                {formatPresenceSummary(presence)}
              </span>
            </div>
          )}

          <span className="hidden sm:inline text-xs text-muted font-medium mr-1">
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "unsaved" && "Unsaved"}
          </span>

          {canSubmit && (
            <button
              type="button"
              onClick={() => setStatus("IN_REVIEW")}
              className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-charcoal/15 bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100"
            >
              <Send className="h-3.5 w-3.5" />
              Submit
            </button>
          )}
          {canCompleteReview && (
            <>
              <button
                type="button"
                onClick={() => setStatus("APPROVED")}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Complete review
              </button>
              {canReturn && (
                <button
                  type="button"
                  onClick={() => setStatus("RETURNED")}
                  className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-charcoal/15 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Return
                </button>
              )}
            </>
          )}
          {canPublish && (
            <>
              <button
                type="button"
                onClick={() => setStatus("PUBLISHED")}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Publish
              </button>
              {canReturn && (
                <button
                  type="button"
                  onClick={() => setStatus("RETURNED")}
                  className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-charcoal/15 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Return
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => togglePanel("comments")}
            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold ${
              panel === "comments"
                ? "bg-primary text-white"
                : "border border-charcoal/15 hover:bg-slate-100"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Comments</span>
          </button>
          <button
            type="button"
            onClick={() => togglePanel("people")}
            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold ${
              panel === "people"
                ? "bg-primary text-white"
                : "border border-charcoal/15 hover:bg-slate-100"
            }`}
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">People</span>
          </button>
          <button
            type="button"
            onClick={() => togglePanel("ai")}
            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold ${
              panel === "ai"
                ? "bg-primary text-white"
                : "border border-primary/30 bg-primary/10 text-primary"
            }`}
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">AI</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-charcoal/15 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </header>

      {(syncState === "local" ||
        (presence.find((p) => p.isSelf)?.connectionCount ?? 0) > 1) && (
        <div
          className={`px-3 py-1.5 text-xs sm:px-4 ${
            syncState === "local"
              ? "bg-amber-50 text-amber-900 border-b border-amber-200"
              : "bg-sky-50 text-sky-900 border-b border-sky-200"
          }`}
        >
          {syncState === "local" ? (
            <>
              Local editing — live sync is offline. Avoid editing this document
              on another device at the same time.
            </>
          ) : (
            <>
              Also open on{" "}
              {presence
                .find((p) => p.isSelf)!
                .devices.join(" + ")}{" "}
              — edits sync live. Prefer one device for heavy typing.
            </>
          )}
        </div>
      )}

      {/* Mobile status actions */}
      <div className="flex gap-2 border-b border-charcoal/10 bg-white px-3 py-2 sm:hidden overflow-x-auto">
        {canSubmit && (
          <TouchButton size="md" onClick={() => setStatus("IN_REVIEW")}>
            Submit for review
          </TouchButton>
        )}
        {canCompleteReview && (
          <>
            <TouchButton size="md" onClick={() => setStatus("APPROVED")}>
              Complete review
            </TouchButton>
            {canReturn && (
              <TouchButton
                size="md"
                variant="secondary"
                onClick={() => setStatus("RETURNED")}
              >
                Return
              </TouchButton>
            )}
          </>
        )}
        {canPublish && (
          <>
            <TouchButton size="md" onClick={() => setStatus("PUBLISHED")}>
              Publish
            </TouchButton>
            {canReturn && (
              <TouchButton
                size="md"
                variant="secondary"
                onClick={() => setStatus("RETURNED")}
              >
                Return
              </TouchButton>
            )}
          </>
        )}
        <TouchButton
          size="md"
          variant="secondary"
          onClick={() => togglePanel("history")}
        >
          <History className="h-3.5 w-3.5" /> History
        </TouchButton>
        <TouchButton
          size="md"
          variant="secondary"
          onClick={() => togglePanel("links")}
        >
          <Link2 className="h-3.5 w-3.5" /> Links
        </TouchButton>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-3 md:p-6 flex flex-col max-w-5xl mx-auto w-full">
          {doc.kind === "SPREADSHEET" ? (
            <UniverSheetEditor
              initialData={contentJson}
              onChange={handleSheetChange}
              readOnly={!canEdit}
            />
          ) : isDoc && user ? (
            <CollaborativeDocEditor
              documentId={doc.id}
              initialHtml={
                (typeof contentJson?.html === "string"
                  ? contentJson.html
                  : body) || "<p></p>"
              }
              readOnly={!canEdit}
              userId={user.id}
              userName={user.name}
              onHtmlChange={scheduleSave}
              onReady={(ed) => {
                editorRef.current = ed;
              }}
              onCommentRequest={(text, from, to) => {
                if (!canComment) return;
                setPendingAnchor(text);
                setPendingRange({ from, to });
                setPanel("comments");
              }}
              onHighlightClick={(threadId) => {
                setActiveThreadId(threadId);
                setPanel("comments");
              }}
              onPresence={setPresence}
              onSyncState={setSyncState}
            />
          ) : null}
        </main>

        {/* Desktop side panel */}
        {sideOpen && (
          <aside className="hidden lg:flex w-96 shrink-0 h-full flex-col bg-white">
            {panel === "comments" && (
              <DocumentCommentsPanel
                documentId={doc.id}
                canComment={canComment}
                activeThreadId={activeThreadId}
                pendingAnchorText={pendingAnchor}
                onClearPending={() => {
                  setPendingAnchor(null);
                  setPendingRange(null);
                }}
                onThreadCreated={(threadId) => {
                  if (editorRef.current) {
                    applyCommentMark(
                      editorRef.current,
                      threadId,
                      pendingRange?.from,
                      pendingRange?.to,
                    );
                  }
                  setPendingRange(null);
                  setActiveThreadId(threadId);
                }}
                onSelectThread={setActiveThreadId}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === "people" && (
              <PeoplePanel
                members={doc.members ?? []}
                canManage={canManage}
                inviteRole={inviteRole}
                setInviteRole={setInviteRole}
                onInvite={inviteMembers}
                onRemove={removeMember}
                onClose={() => setPanel(null)}
                onOpenHistory={() => togglePanel("history")}
                onOpenLinks={() => togglePanel("links")}
              />
            )}
            {panel === "ai" && (
              <AiDocumentAssistant
                documentId={doc.id}
                documentTitle={doc.title}
                documentTag={doc.tag}
                committeeId={doc.committee?.id}
                canSuggestWork={canSuggestWork}
                onClose={() => setPanel(null)}
                onApplyText={(text) => {
                  if (!canEdit) return;
                  const newBody = `${body}\n<p>${text}</p>`;
                  setBody(newBody);
                  saveChanges(title, newBody);
                }}
              />
            )}
            {panel === "history" && (
              <HistoryPanel
                versions={versions}
                canEdit={canEdit}
                onRestore={restoreVersion}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === "links" && (
              <DocumentLinksPanel
                documentId={doc.id}
                links={links}
                canManageLinks={canManageLinks}
                onLinksChange={setLinks}
                onClose={() => setPanel(null)}
              />
            )}
          </aside>
        )}

        {/* Mobile bottom sheet */}
        {sideOpen && (
          <div className="lg:hidden absolute inset-x-0 bottom-0 z-10 max-h-[70vh] flex flex-col">
            {panel === "comments" && (
              <DocumentCommentsPanel
                mobileSheet
                documentId={doc.id}
                canComment={canComment}
                activeThreadId={activeThreadId}
                pendingAnchorText={pendingAnchor}
                onClearPending={() => {
                  setPendingAnchor(null);
                  setPendingRange(null);
                }}
                onThreadCreated={(threadId) => {
                  if (editorRef.current) {
                    applyCommentMark(
                      editorRef.current,
                      threadId,
                      pendingRange?.from,
                      pendingRange?.to,
                    );
                  }
                  setPendingRange(null);
                  setActiveThreadId(threadId);
                }}
                onSelectThread={setActiveThreadId}
                onClose={() => setPanel(null)}
              />
            )}
            {panel === "people" && (
              <div className="max-h-[70vh] overflow-y-auto rounded-t-2xl border-t bg-white shadow-lg">
                <PeoplePanel
                  members={doc.members ?? []}
                  canManage={canManage}
                  inviteRole={inviteRole}
                  setInviteRole={setInviteRole}
                  onInvite={inviteMembers}
                  onRemove={removeMember}
                  onClose={() => setPanel(null)}
                  onOpenHistory={() => togglePanel("history")}
                  onOpenLinks={() => togglePanel("links")}
                />
              </div>
            )}
            {panel === "ai" && (
              <div className="max-h-[70vh] overflow-hidden rounded-t-2xl border-t bg-white shadow-lg">
                <AiDocumentAssistant
                  documentId={doc.id}
                  documentTitle={doc.title}
                  documentTag={doc.tag}
                  committeeId={doc.committee?.id}
                  canSuggestWork={canSuggestWork}
                  onClose={() => setPanel(null)}
                  onApplyText={(text) => {
                    if (!canEdit) return;
                    const newBody = `${body}\n<p>${text}</p>`;
                    setBody(newBody);
                    saveChanges(title, newBody);
                  }}
                />
              </div>
            )}
            {(panel === "history" || panel === "links") && (
              <div className="max-h-[70vh] overflow-y-auto rounded-t-2xl border-t bg-white shadow-lg">
                {panel === "history" ? (
                  <HistoryPanel
                    versions={versions}
                    canEdit={canEdit}
                    onRestore={restoreVersion}
                    onClose={() => setPanel(null)}
                  />
                ) : (
                  <DocumentLinksPanel
                    documentId={doc.id}
                    links={links}
                    canManageLinks={canManageLinks}
                    onLinksChange={setLinks}
                    onClose={() => setPanel(null)}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PeoplePanel({
  members,
  canManage,
  inviteRole,
  setInviteRole,
  onInvite,
  onRemove,
  onClose,
  onOpenHistory,
  onOpenLinks,
}: {
  members: Member[];
  canManage: boolean;
  inviteRole: "EDITOR" | "REVIEWER" | "APPROVER";
  setInviteRole: (v: "EDITOR" | "REVIEWER" | "APPROVER") => void;
  onInvite: (userIds: string[]) => void;
  onRemove: (userId: string) => void;
  onClose: () => void;
  onOpenHistory: () => void;
  onOpenLinks: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">People</h2>
        <button type="button" onClick={onClose} className="text-xs text-muted">
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-charcoal/10 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-charcoal">{m.user.name}</p>
                <p className="text-[11px] text-muted">
                  {DOCUMENT_ROLE_LABELS[m.role]}
                </p>
              </div>
              {canManage && m.role !== "OWNER" && (
                <button
                  type="button"
                  className="text-xs text-accent"
                  onClick={() => onRemove(m.userId)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {canManage && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-semibold uppercase text-muted">Invite</p>
            <select
              className={FORM_FIELD_CLASS}
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "EDITOR" | "REVIEWER" | "APPROVER")
              }
            >
              <option value="EDITOR">Editor</option>
              <option value="REVIEWER">Reviewer</option>
              <option value="APPROVER">Approver</option>
            </select>
            <PeoplePickerField
              mode="multi"
              excludeIds={members.map((m) => m.userId)}
              placeholder="Select people…"
              title="Invite people"
              onConfirm={onInvite}
            />
          </div>
        )}
        <div className="flex gap-2 border-t pt-3">
          <TouchButton size="md" variant="secondary" onClick={onOpenHistory}>
            History
          </TouchButton>
          <TouchButton size="md" variant="secondary" onClick={onOpenLinks}>
            Links
          </TouchButton>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({
  versions,
  canEdit,
  onRestore,
  onClose,
}: {
  versions: { id: string; createdAt: string; createdBy: { name: string } }[];
  canEdit: boolean;
  onRestore: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Version history</h2>
        <button type="button" onClick={onClose} className="text-xs text-muted">
          Close
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-4 space-y-2">
        {versions.length === 0 && (
          <p className="text-sm text-muted">No snapshots yet.</p>
        )}
        {versions.map((v) => (
          <li
            key={v.id}
            className="flex items-center justify-between rounded-xl border border-charcoal/10 px-3 py-2"
          >
            <div>
              <p className="text-sm text-charcoal">
                {new Date(v.createdAt).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted">{v.createdBy.name}</p>
            </div>
            {canEdit && (
              <button
                type="button"
                className="text-xs font-semibold text-primary"
                onClick={() => onRestore(v.id)}
              >
                Restore
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
