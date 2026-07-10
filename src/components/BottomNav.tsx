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
import {
  committeePath,
  parseCommitteeId,
} from "@/lib/navigation";

const NAV_ITEMS = [
  { key: "home", href: "/", label: "Home", icon: Home },
  { key: "tasks", label: "Tasks", icon: ClipboardList, section: "tasks" as const },
  { key: "schedule", label: "Schedule", icon: Calendar, section: "schedule" as const },
  { key: "minutes", label: "Minutes", icon: FileText, section: "minutes" as const },
  { key: "admin", href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
] as const;

function resolveHref(
  item: (typeof NAV_ITEMS)[number],
  committeeId: string | null,
  lastCommitteeId: string | null,
) {
  if ("href" in item && item.href) return item.href;
  const cid = committeeId ?? lastCommitteeId;
  if (!cid || !("section" in item)) return "/";
  return committeePath(cid, item.section);
}

export function BottomNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const committeeId = parseCommitteeId(pathname);
  const lastCommitteeId =
    typeof window !== "undefined"
      ? localStorage.getItem("unitycommit-committee")
      : null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-charcoal border-t border-charcoal/20 safe-area-pb"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around h-16 max-w-5xl mx-auto px-1">
        {NAV_ITEMS.filter(
          (item) => !("adminOnly" in item && item.adminOnly) || canManageUsers(role),
        ).map((item) => {
          const href = resolveHref(item, committeeId, lastCommitteeId);
          const active =
            item.key === "home"
              ? pathname === "/"
              : item.key === "admin"
                ? pathname.startsWith("/admin")
                : pathname.endsWith(`/${(item as { section?: string }).section ?? ""}`);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 touch-target min-w-[56px] transition-colors ${
                active ? "text-primary" : "text-white/70"
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[11px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
