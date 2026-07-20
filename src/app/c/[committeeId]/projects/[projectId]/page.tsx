"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Plus, X } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { CommitteeGuard } from "@/components/CommitteeGuard";
import { CommentThread } from "@/components/CommentThread";
import { DocumentList } from "@/components/DocumentList";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { RichTextContent } from "@/components/RichTextContent";
import { AccessDenied } from "@/components/AccessDenied";
import { TouchButton } from "@/components/TouchButton";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import { toPermissionUser } from "@/lib/permissions-client";
import { canEditTasks } from "@/lib/types";
import { committeePath, projectPath } from "@/lib/navigation";
import { PageShimmer } from "@/components/loading/PageShimmer";

type ProjectTaskDraft = {
  title: string;
  description?: string;
  estimatedDays?: number;
  dependsOnIndex?: number | null;
  onCriticalPath?: boolean;
  accepted: boolean;
};

type ProjectDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  committeeId: string;
  tasks: {
    id: string;
    title: string;
    status: string;
    estimatedDays?: number | null;
    dependsOnTaskId?: string | null;
    assignedTo: { name: string } | null;
  }[];
};

function ProjectDetailInner({ projectId }: { projectId: string }) {
  const { user } = useApp();
  const { committeeId } = useCommitteeContext();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [draftOpen, setDraftOpen] = useState(false);
  const [drafts, setDrafts] = useState<ProjectTaskDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const perm = user ? toPermissionUser(user) : null;
  const canSuggest =
    !!perm && !!project && canEditTasks(perm, project.committeeId);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}`)
      .then((r) => {
        if (r.status === 403) {
          setAccessDenied(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.project) setProject(data.project);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const suggestTasks = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-tasks`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "Generation failed");
        return;
      }
      const tasks = (data.tasks ?? []) as Omit<ProjectTaskDraft, "accepted">[];
      setDrafts(tasks.map((t) => ({ ...t, accepted: true })));
      setDraftOpen(true);
    } catch {
      setAiError("Network error");
    } finally {
      setAiLoading(false);
    }
  };

  const acceptTasks = async () => {
    const selected = drafts.filter((d) => d.accepted && d.title.trim());
    if (selected.length === 0) return;
    setSaving(true);
    try {
      // Remap dependsOnIndex to indices within the accepted subset
      const originalIndices = drafts
        .map((d, i) => (d.accepted && d.title.trim() ? i : -1))
        .filter((i) => i >= 0);
      const indexMap = new Map(originalIndices.map((orig, next) => [orig, next]));

      const payload = selected.map((t, _i, _arr) => {
        const origIndex = drafts.indexOf(t);
        let dependsOnIndex: number | null = null;
        if (
          typeof t.dependsOnIndex === "number" &&
          indexMap.has(t.dependsOnIndex)
        ) {
          dependsOnIndex = indexMap.get(t.dependsOnIndex)!;
        }
        return {
          title: t.title.trim(),
          description: t.description,
          estimatedDays: t.estimatedDays,
          dependsOnIndex,
          onCriticalPath: t.onCriticalPath,
        };
      });

      const res = await fetch(`/api/projects/${projectId}/accept-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: payload }),
      });
      if (!res.ok) {
        let message = "Could not create tasks";
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          message = `Could not create tasks (${res.status})`;
        }
        setAiError(message);
        return;
      }
      setDraftOpen(false);
      setDrafts([]);
      load();
    } finally {
      setSaving(false);
    }
  };

  if (accessDenied) {
    return <AccessDenied itemLabel="project" />;
  }

  if (loading) {
    return <PageShimmer variant="detail" />;
  }

  if (!project) {
    return <p className="text-muted text-center py-12">Loading project…</p>;
  }

  return (
    <div className="space-y-5 pb-20 max-w-3xl">
      <div>
        <Link
          href={committeePath(committeeId ?? project.committeeId, "projects")}
          className="text-sm text-primary font-semibold hover:underline"
        >
          ← Projects
        </Link>
        <h1 className="text-2xl font-bold text-charcoal mt-2 tracking-tight">
          {project.title}
        </h1>
        <div className="mt-1.5">
          <CopyLinkButton
            path={projectPath(committeeId ?? project.committeeId, projectId)}
          />
        </div>
        {project.description && (
          <RichTextContent
            html={project.description}
            className="mt-2 text-sm text-muted"
          />
        )}
      </div>

      <div className="rounded-xl border border-charcoal/8 bg-white shadow-2xs">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <h2 className="text-base font-bold text-charcoal">Tasks</h2>
          {canSuggest && !draftOpen && (
            <TouchButton
              size="md"
              variant="secondary"
              disabled={aiLoading}
              onClick={suggestTasks}
            >
              <Sparkles className="h-4 w-4" />
              {aiLoading ? "Suggesting…" : "Suggest tasks"}
            </TouchButton>
          )}
        </div>
        {aiError && !draftOpen && (
          <p className="text-sm text-accent px-4 mb-2">{aiError}</p>
        )}
        {project.tasks.length === 0 ? (
          <p className="text-sm text-muted px-4 pb-4">
            No tasks in this project yet.
            {canSuggest ? " Use Suggest tasks for a CPM-style breakdown." : ""}
          </p>
        ) : (
          <ul className="divide-y divide-charcoal/6 px-1 pb-1">
            {project.tasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <span className="font-medium text-charcoal truncate">
                  {t.title}
                </span>
                <span className="text-xs font-semibold text-muted shrink-0 tabular-nums">
                  {t.assignedTo?.name?.split(" ")[0] ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {draftOpen && (
        <section
          className="rounded-2xl border border-charcoal/10 bg-white p-5 sm:p-6 space-y-4 shadow-2xs"
          aria-labelledby="suggested-tasks-heading"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="suggested-tasks-heading"
                className="text-lg font-bold text-charcoal"
              >
                Review suggested tasks
              </h2>
              <p className="text-sm text-muted mt-1">
                Check tasks to accept. Dependencies use the order below (CPM).
                Nothing is created until you confirm.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftOpen(false);
                setDrafts([]);
                setAiError("");
              }}
              className="touch-target rounded-xl text-muted hover:text-charcoal hover:bg-slate-50"
              aria-label="Cancel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {aiError && <p className="text-sm text-accent">{aiError}</p>}
          {drafts.map((draft, i) => (
            <label
              key={i}
              className="flex gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer"
            >
              <input
                type="checkbox"
                checked={draft.accepted}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = { ...next[i], accepted: e.target.checked };
                  setDrafts(next);
                }}
                className="mt-1 h-4 w-4"
              />
              <div className="flex-1 space-y-2 min-w-0">
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
                <p className="text-xs text-muted">
                  {draft.estimatedDays != null
                    ? `~${draft.estimatedDays} day${draft.estimatedDays === 1 ? "" : "s"}`
                    : "Duration TBD"}
                  {typeof draft.dependsOnIndex === "number"
                    ? ` · after #${draft.dependsOnIndex + 1}`
                    : ""}
                  {draft.onCriticalPath ? " · critical path" : ""}
                </p>
              </div>
            </label>
          ))}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <TouchButton
              variant="secondary"
              className="sm:flex-1"
              onClick={() => {
                setDraftOpen(false);
                setDrafts([]);
                setAiError("");
              }}
            >
              Cancel
            </TouchButton>
            <TouchButton
              size="lg"
              className="sm:flex-1"
              disabled={saving || drafts.filter((d) => d.accepted).length === 0}
              onClick={acceptTasks}
            >
              <Plus className="h-5 w-5" />
              {saving
                ? "Creating…"
                : `Add ${drafts.filter((d) => d.accepted).length} task${
                    drafts.filter((d) => d.accepted).length !== 1 ? "s" : ""
                  }`}
            </TouchButton>
          </div>
        </section>
      )}

      <CommentThread entityType="PROJECT" entityId={projectId} />
      <DocumentList />
    </div>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ committeeId: string; projectId: string }>;
}) {
  const { projectId } = use(params);
  return (
    <AuthGate>
      <CommitteeGuard>
        <ProjectDetailInner projectId={projectId} />
      </CommitteeGuard>
    </AuthGate>
  );
}
