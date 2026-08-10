"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { NavIcon } from "@/components/layout/NavIcon";
import { useApp } from "@/providers/AppProvider";
import { useNavModel } from "@/hooks/useNavModel";
import type { NavLink } from "@/lib/nav";

function linkActive(pathname: string, href: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  const target = href.replace(/\/$/, "") || "/";

  if (target === "/") return path === "/";
  if (path === target) return true;
  return path.startsWith(`${target}/`);
}

function NavItem({ item, active }: { item: NavLink; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
        active
          ? "bg-primary text-white"
          : "text-white/65 hover:bg-white/10 hover:text-white"
      }`}
    >
      <NavIcon
        name={item.icon}
        className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-white/45"}`}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const { user, attentionCount } = useApp();
  const { model } = useNavModel();

  if (!user || !model) return null;

  return (
    <aside
      className="hidden lg:flex w-[248px] shrink-0 flex-col bg-charcoal text-white"
      aria-label="Main navigation"
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white/10">
          <BrandLogo size={28} className="rounded-md" />
        </div>
        <p className="truncate text-sm font-semibold text-white">Steward</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        <div className="space-y-0.5">
          {model.peers.map((item) => {
            const active = linkActive(pathname, item.href);
            return (
              <div key={item.key} className="relative">
                <NavItem item={item} active={active} />
                {item.key === "home" && attentionCount > 0 && (
                  <span className="absolute right-2 top-1/2 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">
                    {attentionCount > 9 ? "9+" : attentionCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
