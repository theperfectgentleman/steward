"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ClipboardList,
  FolderKanban,
  Inbox,
} from "lucide-react";
import { PageShimmer } from "@/components/loading/PageShimmer";
import {
  ASSIGNMENT_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type AssignmentStatus,
  type ProjectStatus,
  type TaskStatus,
} from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  assignmentPath,
  eventPath,
  projectPath,
  tasksPath,
} from "@/lib/navigation";

type CommitteeRef = {
  id: string;
  name: string;
  charterLetter: string | null;
};

type MyWorkPayload = {
  tasks: {
    id: string;
    title: string;
    status: TaskStatus;
    dueDate: string | null;
    committee: CommitteeRef;
    project: { id: string; title: string } | null;
  }[];
  assignments: {
    id: string;
    title: string;
    status: AssignmentStatus;
    priority: string;
    dueDate: string | null;
    targetCommittee: CommitteeRef | null;
    createdBy: { id: string; name: string };
  }[];
  projects: {
    id: string;
    title: string;
    status: ProjectStatus;
    committee: CommitteeRef;
    updatedAt: string;
  }[];
  upcoming: {
    id: string;
    title: string;
    kind: string;
    startDate: string;
    committee: CommitteeRef | null;
    myRsvp: string | null;
  }[];
};

function WorkCard({
  title,
  count,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  count: number;
  icon: typeof ClipboardList;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-charcoal/10 bg-white shadow-xs">
      <header className="flex items-center gap-2.5 border-b border-charcoal/8 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-charcoal">{title}</h2>
          <p className="text-[11px] text-muted">
            {count === 0 ? "None right now" : `${count} open`}
          </p>
        </div>
        {count > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary-dark">
            {count}
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {count === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">{empty}</p>
        ) : (
          <ul className="divide-y divide-charcoal/5">{children}</ul>
        )}
      </div>
    </section>
  );
}

export function MyWorkView() {
  const [data, setData] = useState<MyWorkPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/my-work")
      .then((r) => r.json())
      .then((payload) => {
        if (payload?.tasks) {
          setData(payload);
        } else {
          setData({
            tasks: [],
            assignments: [],
            projects: [],
            upcoming: [],
          });
        }
      })
      .catch(() => {
        setData({
          tasks: [],
          assignments: [],
          projects: [],
          upcoming: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return <PageShimmer variant="cards" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-charcoal">My work</h1>
        <p className="mt-0.5 text-sm text-muted">
          Tasks, assignments, projects, and upcoming events that involve you
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <WorkCard
          title="My tasks"
          count={data.tasks.length}
          icon={ClipboardList}
          empty="No open tasks assigned to you."
        >
          {data.tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={tasksPath(t.committee.id, { taskId: t.id })}
                className="block px-4 py-2.5 transition-colors hover:bg-slate-50"
              >
                <p className="text-sm font-semibold text-charcoal leading-snug">
                  {t.title}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {t.committee.charterLetter
                    ? `${t.committee.charterLetter} · `
                    : ""}
                  {t.committee.name}
                  {" · "}
                  {TASK_STATUS_LABELS[t.status]}
                  {t.dueDate ? ` · Due ${formatDate(t.dueDate)}` : ""}
                  {t.project ? ` · ${t.project.title}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </WorkCard>

        <WorkCard
          title="My assignments"
          count={data.assignments.length}
          icon={Inbox}
          empty="No open assignments involving you."
        >
          {data.assignments.map((a) => (
            <li key={a.id}>
              <Link
                href={assignmentPath(a.id)}
                className="block px-4 py-2.5 transition-colors hover:bg-slate-50"
              >
                <p className="text-sm font-semibold text-charcoal leading-snug">
                  {a.title}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {ASSIGNMENT_STATUS_LABELS[a.status]}
                  {a.targetCommittee ? ` · ${a.targetCommittee.name}` : ""}
                  {a.dueDate ? ` · Due ${formatDate(a.dueDate)}` : ""}
                  {` · From ${a.createdBy.name}`}
                </p>
              </Link>
            </li>
          ))}
        </WorkCard>

        <WorkCard
          title="My projects"
          count={data.projects.length}
          icon={FolderKanban}
          empty="No projects you created or have tasks on."
        >
          {data.projects.map((p) => (
            <li key={p.id}>
              <Link
                href={projectPath(p.committee.id, p.id)}
                className="block px-4 py-2.5 transition-colors hover:bg-slate-50"
              >
                <p className="text-sm font-semibold text-charcoal leading-snug">
                  {p.title}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {p.committee.name}
                  {" · "}
                  {PROJECT_STATUS_LABELS[p.status]}
                  {" · Updated "}
                  {formatDate(p.updatedAt)}
                </p>
              </Link>
            </li>
          ))}
        </WorkCard>

        <WorkCard
          title="Upcoming"
          count={data.upcoming.length}
          icon={Calendar}
          empty="No upcoming events in the next 14 days."
        >
          {data.upcoming.map((e) => (
            <li key={e.id}>
              {e.committee ? (
                <Link
                  href={eventPath(e.committee.id, e.id)}
                  className="block px-4 py-2.5 transition-colors hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-charcoal leading-snug">
                    {e.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(e.startDate)}
                    {` · ${e.committee.name}`}
                    {e.myRsvp ? ` · RSVP ${e.myRsvp.toLowerCase()}` : ""}
                  </p>
                </Link>
              ) : (
                <div className="px-4 py-2.5">
                  <p className="text-sm font-semibold text-charcoal leading-snug">
                    {e.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(e.startDate)}
                    {e.myRsvp ? ` · RSVP ${e.myRsvp.toLowerCase()}` : ""}
                  </p>
                </div>
              )}
            </li>
          ))}
        </WorkCard>
      </div>
    </div>
  );
}
