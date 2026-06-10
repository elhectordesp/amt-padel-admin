/**
 * Formats a date range (ISO strings or Date objects) using Intl.DateTimeFormat.
 * Uses timeZone:'UTC' so the stored calendar date is always preserved.
 */
export function formatDateRange(
  startDate: string | Date,
  endDate: string | Date,
  locale = "es-ES",
): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const shortOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  const fullOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };

  if (start.getTime() === end.getTime()) {
    return new Intl.DateTimeFormat(locale, fullOpts).format(start);
  }

  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    const startFmt = new Intl.DateTimeFormat(locale, shortOpts).format(start);
    const endFmt = new Intl.DateTimeFormat(locale, fullOpts).format(end);
    return `${startFmt} – ${endFmt}`;
  }

  const startFmt = new Intl.DateTimeFormat(locale, fullOpts).format(start);
  const endFmt = new Intl.DateTimeFormat(locale, fullOpts).format(end);
  return `${startFmt} – ${endFmt}`;
}
