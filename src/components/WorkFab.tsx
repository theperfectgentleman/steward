"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { TouchButton } from "@/components/TouchButton";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  canCreateDirective,
  canEditTasks,
} from "@/lib/types";
import { tasksPath } from "@/lib/navigation";

export function WorkFab() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, activeCommitteeId } = useApp();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const queryCommitteeId = searchParams.get("committeeId");
  const committeeId =
    queryCommitteeId ?? activeCommitteeId;
  if (!committeeId || committeeId === "all") return null;

  const onWorkPeer =
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/documents") ||
    pathname.startsWith("/events");
  if (!onWorkPeer) return null;

  const perm = toPermissionUser(user);
  const canTask = canEditTasks(perm, committeeId);
  const canAssign = canCreateDirective(perm);

  if (!canTask && !canAssign) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg safe-area-pb"
        aria-label="Create work"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Create">
        <div className="space-y-3 p-1">
          {canTask && (
            <TouchButton
              className="w-full"
              onClick={() => {
                setOpen(false);
                router.push(tasksPath(committeeId, { create: true }));
              }}
            >
              New work
            </TouchButton>
          )}
          {canAssign && (
            <TouchButton
              variant="ghost"
              className="w-full"
              onClick={() => {
                setOpen(false);
                router.push(tasksPath(committeeId, { assign: true }));
              }}
            >
              Assign directive
            </TouchButton>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
