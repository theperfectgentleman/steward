import { createHash, randomBytes, randomInt } from "crypto";
import { hashPassword, verifyPassword } from "@/lib/password";

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export async function hashOtp(code: string): Promise<string> {
  return hashPassword(code);
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  return verifyPassword(code, hash);
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export const OTP_TTL_MS = 10 * 60 * 1000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
