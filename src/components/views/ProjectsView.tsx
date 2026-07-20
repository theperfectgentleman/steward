"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TouchButton } from "@/components/TouchButton";
import {
  RichTextEditor,
  normalizeRichText,
} from "@/components/RichTextEditor";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import { toPermissionUser } from "@/lib/permissions-client";
import { canEditTasks, PROJECT_STATUS_LABELS } from "@/lib/types";
import { committeePath } from "@/lib/navigation";
import { PageShimmer } from "@/components/loading/PageShimmer";
import { FolderKanban, Plus, X } from "lucide-react";

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  openTasks: number;
  overdue: boolean;
  assignment: { id: string; title: string; status: string } | null;
};

function FieldLabel({
  htmlFor,
  children,
  optional,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold text-charcoal"
    >
      {children}
      {optional && (
        <span className="text-xs font-medium text-muted">Optional</span>
      )}
    </label>
  );
}

export function ProjectsView() {
  const { user } = useApp();
  const searchParams = useSearchParams();
  const { committeeId, committee, loading } = useCommitteeContext();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!committeeId) return;
    setProjectsLoading(true);
    fetch(`/api/projects?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => undefined)
      .finally(() => setProjectsLoading(false));
  }, [committeeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
  };

  const createProject = async () => {
    if (!title.trim() || !committeeId || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: normalizeRichText(description),
          committeeId,
        }),
      });
      resetForm();
      setCreateOpen(false);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || projectsLoading) {
    return <PageShimmer variant="list" lines={5} />;
  }
  if (!committee || !committeeId) {
    return <p className="text-muted text-center py-6">Committee not found.</p>;
  }

  const perm = user ? toPermissionUser(user) : null;
  const canCreate = perm ? canEditTasks(perm, committeeId) : false;

  const projectList = (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-charcoal/10 bg-white shadow-2xs overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-charcoal/8 px-3 py-2.5">
        <div>
          <h2 className="text-sm font-bold text-charcoal">All projects</h2>
          <p className="text-xs text-muted">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </p>
        </div>
        {canCreate && (
          <TouchButton
            size="md"
            className="lg:hidden"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New
          </TouchButton>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-muted">
          No projects yet. Chairs and secretaries can create projects or convert
          supervisory assignments.
        </div>
      ) : (
        <ul className="divide-y divide-charcoal/6 overflow-y-auto max-h-[min(70vh,640px)]">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`${committeePath(committeeId, "projects")}/${p.id}`}
                className="block px-3 py-2.5 hover:bg-surface/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal truncate">
                      {p.title}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {
                        PROJECT_STATUS_LABELS[
                          p.status as keyof typeof PROJECT_STATUS_LABELS
                        ]
                      }{" "}
                      · {p.openTasks} open
                      {p.overdue && " · overdue"}
                    </p>
                    {p.assignment && (
                      <p className="text-[11px] text-accent mt-1 truncate">
                        From: {p.assignment.title}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-primary tabular-nums shrink-0">
                    {p.progress}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-charcoal/10 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const createPane = createOpen ? (
    <section
      className="flex min-h-0 flex-1 flex-col rounded-xl border border-charcoal/10 bg-white shadow-2xs overflow-hidden"
      aria-labelledby="new-project-heading"
    >
      <div className="flex items-start justify-between gap-3 border-b border-charcoal/8 bg-surface/60 px-4 py-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderKanban className="h-4 w-4" />
          </span>
          <div>
            <h2
              id="new-project-heading"
              className="text-base font-bold text-charcoal"
            >
              New project
            </h2>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Scope, goals, and constraints for the team.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setCreateOpen(false);
          }}
          className="touch-target rounded-xl text-muted hover:text-charcoal hover:bg-white shrink-0"
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <FieldLabel htmlFor="project-title">Project title</FieldLabel>
          <input
            id="project-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sanctuary Systems Upgrade"
            className={FORM_FIELD_CLASS}
            autoFocus
          />
        </div>

        <div className="flex-1 min-h-0">
          <FieldLabel optional>Description</FieldLabel>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Scope, goals, constraints, or notes for the team…"
            minHeight="200px"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1 border-t border-charcoal/6">
          <TouchButton
            variant="secondary"
            onClick={() => {
              resetForm();
              setCreateOpen(false);
            }}
          >
            Cancel
          </TouchButton>
          <TouchButton
            onClick={createProject}
            disabled={!title.trim() || submitting}
          >
            {submitting ? "Creating…" : "Create project"}
          </TouchButton>
        </div>
      </div>
    </section>
  ) : (
    <div className="hidden lg:flex min-h-[320px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-charcoal/15 bg-white/70 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
        <FolderKanban className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-charcoal">Create a project</p>
      <p className="text-sm text-muted mt-1 max-w-xs">
        Open a workstream for {committee.name}, then break it into tasks.
      </p>
      {canCreate && (
        <TouchButton className="mt-4" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New project
        </TouchButton>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-charcoal">Projects</h1>
          <p className="text-sm text-muted mt-1">
            Group related tasks under {committee.name}
          </p>
        </div>
        {canCreate && !createOpen && (
          <TouchButton className="hidden lg:inline-flex" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New project
          </TouchButton>
        )}
      </div>

      {/* Mobile: form above list when open */}
      <div className="space-y-3 lg:hidden">
        {canCreate && createOpen && createPane}
        {projectList}
      </div>

      {/* Desktop: list | create */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4 lg:items-stretch min-h-[420px]">
        {projectList}
        {canCreate ? createPane : (
          <div className="flex items-center justify-center rounded-xl border border-charcoal/10 bg-white px-6 text-sm text-muted text-center">
            You can browse projects here. Creating requires chair or secretary
            access.
          </div>
        )}
      </div>
    </div>
  );
}
