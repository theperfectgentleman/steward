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
      className={`touch-target inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-primary text-white font-semibold hover:bg-primary-dark min-h-14 px-6 py-4 text-lg rounded-2xl w-full text-sm sm:text-base ${className}`}
    >
      {children}
    </Link>
  );
}
