"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function QuickActionLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`touch-target inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-primary text-white font-semibold hover:bg-primary-dark min-h-10 px-4 py-2 text-sm rounded-lg w-full ${className}`}
    >
      {children}
    </Link>
  );
}
