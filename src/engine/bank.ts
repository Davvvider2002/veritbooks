import { daysBetween, parseDate, resolveDateOrder, type DateOrder } from './dates';
import type { GlEntry } from './ledger';
import { parseAmount } from './money';
import type { Kobo } from './types';

export interface BankLine {
  date: string; // ISO
  description: string;
  amount: Kobo; // money in is positive
  balance: Kobo | null;
}

export interface BankParse {
  lines: BankLine[];
  opening: Kobo | null;
  /** Number of rows where the running balance does not follow from the row before. */
  breaks: number;
  firstBreak: string | null;
  warnings: string[];
  dateOrder: { monthFirst: boolean; certain: boolean };
}

const txt = (c: unknown) => (c === null || c === undefined ? '' : String(c).trim());

/**
 * Read a bank statement exported as CSV or Excel. Needs a header row with a date and either
 * Debit and Credit (or Withdrawal and Deposit) columns or one signed Amount column.
 * On a bank statement, a debit is money out.
 */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseBankStatement(rows: unknown[][], dateOrder: DateOrder = 'auto'): BankParse {
  let h: { row: number; date: number; desc: number; out: number; in: number; amount: number; balance: number } | null = null;
  for (let r = 0; r < Math.min(rows.length, 40) && !h; r++) {
    const c = rows[r].map((x) => txt(x).toLowerCase());
    const find = (re: RegExp, not?: RegExp) => c.findIndex((x) => re.test(x) && !(not && not.test(x)));
    const date = find(/date/);
    const out = find(/debit|withdraw|money out|paid out|payment|^dr\.?$/);
    const inn = find(/credit|deposit|money in|paid in|lodg|receipt|^cr\.?$/);
    const amount = find(/amount/);
    if (date < 0 || !((out >= 0 && inn >= 0) || amount >= 0)) continue;
    h = {
      row: r, date, out, in: inn, amount,
      desc: (() => {
        // Prefer the narration over a reference number column.
        const d = find(/narration|description|remark|detail|particular|transaction$/);
        return d >= 0 ? d : find(/reference/);
      })(),
      balance: find(/balance/),
    };
  }
  if (!h) {
    throw new Error(
      'No header row found. The statement needs a row naming the columns: a date, and either Debit and Credit or one Amount column.',
    );
  }

  // Dates printed without a year, as "03 Jan" on FNB and other South African statements, take it
  // from the statement period above the table, moving on a year when the months turn back.
  const yearMatch = rows
    .slice(0, h.row)
    .map((r) => (r ?? []).map(txt).join(' '))
    .join(' ')
    .match(/\b(19|20)\d{2}\b/);
  let year = yearMatch ? Number(yearMatch[0]) : null;
  let lastMonth = 0;
  let yearless = 0;
  rows = rows.map((r, i) => {
    if (i <= h!.row || !r) return r;
    const m = /^(\d{1,2})\s*([A-Za-z]{3,9})\.?$/.exec(txt(r[h!.date]));
    const mon = m ? MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1 : 0;
    if (!m || !mon) return r;
    yearless++;
    if (year === null) return r;
    if (mon < lastMonth) year++;
    lastMonth = mon;
    const out = [...r];
    out[h!.date] = `${m[1]} ${m[2].slice(0, 3)} ${year}`;
    return out;
  });

  // Statements that print one Amount column mark money in with Cr and money out with no mark or Dr,
  // and balances in credit with Cr and overdrawn ones with Dr.
  const marked = (col: number) => col >= 0 && rows.slice(h.row + 1).some((r) => /\d\s*(cr|dr)\.?$/i.test(txt(r?.[col])));
  const amountMarked = h.out < 0 || h.in < 0 ? marked(h.amount) : false;
  const balanceMarked = marked(h.balance);
  const bankAmount = (raw: unknown, isBalance: boolean): Kobo | null => {
    const s = txt(raw);
    const v = parseAmount(s.replace(/(cr|dr)\.?$/i, ''));
    if (v === null) return null;
    if (/cr\.?$/i.test(s)) return Math.abs(v);
    if (/dr\.?$/i.test(s)) return -Math.abs(v);
    return isBalance ? v : -Math.abs(v);
  };

  const order = resolveDateOrder(dateOrder, rows.slice(h.row + 1).map((r) => r?.[h!.date]));
  const lines: BankLine[] = [];
  const warnings: string[] = [];
  let opening: Kobo | null = null;
  let previous: Kobo | null = null;
  let breaks = 0;
  let firstBreak: string | null = null;
  let skipped = 0;

  for (let r = h.row + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const date = parseDate(row[h.date], order.monthFirst);
    const balance = h.balance < 0 ? null : balanceMarked ? bankAmount(row[h.balance], true) : parseAmount(row[h.balance]);
    let amount: Kobo | null;
    if (h.out >= 0 && h.in >= 0) {
      const o = parseAmount(row[h.out]);
      const i = parseAmount(row[h.in]);
      amount = o === null && i === null ? null : (i ?? 0) - (o ?? 0);
    } else {
      amount = amountMarked ? bankAmount(row[h.amount], false) : parseAmount(row[h.amount]);
    }
    if (!date) {
      if (row.some((x) => txt(x) !== '')) skipped++;
      continue;
    }
    if (amount === null || amount === 0) {
      // An opening or brought-forward balance row carries a balance and no movement.
      if (balance !== null && previous === null) {
        opening = balance;
        previous = balance;
      }
      continue;
    }
    if (balance !== null) {
      if (previous === null) opening = balance - amount;
      else if (previous + amount !== balance) {
        breaks++;
        firstBreak ??= date;
      }
      previous = balance;
    }
    lines.push({ date, description: h.desc >= 0 ? txt(row[h.desc]) : '', amount, balance });
  }

  if (lines.length === 0) throw new Error('No transactions with a date and an amount were found under the header row.');
  if (yearless && year === null) warnings.push('The dates have no year and no statement period was found above the table, so those rows were left out.');
  if (skipped) warnings.push(`${skipped} row(s) had no readable date and were left out.`);
  if (h.balance < 0) warnings.push('The statement has no balance column, so the closing balance must be entered by hand and the running balance cannot be checked.');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].date < lines[i - 1].date) {
      warnings.push('The transactions are not in date order. Export the statement oldest first.');
      break;
    }
  }
  return { lines, opening, breaks, firstBreak, warnings, dateOrder: order };
}

/** Balance on the statement at the close of a given day, or null when the statement carries no balances. */
export function balanceAt(p: Pick<BankParse, 'lines' | 'opening'>, date: string): Kobo | null {
  let b = p.opening;
  let seen = false;
  for (const l of p.lines) {
    if (l.date > date) break;
    if (l.balance !== null) {
      b = l.balance;
      seen = true;
    }
  }
  return seen || p.opening !== null ? b : null;
}

export interface Outstanding extends GlEntry {
  /** Date the item cleared the bank after the year end, when the statement runs that far. */
  clearedOn: string | null;
}

export interface Reconciliation {
  matched: number;
  /** In the ledger by the year end but not on the statement by then: uncredited lodgements and unpresented payments. */
  ledgerOnly: Outstanding[];
  /** On the statement by the year end but not in the ledger. These usually need a journal. */
  bankOnly: BankLine[];
  ledgerOnlyTotal: Kobo;
  bankOnlyTotal: Kobo;
  bankClosing: Kobo;
  ledgerBalance: Kobo;
  /** Statement balance, plus ledger-only items, less bank-only items. */
  expectedLedger: Kobo;
  /** Ledger balance less the expected figure. Nil when the account reconciles. Includes any reconciling items brought forward from the prior year. */
  difference: Kobo;
}

/**
 * Match statement lines to ledger postings on the cash account, one to one, on exact amount
 * and nearest date. A bank line may fall up to 3 days before or 10 days after the ledger date.
 */
export function reconcile(input: {
  bank: BankLine[];
  ledger: GlEntry[];
  bankClosing: Kobo;
  ledgerBalance: Kobo;
  yearEnd: string;
}): Reconciliation {
  const { bank, yearEnd } = input;
  const ledger = input.ledger.filter((e) => e.date <= yearEnd);
  const byAmount = new Map<Kobo, number[]>();
  ledger.forEach((e, i) => {
    const list = byAmount.get(e.amount);
    if (list) list.push(i);
    else byAmount.set(e.amount, [i]);
  });
  const clearedOn: (string | null | undefined)[] = new Array(ledger.length).fill(undefined);
  const bankOnly: BankLine[] = [];
  let matched = 0;

  for (const b of [...bank].sort((x, y) => x.date.localeCompare(y.date))) {
    let best = -1;
    let bestGap = Infinity;
    for (const i of byAmount.get(b.amount) ?? []) {
      if (clearedOn[i] !== undefined) continue;
      const gap = daysBetween(ledger[i].date, b.date);
      if (gap < -3 || gap > 10) continue;
      if (Math.abs(gap) < bestGap) {
        best = i;
        bestGap = Math.abs(gap);
      }
    }
    if (best >= 0) {
      if (b.date <= yearEnd) {
        clearedOn[best] = null; // cleared within the year
        matched++;
      } else {
        clearedOn[best] = b.date; // outstanding at the year end, cleared after it
      }
    } else if (b.date <= yearEnd) {
      bankOnly.push(b);
    }
  }

  const ledgerOnly: Outstanding[] = [];
  ledger.forEach((e, i) => {
    if (clearedOn[i] === null) return;
    ledgerOnly.push({ ...e, clearedOn: clearedOn[i] ?? null });
  });
  const ledgerOnlyTotal = ledgerOnly.reduce((a, e) => a + e.amount, 0);
  const bankOnlyTotal = bankOnly.reduce((a, b) => a + b.amount, 0);
  const expectedLedger = input.bankClosing + ledgerOnlyTotal - bankOnlyTotal;
  return {
    matched,
    ledgerOnly,
    bankOnly,
    ledgerOnlyTotal,
    bankOnlyTotal,
    bankClosing: input.bankClosing,
    ledgerBalance: input.ledgerBalance,
    expectedLedger,
    difference: input.ledgerBalance - expectedLedger,
  };
}
