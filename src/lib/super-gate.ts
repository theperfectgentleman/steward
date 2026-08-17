import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SUPER_UNLOCK_COOKIE = "steward-super";
const UNLOCK_TTL_SEC = 60 * 60 * 8;

export function superPasswordConfigured(): boolean {
  return Boolean(process.env.SUPER_PASSWORD?.trim());
}

function superSecret(): string | null {
  const password = process.env.SUPER_PASSWORD?.trim();
  return password || null;
}

function hashesEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export function verifySuperPassword(password: string): boolean {
  const secret = superSecret();
  if (!secret) return false;
  return hashesEqual(password, secret);
}

function signUnlock(userId: string, exp: number, secret: string): string {
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function createSuperUnlockToken(userId: string): string | null {
  const secret = superSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SEC;
  return signUnlock(userId, exp, secret);
}

export function readSuperUnlockToken(token: string, userId: string): boolean {
  const secret = superSecret();
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [uid, expRaw, sig] = parts;
  if (uid !== userId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = createHmac("sha256", secret)
    .update(`${uid}.${expRaw}`)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(sigBuf, expectedBuf);
}

export async function isSuperUnlocked(userId: string): Promise<boolean> {
  if (!superPasswordConfigured()) return false;
  const store = await cookies();
  const token = store.get(SUPER_UNLOCK_COOKIE)?.value;
  if (!token) return false;
  return readSuperUnlockToken(token, userId);
}

export function setSuperUnlockCookie(
  response: {
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
    };
  },
  token: string,
) {
  response.cookies.set(SUPER_UNLOCK_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: UNLOCK_TTL_SEC,
    path: "/",
  });
}

export function clearSuperUnlockCookie(response: {
  cookies: { delete: (name: string) => void };
}) {
  response.cookies.delete(SUPER_UNLOCK_COOKIE);
}
