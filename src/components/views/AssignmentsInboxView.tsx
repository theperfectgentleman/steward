"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TouchButton } from "@/components/TouchButton";
import { SearchableCommitteeSelect } from "@/components/SearchableCommitteeSelect";
import { FORM_FIELD_CLASS, FORM_TEXTAREA_CLASS } from "@/lib/form-field";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  ASSIGNMENT_STATUS_LABELS,
  canAcceptAssignments,
  canCreateReferral,
} from "@/lib/types";
import { PageShimmer } from "@/components/loading/PageShimmer";
import { X } from "lucide-react";

type AssignmentRow = {
  id: string;
  title: string;
  status: string;
  source: string;
  priority: string;
  createdBy: { name: string };
  targetCommittee: { name: string } | null;
};

export function AssignmentsInboxView() {
  const { user } = useApp();
  const searchParams = useSearchParams();
  const { committeeId, committee, loading } = useCommitteeContext();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [referralOpen, setReferralOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetCommitteeId, setTargetCommitteeId] = useState("");
  const [committees, setCommittees] = useState<
    { id: string; name: string; charterLetter: string }[]
  >([]);

  const load = useCallback(() => {
    if (!committeeId) return;
    fetch(`/api/assignments?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then(setAssignments)
      .catch(() => undefined);
  }, [committeeId]);

  useEffect(() => {
    load();
    fetch("/api/committees?scope=all")
      .then((r) => r.json())
      .then(setCommittees)
      .catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (searchParams.get("refer") === "1") {
      setReferralOpen(true);
    }
  }, [searchParams]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTargetCommitteeId("");
  };

  const createReferral = async () => {
    if (!title.trim() || !targetCommitteeId || !committeeId) return;
    await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        source: "COMMITTEE_REFERRAL",
        sourceCommitteeId: committeeId,
        targetCommitteeId,
        status: "ASSIGNED",
      }),
    });
    resetForm();
    setReferralOpen(false);
    load();
  };

  if (loading) return <PageShimmer variant="list" lines={5} />;
  if (!committee || !committeeId || !user) {
    return <p className="text-muted text-center py-6">Committee not found.</p>;
  }

  const perm = toPermissionUser(user);
  const canRefer = canCreateReferral(perm, committeeId);
  const canInbox = canAcceptAssignments(perm, committeeId);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-charcoal">Assignments</h1>
          <p className="text-sm text-muted mt-1">
            Supervisory directives and chair-to-chair referrals for {committee.name}
          </p>
          <p className="text-xs text-muted mt-2">
            Referrals go directly to another committee&apos;s assignment inbox.
          </p>
        </div>
        {canRefer && !referralOpen && (
          <TouchButton onClick={() => setReferralOpen(true)}>Refer</TouchButton>
        )}
      </div>

      {canRefer && referralOpen && (
        <section
          className="max-w-xl rounded-xl border border-charcoal/10 bg-white p-4 space-y-3 shadow-2xs"
          aria-labelledby="refer-heading"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="refer-heading" className="text-lg font-bold text-charcoal">
              Refer to committee
            </h2>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setReferralOpen(false);
              }}
              className="touch-target rounded-xl text-muted hover:text-charcoal hover:bg-slate-50"
              aria-label="Cancel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className={FORM_FIELD_CLASS}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does the other committee need to do?"
            rows={3}
            className={FORM_TEXTAREA_CLASS}
          />
          <SearchableCommitteeSelect
            committees={committees.filter((c) => c.id !== committeeId)}
            value={targetCommitteeId}
            onChange={setTargetCommitteeId}
            emptyLabel="Select committee"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <TouchButton
              variant="secondary"
              onClick={() => {
                resetForm();
                setReferralOpen(false);
              }}
            >
              Cancel
            </TouchButton>
            <TouchButton onClick={createReferral}>
              Send referral
            </TouchButton>
          </div>
        </section>
      )}

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-4 py-6 text-center text-sm text-muted">
          No assignments for this committee.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {assignments.map((a) => (
            <li key={a.id}>
              <Link
                href={`/assignments/${a.id}${a.status === "ASSIGNED" && canInbox ? "?action=receive" : ""}`}
                className="block rounded-xl border border-charcoal/10 bg-white px-3 py-2.5 hover:border-primary/30"
              >
                <p className="font-semibold text-charcoal text-sm">{a.title}</p>
                <p className="text-xs text-muted mt-0.5">
                  {a.source === "SUPERVISORY" ? "Supervisory" : "Referral"} · From{" "}
                  {a.createdBy.name} ·{" "}
                  {
                    ASSIGNMENT_STATUS_LABELS[
                      a.status as keyof typeof ASSIGNMENT_STATUS_LABELS
                    ]
                  }
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
