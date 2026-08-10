import { createHmac, timingSafeEqual } from "crypto";

const COLLAB_SECRET =
  process.env.COLLAB_TOKEN_SECRET ||
  process.env.SESSION_SECRET ||
  "steward-collab-dev-secret";

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

export function signCollabToken(payload: Omit<CollabTokenPayload, "exp">, ttlSec = 3600) {
  const body: CollabTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const data = b64url(JSON.stringify(body));
  const sig = createHmac("sha256", COLLAB_SECRET).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

export function verifyCollabToken(token: string): CollabTokenPayload | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", COLLAB_SECRET).update(data).digest();
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
  // Prefer server runtime URL (Dokploy/Docker), then public build-time URL, then local default.
  return (
    process.env.COLLAB_WS_URL ||
    process.env.NEXT_PUBLIC_COLLAB_WS_URL ||
    "ws://localhost:1234"
  );
}
