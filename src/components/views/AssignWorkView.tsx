"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { CreateAssignmentForm } from "@/components/CreateAssignmentForm";
import { useApp } from "@/providers/AppProvider";
import {
  ASSIGNMENT_STATUS_LABELS,
  type AssignmentStatus,
} from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { assignmentPath, presbyteryAssignmentsPath } from "@/lib/navigation";

type RecentAssignment = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  targetCommittee: { name: string; charterLetter: string };
};

export function AssignWorkView() {
  const { user } = useApp();
  const [recent, setRecent] = useState<RecentAssignment[]>([]);

  useEffect(() => {
    fetch("/api/assignments")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const mine = user
            ? data.filter(
                (a: { createdBy: { id: string } }) => a.createdBy.id === user.id,
              )
            : data;
          setRecent(mine.slice(0, 10));
        }
      })
      .catch(() => undefined);
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-charcoal">Assign work</h1>
          <p className="text-muted mt-1 max-w-xl">
            Send a presbytery directive to a committee with clear instructions and
            deadlines.
          </p>
        </div>
        <Link
          href={presbyteryAssignmentsPath()}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline touch-target"
        >
          <ClipboardList className="h-4 w-4" />
          View full pipeline
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:items-start">
        <CreateAssignmentForm />

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-2xl border border-charcoal/10 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
                Your recent directives
              </h2>
            </div>

            {recent.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">
                No directives yet. Your assignments will appear here.
              </p>
            ) : (
              <ul className="space-y-2">
                {recent.map((a) => {
                  const statusLabel =
                    ASSIGNMENT_STATUS_LABELS[a.status as AssignmentStatus] ??
                    a.status.replace(/_/g, " ");
                  return (
                    <li key={a.id}>
                      <Link
                        href={assignmentPath(a.id)}
                        className="block rounded-xl border border-charcoal/8 px-3.5 py-3 hover:border-primary/35 hover:bg-primary/[0.03] transition-colors"
                      >
                        <p className="font-semibold text-charcoal text-sm leading-snug line-clamp-2">
                          {a.title}
                        </p>
                        <p className="text-xs text-muted mt-1.5">
                          {a.targetCommittee.charterLetter.toUpperCase()}){" "}
                          {a.targetCommittee.name}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                            {statusLabel}
                          </span>
                          <time className="text-[11px] text-muted">
                            {formatDate(a.updatedAt)}
                          </time>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="hidden lg:block rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
            <p className="text-sm font-semibold text-charcoal">Tips</p>
            <ul className="mt-2 space-y-1.5 text-sm text-muted leading-relaxed list-disc pl-4">
              <li>Use the description for deliverables and context.</li>
              <li>Save as draft if you need presbytery review first.</li>
              <li>High priority is for time-sensitive directives only.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
