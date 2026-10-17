import { parseAmount } from './money';
import type { Kobo } from './types';

export interface ParsedLine {
  code: string;
  name: string;
  balance: Kobo;
}

export interface ParseResult {
  lines: ParsedLine[];
  warnings: string[];
  headerRow: number;
}

export const txt = (c: unknown) => (c === null || c === undefined ? '' : String(c).trim());

export const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/** Some packages print the account number and name in one cell: "1000 · Bank" or "1000 - Bank". */
export function splitAccount(cell: string): { code: string; name: string } {
  const m = /^(\d[\d.\-/]*)\s*[·•:\-–—]\s*(\S.*)$/.exec(cell.trim());
  return m ? { code: m[1], name: m[2].trim() } : { code: '', name: cell.trim() };
}

export function findHeader(rows: unknown[][]): Columns | null {
  // Debit and Credit headings are unmistakable. A lone Balance heading is accepted only when
  // no such row exists, so a title line reading "Trial Balance" is not taken for the header.
  for (const needPair of [true, false]) {
    for (let r = 0; r < Math.min(rows.length, 25); r++) {
      const cells = rows[r].map((c) => txt(c).toLowerCase());
      const debit = cells.findIndex((c) => /\bdebit\b|^dr\.?$/.test(c));
      const credit = cells.findIndex((c) => /\bcredit\b|^cr\.?$/.test(c));
      const pair = debit >= 0 && credit >= 0;
      const balance = pair
        ? -1
        : cells.findIndex((c, i) => i !== debit && i !== credit && /balance|amount|^net$|closing/.test(c));
      if (needPair ? !pair : balance < 0) continue;
      const taken = new Set([debit, credit, balance]);
      const code = cells.findIndex(
        (c, i) => !taken.has(i) && /code|number|\bno\.?$|acct|a\/c|\bgl\b|\bid\b/.test(c),
      );
      taken.add(code);
      let name = cells.findIndex(
        (c, i) => !taken.has(i) && /name|description|particular|detail|title|^account$|ledger/.test(c),
      );
      if (name < 0) name = cells.findIndex((c, i) => !taken.has(i) && c !== '');
      // QuickBooks leaves the heading over the account names blank.
      if (name < 0 && code < 0 && pair) name = cells.findIndex((_, i) => !taken.has(i));
      if (name < 0 && code < 0) continue;
      return { row: r, debit, credit, balance: pair ? -1 : balance, code, name };
    }
  }
  return null;
}

/** Which column holds what. -1 when the file has no such column. */
export interface Columns {
  row: number;
  debit: number;
  credit: number;
  balance: number;
  code: number;
  name: number;
}

/**
 * Turn the rows of a CSV or Excel sheet into trial balance lines.
 * Needs a header row naming either Debit and Credit columns or a single Balance column.
 */
export function parseTrialBalance(rows: unknown[][]): ParseResult {
  const h = findHeader(rows);
  if (!h) {
    throw new Error(
      'No header row found. The file needs a row naming the columns: an account name, and either Debit and Credit or a single Balance column.',
    );
  }
  return parseColumns(rows, h);
}

/** Reads the account rows under a header whose columns are already known. */
export function parseColumns(rows: unknown[][], h: Columns): ParseResult {
  const warnings: string[] = [];
  const byCode = new Map<string, ParsedLine>();
  let skippedZero = 0;

  for (let r = h.row + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    let name = h.name >= 0 ? txt(row[h.name]) : '';
    let code = h.code >= 0 ? txt(row[h.code]) : '';
    if (h.code < 0 && name) {
      const split = splitAccount(name);
      if (split.code) ({ code, name } = split);
    }
    if (!name && !code) continue;
    if (/^(grand\s+|sub\s*)?totals?\b/i.test(name) || /^(grand\s+)?totals?\b/i.test(code)) continue;

    let balance: Kobo | null;
    if (h.debit >= 0 && h.credit >= 0) {
      const d = parseAmount(row[h.debit]);
      const c = parseAmount(row[h.credit]);
      balance = d === null && c === null ? null : (d ?? 0) - (c ?? 0);
    } else {
      balance = parseAmount(row[h.balance]);
    }
    if (balance === null) {
      // A heading row inside the trial balance, e.g. "ASSETS". Not an account.
      continue;
    }
    if (balance === 0) {
      skippedZero++;
      continue;
    }
    if (!code) {
      code = slug(name);
    }
    const existing = byCode.get(code);
    if (existing) {
      existing.balance += balance;
      warnings.push(`Account code ${code} appears more than once. The rows were added together.`);
    } else {
      byCode.set(code, { code, name: name || code, balance });
    }
  }

  const lines = [...byCode.values()].filter((l) => l.balance !== 0);
  if (lines.length === 0) throw new Error('No account rows with amounts were found under the header row.');
  if (skippedZero > 0) warnings.push(`${skippedZero} account(s) with a nil balance were left out.`);
  return { lines, warnings, headerRow: h.row };
}
