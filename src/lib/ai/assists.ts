/**
 * Governance AI assist types and prompt builders.
 * All assists return suggestions only — never auto-approve, auto-post, or mutate records.
 *
 * Wired in UI:
 * - assignment_scope → AssignmentDetailView "Suggest scope"
 * - report_draft → ReportsPipelineView "Draft with AI"
 *
 * API-only (call POST /api/ai/assist with type):
 * - approval_brief
 * - agenda_suggest
 * - minutes_draft
 */

export const ASSIST_TYPES = [
  "report_draft",
  "approval_brief",
  "agenda_suggest",
  "minutes_draft",
  "assignment_scope",
] as const;

export type AssistType = (typeof ASSIST_TYPES)[number];

export function isAssistType(value: unknown): value is AssistType {
  return typeof value === "string" && ASSIST_TYPES.includes(value as AssistType);
}

export function assistSystemPrompt(type: AssistType): string {
  switch (type) {
    case "report_draft":
      return `You are a church committee report writer. Draft a concise progress report body from the project context. Use plain paragraphs. Do not invent completed work. Never mark anything approved or final. Return plain text only.`;
    case "approval_brief":
      return `You are a governance briefing assistant. Summarize what a reviewer should know before deciding — facts, open questions, and risks. Never recommend approve/reject. Return plain text only.`;
    case "agenda_suggest":
      return `You are a meeting agenda assistant for church committees. Suggest a short ordered agenda from the context. Return plain text with numbered items only. Do not invent attendees or decisions.`;
    case "minutes_draft":
      return `You are a minutes drafting assistant. Produce a draft minutes outline from the meeting/agenda context. Clearly label it as a DRAFT suggestion. Never invent votes or approvals. Return plain text only.`;
    case "assignment_scope":
      return `You are a church assignment scoping assistant. Suggest a clear scope of work (objectives, deliverables, out of scope) from the assignment title and description. Return plain text only. Never auto-accept or approve the assignment.`;
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
