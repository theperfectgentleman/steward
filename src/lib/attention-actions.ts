import type { AttentionItem } from "@/lib/attention";

/**
 * Runs the inbox primary action. Returns whether the feed should reload
 * (work completed in place) or the caller should navigate to `item.href`.
 */
export async function runAttentionPrimaryAction(
  item: AttentionItem,
): Promise<"reloaded" | "navigate"> {
  const action = item.primaryAction;
  if (!action) return "navigate";

  if (action.action === "mark_done" && action.entityType === "TASK") {
    const res = await fetch(`/api/tasks/${action.entityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    if (!res.ok) {
      throw new Error("Could not mark task done");
    }
    return "reloaded";
  }

  return "navigate";
}
