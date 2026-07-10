"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ClipboardList,
  FileText,
  Home,
  LogOut,
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
  { key: "home", href: "/", label: "Home", icon: Home, section: null as string | null },
  { key: "tasks", label: "Tasks", icon: ClipboardList, section: "tasks" },
  { key: "schedule", label: "Schedule", icon: Calendar, section: "schedule" },
  { key: "minutes", label: "Minutes", icon: FileText, section: "minutes" },
  { key: "admin", href: "/admin", label: "Admin", icon: Settings, adminOnly: true },
] as const;

function resolveHref(
  item: (typeof NAV_ITEMS)[number],
  committeeId: string | null,
  lastCommitteeId: string | null,
) {
  if ("href" in item && item.href) return item.href;
  const cid = committeeId ?? lastCommitteeId;
  if (!cid || !("section" in item) || !item.section) return "/";
  return committeePath(cid, item.section as "tasks" | "schedule" | "minutes");
}

function isActive(
  pathname: string,
  item: (typeof NAV_ITEMS)[number],
  committeeId: string | null,
) {
  if (item.key === "home") {
    return pathname === "/";
  }
  if (item.key === "admin") return pathname.startsWith("/admin");
  if ("section" in item && item.section) {
    return pathname.endsWith(`/${item.section}`) && committeeId === parseCommitteeId(pathname);
  }
  return false;
}

export function SidebarNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { logout } = useApp();
  const committeeId = parseCommitteeId(pathname);
  const lastCommitteeId =
    typeof window !== "undefined"
      ? localStorage.getItem("unitycommit-committee")
      : null;

  return (
    <nav
      className="hidden lg:flex flex-col items-center w-[72px] shrink-0 bg-charcoal py-4 gap-1"
      aria-label="Main navigation"
    >
      <Link
        href="/"
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white font-bold text-sm"
        title="UnityCommit"
      >
        UC
      </Link>

      {NAV_ITEMS.filter(
        (item) => !("adminOnly" in item && item.adminOnly) || canManageUsers(role),
      ).map((item) => {
        const href = resolveHref(item, committeeId, lastCommitteeId);
        const active = isActive(pathname, item, committeeId);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={href}
            title={item.label}
            className={`touch-target flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-colors ${
              active
                ? "bg-primary text-charcoal"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
            <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
          </Link>
        );
      })}

      <div className="flex-1" />

      <button
        type="button"
        onClick={logout}
        title="Sign out"
        className="touch-target flex flex-col items-center justify-center w-14 h-14 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
      >
        <LogOut className="h-5 w-5" />
        <span className="text-[10px] font-medium mt-0.5">Exit</span>
      </button>
    </nav>
  );
}
