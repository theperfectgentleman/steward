"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { absoluteUrl } from "@/lib/navigation";

type CopyLinkButtonProps = {
  path?: string;
  url?: string;
  label?: string;
  className?: string;
};

export function CopyLinkButton({
  path,
  url,
  label = "Copy link",
  className = "",
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
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors touch-target ${className}`}
      aria-label={label}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Copied
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4" />
          {label}
        </>
      )}
    </button>
  );
}
