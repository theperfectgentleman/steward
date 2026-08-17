export type CommitteeRef = {
  id: string;
  charterLetter: string;
  name: string;
};

/** Sentinel for "All my groups" in the group switcher */
export const ALL_GROUPS_ID = "all";

export function isAllGroups(id: string | null | undefined): boolean {
  return !id || id === ALL_GROUPS_ID;
}

/** Deep-link into a group's work on a peer tab (replaces legacy /c/:id/... routes). */
export function committeePath(
  committeeId: string,
  section?: "tasks" | "events" | "documents",
) {
  if (section === "events") return eventsPath(committeeId);
  if (section === "documents") return documentsPath({ committeeId });
  return tasksPath(committeeId);
}

export function tasksPath(
  committeeId?: string | null,
  opts?: {
    taskId?: string;
    column?: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "IN_REVIEW";
    filter?: "all" | "needs-me" | "waiting-review";
    assign?: boolean;
    create?: boolean;
  },
) {
  if (opts?.taskId) {
    return `/tasks/${opts.taskId}`;
  }
  const params = new URLSearchParams();
  if (committeeId && !isAllGroups(committeeId)) {
    params.set("committeeId", committeeId);
  }
  if (opts?.column) params.set("column", opts.column);
  if (opts?.filter) params.set("filter", opts.filter);
  if (opts?.assign) params.set("assign", "1");
  if (opts?.create) params.set("create", "1");
  const qs = params.toString();
  return `/tasks${qs ? `?${qs}` : ""}`;
}

export function eventsPath(
  committeeId?: string | null,
  opts?: { eventId?: string },
) {
  if (opts?.eventId && committeeId && !isAllGroups(committeeId)) {
    return `/events/${opts.eventId}?committeeId=${encodeURIComponent(committeeId)}`;
  }
  if (opts?.eventId) {
    return `/events/${opts.eventId}`;
  }
  const params = new URLSearchParams();
  if (committeeId && !isAllGroups(committeeId)) {
    params.set("committeeId", committeeId);
  }
  const qs = params.toString();
  return `/events${qs ? `?${qs}` : ""}`;
}

export function taskPath(_committeeId: string | null | undefined, taskId: string) {
  return `/tasks/${taskId}`;
}

export function eventPath(committeeId: string, eventId: string) {
  return `/events/${eventId}?committeeId=${encodeURIComponent(committeeId)}`;
}

export function meetingPath(committeeId: string, meetingId: string) {
  return `/events?committeeId=${encodeURIComponent(committeeId)}&meeting=${encodeURIComponent(meetingId)}`;
}

export function documentsPath(opts?: { tag?: string; committeeId?: string }) {
  const params = new URLSearchParams();
  if (opts?.committeeId && !isAllGroups(opts.committeeId)) {
    params.set("committeeId", opts.committeeId);
  }
  if (opts?.tag) params.set("tag", opts.tag);
  const qs = params.toString();
  return qs ? `/documents?${qs}` : "/documents";
}

/** Open Tasks with the assign-directive flow */
export function tasksAssignPath(committeeId?: string | null) {
  return tasksPath(committeeId, { assign: true });
}

export function homePath(committeeId?: string | null) {
  if (committeeId && !isAllGroups(committeeId)) {
    return `/?committeeId=${encodeURIComponent(committeeId)}`;
  }
  return "/";
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

/** Read ?committeeId= from a search string (client navigation helpers). */
export function parseCommitteeIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  return params.get("committeeId");
}

/** Map a peer pathname to the group-switcher destination when picking a group */
export function peerPathForGroup(
  pathname: string,
  committeeId: string | typeof ALL_GROUPS_ID,
): string {
  if (pathname.startsWith("/events")) {
    return eventsPath(committeeId === ALL_GROUPS_ID ? null : committeeId);
  }
  if (pathname.startsWith("/documents")) {
    return documentsPath({
      committeeId: committeeId === ALL_GROUPS_ID ? undefined : committeeId,
    });
  }
  if (pathname.startsWith("/tasks")) {
    return tasksPath(committeeId === ALL_GROUPS_ID ? null : committeeId);
  }
  if (pathname === "/") {
    return committeeId === ALL_GROUPS_ID ? "/" : homePath(committeeId);
  }
  if (pathname.startsWith("/messages")) {
    return committeeId === ALL_GROUPS_ID ? "/tasks" : tasksPath(committeeId);
  }
  return tasksPath(committeeId === ALL_GROUPS_ID ? null : committeeId);
}
