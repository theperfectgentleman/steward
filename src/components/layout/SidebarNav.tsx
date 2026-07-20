"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { NavIcon } from "@/components/layout/NavIcon";
import { useApp } from "@/providers/AppProvider";
import { useNavModel } from "@/hooks/useNavModel";
import { parseCommitteeId } from "@/lib/navigation";
import type { NavLink } from "@/lib/nav";

function linkActive(pathname: string, href: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  const target = href.replace(/\/$/, "") || "/";

  if (target === "/") return path === "/";
  if (path === target) return true;

  // Committee overview is `/c/[id]` — must not stay active on `/c/[id]/projects` etc.
  if (/^\/c\/[^/]+$/.test(target)) return false;

  return path.startsWith(`${target}/`);
}

function NavItem({
  item,
  active,
  nested = false,
}: {
  item: NavLink;
  active: boolean;
  nested?: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
        nested ? "pl-2" : ""
      } ${
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

function SectionLabel({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full min-h-8 items-center gap-1 px-2 text-[11px] font-semibold tracking-[0.14em] text-white/35 uppercase"
    >
      {open ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const { user, setActiveCommitteeId, attentionCount } = useApp();
  const { model } = useNavModel();
  const routeCommitteeId = parseCommitteeId(pathname);

  const [openSections, setOpenSections] = useState({
    committees: true,
    governance: true,
    admin: true,
  });
  const [expandedCommittees, setExpandedCommittees] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (routeCommitteeId) {
      setActiveCommitteeId(routeCommitteeId);
      setExpandedCommittees((prev) => ({ ...prev, [routeCommitteeId]: true }));
    }
  }, [routeCommitteeId, setActiveCommitteeId]);

  if (!user || !model) return null;

  const orgLabel =
    user.organization?.settings.committeeLabel ?? "Committee";
  const supervisoryLabel =
    user.organization?.settings.supervisoryLabel ?? "Governance";

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
          {model.top.map((item) => {
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

        {model.flags.showCommittees && (
          <div className="space-y-1">
            <SectionLabel
              label={`${orgLabel}s`}
              open={openSections.committees}
              onToggle={() =>
                setOpenSections((s) => ({ ...s, committees: !s.committees }))
              }
            />
            {openSections.committees &&
              model.committees.map((c) => {
                const open =
                  expandedCommittees[c.id] ?? routeCommitteeId === c.id;
                const onCommittee = routeCommitteeId === c.id;
                return (
                  <div key={c.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCommittees((prev) => ({
                          ...prev,
                          [c.id]: !open,
                        }))
                      }
                      className={`flex w-full min-h-9 items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium transition-colors ${
                        onCommittee
                          ? "bg-white/10 text-white"
                          : "text-white/65 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" />
                      )}
                      <NavIcon
                        name="committee"
                        className="h-4 w-4 shrink-0 text-primary"
                      />
                      <span className="truncate">{c.name}</span>
                    </button>
                    {open && (
                      <div className="ml-3 space-y-0.5 border-l border-white/12 pl-2">
                        {c.children.map((child) => (
                          <NavItem
                            key={child.key}
                            item={child}
                            active={linkActive(pathname, child.href)}
                            nested
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {model.flags.showGovernance && (
          <div className="space-y-1">
            <SectionLabel
              label={supervisoryLabel}
              open={openSections.governance}
              onToggle={() =>
                setOpenSections((s) => ({ ...s, governance: !s.governance }))
              }
            />
            {openSections.governance &&
              model.governance.map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  active={linkActive(pathname, item.href)}
                />
              ))}
          </div>
        )}

        {model.flags.showAdmin && (
          <div className="space-y-1">
            <SectionLabel
              label="Admin"
              open={openSections.admin}
              onToggle={() =>
                setOpenSections((s) => ({ ...s, admin: !s.admin }))
              }
            />
            {openSections.admin &&
              model.admin.map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  active={linkActive(pathname, item.href)}
                />
              ))}
          </div>
        )}
      </nav>
    </aside>
  );
}
