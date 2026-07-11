"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Wider panel on desktop for forms with more fields */
  size?: "md" | "lg";
};

const desktopMaxWidth = {
  md: "lg:max-w-lg",
  lg: "lg:max-w-xl",
};

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  size = "md",
}: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-charcoal/50 lg:bg-charcoal/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${desktopMaxWidth[size]} max-h-[85dvh] lg:max-h-[min(85dvh,720px)] overflow-y-auto bg-white rounded-t-3xl lg:rounded-2xl max-lg:sheet-enter lg:modal-enter shadow-2xl lg:shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-charcoal/10 lg:px-6">
          <h2 id="sheet-title" className="text-lg font-bold text-charcoal">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-target flex items-center justify-center rounded-full hover:bg-surface"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="p-5 pb-8 lg:p-6 lg:pb-6">{children}</div>
      </div>
    </div>
  );
}
