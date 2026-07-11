"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { TouchButton } from "./TouchButton";

type AccessDeniedProps = {
  itemLabel?: string;
  message?: string;
  showHomeLink?: boolean;
};

export function AccessDenied({
  itemLabel = "item",
  message,
  showHomeLink = true,
}: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 max-w-md mx-auto">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-charcoal/5 mb-5">
        <ShieldOff className="h-8 w-8 text-muted" />
      </div>
      <h2 className="text-xl font-bold text-charcoal">You don&apos;t have access</h2>
      <p className="text-muted mt-2 text-sm leading-relaxed">
        {message ??
          `This ${itemLabel} is only visible to committee members who have been added. Ask your chair or admin to invite you.`}
      </p>
      {showHomeLink && (
        <Link href="/" className="mt-6">
          <TouchButton variant="secondary">Go to dashboard</TouchButton>
        </Link>
      )}
    </div>
  );
}
