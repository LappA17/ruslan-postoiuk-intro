import type { YearMonth } from '../data/cv';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function currentYearMonth(date = new Date()): YearMonth {
  return [date.getFullYear(), date.getMonth() + 1];
}

// Inclusive on both ends, the way LinkedIn counts tenure.
export function monthsBetween(start: YearMonth, end: YearMonth): number {
  return (end[0] - start[0]) * 12 + (end[1] - start[1]) + 1;
}

export function formatYearMonth(value: YearMonth): string {
  return `${MONTHS[value[1] - 1]} ${value[0]}`;
}

export function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ${years > 1 ? 'YRS' : 'YR'}`);
  if (rest) parts.push(`${rest} MO`);
  return parts.join(' ');
}

export function yearsSince(start: YearMonth, now: YearMonth = currentYearMonth()): number {
  return Math.round(monthsBetween(start, now) / 12);
}

export function toIso(value: YearMonth): string {
  return `${value[0]}-${String(value[1]).padStart(2, '0')}`;
}

export function parseIso(value: string | undefined): YearMonth | null {
  const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  return match ? [Number(match[1]), Number(match[2])] : null;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
