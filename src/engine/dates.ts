const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function build(y: number, m: number, d: number): string | null {
  if (y < 100) y += y < 70 ? 2000 : 1900;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // e.g. 31 June
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Parse a date cell into ISO yyyy-mm-dd. Numeric dates are read day first, as written in Nigeria:
 * 03/04/2025 is 3 April. Pass monthFirst for files exported by software set to the American order. Accepts Excel date cells and serial numbers, 2025-04-03, 03/04/2025,
 * 03-04-25, 03-Apr-2025, 3 April 2025, each with an optional time after it.
 */
export function parseDate(raw: unknown, monthFirst = false): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString().slice(0, 10);
  if (typeof raw === 'number') {
    if (raw < 30000 || raw > 80000) return null;
    return new Date(Math.round((raw - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/.exec(s);
  if (m) return monthFirst ? build(+m[3], +m[1], +m[2]) : build(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[-/.\s]([A-Za-z]{3,9})[-/.,\s]+(\d{2}|\d{4})(?:\s.*)?$/.exec(s);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    return mon ? build(+m[3], mon, +m[1]) : null;
  }
  return null;
}

export const dayOfWeek = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay();
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
export const addDays = (iso: string, n: number) =>
  new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const shortDate = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

export type DateOrder = 'auto' | 'day' | 'month';

/**
 * Work out whether numeric dates in a column are written day first or month first.
 * 13/01/2025 can only be day first, and 01/13/2025 only month first. When every date
 * could be read either way, the answer is day first, marked as not certain.
 */
export function detectDateOrder(cells: unknown[]): { monthFirst: boolean; certain: boolean } {
  let day = false;
  let month = false;
  let numeric = 0;
  for (const c of cells) {
    if (typeof c !== 'string') continue;
    const m = /^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s.*)?$/.exec(c);
    if (!m) continue;
    numeric++;
    if (+m[1] > 12) day = true;
    if (+m[2] > 12) month = true;
  }
  if (numeric === 0) return { monthFirst: false, certain: true }; // no ambiguous format in the file
  if (month && !day) return { monthFirst: true, certain: true };
  return { monthFirst: false, certain: day && !month };
}

export function resolveDateOrder(order: DateOrder, cells: unknown[]): { monthFirst: boolean; certain: boolean } {
  if (order === 'day') return { monthFirst: false, certain: true };
  if (order === 'month') return { monthFirst: true, certain: true };
  return detectDateOrder(cells);
}
