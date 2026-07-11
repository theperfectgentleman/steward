"use client";



import { useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";

import { BottomSheet } from "@/components/BottomSheet";

import { TouchButton } from "@/components/TouchButton";

import { CreateAssignmentForm } from "@/components/CreateAssignmentForm";

import { useApp } from "@/providers/AppProvider";

import { toPermissionUser } from "@/lib/permissions-client";

import { canCreatePresbyteryAssignment } from "@/lib/types";



export function CreateAssignmentSheet({

  autoOpen = false,

  triggerClassName = "",

}: {

  autoOpen?: boolean;

  triggerClassName?: string;

}) {

  const { user } = useApp();

  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);



  useEffect(() => {

    if (autoOpen || searchParams.get("assign") === "1") {

      setOpen(true);

    }

  }, [autoOpen, searchParams]);



  if (!user) return null;

  const perm = toPermissionUser(user);

  if (!canCreatePresbyteryAssignment(perm)) return null;



  return (

    <>

      <TouchButton

        size="lg"

        className={`text-sm sm:text-base ${triggerClassName}`}

        onClick={() => setOpen(true)}

      >

        Assign work

      </TouchButton>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Presbytery assignment">

        <CreateAssignmentForm embedded onSuccess={() => setOpen(false)} />

      </BottomSheet>

    </>

  );

}

