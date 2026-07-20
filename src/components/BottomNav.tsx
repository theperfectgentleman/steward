"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MoreHorizontal } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { NavIcon } from "@/components/layout/NavIcon";
import { useApp } from "@/providers/AppProvider";
import { useNavModel } from "@/hooks/useNavModel";
import type { NavLink } from "@/lib/nav";

function isDockActive(pathname: string, href: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  const target = href.replace(/\/$/, "") || "/";

  if (target === "/") return path === "/";
  if (path === target) return true;
  if (/^\/c\/[^/]+$/.test(target)) return false;
  return path.startsWith(`${target}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const { attentionCount } = useApp();
  const { model } = useNavModel();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!model) return null;

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-charcoal border-t border-charcoal/20 safe-area-pb"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-16 max-w-5xl items-stretch justify-around px-1">
          {model.mobileDock.map((item) => {
            if (item.key === "more") {
              return (
                <button
                  key="more"
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 touch-target min-w-[56px] transition-colors ${
                    moreOpen ? "text-primary" : "text-white/70"
                  }`}
                >
                  <MoreHorizontal className="h-6 w-6" strokeWidth={2} />
                  <span className="text-[11px] font-medium leading-none">
                    More
                  </span>
                </button>
              );
            }

            const link = item as NavLink;
            const active = isDockActive(pathname, link.href);
            const badge =
              link.key === "home" && attentionCount > 0 ? attentionCount : 0;

            return (
              <Link
                key={link.key}
                href={link.href}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 touch-target min-w-[56px] transition-colors ${
                  active ? "text-primary" : "text-white/70"
                }`}
              >
                <NavIcon
                  name={link.icon}
                  className="h-6 w-6"
                  strokeWidth={active ? 2.5 : 2}
                />
                {badge > 0 && (
                  <span className="absolute top-1 right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
                <span className="text-[11px] font-medium leading-none">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
      >
        <div className="max-h-[70vh] space-y-1 overflow-y-auto pb-4">
          {model.mobileMore.map((item) => {
            const active = isDockActive(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-charcoal hover:bg-charcoal/5"
                }`}
              >
                <NavIcon name={item.icon} className="h-5 w-5 text-stone-500" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}

export function AttentionBellButton({ onClick }: { onClick: () => void }) {
  const { attentionCount } = useApp();
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative touch-target rounded-xl p-2 text-charcoal hover:bg-charcoal/5"
      aria-label="Inbox"
    >
      <Bell className="h-5 w-5" />
      {attentionCount > 0 && (
        <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
          {attentionCount > 9 ? "9+" : attentionCount}
        </span>
      )}
    </button>
  );
}
