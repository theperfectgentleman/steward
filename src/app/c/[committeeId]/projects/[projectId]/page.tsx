"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { CommitteeGuard } from "@/components/CommitteeGuard";
import { CommentThread } from "@/components/CommentThread";
import { DocumentList } from "@/components/DocumentList";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { AccessDenied } from "@/components/AccessDenied";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import { committeePath, projectPath } from "@/lib/navigation";
import { PageShimmer } from "@/components/loading/PageShimmer";

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
    assignedTo: { name: string } | null;
  }[];
};

function ProjectDetailInner({ projectId }: { projectId: string }) {
  const { committeeId } = useCommitteeContext();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(true);

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
    <div className="space-y-6 pb-20">
      <div>
        <Link
          href={committeePath(committeeId ?? project.committeeId, "projects")}
          className="text-sm text-primary font-medium"
        >
          ← Projects
        </Link>
        <h1 className="text-2xl font-bold text-charcoal mt-2">{project.title}</h1>
        <div className="mt-2">
          <CopyLinkButton
            path={projectPath(committeeId ?? project.committeeId, projectId)}
          />
        </div>
        {project.description && (
          <p className="text-muted mt-2">{project.description}</p>
        )}
      </div>

      <div className="rounded-2xl border border-charcoal/10 bg-white p-4">
        <h2 className="font-semibold text-charcoal mb-3">Tasks</h2>
        {project.tasks.length === 0 ? (
          <p className="text-sm text-muted">No tasks in this project yet.</p>
        ) : (
          <ul className="space-y-2">
            {project.tasks.map((t) => (
              <li key={t.id} className="flex justify-between text-sm">
                <span>{t.title}</span>
                <span className="text-muted">{t.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

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
