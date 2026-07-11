"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AttentionFeed } from "@/components/AttentionFeed";
import { EmailComingSoon } from "@/components/ComingSoonBanner";
import type { AttentionItem } from "@/lib/attention";

export function MyWorkHub() {
  const router = useRouter();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/attention")
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleAction = async (item: AttentionItem) => {
    if (!item.primaryAction) return;

    if (item.primaryAction.action === "mark_done") {
      await fetch(`/api/tasks/${item.primaryAction.entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      load();
      return;
    }

    if (
      ["accept", "approve", "close", "assign"].includes(item.primaryAction.action)
    ) {
      router.push(item.href);
      return;
    }

    router.push(item.href);
  };

  if (loading) {
    return <p className="text-muted">Loading your work…</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-charcoal">My Work</h2>
          <p className="text-sm text-muted">What needs your attention right now</p>
        </div>
        <EmailComingSoon className="sm:max-w-xs" />
      </div>
      <AttentionFeed items={items} onAction={handleAction} />
    </section>
  );
}
