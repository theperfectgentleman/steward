/** Steward-themed status chips (primary emerald, accent gold, charcoal neutrals). */

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
