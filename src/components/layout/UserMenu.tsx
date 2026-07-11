"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useApp } from "@/providers/AppProvider";

export function UserMenu() {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const handleLogout = () => {
    setOpen(false);
    logout();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 touch-target rounded-xl hover:bg-surface px-1 py-1 transition-colors"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <div className="hidden sm:block text-right">
          <p className="text-sm font-semibold text-charcoal truncate max-w-[140px]">
            {user.name}
          </p>
          <p className="text-xs text-muted capitalize">
            {user.role.replace(/_/g, " ").toLowerCase()}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal text-white font-bold text-sm shrink-0">
          {initials}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-charcoal/10 shadow-lg py-2 z-50">
          <div className="px-4 py-3 border-b border-charcoal/10">
            <p className="font-semibold text-charcoal text-sm">{user.name}</p>
            <p className="text-xs text-muted capitalize mt-0.5">
              {user.role.replace(/_/g, " ").toLowerCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-charcoal hover:bg-surface touch-target text-left"
          >
            <LogOut className="h-5 w-5 text-muted" />
            Sign out & switch profile
          </button>
        </div>
      )}
    </div>
  );
}
