"use client";

import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FilePenLine,
  FileText,
  FolderKanban,
  GitBranch,
  Home,
  Inbox,
  Layers,
  ListTodo,
  MessageSquare,
  Settings,
  Shield,
} from "lucide-react";
import type { NavLink } from "@/lib/nav";

const ICONS: Record<NavLink["icon"], LucideIcon> = {
  home: Home,
  inbox: Inbox,
  assignments: ClipboardCheck,
  tasks: ClipboardList,
  projects: FolderKanban,
  schedule: Calendar,
  minutes: FileText,
  reports: FilePenLine,
  reportInbox: FileCheck2,
  documents: Layers,
  messages: MessageSquare,
  myWork: ListTodo,
  admin: Settings,
  structure: GitBranch,
  rbac: Shield,
  assign: Briefcase,
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
