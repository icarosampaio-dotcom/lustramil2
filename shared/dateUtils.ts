/**
 * Utility functions for consistent date formatting across the app.
 * 
 * The database stores dates in UTC. When the browser converts UTC dates
 * to local time, dates can shift by one day (e.g., 2026-01-31T00:00:00Z
 * becomes 30/01/2026 in UTC-3 Brazil timezone).
 * 
 * Solution: Always display dates using UTC timezone to match the stored date.
 */

/** Format a date to pt-BR locale string using UTC timezone (avoids timezone shift) */
export function formatDateBR(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** Format a date to YYYY-MM-DD string using UTC (for inputs and comparisons) */
export function toDateString(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}

/** Format date for chart labels using UTC */
export function formatDateLabel(d: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC", ...options });
}

/** Format month name from date using UTC */
export function formatMonthName(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const name = date.toLocaleDateString("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}
