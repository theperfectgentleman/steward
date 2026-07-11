"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { TouchButton } from "@/components/TouchButton";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  canCreatePresbyteryAssignment,
  canCreateReferral,
  canEditTasks,
} from "@/lib/types";
import { committeePath, parseCommitteeId } from "@/lib/navigation";

export function WorkFab() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeCommitteeId } = useApp();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const committeeId = parseCommitteeId(pathname) ?? activeCommitteeId;
  if (!committeeId) return null;

  // Only on committee work surfaces (not admin / assignment detail)
  const onCommitteeWork =
    pathname.startsWith(`/c/${committeeId}`) &&
    !pathname.includes("/schedule/");
  if (!onCommitteeWork) return null;

  const perm = toPermissionUser(user);
  const canTask = canEditTasks(perm, committeeId);
  const canRefer = canCreateReferral(perm, committeeId);
  const canAssign = canCreatePresbyteryAssignment(perm);

  if (!canTask && !canRefer && !canAssign) return null;

  const section = pathname.split("/").pop() ?? "tasks";

  const primary = () => {
    if (section === "projects" && canTask) {
      router.push(committeePath(committeeId, "projects"));
      setOpen(true);
      return;
    }
    if (section === "assignments" && canRefer) {
      router.push(committeePath(committeeId, "assignments"));
      setOpen(true);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={primary}
        className="lg:hidden fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg safe-area-pb"
        aria-label="Create work"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Create">
        <div className="space-y-3 p-1">
          {canTask && (
            <>
              <TouchButton
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  router.push(`${committeePath(committeeId, "tasks")}?create=1`);
                }}
              >
                New task
              </TouchButton>
              <TouchButton
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  router.push(`${committeePath(committeeId, "projects")}?create=1`);
                }}
              >
                New project
              </TouchButton>
            </>
          )}
          {canRefer && (
            <TouchButton
              variant="ghost"
              className="w-full"
              onClick={() => {
                setOpen(false);
                router.push(`${committeePath(committeeId, "assignments")}?refer=1`);
              }}
            >
              Refer to another committee
            </TouchButton>
          )}
          {canAssign && (
            <TouchButton
              variant="ghost"
              className="w-full"
              onClick={() => {
                setOpen(false);
                router.push("/?assign=1");
              }}
            >
              Presbytery assignment
            </TouchButton>
          )}
          <p className="text-xs text-muted pt-2">
            Assignments come from Presbytery. Referrals are chair-to-chair. Feedback is for member suggestions.
          </p>
        </div>
      </BottomSheet>
    </>
  );
}
