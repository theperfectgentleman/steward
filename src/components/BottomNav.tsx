"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ClipboardList,
  FileText,
  Home,
  Settings,
} from "lucide-react";
import type { UserRole } from "@/lib/types";
import { canManageUsers } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/minutes", label: "Minutes", icon: FileText },
  { href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
] as const;

export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-charcoal border-t border-charcoal/20 safe-area-pb"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around h-16 max-w-5xl mx-auto px-1">
        {NAV_ITEMS.filter(
          (item) => !("adminOnly" in item && item.adminOnly) || canManageUsers(role),
        ).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 touch-target min-w-[56px] transition-colors ${
                active ? "text-primary" : "text-white/70"
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[11px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
