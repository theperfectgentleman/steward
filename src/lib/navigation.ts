export type CommitteeRef = {
  id: string;
  charterLetter: string;
  name: string;
};

export function committeePath(
  committeeId: string,
  section?: "tasks" | "schedule" | "minutes",
) {
  const base = `/c/${committeeId}`;
  return section ? `${base}/${section}` : base;
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
): "overview" | "tasks" | "schedule" | "minutes" {
  if (pathname.endsWith("/tasks")) return "tasks";
  if (pathname.endsWith("/schedule")) return "schedule";
  if (pathname.endsWith("/minutes")) return "minutes";
  return "overview";
}
