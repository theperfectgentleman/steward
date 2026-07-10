export const FEEDBACK_LIMITS = {
  /** Minimum characters for a meaningful message */
  minMessageLength: 15,
  /** Maximum message length */
  maxMessageLength: 2000,
  /** Max submissions per user per committee per rolling 24h window */
  maxPerCommitteePerDay: 3,
  /** Min seconds between any two submissions from the same user */
  cooldownSeconds: 300,
  /** Reject duplicate message text within this window (seconds) */
  duplicateWindowSeconds: 3600,
  /** Max URLs allowed in a single message */
  maxUrls: 2,
} as const;

export type FeedbackType = "ISSUE" | "SUGGESTION";

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  ISSUE: "Issue",
  SUGGESTION: "Suggestion",
};

export function countUrls(text: string): number {
  const matches = text.match(/https?:\/\/|www\./gi);
  return matches?.length ?? 0;
}

export function normalizeMessage(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}
