export type CommitteeRef = {
  id: string;
  charterLetter: string;
  name: string;
};

export function committeePath(
  committeeId: string,
  section?:
    | "tasks"
    | "schedule"
    | "minutes"
    | "projects"
    | "assignments"
    | "documents",
) {
  const base = `/c/${committeeId}`;
  return section ? `${base}/${section}` : base;
}

export function tasksPath(
  committeeId: string,
  opts?: {
    taskId?: string;
    column?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
    filter?: "mine" | "all" | "standalone" | "project";
  },
) {
  const params = new URLSearchParams();
  if (opts?.taskId) params.set("task", opts.taskId);
  if (opts?.column) params.set("column", opts.column);
  if (opts?.filter) params.set("filter", opts.filter);
  const qs = params.toString();
  return `${committeePath(committeeId, "tasks")}${qs ? `?${qs}` : ""}`;
}

export function presbyteryAssignmentsPath(status?: "open", mine?: boolean) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (mine) params.set("mine", "1");
  const qs = params.toString();
  return qs ? `/assignments?${qs}` : "/assignments";
}

export function projectPath(committeeId: string, projectId: string) {
  return `${committeePath(committeeId, "projects")}/${projectId}`;
}

export function taskPath(committeeId: string, taskId: string) {
  return `${committeePath(committeeId, "tasks")}?task=${encodeURIComponent(taskId)}`;
}

export function assignmentPath(assignmentId: string) {
  return `/assignments/${assignmentId}`;
}

export function eventPath(committeeId: string, eventId: string) {
  return `${committeePath(committeeId, "schedule")}/${eventId}`;
}

export function meetingPath(committeeId: string, meetingId: string) {
  return `${committeePath(committeeId, "schedule")}?meeting=${encodeURIComponent(meetingId)}`;
}

export function suggestionsPath(committeeId?: string) {
  const params = new URLSearchParams();
  if (committeeId) params.set("committeeId", committeeId);
  const qs = params.toString();
  return qs ? `/suggestions?${qs}` : "/suggestions";
}

export function documentsPath(opts?: { tag?: string; committeeId?: string }) {
  if (opts?.committeeId) {
    const params = new URLSearchParams();
    if (opts.tag) params.set("tag", opts.tag);
    const qs = params.toString();
    return `${committeePath(opts.committeeId, "documents")}${qs ? `?${qs}` : ""}`;
  }
  const params = new URLSearchParams();
  if (opts?.tag) params.set("tag", opts.tag);
  const qs = params.toString();
  return qs ? `/documents?${qs}` : "/documents";
}

export function assignWorkPath() {
  return "/assign-work";
}

export function invitePath(token: string) {
  return `/invite/${token}`;
}

export function absoluteUrl(path: string, origin?: string) {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isCommitteeRoute(pathname: string) {
  return pathname.startsWith("/c/");
}

export function parseCommitteeId(pathname: string): string | null {
  const match = pathname.match(/^\/c\/([^/]+)/);
  return match?.[1] ?? null;
}

export function parseCommitteeSection(
  pathname: string,
): "overview" | "tasks" | "schedule" | "minutes" | "projects" | "assignments" | "documents" {
  const committeeId = parseCommitteeId(pathname);
  if (!committeeId) return "overview";

  const rest = pathname.slice(`/c/${committeeId}`.length);
  if (rest === "" || rest === "/") return "overview";
  if (rest.startsWith("/tasks")) return "tasks";
  if (rest.startsWith("/projects")) return "projects";
  if (rest.startsWith("/schedule")) return "schedule";
  if (rest.startsWith("/minutes")) return "minutes";
  if (rest.startsWith("/assignments")) return "assignments";
  if (rest.startsWith("/documents")) return "documents";
  return "overview";
}
