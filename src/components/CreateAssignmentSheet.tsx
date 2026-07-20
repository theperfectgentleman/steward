"use client";

import { useRouter } from "next/navigation";
import { TouchButton } from "@/components/TouchButton";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import { canCreatePresbyteryAssignment } from "@/lib/types";

export function CreateAssignmentSheet({
  triggerClassName = "",
}: {
  autoOpen?: boolean;
  triggerClassName?: string;
}) {
  const { user } = useApp();
  const router = useRouter();

  if (!user) return null;
  const perm = toPermissionUser(user);
  if (!canCreatePresbyteryAssignment(perm)) return null;

  return (
    <TouchButton
      size="lg"
      className={`text-sm sm:text-base ${triggerClassName}`}
      onClick={() => router.push("/assign-work")}
    >
      Assign work
    </TouchButton>
  );
}
