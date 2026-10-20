// Reading which year a trial balance belongs to, and placing several years at once.
//
// A firm can import up to five years in one go: several files, one file with a column per
// year, or both. Each year is found from, in order of trust:
//   1. a column heading that names the year ("2025", "31 Dec 2024", "Debit 2023");
//   2. the title lines above the header ("Trial balance as at 31 December 2025");
//   3. the file name ("TB FY2024.xlsx").
// The year is the year in which the period ends, as the engagement's year end is. The
// accountant sees what was found and can change it before anything is saved.
import { findHeader, parseColumns, txt, type Columns, type ParsedLine } from './parse';

/** Where a year was read from. Null when nothing named one. */
export type YearSource = 'column' | 'title' | 'file name' | null;

/** One year of balances found in an imported file. */
export interface YearSet {
  /** The file it came from. */
  file: string;
  /** The column heading, when the file holds several years. */
  column: string | null;
  year: number | null;
  how: YearSource;
  lines: ParsedLine[];
  warnings: string[];
}

/** The slots a year can fill in an engagement. */
export type Slot = 'current' | 'prior' | 'prior2' | 'prior3' | 'prior4';
export const SLOTS: Slot[] = ['current', 'prior', 'prior2', 'prior3', 'prior4'];
export const MAX_YEARS = 5;
/** Each slot in words. */
export const SLOT_NAME: Record<Slot, string> = { current: 'current year', prior: 'prior year', prior2: 'two years before', prior3: 'three years before', prior4: 'four years before' };

const YEAR = /(?<!\d)(19[5-9]\d|20\d{2})(?!\d)/g;

/** Every four-digit year in a cell. Dates from Excel arrive as Date objects. */
function yearsIn(cell: unknown): number[] {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) return [cell.getUTCFullYear()];
  const s = txt(cell);
  // An amount is not a year: "2,025.00" and "2025.00" are left alone.
  if (/^\(?-?[\d,]+\.\d+\)?$/.test(s)) return [];
  return [...s.matchAll(YEAR)].map((m) => Number(m[1]));
}

/** The latest year written in some text, or null. A period "1 April 2024 to 31 March 2025" ends in 2025. */
export function latestYear(cells: unknown[]): number | null {
  const all = cells.flatMap(yearsIn);
  return all.length ? Math.max(...all) : null;
}

/** The year in a file name, ignoring anything that is not a plausible year. */
export function yearFromFileName(name: string): number | null {
  const base = name.replace(/\.[a-z0-9]+$/i, '');
  return latestYear([base.replace(/[_.]/g, ' ')]);
}

/**
 * A header with a column for each year: "Account, 2025, 2024, 2023", or Debit and Credit
 * under each year. Needs at least two different years in one row.
 */
function findYearColumns(rows: unknown[][]): { row: number; code: number; name: number; years: { year: number; label: string; debit: number; credit: number; balance: number }[] } | null {
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const cells = rows[r].map((c) => (c instanceof Date ? c : txt(c)));
    // A row of account balances is never the header, whatever years its names mention.
    const isYear = (n: number) => Number.isInteger(n) && n >= 1950 && n <= 2099;
    if (rows[r].some((c) => (typeof c === 'number' && !isYear(c)) || (typeof c === 'string' && /^\(?-?[\d,]+\.\d{2}\)?$/.test(c.trim())))) continue;
    const tagged = cells
      .map((c, i) => ({ i, label: c instanceof Date ? c.toISOString().slice(0, 10) : String(c), years: yearsIn(c) }))
      .filter((c) => c.years.length === 1);
    const distinct = new Set(tagged.map((c) => c.years[0]));
    if (distinct.size < 2) continue;
    const lower = (i: number) => String(cells[i]).toLowerCase();
    const years = [...distinct].map((year) => {
      const cols = tagged.filter((c) => c.years[0] === year);
      const debit = cols.find((c) => /\bdebit\b|\bdr\b/.test(lower(c.i)))?.i ?? -1;
      const credit = cols.find((c) => /\bcredit\b|\bcr\b/.test(lower(c.i)))?.i ?? -1;
      const balance = debit >= 0 && credit >= 0 ? -1 : cols[0].i;
      return { year, label: cols.map((c) => c.label).join(' / '), debit, credit, balance };
    });
    const taken = new Set(tagged.map((c) => c.i));
    const plain = cells.map((c) => (c instanceof Date ? '' : String(c).toLowerCase()));
    const code = plain.findIndex((c, i) => !taken.has(i) && /code|number|\bno\.?$|acct|a\/c|\bgl\b|\bid\b/.test(c));
    let name = plain.findIndex((c, i) => !taken.has(i) && i !== code && /name|description|particular|detail|title|^account$|ledger/.test(c));
    if (name < 0) name = plain.findIndex((c, i) => !taken.has(i) && i !== code && c !== '');
    if (name < 0 && code < 0) continue;
    return { row: r, code, name, years: years.sort((a, b) => b.year - a.year) };
  }
  return null;
}

/**
 * Reads a trial balance file and returns each year it holds, with the year it was found to be.
 * A file with one year of balances returns one set.
 */
export function readYears(rows: unknown[][], fileName: string): YearSet[] {
  const multi = findYearColumns(rows);
  if (multi) {
    const sets: YearSet[] = [];
    for (const y of multi.years) {
      const h: Columns = { row: multi.row, code: multi.code, name: multi.name, debit: y.debit, credit: y.credit, balance: y.balance };
      try {
        const p = parseColumns(rows, h);
        sets.push({ file: fileName, column: y.label, year: y.year, how: 'column', lines: p.lines, warnings: p.warnings });
      } catch {
        // A year column with no amounts in it, such as a date printed in the heading row, is not a year of balances.
      }
    }
    if (sets.length > 0) return sets.slice(0, MAX_YEARS);
  }
  const h = findHeader(rows);
  if (!h) {
    throw new Error(
      `${fileName}: no header row found. The file needs a row naming the columns: an account name, and either Debit and Credit or a single Balance column.`,
    );
  }
  const p = parseColumns(rows, h);
  // A single year named in the header row itself, such as "Balance at 31 Dec 2024".
  const inHeader = latestYear(rows[h.row] ?? []);
  const inTitle = latestYear(rows.slice(0, h.row).flat());
  const inName = yearFromFileName(fileName);
  const [year, how]: [number | null, YearSource] =
    inHeader !== null ? [inHeader, 'column'] : inTitle !== null ? [inTitle, 'title'] : inName !== null ? [inName, 'file name'] : [null, null];
  return [{ file: fileName, column: null, year, how, lines: p.lines, warnings: p.warnings }];
}

/** Where a year belongs in an engagement with this year end, or null when it is not one of the five. */
export function slotFor(year: number | null, yearEnd: string): Slot | null {
  if (year === null) return null;
  const gap = Number(yearEnd.slice(0, 4)) - year;
  return gap >= 0 && gap < SLOTS.length ? SLOTS[gap] : null;
}

/** The year a slot stands for. */
export const yearOfSlot = (slot: Slot, yearEnd: string) => Number(yearEnd.slice(0, 4)) - SLOTS.indexOf(slot);

/** What is wrong with a set of choices, in words. Empty when it can be imported. */
export function placementProblems(chosen: (Slot | null)[]): string[] {
  const used = chosen.filter((c): c is Slot => c !== null);
  const problems: string[] = [];
  if (used.length === 0) problems.push('Choose which year each file is.');
  for (const s of SLOTS) if (used.filter((u) => u === s).length > 1) problems.push(`Two files are set as the same year (${SLOT_NAME[s]}). Choose one.`);
  return problems;
}
