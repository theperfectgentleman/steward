"use client";

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Calendar,
  ClipboardList,
  GitBranch,
  Home,
  Layers,
  MessageSquare,
  Settings,
  Shield,
} from "lucide-react";
import type { NavLink } from "@/lib/nav";

const ICONS: Record<NavLink["icon"], LucideIcon> = {
  home: Home,
  tasks: ClipboardList,
  events: Calendar,
  documents: Layers,
  messages: MessageSquare,
  admin: Settings,
  structure: GitBranch,
  rbac: Shield,
  committee: Building2,
};

export function NavIcon({
  name,
  className = "h-4 w-4",
  strokeWidth = 2,
}: {
  name: NavLink["icon"];
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ICONS[name] ?? Building2;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}
