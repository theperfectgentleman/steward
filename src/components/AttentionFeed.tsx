"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

function StackedAttentionGroup({
  urgency,
  items,
  onAction,
}: {
  urgency: AttentionUrgency;
  items: AttentionItem[];
  onAction?: (item: AttentionItem) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  };

  const activeItem = items[activeIndex];
  const showNav = items.length > 1;

  return (
    <div className={`relative isolate ${showNav ? "pb-4 mb-2" : ""}`}>
      {/* Behind cards stack container */}
      {showNav && (
        <>
          {/* Card behind 1 */}
          <div className="absolute -bottom-2 left-2.5 right-2.5 h-full rounded-xl border border-charcoal/10 bg-white pointer-events-none -z-10 transform scale-[0.98] origin-bottom transition-all duration-300 shadow-xs" />
          {/* Card behind 2 */}
          {items.length > 2 && (
            <div className="absolute -bottom-4 left-5 right-5 h-full rounded-xl border border-charcoal/10 bg-white/80 pointer-events-none -z-20 transform scale-[0.96] origin-bottom transition-all duration-300 shadow-2xs" />
          )}
        </>
      )}

      {/* Active Card */}
      <div
        className={`relative z-10 rounded-xl border border-charcoal/10 border-l-4 p-4 bg-white shadow-xs ${URGENCY_STYLES[urgency]}`}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-charcoal text-base leading-snug">{activeItem.title}</p>
              <p className="text-sm text-muted mt-1 font-medium">{activeItem.subtitle}</p>
            </div>
            <div className="flex gap-2 shrink-0 items-center">
              {activeItem.primaryAction && (
                <TouchButton
                  size="md"
                  onClick={() => onAction?.(activeItem)}
                  className="min-w-[120px]"
                >
                  {activeItem.primaryAction.label}
                </TouchButton>
              )}
              <Link
                href={activeItem.href}
                className="touch-target inline-flex items-center justify-center px-4 py-2 rounded-xl border border-charcoal/15 text-sm font-semibold text-charcoal hover:bg-charcoal/5 transition-colors"
              >
                Open
              </Link>
            </div>
          </div>

          {/* Navigation panel */}
          {showNav && (
            <div className="flex items-center justify-between border-t border-charcoal/10 pt-3 mt-1">
              <span className="text-xs font-bold text-accent uppercase tracking-wider select-none">
                {items.length} items waiting
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-charcoal/15 bg-white text-charcoal shadow-xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                  aria-label="Previous item"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-bold text-charcoal tabular-nums select-none min-w-[32px] text-center">
                  {activeIndex + 1} / {items.length}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-charcoal/15 bg-white text-charcoal shadow-xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                  aria-label="Next item"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
          <StackedAttentionGroup
            urgency={group.urgency}
            items={group.items}
            onAction={onAction}
          />
        </section>
      ))}
    </div>
  );
}

