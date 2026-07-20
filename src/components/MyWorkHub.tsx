"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AttentionFeed } from "@/components/AttentionFeed";
import { EmailComingSoon } from "@/components/ComingSoonBanner";
import type { AttentionItem } from "@/lib/attention";
import { runAttentionPrimaryAction } from "@/lib/attention-actions";
import {
  dismissAttentionItem,
  filterDismissedAttention,
} from "@/lib/attention-dismiss";
import { useApp } from "@/providers/AppProvider";

export function MyWorkHub() {
  const router = useRouter();
  const { refreshAttention } = useApp();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/attention")
      .then((r) => r.json())
      .then((data) => setItems(filterDismissedAttention(data.items ?? [])))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const openItem = (item: AttentionItem) => {
    dismissAttentionItem(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    refreshAttention();
    router.push(item.href);
  };

  const handleAction = async (item: AttentionItem) => {
    try {
      const result = await runAttentionPrimaryAction(item);
      if (result === "reloaded") {
        dismissAttentionItem(item.id);
        load();
        refreshAttention();
        return;
      }
      openItem(item);
    } catch {
      openItem(item);
    }
  };

  if (loading) {
    return <p className="text-muted">Loading your work…</p>;
  }

  return (
    <section className="space-y-2.5">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-charcoal">My Work</h2>
          <p className="text-xs text-muted">What needs your attention right now</p>
        </div>
        <EmailComingSoon className="sm:max-w-xs" />
      </div>
      <AttentionFeed items={items} onAction={handleAction} onOpen={openItem} />
    </section>
  );
}
