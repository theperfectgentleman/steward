const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function toDate(
  value: Date | string | number | null | undefined,
): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ghana-style date: 22-Jan-2026 */
export function formatDate(
  value: Date | string | number | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  return `${day}-${month}-${d.getFullYear()}`;
}

/** 22-Jan-2026, 3:45 PM */
export function formatDateTime(
  value: Date | string | number | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  const time = d.toLocaleTimeString("en-GH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${formatDate(d)}, ${time}`;
}

/** Saturday, 22-Jan-2026 */
export function formatDateWithWeekday(
  value: Date | string | number | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  const weekday = d.toLocaleDateString("en-GH", { weekday: "long" });
  return `${weekday}, ${formatDate(d)}`;
}

/** Jan 2026 — filenames, month headers */
export function formatMonthYear(
  value: Date | string | number | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Saturday, 22-Jan-2026, 3:45 PM */
export function formatDateTimeWithWeekday(
  value: Date | string | number | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  const time = d.toLocaleTimeString("en-GH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${formatDateWithWeekday(d)}, ${time}`;
}

export function toInputDateValue(
  value: Date | string | number | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** yyyy-mm-ddThh:mm for datetime-local inputs */
export function toInputDateTimeValue(
  value: Date | string | number | null | undefined,
): string {
  const d = toDate(value);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}
