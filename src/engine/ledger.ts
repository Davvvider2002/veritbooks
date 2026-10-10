import { ITEM, isBalanceSheet } from './chart';
import { dayOfWeek, parseDate } from './dates';
import { parseAmount } from './money';
import type { Kobo, TbLine } from './types';

export interface GlEntry {
  entryNo: string;
  date: string; // ISO
  accountCode: string;
  description: string;
  amount: Kobo; // debit positive
  user: string;
}

export interface LedgerParse {
  entries: GlEntry[];
  warnings: string[];
}

const txt = (c: unknown) => (c === null || c === undefined ? '' : String(c).trim());

/**
 * Read a general ledger or journal listing. Needs a header row with a date, an account code
 * and either Debit and Credit or one Amount column. A journal number column is used when
 * present; without one, journals are split wherever the running total returns to nil.
 */
export function parseLedger(rows: unknown[][]): LedgerParse {
  let h: { row: number; date: number; code: number; debit: number; credit: number; amount: number; no: number; desc: number; user: number } | null = null;
  for (let r = 0; r < Math.min(rows.length, 25) && !h; r++) {
    const c = rows[r].map((x) => txt(x).toLowerCase());
    const find = (re: RegExp, not?: RegExp) => c.findIndex((x) => re.test(x) && !(not && not.test(x)));
    const date = find(/date/);
    const debit = find(/\bdebit\b|^dr\.?$/);
    const credit = find(/\bcredit\b|^cr\.?$/);
    const amount = find(/amount|^value$/);
    let code = find(/(account|acct|a\/c|gl|ledger).*(code|no\.?|number|id)|^code$|^account$|^gl$/);
    if (code < 0) code = find(/account|acct|ledger/);
    if (date < 0 || code < 0 || !((debit >= 0 && credit >= 0) || amount >= 0)) continue;
    h = {
      row: r, date, code, debit, credit, amount,
      no: find(/journal|voucher|\bjv\b|entry|doc(ument)?\.? ?(no|num|id)|trans(action)?\.? ?(no|num|id|ref)|^ref(erence)?( no\.?)?$|batch/, /date/),
      desc: find(/description|narration|memo|detail|particular|remark|comment/),
      user: find(/posted by|user|created by|prepared by|entered by|operator/),
    };
  }
  if (!h) {
    throw new Error(
      'No header row found. The ledger needs a row naming the columns: a date, an account code, and either Debit and Credit or one Amount column.',
    );
  }

  const warnings: string[] = [];
  const entries: GlEntry[] = [];
  let skipped = 0;
  let auto = 1;
  let running = 0;
  for (let r = h.row + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const date = parseDate(row[h.date]);
    const accountCode = txt(row[h.code]);
    let amount: Kobo | null;
    if (h.debit >= 0 && h.credit >= 0) {
      const d = parseAmount(row[h.debit]);
      const c = parseAmount(row[h.credit]);
      amount = d === null && c === null ? null : (d ?? 0) - (c ?? 0);
    } else {
      amount = parseAmount(row[h.amount]);
    }
    if (!date || !accountCode || amount === null) {
      if (row.some((x) => txt(x) !== '')) skipped++;
      continue;
    }
    if (amount === 0) continue;
    let entryNo = h.no >= 0 ? txt(row[h.no]) : '';
    if (!entryNo) {
      entryNo = `#${auto}`;
      running += amount;
      if (running === 0) auto++;
    }
    entries.push({
      entryNo,
      date,
      accountCode,
      description: h.desc >= 0 ? txt(row[h.desc]) : '',
      amount,
      user: h.user >= 0 ? txt(row[h.user]) : '',
    });
  }
  if (entries.length === 0) throw new Error('No ledger lines with a date, an account and an amount were found.');
  if (skipped) warnings.push(`${skipped} row(s) had no date, account or amount and were left out. Check they are headings or totals.`);
  if (h.no < 0) warnings.push('No journal number column was found. Journals were split wherever the running total returned to nil.');
  return { entries, warnings };
}

export type Flag =
  | 'unbalanced'
  | 'weekend'
  | 'period_end'
  | 'outside_period'
  | 'round'
  | 'large'
  | 'no_description'
  | 'keyword'
  | 'revenue_pair'
  | 'duplicate'
  | 'rare_account'
  | 'unknown_account';

export const FLAG_LABEL: Record<Flag, string> = {
  unbalanced: 'Does not balance',
  weekend: 'Posted on a weekend',
  period_end: 'Last five days of the year',
  outside_period: 'Dated outside the year',
  round: 'Round amount',
  large: 'At or above performance materiality',
  no_description: 'No description',
  keyword: 'Adjustment wording',
  revenue_pair: 'Revenue with no cash or receivable',
  duplicate: 'Duplicate of another journal',
  rare_account: 'Rarely used account',
  unknown_account: 'Account not in the trial balance',
};

/** A journal with this many flags or more must be tested and concluded on before sign-off. */
export const HIGH_RISK_SCORE = 3;

export interface Journal {
  entryNo: string;
  date: string;
  description: string;
  user: string;
  lines: GlEntry[];
  value: Kobo; // total debits
  flags: Flag[];
  score: number;
}

export interface Agreement {
  code: string;
  name: string;
  ledger: Kobo;
  expected: Kobo | null; // null when there is no prior year to measure a balance sheet movement
  difference: Kobo | null;
}

export interface LedgerTest {
  journals: Journal[]; // highest score first
  highRisk: Journal[];
  agreement: Agreement[];
  disagreements: number;
  unknownAccounts: string[];
  lineCount: number;
  totalDebits: Kobo;
  flagCounts: Partial<Record<Flag, number>>;
}

const KEYWORDS = /adjust|revers|correct|write.?off|suspense|per (the )?(md|ceo|director|management|chairman)|error|plug|to balance|balancing/i;

export function testLedger(
  entries: GlEntry[],
  lines: TbLine[],
  opts: { yearEnd: string; performance: Kobo | null },
): LedgerTest {
  const byCode = new Map(lines.map((l) => [l.code, l]));
  const section = (code: string) => {
    const m = byCode.get(code)?.mapCode;
    return m ? ITEM.get(m) : undefined;
  };
  const yearStart = `${Number(opts.yearEnd.slice(0, 4)) - 1}${opts.yearEnd.slice(4)}`; // exclusive: same day, prior year
  const periodEndFrom = new Date(Date.parse(opts.yearEnd + 'T00:00:00Z') - 4 * 86400000).toISOString().slice(0, 10);

  const postings = new Map<string, number>();
  const movement = new Map<string, Kobo>();
  const groups = new Map<string, GlEntry[]>();
  let totalDebits = 0;
  for (const e of entries) {
    postings.set(e.accountCode, (postings.get(e.accountCode) ?? 0) + 1);
    movement.set(e.accountCode, (movement.get(e.accountCode) ?? 0) + e.amount);
    if (e.amount > 0) totalDebits += e.amount;
    const g = groups.get(e.entryNo);
    if (g) g.push(e);
    else groups.set(e.entryNo, [e]);
  }

  // Two journals are duplicates when they share a date and identical lines.
  const signatures = new Map<string, number>();
  const sig = (g: GlEntry[]) => g[0].date + '|' + g.map((e) => `${e.accountCode}:${e.amount}`).sort().join(',');
  for (const g of groups.values()) signatures.set(sig(g), (signatures.get(sig(g)) ?? 0) + 1);

  const flagCounts: Partial<Record<Flag, number>> = {};
  const journals: Journal[] = [];
  for (const [entryNo, g] of groups) {
    const flags: Flag[] = [];
    const value = g.reduce((a, e) => a + Math.max(e.amount, 0), 0);
    const date = g[0].date;
    const description = g.find((e) => e.description)?.description ?? '';
    if (g.reduce((a, e) => a + e.amount, 0) !== 0) flags.push('unbalanced');
    const dow = dayOfWeek(date);
    if (dow === 0 || dow === 6) flags.push('weekend');
    if (date > opts.yearEnd || date <= yearStart) flags.push('outside_period');
    else if (date >= periodEndFrom) flags.push('period_end');
    if (value >= 100_000_000 && value % 10_000_000 === 0) flags.push('round'); // N1m and up, in whole N100,000s
    if (opts.performance && opts.performance > 0 && value >= opts.performance) flags.push('large');
    if (description.replace(/[^a-z0-9]/gi, '').length < 4) flags.push('no_description');
    if (KEYWORDS.test(description)) flags.push('keyword');
    const creditsRevenue = g.some((e) => e.amount < 0 && section(e.accountCode)?.code === 'revenue');
    const debitsCashOrDebtor = g.some((e) => {
      const c = section(e.accountCode)?.code;
      return e.amount > 0 && (c === 'cash' || c === 'trade_receivables');
    });
    if (creditsRevenue && !debitsCashOrDebtor) flags.push('revenue_pair');
    if ((signatures.get(sig(g)) ?? 0) > 1) flags.push('duplicate');
    if (g.some((e) => byCode.has(e.accountCode) && (postings.get(e.accountCode) ?? 0) <= 2)) flags.push('rare_account');
    if (g.some((e) => !byCode.has(e.accountCode))) flags.push('unknown_account');
    for (const f of flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
    const score = flags.length + (flags.includes('unbalanced') ? 2 : 0);
    journals.push({ entryNo, date, description, user: g[0].user, lines: g, value, flags, score });
  }
  journals.sort((a, b) => b.score - a.score || b.value - a.value || a.entryNo.localeCompare(b.entryNo));

  // Completeness: the ledger's movement on each account should explain the trial balance.
  const agreement: Agreement[] = [];
  for (const l of lines) {
    const item = l.mapCode ? ITEM.get(l.mapCode) : undefined;
    const ledger = movement.get(l.code) ?? 0;
    let expected: Kobo | null;
    // Opening retained earnings move by the prior year's closing entry, not by this year's postings.
    if (!item || item.code === 'retained_earnings') expected = null;
    else if (isBalanceSheet(item.section)) expected = l.prior === null ? null : l.balance - l.prior;
    else expected = l.balance;
    agreement.push({ code: l.code, name: l.name, ledger, expected, difference: expected === null ? null : ledger - expected });
  }
  const unknownAccounts = [...movement.keys()].filter((c) => !byCode.has(c)).sort();

  return {
    journals,
    highRisk: journals.filter((j) => j.score >= HIGH_RISK_SCORE),
    agreement,
    disagreements: agreement.filter((a) => a.difference !== null && a.difference !== 0).length,
    unknownAccounts,
    lineCount: entries.length,
    totalDebits,
    flagCounts,
  };
}
