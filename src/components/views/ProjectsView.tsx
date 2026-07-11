"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { TouchButton } from "@/components/TouchButton";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import { toPermissionUser } from "@/lib/permissions-client";
import { canEditTasks, PROJECT_STATUS_LABELS } from "@/lib/types";
import { committeePath } from "@/lib/navigation";
import { PageShimmer } from "@/components/loading/PageShimmer";

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

export function ProjectsView() {
  const { user } = useApp();
  const searchParams = useSearchParams();
  const { committeeId, committee, loading } = useCommitteeContext();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

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

  const createProject = async () => {
    if (!title.trim() || !committeeId) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        committeeId,
      }),
    });
    setTitle("");
    setDescription("");
    setCreateOpen(false);
    load();
  };

  if (loading || projectsLoading) {
    return <PageShimmer variant="list" lines={5} />;
  }
  if (!committee || !committeeId) {
    return <p className="text-muted text-center py-12">Committee not found.</p>;
  }

  const perm = user ? toPermissionUser(user) : null;
  const canCreate = perm ? canEditTasks(perm, committeeId) : false;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Projects</h1>
          <p className="text-sm text-muted mt-1">
            Group related tasks under {committee.name}
          </p>
        </div>
        {canCreate && (
          <TouchButton onClick={() => setCreateOpen(true)}>New project</TouchButton>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-charcoal/10 bg-white p-8 text-center text-muted">
          No projects yet. Chairs and secretaries can create projects or convert Presbytery assignments.
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`${committeePath(committeeId, "projects")}/${p.id}`}
                className="block rounded-2xl border border-charcoal/10 bg-white p-4 touch-target hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-charcoal">{p.title}</p>
                    <p className="text-sm text-muted mt-1">
                      {PROJECT_STATUS_LABELS[p.status as keyof typeof PROJECT_STATUS_LABELS]} ·{" "}
                      {p.openTasks} open tasks
                      {p.overdue && " · overdue"}
                    </p>
                    {p.assignment && (
                      <p className="text-xs text-accent mt-1">
                        From assignment: {p.assignment.title}
                      </p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-primary">{p.progress}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-charcoal/10 overflow-hidden">
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

      <BottomSheet open={createOpen} onClose={() => setCreateOpen(false)} title="New project">
        <div className="space-y-4 p-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            className={FORM_FIELD_CLASS}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className={FORM_TEXTAREA_CLASS}
          />
          <TouchButton className="w-full" onClick={createProject}>
            Create project
          </TouchButton>
        </div>
      </BottomSheet>
    </div>
  );
}
