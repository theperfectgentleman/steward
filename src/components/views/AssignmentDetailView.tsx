"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { CommentThread } from "@/components/CommentThread";
import { DocumentList } from "@/components/DocumentList";
import { TouchButton } from "@/components/TouchButton";
import { DateInput } from "@/components/DateInput";
import { FormSelect } from "@/components/FormSelect";
import { SearchableCommitteeSelect } from "@/components/SearchableCommitteeSelect";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { RichTextContent } from "@/components/RichTextContent";
import { RichTextEditor, normalizeRichText } from "@/components/RichTextEditor";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { AccessDenied } from "@/components/AccessDenied";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  ASSIGNMENT_PRIORITY_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  canAcceptAssignments,
  canApproveAssignmentReview,
  canCloseAssignment,
  canCreatePresbyteryAssignment,
  isPresbyteryHead,
  isSuperAdmin,
  type AssignmentStatus,
} from "@/lib/types";
import { formatDate, formatDateTime, toInputDateValue } from "@/lib/dates";
import { committeePath, assignmentPath, projectPath } from "@/lib/navigation";
import { PageShimmer } from "@/components/loading/PageShimmer";

type AssignmentDetail = {
  id: string;
  title: string;
  description: string | null;
  source: string;
  status: AssignmentStatus;
  priority: string;
  dueDate: string | null;
  returnComment: string | null;
  createdBy: { id: string; name: string };
  targetCommittee: { id: string; name: string; charterLetter: string };
  sourceCommittee: { id: string; name: string } | null;
  project: { id: string; title: string; tasks?: unknown[] } | null;
  rootTask: { id: string; title: string } | null;
};

type Activity = {
  id: string;
  action: string;
  createdAt: string;
  actor: { name: string };
  metadata?: Record<string, unknown>;
};

type Option = { id: string; name: string; charterLetter?: string };

const EDITABLE: AssignmentStatus[] = [
  "DRAFT",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "RETURNED",
];

export function AssignmentDetailView({ assignmentId }: { assignmentId: string }) {
  const { user, refreshAttention } = useApp();
  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");

  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [convertOpen, setConvertOpen] = useState(actionParam === "accept");
  const [returnOpen, setReturnOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [convertTitle, setConvertTitle] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("NORMAL");
  const [editDueDate, setEditDueDate] = useState("");
  const [committees, setCommittees] = useState<Option[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [targetCommitteeId, setTargetCommitteeId] = useState("");
  const [transferUserId, setTransferUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/assignments/${assignmentId}`)
      .then((r) => {
        if (r.status === 403) {
          setAccessDenied(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setAssignment(data.assignment);
        setActivity(data.activity ?? []);
        setConvertTitle(data.assignment?.title ?? "");
        setEditTitle(data.assignment?.title ?? "");
        setEditDescription(data.assignment?.description ?? "");
        setEditPriority(data.assignment?.priority ?? "NORMAL");
        setEditDueDate(
          data.assignment?.dueDate
            ? toInputDateValue(data.assignment.dueDate)
            : "",
        );
        setTargetCommitteeId(data.assignment?.targetCommittee?.id ?? "");
      })
      .finally(() => setLoading(false));
  }, [assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (actionParam === "accept") setConvertOpen(true);
    if (actionParam === "close" && assignment?.status === "CHAIR_APPROVED") {
      // sticky close button already shown
    }
  }, [actionParam, assignment?.status]);

  if (!user) return null;
  const perm = toPermissionUser(user);

  const patch = async (payload: Record<string, unknown>) => {
    await fetch("/api/assignments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assignmentId, ...payload }),
    });
    load();
    refreshAttention();
  };

  const loadPickers = async () => {
    const [cRes, uRes] = await Promise.all([
      fetch("/api/committees?scope=all"),
      fetch("/api/users"),
    ]);
    const cData = await cRes.json();
    const uData = await uRes.json();
    if (Array.isArray(cData)) {
      setCommittees(cData.map((c: Option) => ({ id: c.id, name: c.name })));
    }
    if (Array.isArray(uData)) {
      setUsers(uData.map((u: Option) => ({ id: u.id, name: u.name })));
    }
  };

  if (loading) {
    return <PageShimmer variant="detail" />;
  }

  if (accessDenied) {
    return <AccessDenied itemLabel="assignment" />;
  }

  if (!assignment) {
    return <p className="text-muted text-center py-12">Assignment not found.</p>;
  }

  const canAccept = canAcceptAssignments(perm, assignment.targetCommittee.id);
  const canApprove = canApproveAssignmentReview(perm, assignment.targetCommittee.id);
  const canClose = canCloseAssignment(perm, assignment.createdBy.id);
  const isPresbytery = canCreatePresbyteryAssignment(perm);
  const canManage =
    canClose || isPresbyteryHead(perm) || isSuperAdmin(perm.role);
  const canEdit =
    canClose &&
    EDITABLE.includes(assignment.status) &&
    assignment.status !== "IN_REVIEW";
  const canReassign =
    canManage &&
    ["ASSIGNED", "ACCEPTED"].includes(assignment.status) &&
    (canClose || isPresbyteryHead(perm));
  const canTransfer = isPresbyteryHead(perm) || isSuperAdmin(perm.role);

  const primaryActions = (
    <>
      {assignment.status === "ASSIGNED" && canAccept && (
        <TouchButton onClick={() => setConvertOpen(true)}>Accept</TouchButton>
      )}
      {["ACCEPTED", "IN_PROGRESS", "RETURNED"].includes(assignment.status) &&
        canAccept && (
          <TouchButton onClick={() => patch({ action: "submit_review" })}>
            Submit for review
          </TouchButton>
        )}
      {assignment.status === "IN_REVIEW" && canApprove && (
        <>
          <TouchButton onClick={() => patch({ action: "approve" })}>Approve</TouchButton>
          <TouchButton variant="secondary" onClick={() => setReturnOpen(true)}>
            Return
          </TouchButton>
        </>
      )}
      {assignment.status === "CHAIR_APPROVED" && canClose && (
        <TouchButton onClick={() => patch({ action: "close" })}>Close</TouchButton>
      )}
      {canClose && !["CLOSED", "CANCELLED"].includes(assignment.status) && (
        <TouchButton variant="secondary" onClick={() => patch({ action: "cancel" })}>
          Cancel
        </TouchButton>
      )}
      {canManage && !["CLOSED", "CANCELLED"].includes(assignment.status) && (
        <TouchButton
          variant="ghost"
          onClick={async () => {
            await loadPickers();
            setManageOpen(true);
          }}
        >
          Manage
        </TouchButton>
      )}
    </>
  );

  return (
    <div className="space-y-6 pb-28 lg:pb-8">
      <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-8">
        <div className="space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent">
              {assignment.source === "PRESBYTERY"
                ? "Presbytery Assignment"
                : "Committee Referral"}
            </p>
            <h1 className="text-2xl font-bold text-charcoal mt-1">{assignment.title}</h1>
            <div className="mt-2">
              <CopyLinkButton path={assignmentPath(assignmentId)} />
            </div>
            <p className="text-sm text-muted mt-2">
              {ASSIGNMENT_STATUS_LABELS[assignment.status]} ·{" "}
              {
                ASSIGNMENT_PRIORITY_LABELS[
                  assignment.priority as keyof typeof ASSIGNMENT_PRIORITY_LABELS
                ]
              }{" "}
              · {assignment.targetCommittee.name}
              {assignment.dueDate &&
                ` · Due ${formatDate(assignment.dueDate)}`}
            </p>
            {assignment.description && (
              <RichTextContent html={assignment.description} className="mt-4" />
            )}
            {assignment.returnComment && (
              <p className="text-sm text-accent mt-3 rounded-xl bg-accent/5 p-3">
                Return note: {assignment.returnComment}
              </p>
            )}
          </div>

          <div className="hidden lg:flex flex-wrap gap-2">{primaryActions}</div>

          {(assignment.project || assignment.rootTask) && (
            <div className="rounded-2xl border border-charcoal/10 bg-white p-4 space-y-2">
              <h2 className="font-semibold text-charcoal">Linked work</h2>
              {assignment.project && (
                <Link
                  href={projectPath(assignment.targetCommittee.id, assignment.project.id)}
                  className="text-primary font-medium"
                >
                  Project: {assignment.project.title}
                </Link>
              )}
              {assignment.rootTask && (
                <Link
                  href={`${committeePath(assignment.targetCommittee.id, "tasks")}?task=${assignment.rootTask.id}`}
                  className="text-primary font-medium block"
                >
                  Task: {assignment.rootTask.title}
                </Link>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-charcoal/10 bg-white p-4">
            <h2 className="font-semibold text-charcoal mb-3">Activity trail</h2>
            <ul className="space-y-2">
              {activity.map((a) => (
                <li
                  key={a.id}
                  className="text-sm text-charcoal border-l-2 border-charcoal/10 pl-3"
                >
                  <span className="font-medium">{a.actor.name}</span> —{" "}
                  {a.action.replace(/_/g, " ").toLowerCase()}
                  <time className="text-xs text-muted block">
                    {formatDateTime(a.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          </div>

          <CommentThread entityType="ASSIGNMENT" entityId={assignmentId} />
          <DocumentList />

          {isPresbytery && (
            <p className="text-xs text-muted">
              Presbytery assignments are directives to committees. Member feedback is
              separate under Report Issue.
            </p>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-charcoal/10 bg-white p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              Actions
            </h2>
            <div className="flex flex-col gap-2">{primaryActions}</div>
          </div>
        </aside>
      </div>

      {/* Mobile sticky action bar */}
      <div className="lg:hidden fixed bottom-20 inset-x-0 z-30 border-t border-charcoal/10 bg-white/95 backdrop-blur px-4 py-3 safe-area-pb">
        <div className="flex gap-2 overflow-x-auto">{primaryActions}</div>
      </div>

      <BottomSheet
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Convert assignment"
      >
        <div className="space-y-4 p-1">
          <p className="text-sm text-muted">
            Accept this assignment and convert it into committee work.
          </p>
          <input
            value={convertTitle}
            onChange={(e) => setConvertTitle(e.target.value)}
            className={FORM_FIELD_CLASS}
            placeholder="Title"
          />
          <TouchButton
            className="w-full"
            onClick={async () => {
              await patch({
                action: "convert",
                convertType: "project",
                convertTitle: convertTitle.trim() || assignment.title,
              });
              setConvertOpen(false);
            }}
          >
            Create as project
          </TouchButton>
          <TouchButton
            variant="secondary"
            className="w-full"
            onClick={async () => {
              await patch({
                action: "convert",
                convertType: "task",
                convertTitle: convertTitle.trim() || assignment.title,
              });
              setConvertOpen(false);
            }}
          >
            Create as task
          </TouchButton>
        </div>
      </BottomSheet>

      <BottomSheet open={returnOpen} onClose={() => setReturnOpen(false)} title="Return for revision">
        <div className="space-y-4 p-1">
          <textarea
            value={returnComment}
            onChange={(e) => setReturnComment(e.target.value)}
            rows={4}
            className={FORM_TEXTAREA_CLASS}
            placeholder="Explain what needs to change (required)"
          />
          <TouchButton
            className="w-full"
            disabled={!returnComment.trim()}
            onClick={async () => {
              await patch({ action: "return", returnComment });
              setReturnOpen(false);
              setReturnComment("");
            }}
          >
            Return to workers
          </TouchButton>
        </div>
      </BottomSheet>

      <BottomSheet open={manageOpen} onClose={() => setManageOpen(false)} title="Manage assignment">
        <div className="space-y-3 p-1">
          {canEdit && (
            <TouchButton
              className="w-full"
              onClick={() => {
                setManageOpen(false);
                setEditOpen(true);
              }}
            >
              Edit details
            </TouchButton>
          )}
          {canReassign && (
            <TouchButton
              variant="secondary"
              className="w-full"
              onClick={() => {
                setManageOpen(false);
                setReassignOpen(true);
              }}
            >
              Reassign committee
            </TouchButton>
          )}
          {canTransfer && (
            <TouchButton
              variant="ghost"
              className="w-full"
              onClick={() => {
                setManageOpen(false);
                setTransferOpen(true);
              }}
            >
              Transfer originator
            </TouchButton>
          )}
        </div>
      </BottomSheet>

      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title="Edit assignment">
        <div className="space-y-3 p-1">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className={FORM_FIELD_CLASS}
            placeholder="Title"
          />
          <RichTextEditor
            value={editDescription}
            onChange={setEditDescription}
            placeholder="Description"
            minHeight="140px"
            compact
          />
          <FormSelect
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value)}
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </FormSelect>
          <DateInput
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
          />
          <TouchButton
            className="w-full"
            onClick={async () => {
              await patch({
                action: "edit",
                title: editTitle.trim(),
                description: normalizeRichText(editDescription),
                priority: editPriority,
                dueDate: editDueDate || null,
              });
              setEditOpen(false);
            }}
          >
            Save changes
          </TouchButton>
        </div>
      </BottomSheet>

      <BottomSheet
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign committee"
      >
        <div className="space-y-3 p-1">
          <SearchableCommitteeSelect
            committees={committees.filter(
              (c): c is { id: string; name: string; charterLetter: string } =>
                Boolean(c.charterLetter),
            )}
            value={targetCommitteeId}
            onChange={setTargetCommitteeId}
            emptyLabel="Select committee"
          />
          <TouchButton
            className="w-full"
            onClick={async () => {
              await patch({
                action: "reassign_committee",
                targetCommitteeId,
              });
              setReassignOpen(false);
            }}
          >
            Reassign
          </TouchButton>
        </div>
      </BottomSheet>

      <BottomSheet
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Transfer originator"
      >
        <div className="space-y-3 p-1">
          <FormSelect
            value={transferUserId}
            onChange={(e) => setTransferUserId(e.target.value)}
          >
            <option value="">Select person…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </FormSelect>
          <TouchButton
            className="w-full"
            disabled={!transferUserId}
            onClick={async () => {
              await patch({
                action: "transfer_originator",
                createdById: transferUserId,
              });
              setTransferOpen(false);
            }}
          >
            Transfer
          </TouchButton>
        </div>
      </BottomSheet>
    </div>
  );
}
