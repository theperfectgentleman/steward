"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, FileDown, FileText, Link2, Paperclip, Plus } from "lucide-react";
import { CommentThread } from "@/components/CommentThread";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TouchButton } from "@/components/TouchButton";
import { FormSelect } from "@/components/FormSelect";
import { SearchableCommitteeSelect } from "@/components/SearchableCommitteeSelect";
import { PeoplePickerField } from "@/components/people/PeoplePickerField";
import { useApp } from "@/providers/AppProvider";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  DOCUMENT_SOURCE_LABELS,
  DOCUMENT_STATUS_LABELS,
  LIBRARY_DOCUMENT_TAGS,
  LIBRARY_DOCUMENT_TAG_LABELS,
  type LibraryDocumentTag,
} from "@/lib/documents";
import { DOCUMENT_TEMPLATES } from "@/lib/document-templates";
import { buildTextPdf } from "@/lib/pdf";
import { formatDate, formatDateWithWeekday } from "@/lib/dates";
import { resolveLibraryFileHref } from "@/lib/document-urls";
import { canViewAllCommittees, canManageTor } from "@/lib/types";
import { isAllGroups } from "@/lib/navigation";
import { formatGroupRoleLabel } from "@/lib/work-context";

type LibraryDoc = {
  id: string;
  title: string;
  tag: LibraryDocumentTag;
  source: "UPLOAD" | "CREATED";
  status?: keyof typeof DOCUMENT_STATUS_LABELS;
  body: string | null;
  fileName: string | null;
  fileUrl: string | null;
  storageKey?: string | null;
  mimeType?: string | null;
  createdAt: string;
  committee: { id: string; name: string; charterLetter: string } | null;
  uploadedBy: { name: string };
};

type Committee = { id: string; name: string; charterLetter: string };
type CreateSource = "CREATED" | "UPLOAD";
type InviteRow = { userId: string; role: "EDITOR" | "REVIEWER" | "APPROVER" };

export function DocumentsView({
  committeeId: lockedCommitteeId,
  committeeName,
}: {
  committeeId?: string;
  committeeName?: string;
} = {}) {
  const { user, activeCommitteeId } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTag = searchParams.get("tag");
  const urlCommitteeId = searchParams.get("committeeId");
  const contextCommitteeId =
    activeCommitteeId && !isAllGroups(activeCommitteeId)
      ? activeCommitteeId
      : "";
  const filterCommitteeId =
    lockedCommitteeId || urlCommitteeId || contextCommitteeId || "";
  const scoped = Boolean(lockedCommitteeId);

  const perm = user ? toPermissionUser(user) : null;
  const isExecutive = perm && canViewAllCommittees(perm);
  const supervisoryLabel =
    user?.organization?.settings.supervisoryLabel ?? "Governance";
  const canAddTor = Boolean(
    perm && filterCommitteeId && canManageTor(perm, filterCommitteeId),
  );

  const [documents, setDocuments] = useState<LibraryDoc[]>([]);
  const [groupTor, setGroupTor] = useState<LibraryDoc | null>(null);
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
  const [committeeId, setCommitteeId] = useState<string>(
    lockedCommitteeId || urlCommitteeId || "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteNameById, setInviteNameById] = useState<Record<string, string>>(
    {},
  );
  const [inviteRole, setInviteRole] = useState<"EDITOR" | "REVIEWER" | "APPROVER">(
    "EDITOR",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [docKind, setDocKind] = useState<"DOCUMENT" | "SPREADSHEET">("DOCUMENT");

  useEffect(() => {
    if (lockedCommitteeId) setCommitteeId(lockedCommitteeId);
    else if (urlCommitteeId) setCommitteeId(urlCommitteeId);
  }, [lockedCommitteeId, urlCommitteeId]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tagFilter !== "ALL") params.set("tag", tagFilter);
    if (filterCommitteeId) params.set("committeeId", filterCommitteeId);
    const qs = params.toString();
    fetch(`/api/documents${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDocuments(data);
        else setDocuments([]);
      })
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [tagFilter, filterCommitteeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!filterCommitteeId) {
      setGroupTor(null);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/documents?committeeId=${encodeURIComponent(filterCommitteeId)}&tag=TOR`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setGroupTor(Array.isArray(data) && data[0] ? data[0] : null);
      })
      .catch(() => {
        if (!cancelled) setGroupTor(null);
      });
    return () => {
      cancelled = true;
    };
  }, [filterCommitteeId]);

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

  useEffect(() => {
    if (!showCreate) return;
    const qs = committeeId
      ? `?committeeId=${encodeURIComponent(committeeId)}`
      : "";
    fetch(`/api/people-directory${qs}`)
      .then((r) => r.json())
      .then((data: { people?: { id: string; name: string }[] }) => {
        if (Array.isArray(data.people)) {
          setInviteNameById(
            Object.fromEntries(data.people.map((p) => [p.id, p.name])),
          );
        }
      })
      .catch(() => undefined);
  }, [showCreate, committeeId]);

  const resetCreate = () => {
    setTitle("");
    setBody("");
    setFileName("");
    setFileUrl("");
    setTag("OTHER");
    setSource("CREATED");
    setCommitteeId(lockedCommitteeId || urlCommitteeId || "");
    setCreateError("");
    setInvites([]);
    setInviteNameById({});
    setSelectedFile(null);
    setImportFile(null);
  };

  const addInvitesFromPicker = (
    userIds: string[],
    people: { id: string; name: string }[],
  ) => {
    setInviteNameById((prev) => {
      const next = { ...prev };
      for (const p of people) next[p.id] = p.name;
      return next;
    });
    setInvites((prev) => {
      const next = [...prev];
      for (const userId of userIds) {
        if (userId === user?.id) continue;
        if (next.some((i) => i.userId === userId)) continue;
        next.push({ userId, role: inviteRole });
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setCreateError("");

    const editors = invites.filter((i) => i.role === "EDITOR").map((i) => i.userId);
    const reviewers = invites
      .filter((i) => i.role === "REVIEWER")
      .map((i) => i.userId);
    const approvers = invites
      .filter((i) => i.role === "APPROVER")
      .map((i) => i.userId);

    try {
      let createdId: string | null = null;
      if (importFile) {
        const formData = new FormData();
        formData.append("file", importFile);
        formData.append("title", title.trim());
        formData.append("tag", tag);
        if (lockedCommitteeId || committeeId) {
          formData.append("committeeId", lockedCommitteeId || committeeId);
        }

        const res = await fetch("/api/documents/import", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setCreateError(data.error ?? "Failed to extract and import document.");
          return;
        }
        createdId = data.id;
        for (const inv of invites) {
          await fetch(`/api/documents/${createdId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: inv.userId, role: inv.role }),
          });
        }
      } else if (selectedFile && source === "UPLOAD") {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", title.trim());
        formData.append("tag", tag);
        if (lockedCommitteeId || committeeId) {
          formData.append("committeeId", lockedCommitteeId || committeeId);
        }

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setCreateError(data.error ?? "Failed to upload file.");
          return;
        }
        createdId = data.id;
        for (const inv of invites) {
          await fetch(`/api/documents/${createdId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: inv.userId, role: inv.role }),
          });
        }
      } else {
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            tag,
            source,
            kind: docKind,
            body:
              source === "CREATED" && body.trim()
                ? `<p>${body.replace(/\n/g, "</p><p>")}</p>`
                : undefined,
            fileName: source === "UPLOAD" ? fileName : undefined,
            fileUrl: source === "UPLOAD" ? fileUrl : undefined,
            committeeId: lockedCommitteeId || committeeId || null,
            editors,
            reviewers,
            approvers: approvers.length > 0 ? approvers : undefined,
          }),
        });
        const data = (await res.json()) as { error?: string; id?: string };
        if (!res.ok) {
          setCreateError(data.error ?? "Could not save document.");
          return;
        }
        createdId = data.id ?? null;
      }
      resetCreate();
      setSelectedFile(null);
      setImportFile(null);
      setShowCreate(false);
      if (createdId) {
        router.push(`/documents/${createdId}`);
        return;
      }
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
    ];
    const blob = buildTextPdf(
      `UnityCommit — Monthly ${supervisoryLabel} Report`,
      lines,
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${supervisoryLabel.toLowerCase().replace(/\s+/g, "-")}-report-${new Date().toISOString().slice(0, 7)}.pdf`;
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
              : filterCommitteeId
                ? "Filtered by group — create, co-edit, and review with your team."
                : "Create, co-edit, comment, and review — org-wide and by group."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!scoped && isExecutive && (
            <TouchButton variant="ghost" onClick={handleExportReport}>
              <FileDown className="h-5 w-5" />
              Export {supervisoryLabel.toLowerCase()} report
            </TouchButton>
          )}
          {!(tagFilter === "TOR" && !canAddTor) && (
            <TouchButton
              onClick={() => {
                setShowCreate((v) => {
                  if (!v && tagFilter !== "ALL") setTag(tagFilter);
                  return !v;
                });
              }}
            >
              {showCreate ? (
                "Cancel"
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {tagFilter === "TOR" ? "New TOR" : "New document"}
                </>
              )}
            </TouchButton>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-charcoal/10 bg-white p-4 shadow-xs space-y-3 max-w-xl">
          <SegmentedControl
            options={[
              { value: "CREATED", label: "Create Online" },
              { value: "UPLOAD", label: "Import / Attach File" },
            ]}
            value={source}
            onChange={(v) => {
              setSource(v as CreateSource);
              setSelectedFile(null);
              setImportFile(null);
            }}
          />

          {source === "CREATED" && (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDocKind("DOCUMENT")}
                className={`flex-1 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                  docKind === "DOCUMENT"
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-charcoal/15 bg-white text-charcoal hover:border-primary/40"
                }`}
              >
                Document
              </button>
              <button
                type="button"
                onClick={() => setDocKind("SPREADSHEET")}
                className={`flex-1 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                  docKind === "SPREADSHEET"
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-charcoal/15 bg-white text-charcoal hover:border-primary/40"
                }`}
              >
                Spreadsheet
              </button>
            </div>
          )}

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
            {LIBRARY_DOCUMENT_TAGS.filter(
              (t) => t !== "TOR" || canAddTor || !filterCommitteeId,
            ).map((t) => (
              <option key={t} value={t}>
                {LIBRARY_DOCUMENT_TAG_LABELS[t]}
              </option>
            ))}
          </FormSelect>
          {source === "CREATED" && docKind === "DOCUMENT" && (
            <p className="text-xs text-muted -mt-1">
              {DOCUMENT_TEMPLATES[tag].description}
            </p>
          )}
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
              emptyLabel="Org-wide (no committee)"
            />
          )}
          {source === "CREATED" ? (
            <div className="space-y-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder={
                  docKind === "SPREADSHEET"
                    ? "Optional summary notes…"
                    : "Optional notes (leave blank to use the type template)…"
                }
                className={FORM_TEXTAREA_CLASS}
              />
              <div className="rounded-xl border border-charcoal/15 bg-slate-50 p-3 space-y-2">
                <label className="block text-xs font-bold text-charcoal">
                  Import & extract for editing (.docx, .xlsx, .csv, .pdf)
                </label>
                <input
                  type="file"
                  accept=".docx,.xlsx,.csv,.pdf,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImportFile(file);
                    if (file && !title.trim()) {
                      setTitle(file.name.replace(/\.[^/.]+$/, ""));
                    }
                  }}
                  className="w-full text-xs text-charcoal file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-dark"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-charcoal/15 bg-slate-50 p-3">
              <label className="block text-xs font-bold text-charcoal">
                Upload file (stored in cloud)
              </label>
              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file && !title.trim()) {
                    setTitle(file.name.replace(/\.[^/.]+$/, ""));
                  }
                }}
                className="w-full text-xs text-charcoal file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary-dark"
              />
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-charcoal/10" />
                <span className="shrink-0 px-2 text-[10px] font-bold uppercase text-muted">
                  Or External Link
                </span>
                <div className="flex-grow border-t border-charcoal/10" />
              </div>
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
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-charcoal/10 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Invite people
            </p>
            <p className="text-xs text-muted">
              Editors draft the document. Reviewers complete review. Approvers
              publish. If you skip approver, one is assigned from governance
              titles.
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="min-w-[140px] flex-1">
                <PeoplePickerField
                  mode="multi"
                  committeeId={committeeId || null}
                  excludeIds={[
                    ...(user?.id ? [user.id] : []),
                    ...invites.map((i) => i.userId),
                  ]}
                  nameById={inviteNameById}
                  placeholder="Select people…"
                  title="Invite people"
                  onConfirm={addInvitesFromPicker}
                />
              </div>
              <select
                className={FORM_FIELD_CLASS}
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(
                    e.target.value as "EDITOR" | "REVIEWER" | "APPROVER",
                  )
                }
              >
                <option value="EDITOR">Editor</option>
                <option value="REVIEWER">Reviewer</option>
                <option value="APPROVER">Approver</option>
              </select>
            </div>
            {invites.length > 0 && (
              <ul className="space-y-1">
                {invites.map((inv) => {
                  const name = inviteNameById[inv.userId] ?? inv.userId;
                  return (
                    <li
                      key={inv.userId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        {name}{" "}
                        <span className="text-muted">
                          ({inv.role.toLowerCase()})
                        </span>
                      </span>
                      <button
                        type="button"
                        className="text-xs text-accent"
                        onClick={() =>
                          setInvites((prev) =>
                            prev.filter((i) => i.userId !== inv.userId),
                          )
                        }
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {createError && (
            <p className="text-sm text-accent bg-accent/10 rounded-xl p-3">
              {createError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <TouchButton
              disabled={
                !title.trim() ||
                submitting ||
                (source === "UPLOAD" &&
                  !selectedFile &&
                  !fileName.trim() &&
                  !fileUrl.trim())
              }
              onClick={handleCreate}
            >
              {submitting ? "Saving…" : "Save & Open"}
            </TouchButton>
          </div>
        </div>
      )}

      {filterCommitteeId ? (
        <section className="max-w-3xl rounded-xl border border-primary/20 bg-primary/[0.04] p-4 space-y-2">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Group home · Terms of Reference
              </p>
              {groupTor ? (
                <>
                  <p className="font-semibold text-charcoal truncate">
                    {groupTor.title}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Standing mandate for this group — open it to suggest Work
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-charcoal">
                    No TOR for this group yet
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {canAddTor
                      ? "Add Terms of Reference so AI can suggest Work from the mandate"
                      : "The chair adds the Terms of Reference; everyone can view it"}
                  </p>
                </>
              )}
            </div>
            {groupTor ? (
              <Link
                href={`/documents/${groupTor.id}`}
                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90"
              >
                Open TOR
              </Link>
            ) : canAddTor ? (
              <TouchButton
                size="md"
                onClick={() => {
                  setTag("TOR");
                  setTagFilter("TOR");
                  setShowCreate(true);
                  if (!title.trim()) {
                    setTitle("Terms of Reference");
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                Add TOR
              </TouchButton>
            ) : (
              <p className="shrink-0 text-xs text-muted max-w-[10rem] text-right">
                Ask the chair to add one
              </p>
            )}
          </div>
        </section>
      ) : null}

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

      {!loading &&
        documents.filter(
          (doc) =>
            !(filterCommitteeId && doc.tag === "TOR" && groupTor?.id === doc.id),
        ).length === 0 &&
        !(filterCommitteeId && groupTor && tagFilter === "TOR") && (
        <p className="text-center text-muted py-6 rounded-xl border border-charcoal/5 bg-white text-sm">
          {scoped || filterCommitteeId
            ? "No documents for this group yet."
            : "No documents yet. Create one to invite editors and reviewers."}
        </p>
      )}

      <ul className="max-w-3xl space-y-1.5">
        {documents
          .filter((doc) => !(filterCommitteeId && doc.tag === "TOR" && groupTor?.id === doc.id))
          .map((doc) => {
          const expanded = expandedId === doc.id;
          const SourceIcon = doc.source === "UPLOAD" ? Paperclip : FileText;
          return (
            <li
              key={doc.id}
              className="rounded-xl border border-charcoal/10 bg-white shadow-xs overflow-hidden"
            >
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
                        <p className="font-semibold text-charcoal text-sm">
                          {doc.title}
                        </p>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-accent bg-accent/10 px-1.5 py-0.5 rounded-md">
                          {LIBRARY_DOCUMENT_TAG_LABELS[doc.tag]}
                        </span>
                        {doc.status && (
                          <span className="text-[10px] font-semibold uppercase text-muted bg-charcoal/5 px-1.5 py-0.5 rounded-md">
                            {DOCUMENT_STATUS_LABELS[doc.status]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {!scoped &&
                          (doc.committee
                            ? formatGroupRoleLabel(perm, doc.committee) ||
                              `${doc.committee.charterLetter.toUpperCase()}) ${doc.committee.name}`
                            : "Org-wide")}
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
                    <div
                      className="pt-3 text-sm text-charcoal leading-relaxed prose max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: doc.body.slice(0, 800),
                      }}
                    />
                  )}
                  {doc.source === "UPLOAD" && (
                    <div className="pt-3">
                      {doc.fileName && (
                        <p className="text-sm text-charcoal">{doc.fileName}</p>
                      )}
                      {resolveLibraryFileHref(doc) && (
                        <a
                          href={resolveLibraryFileHref(doc)!}
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
