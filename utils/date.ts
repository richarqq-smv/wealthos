export type PeriodKey = "1W" | "1M" | "3M" | "6M" | "1J" | "ALLES";

export function nowISO(): string {
  return new Date().toISOString();
}

export function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateMedium(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthKey(key: string): string {
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() - 1);
  return monthKey(date);
}

export function isInMonth(iso: string, key: string): boolean {
  return monthKey(new Date(iso)) === key;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function subtractDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

export function subtractMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

export function periodStartDate(period: PeriodKey, from: Date = new Date()): Date | null {
  switch (period) {
    case "1W":
      return subtractDays(from, 7);
    case "1M":
      return subtractMonths(from, 1);
    case "3M":
      return subtractMonths(from, 3);
    case "6M":
      return subtractMonths(from, 6);
    case "1J":
      return subtractMonths(from, 12);
    case "ALLES":
      return null;
  }
}

export function groupLabelForDate(iso: string): string {
  const date = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  const yesterday = subtractDays(today, 1);
  if (date.getTime() === today.getTime()) return "Vandaag";
  if (date.getTime() === yesterday.getTime()) return "Gisteren";
  return formatDateLong(iso);
}
