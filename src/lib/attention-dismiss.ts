"use client";

/**
 * Session-scoped inbox dismissals (survive within the tab until close).
 * Used when the user Opens an item so it leaves the bell inbox without
 * mutating the underlying work item (e.g. marking a task done).
 */
const STORAGE_KEY = "steward.attention.dismissed";

function readIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function getDismissedAttentionIds(): Set<string> {
  return readIds();
}

export function dismissAttentionItem(id: string) {
  const ids = readIds();
  ids.add(id);
  writeIds(ids);
}

export function filterDismissedAttention<T extends { id: string }>(items: T[]): T[] {
  const dismissed = readIds();
  if (dismissed.size === 0) return items;
  return items.filter((item) => !dismissed.has(item.id));
}
