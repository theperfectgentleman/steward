/** Client-safe helpers for the Docs Hocuspocus connect path. */

export const COLLAB_CONNECT_TIMEOUT_MS = 8_000;
export const COLLAB_SYNC_TIMEOUT_MS = 20_000;

export type CollabTokenResponse = {
  mode?: string;
  disabled?: boolean;
  token?: string;
  wsUrl?: string;
  canWrite?: boolean;
  reason?: string;
};

export type CollabConnectDecision =
  | { action: "local"; reason: string }
  | { action: "connect"; token: string; wsUrl: string; canWrite: boolean };

export function isCollabDisabledResponse(
  data: unknown,
  status: number,
): boolean {
  if (status === 503) return true;
  if (!data || typeof data !== "object") return false;
  const d = data as CollabTokenResponse;
  return d.mode === "local" || d.disabled === true;
}

/** Rewrite listen addresses browsers cannot open (0.0.0.0 / ::). */
export function rewriteUnreachableListenHost(wsUrl: string): string {
  return wsUrl
    .replace(/\/\/0\.0\.0\.0\b/, "//127.0.0.1")
    .replace(/\/\/\[::\](?=\s|:|$|\/)/, "//[::1]");
}

/**
 * Turn the token-API wsUrl into something the current page can open.
 * - Relative paths use the page host (ws / wss).
 * - HTTPS pages upgrade ws:// to wss:// except localhost (mixed-content block).
 */
export function resolveBrowserWsUrl(
  wsUrl: string,
  loc?: { protocol: string; host: string },
): string {
  const trimmed = (wsUrl || "").trim();
  if (!trimmed) return trimmed;

  const resolved = rewriteUnreachableListenHost(trimmed);
  const location =
    loc ?? (typeof window !== "undefined" ? window.location : undefined);

  if (resolved.startsWith("/")) {
    if (!location) return resolved;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host}${resolved}`;
  }

  if (location?.protocol === "https:" && resolved.startsWith("ws://")) {
    try {
      const parsed = new URL(resolved.replace(/^ws:/i, "http:"));
      const host = parsed.hostname;
      const isLoopback =
        host === "localhost" || host === "127.0.0.1" || host === "::1";
      if (!isLoopback) {
        return `wss://${resolved.slice("ws://".length)}`;
      }
    } catch {
      /* keep original */
    }
  }

  return resolved;
}

export function decideCollabConnect(
  status: number,
  data: unknown,
  loc?: { protocol: string; host: string },
): CollabConnectDecision {
  if (status === 401 || status === 403) {
    return { action: "local", reason: "unauthorized" };
  }
  if (isCollabDisabledResponse(data, status)) {
    return { action: "local", reason: "disabled" };
  }
  if (status < 200 || status >= 300) {
    return { action: "local", reason: "token-http" };
  }
  const d = (data ?? {}) as CollabTokenResponse;
  if (!d.token || !d.wsUrl) {
    return { action: "local", reason: "malformed" };
  }
  return {
    action: "connect",
    token: d.token,
    wsUrl: resolveBrowserWsUrl(d.wsUrl, loc),
    canWrite: Boolean(d.canWrite),
  };
}

/** Give up on live sync only when the socket never opened (or sync never finished). */
export function shouldAbandonLiveConnect(opts: {
  cancelled: boolean;
  synced: boolean;
  everConnected: boolean;
  requireConnection: boolean;
}): boolean {
  if (opts.cancelled || opts.synced) return false;
  if (opts.requireConnection && opts.everConnected) return false;
  return true;
}
