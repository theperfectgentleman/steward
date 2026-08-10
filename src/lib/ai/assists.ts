/**
 * Governance AI assist types and prompt builders.
 * All assists return suggestions only — never auto-approve, auto-post, or mutate records.
 *
 * API (POST /api/ai/assist with type):
 * - approval_brief
 * - agenda_suggest
 * - minutes_draft
 */

export const ASSIST_TYPES = [
  "approval_brief",
  "agenda_suggest",
  "minutes_draft",
] as const;

export type AssistType = (typeof ASSIST_TYPES)[number];

export function isAssistType(value: unknown): value is AssistType {
  return typeof value === "string" && ASSIST_TYPES.includes(value as AssistType);
}

export function assistSystemPrompt(type: AssistType): string {
  switch (type) {
    case "approval_brief":
      return `You are a governance briefing assistant. Summarize what a reviewer should know before deciding — facts, open questions, and risks. Never recommend approve/reject. Return plain text only.`;
    case "agenda_suggest":
      return `You are a meeting agenda assistant for church committees. Suggest a short ordered agenda from the context. Return plain text with numbered items only. Do not invent attendees or decisions.`;
    case "minutes_draft":
      return `You are a minutes drafting assistant. Produce a draft minutes outline from the meeting/agenda context. Clearly label it as a DRAFT suggestion. Never invent votes or approvals. Return plain text only.`;
  }
}

export function assistUserPrompt(
  type: AssistType,
  context: Record<string, string | null | undefined>,
): string {
  const lines = Object.entries(context)
    .filter(([, v]) => v != null && String(v).trim().length > 0)
    .map(([k, v]) => `${k}: ${v}`);
  return `Assist type: ${type}\n\nContext:\n${lines.join("\n") || "(no context)"}`;
}
