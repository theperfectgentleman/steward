"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { absoluteUrl } from "@/lib/navigation";

type CopyLinkButtonProps = {
  path?: string;
  url?: string;
  label?: string;
  className?: string;
  /** Icon-only control (aria-label still uses `label`). */
  iconOnly?: boolean;
};

export function CopyLinkButton({
  path,
  url,
  label = "Copy link",
  className = "",
  iconOnly = false,
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const target = url ?? (path ? absoluteUrl(path) : "");
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", target);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied" : label}
      className={`inline-flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors touch-target ${
        iconOnly ? "h-8 w-8 rounded-lg hover:bg-primary/10" : ""
      } ${className}`}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          {!iconOnly && "Copied"}
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          {!iconOnly && label}
        </>
      )}
    </button>
  );
}
