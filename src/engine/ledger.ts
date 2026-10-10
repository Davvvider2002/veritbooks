import { ITEM, isBalanceSheet } from './chart';
import { dayOfWeek, parseDate, resolveDateOrder, type DateOrder } from './dates';
import { parseAmount } from './money';
import { slug, splitAccount } from './parse';
import type { Kobo, TbLine } from './types';

export interface GlEntry {
  entryNo: string;
  date: string; // ISO
  accountCode: string;
  /** Account name as printed in the ledger, when it has one. Used only to match the trial balance. */
  accountName?: string;
  description: string;
  amount: Kobo; // debit positive
  user: string;
}

export interface LedgerParse {
  entries: GlEntry[];
  warnings: string[];
  /** How numeric dates were read, and whether the file itself settled it. */
  dateOrder: { monthFirst: boolean; certain: boolean };
  /** Rows with an amount whose date could not be read. A large number means the wrong date order. */
  badDates: number;
}

const txt = (c: unknown) => (c === null || c === undefined ? '' : String(c).trim());

const SUMMARY_ROW = /^(beginning|ending|opening|closing) balance|^current period change|^(grand |sub ?)?totals?\b|^balance (b\/?f|c\/?f|brought|carried)|^net (change|movement)/i;

/**
 * Read a general ledger or journal listing. Needs a header row with a date, an account
 * and either Debit and Credit or one Amount column. Handles the layouts the common packages
 * export: an account printed once above its transactions, a transaction whose date and number
 * appear only on its first line, opening and closing balance rows, and subtotal rows.
 * A journal number column is used when present. Rows with no number are grouped by day when
 * the file has such a column, and otherwise split wherever the running total returns to nil.
 */
export function parseLedger(rows: unknown[][], opts: { dateOrder?: DateOrder } = {}): LedgerParse {
  let h: { row: number; date: number; code: number; name: number; debit: number; credit: number; amount: number; no: number; jrnl: number; desc: number; user: number } | null = null;
  for (let r = 0; r < Math.min(rows.length, 25) && !h; r++) {
    const c = rows[r].map((x) => txt(x).toLowerCase());
    const find = (re: RegExp, not?: RegExp) => c.findIndex((x) => re.test(x) && !(not && not.test(x)));
    const date = find(/date/);
    const debit = find(/\bdebit\b|^dr\.?$/);
    const credit = find(/\bcredit\b|^cr\.?$/);
    const amount = find(/amount|^value$/, /debit|credit/);
    let code = find(/(account|acct|a\/c|gl|ledger).*(code|no\.?|number|id)|^code$|^account$|^gl$/, /name|desc/);
    const name = find(/(account|acct|ledger).*(name|desc|title)/);
    if (code < 0) code = name >= 0 ? name : find(/account|acct|ledger/);
    let desc = find(/description|narration|memo|detail|remark|comment/, /account|acct/);
    // Tally lists the ledger account under Particulars.
    if (code < 0) code = find(/particular/);
    else if (desc < 0) desc = find(/particular/);
    if (date < 0 || code < 0 || !((debit >= 0 && credit >= 0) || amount >= 0)) continue;
    h = {
      row: r, date, code, name: name === code ? -1 : name, debit, credit, amount,
      no: find(/journal|voucher|vch|\bjv\b|entry|doc(ument)?\.? ?(no|num|id|#)|trans(action)?\.? ?(no|num|id|ref|#)|^ref(erence)?( no\.?)?$|batch/, /date|type|desc/),
      jrnl: find(/^jrnl$/),
      desc,
      user: find(/posted by|user|created by|prepared by|entered by|operator/),
    };
  }
  if (!h) {
    throw new Error(
      'No header row found. The ledger needs a row naming the columns: a date, an account, and either Debit and Credit or one Amount column.',
    );
  }

  const order = resolveDateOrder(opts.dateOrder ?? 'auto', rows.slice(h.row + 1).map((r) => r?.[h!.date]));
  const warnings: string[] = [];
  const entries: GlEntry[] = [];
  let skipped = 0;
  let auto = 1;
  let running = 0;
  let lastAccount = '';
  let lastName = '';
  let lastDate: string | null = null;
  let lastEntry = '';
  let byDay = false;
  let badDates = 0;

  for (let r = h.row + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const description = h.desc >= 0 ? txt(row[h.desc]) : '';
    // An account printed once above its transactions carries down to the rows beneath it.
    let account = txt(row[h.code]);
    if (account) {
      lastAccount = account;
      lastName = h.name >= 0 ? txt(row[h.name]) : '';
    }
    if (SUMMARY_ROW.test(description) || SUMMARY_ROW.test(account)) continue;

    let amount: Kobo | null;
    if (h.debit >= 0 && h.credit >= 0) {
      const d = parseAmount(row[h.debit]);
      const c = parseAmount(row[h.credit]);
      amount = d === null && c === null ? null : (d ?? 0) - (c ?? 0);
    } else {
      amount = parseAmount(row[h.amount]);
    }

    let entryNo = h.no >= 0 ? txt(row[h.no]) : '';
    let date = parseDate(row[h.date], order.monthFirst);
    if (date) {
      if (!account) account = lastAccount;
    } else if (txt(row[h.date]) === '' && account && !entryNo && lastDate && h.no >= 0) {
      // A later line of the same transaction: the date and number are printed on its first line only.
      date = lastDate;
      entryNo = lastEntry;
    }
    if (!date && amount !== null && amount !== 0 && txt(row[h.date]) !== '') badDates++;
    if (!date || !account || amount === null) {
      // A subtotal line shows equal debits and credits, so it nets to nil and is not worth a warning.
      if (amount !== null && amount !== 0 && row.some((x) => txt(x) !== '')) skipped++;
      continue;
    }
    if (amount === 0) continue;

    if (!entryNo) {
      if (h.no >= 0) {
        entryNo = `#${date}`;
        byDay = true;
      } else {
        entryNo = `#${auto}`;
        running += amount;
        if (running === 0) auto++;
      }
    } else if (h.jrnl >= 0 && txt(row[h.jrnl])) {
      entryNo = `${txt(row[h.jrnl])} ${entryNo}`;
    }
    lastDate = date;
    lastEntry = entryNo;
    const split = splitAccount(account);
    entries.push({
      entryNo,
      date,
      accountCode: split.code || account,
      accountName: split.code ? split.name : h.name >= 0 ? txt(row[h.name]) || lastName : undefined,
      description,
      amount,
      user: h.user >= 0 ? txt(row[h.user]) : '',
    });
  }
  if (entries.length === 0) throw new Error('No ledger lines with a date, an account and an amount were found.');
  if (skipped) warnings.push(`${skipped} row(s) with an amount had no date or account and were left out. Check they are totals.`);
  if (h.no < 0) warnings.push('No journal number column was found. Journals were split wherever the running total returned to nil.');
  if (byDay) warnings.push('Some postings carry no journal number. Those are grouped into one journal per day.');
  return { entries, warnings, dateOrder: order, badDates };
}

/**
 * Point each ledger posting at its trial balance account. Packages differ in how they name an
 * account: by number, by name, as "1000 · Bank", or as "Parent:Child". Returns the accounts
 * that could not be found in the trial balance.
 */
export function resolveAccounts(entries: GlEntry[], lines: TbLine[]): { entries: GlEntry[]; unresolved: string[] } {
  const codes = new Set(lines.map((l) => l.code));
  const bySlug = new Map<string, string>();
  for (const l of lines) {
    bySlug.set(slug(l.code), l.code);
    if (!bySlug.has(slug(l.name))) bySlug.set(slug(l.name), l.code);
  }
  const cache = new Map<string, string | null>();
  const unresolved = new Set<string>();
  const out = entries.map((e) => {
    const key = `${e.accountCode}|${e.accountName ?? ''}`;
    let code = cache.get(key);
    if (code === undefined) {
      const tail = (x: string) => x.split(':').pop()!.trim();
      const tries = [e.accountCode, tail(e.accountCode), e.accountName ?? '', tail(e.accountName ?? '')].filter(Boolean);
      code = tries.find((t) => codes.has(t)) ?? null;
      if (!code) {
        for (const t of tries) {
          const hit = bySlug.get(slug(t)) ?? bySlug.get(slug(splitAccount(t).name));
          if (hit) {
            code = hit;
            break;
          }
        }
      }
      cache.set(key, code);
    }
    if (!code) {
      unresolved.add(e.accountName ? `${e.accountCode} ${e.accountName}` : e.accountCode);
      return e;
    }
    return code === e.accountCode ? e : { ...e, accountCode: code };
  });
  return { entries: out, unresolved: [...unresolved].sort() };
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
