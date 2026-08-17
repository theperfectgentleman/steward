"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export type OverflowDotsItem = {
  label: string;
  onClick: () => void;
};

export function OverflowDots({
  items,
  label = "More",
  tone = "light",
}: {
  items: OverflowDotsItem[];
  label?: string;
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const buttonClass =
    tone === "dark"
      ? "inline-flex h-11 w-11 items-center justify-center rounded-xl text-stone-400 transition hover:bg-white/10 hover:text-stone-200"
      : "inline-flex h-11 w-11 items-center justify-center rounded-xl text-stone-400 transition hover:bg-white/60 hover:text-stone-700";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={buttonClass}
      >
        <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-48 rounded-xl border border-charcoal/10 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-charcoal hover:bg-surface"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
