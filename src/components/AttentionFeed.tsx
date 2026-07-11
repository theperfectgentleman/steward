"use client";

import Link from "next/link";
import { TouchButton } from "@/components/TouchButton";
import type { AttentionUrgency } from "@/lib/types";
import type { AttentionItem } from "@/lib/attention";

const URGENCY_LABELS: Record<AttentionUrgency, string> = {
  NOW: "Needs my action",
  SOON: "Due soon",
  WAITING: "Waiting on others",
  FYI: "Activity",
};

const URGENCY_STYLES: Record<AttentionUrgency, string> = {
  NOW: "border-l-primary bg-primary/5",
  SOON: "border-l-accent bg-accent/5",
  WAITING: "border-l-charcoal/40 bg-charcoal/5",
  FYI: "border-l-charcoal/20 bg-white",
};

type Props = {
  items: AttentionItem[];
  onAction?: (item: AttentionItem) => void;
  compact?: boolean;
};

export function AttentionFeed({ items, onAction, compact }: Props) {
  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-muted bg-white rounded-2xl border border-charcoal/10">
        <p className="font-medium text-charcoal">You&apos;re all caught up</p>
        <p className="text-sm mt-1">No items need your attention right now.</p>
      </div>
    );
  }

  const groups = (["NOW", "SOON", "WAITING", "FYI"] as AttentionUrgency[]).map(
    (urgency) => ({
      urgency,
      items: items.filter((i) => i.urgency === urgency),
    }),
  ).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.urgency}>
          {!compact && (
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
              {URGENCY_LABELS[group.urgency]}
            </h3>
          )}
          <ul className="space-y-3">
            {group.items.map((item) => (
              <li
                key={item.id}
                className={`rounded-xl border border-charcoal/10 border-l-4 p-4 bg-white ${URGENCY_STYLES[item.urgency]}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-charcoal">{item.title}</p>
                    <p className="text-sm text-muted mt-0.5">{item.subtitle}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {item.primaryAction && (
                      <TouchButton
                        size="md"
                        onClick={() => onAction?.(item)}
                        className="min-w-[120px]"
                      >
                        {item.primaryAction.label}
                      </TouchButton>
                    )}
                    <Link
                      href={item.href}
                      className="touch-target inline-flex items-center justify-center px-4 py-2 rounded-xl border border-charcoal/15 text-sm font-medium text-charcoal hover:bg-charcoal/5"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
