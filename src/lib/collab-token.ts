import { createHmac, timingSafeEqual } from "crypto";
import { rewriteUnreachableListenHost } from "@/lib/collab-connect";

/** Dev fallback — keep in sync with scripts/collab-server.cjs */
export const COLLAB_DEV_SECRET = "steward-collab-dev-secret";

export function getCollabSecret() {
  return (
    process.env.COLLAB_TOKEN_SECRET ||
    process.env.SESSION_SECRET ||
    COLLAB_DEV_SECRET
  );
}

export function isCollabDisabled() {
  const v = process.env.DISABLE_COLLAB;
  return v === "1" || v === "true";
}

export type CollabTokenPayload = {
  documentId: string;
  userId: string;
  userName: string;
  canWrite: boolean;
  exp: number;
};

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export function signCollabToken(
  payload: Omit<CollabTokenPayload, "exp">,
  ttlSec = 3600,
  secret = getCollabSecret(),
) {
  const body: CollabTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const data = b64url(JSON.stringify(body));
  const sig = createHmac("sha256", secret).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

export function verifyCollabToken(
  token: string,
  secret = getCollabSecret(),
): CollabTokenPayload | null {
  const [data, sig] = String(token || "").split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", secret).update(data).digest();
  const actual = fromB64url(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64url(data).toString("utf8")) as CollabTokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.documentId || !payload.userId) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getCollabWsUrl() {
  const raw =
    process.env.COLLAB_WS_URL ||
    process.env.NEXT_PUBLIC_COLLAB_WS_URL ||
    "ws://localhost:1234";
  return rewriteUnreachableListenHost(raw);
}
