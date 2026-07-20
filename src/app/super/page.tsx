"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/providers/AppProvider";
import { LoginPicker } from "@/components/LoginPicker";
import { SuperConsoleView } from "@/components/views/SuperConsoleView";
import { PageLoader } from "@/components/loading/PageShimmer";

export default function SuperPage() {
  const { user, loading } = useApp();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    setReady(true);
    if (user && !user.isPlatformAdmin) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || !ready) {
    return (
      <div className="min-h-dvh bg-stone-950">
        <PageLoader label="Loading Super…" />
      </div>
    );
  }

  if (!user) return <LoginPicker />;
  if (!user.isPlatformAdmin) return null;

  return <SuperConsoleView />;
}
