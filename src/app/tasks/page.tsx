"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { useApp } from "@/providers/AppProvider";
import { committeePath } from "@/lib/navigation";

function LegacyTasksRedirect() {
  const router = useRouter();
  const { user } = useApp();

  useEffect(() => {
    const last =
      localStorage.getItem("unitycommit-committee") ??
      user?.committeeIds[0];
    if (last) {
      router.replace(committeePath(last, "tasks"));
    } else {
      router.replace("/");
    }
  }, [router, user]);

  return <p className="text-muted text-center py-12">Redirecting…</p>;
}

export default function TasksPage() {
  return (
    <AuthGate>
      <LegacyTasksRedirect />
    </AuthGate>
  );
}
