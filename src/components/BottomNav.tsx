"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { NavIcon } from "@/components/layout/NavIcon";
import { useApp } from "@/providers/AppProvider";
import { useNavModel } from "@/hooks/useNavModel";

function isDockActive(pathname: string, href: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  const target = href.replace(/\/$/, "") || "/";

  if (target === "/") return path === "/";
  if (path === target) return true;
  return path.startsWith(`${target}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  const { attentionCount } = useApp();
  const { model } = useNavModel();

  if (!model) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-charcoal border-t border-charcoal/20 safe-area-pb"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-16 max-w-5xl items-stretch justify-around px-1">
        {model.mobileDock.map((link) => {
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
