"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Calendar,
  ClipboardList,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  Settings,
} from "lucide-react";
import type { UserRole } from "@/lib/types";
import { canManageUsers } from "@/lib/types";
import {
  committeePath,
  parseCommitteeId,
} from "@/lib/navigation";
import { useApp } from "@/providers/AppProvider";

const NAV_ITEMS = [
  { key: "home", href: "/", label: "Home", icon: Home },
  { key: "tasks", label: "Tasks", icon: ClipboardList, section: "tasks" as const },
  { key: "projects", label: "Projects", icon: FolderKanban, section: "projects" as const },
  { key: "assignments", label: "Inbox", icon: Inbox, section: "assignments" as const },
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
  const { attentionCount } = useApp();
  const committeeId = parseCommitteeId(pathname);
  const [lastCommitteeId, setLastCommitteeId] = useState<string | null>(null);

  useEffect(() => {
    setLastCommitteeId(localStorage.getItem("unitycommit-committee"));
  }, [pathname]);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !("adminOnly" in item && item.adminOnly) || canManageUsers(role),
  ).slice(0, 5);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-charcoal border-t border-charcoal/20 safe-area-pb"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around h-16 max-w-5xl mx-auto px-1">
        {visibleItems.map((item) => {
          const href = resolveHref(item, committeeId, lastCommitteeId);
          const active =
            item.key === "home"
              ? pathname === "/"
              : item.key === "admin"
                ? pathname.startsWith("/admin")
                : pathname.endsWith(`/${(item as { section?: string }).section ?? ""}`);
          const Icon = item.icon;
          const badge = item.key === "home" && attentionCount > 0 ? attentionCount : 0;
          return (
            <Link
              key={item.key}
              href={href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 touch-target min-w-[56px] transition-colors ${
                active ? "text-primary" : "text-white/70"
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
              {badge > 0 && (
                <span className="absolute top-1 right-2 min-w-[18px] h-[18px] rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
              <span className="text-[11px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AttentionBellButton({ onClick }: { onClick: () => void }) {
  const { attentionCount } = useApp();
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative touch-target rounded-xl p-2 text-charcoal hover:bg-charcoal/5"
      aria-label="Attention inbox"
    >
      <Bell className="h-5 w-5" />
      {attentionCount > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center px-1">
          {attentionCount > 9 ? "9+" : attentionCount}
        </span>
      )}
    </button>
  );
}
