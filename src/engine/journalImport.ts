// Reads journals from a spreadsheet: one row per journal line, grouped by reference.
// Columns are found by their headings. A reference, an account (by code, by name, or both) and
// an amount are needed; date, description and treatment are optional.
import { suggestMapping } from './mapping';
import { parseAmount } from './money';
import type { Adjustment, JournalLine, Kobo, Nature, TbLine } from './types';

export interface ImportedJournal extends Omit<Adjustment, 'id'> {
  date: string;
}
/** An account a journal uses that the trial balance does not have yet. */
export interface MissingAccount {
  /** The code in the file. Blank when the file names the account without a code. */
  code: string;
  /** The account's name, from the file's account name column when it has one. */
  name: string;
  /** The statement line it most likely belongs on, from its name or from the nearest account code. */
  mapCode: string | null;
  nature: Nature | null;
  /** Why that line was suggested. */
  basis: string;
  /** The journals that use it, and the rows. */
  refs: string[];
  rows: number[];
  /** Debits and credits of its lines in the file, and the net debit. */
  debit: Kobo;
  credit: Kobo;
  net: Kobo;
}

/** A problem with one row, by its index in the rows given, so the row can be shown and corrected. */
export interface RowProblem {
  index: number;
  ref: string;
  message: string;
}

export interface JournalImport {
  journals: ImportedJournal[];
  /** Problems that stop a journal being added, each naming its reference and row. */
  errors: string[];
  /** The rows behind those problems: every row of a journal that does not balance, and each faulty row. */
  problems: RowProblem[];
  /** Accounts not in the trial balance. Journals using them wait until they are added. */
  missing: MissingAccount[];
  /** The journals waiting for those accounts. */
  waiting: string[];
  /** Where the heading row is, and which column holds what. Null when no heading row was found. */
  layout: { header: number; columns: Record<Column, number> } | null;
}

export type Column = 'ref' | 'date' | 'description' | 'account' | 'accountName' | 'debit' | 'credit' | 'amount' | 'treatment';

/** A heading in plain words: lower case, currency marks and units dropped. "Debit (₦)" and "Debit NGN" read as "debit". */
export const headingKey = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(ngn|ghs|zar|usd|sle|lrd|gmd|naira|cedis?|rand|dollars?|in|amt)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const HEADINGS: Record<Column, RegExp> = {
  ref: /^(ref|reference|journal|journal no|journal number|journal ref|journal reference|jnl|jnl no|jv|jv no|entry|entry no|voucher|voucher no|document no|doc no)$/,
  date: /^(date|journal date|posting date|transaction date|value date)$/,
  description: /^(description|narration|narrative|details|memo|particulars)$/,
  account: /^(account|account code|code|gl code|ledger code|account no|account number|gl account|gl account code|gl no|ledger account)$/,
  accountName: /^(account name|name|account description|gl name|gl account name|ledger name|account title|gl description)$/,
  debit: /^(debit|debits|dr|debit amount|dr amount|amount dr|amount debit|debit value)$/,
  credit: /^(credit|credits|cr|credit amount|cr amount|amount cr|amount credit|credit value)$/,
  amount: /^(amount|value|net amount|signed amount|amount net|net)$/,
  treatment: /^(treatment|status|type|posted)$/,
};

const EMPTY = (errors: string[]): JournalImport => ({ journals: [], errors, problems: [], missing: [], waiting: [], layout: null });

export function parseJournals(rows: unknown[][], lines: TbLine[]): JournalImport {
  const errors: string[] = [];
  const problems: RowProblem[] = [];
  const headerAt = rows.findIndex((r) => {
    const cells = (r ?? []).map(headingKey);
    return cells.some((c) => HEADINGS.ref.test(c)) && cells.some((c) => HEADINGS.account.test(c) || HEADINGS.accountName.test(c));
  });
  if (headerAt < 0)
    return EMPTY(['No heading row was found. The sheet needs columns for the journal reference, the account code or account name, and a debit and credit (or a signed amount).']);
  const head = rows[headerAt].map(headingKey);
  const col = (k: Column) => head.findIndex((c) => HEADINGS[k].test(c));
  const c = { ref: col('ref'), date: col('date'), description: col('description'), account: col('account'), accountName: col('accountName'), debit: col('debit'), credit: col('credit'), amount: col('amount'), treatment: col('treatment') } as Record<Column, number>;
  if (c.amount < 0 && (c.debit < 0 || c.credit < 0)) {
    const r = EMPTY(['The sheet needs Debit and Credit columns, or a single Amount column with debits positive. No amount column was recognised in the headings.']);
    return { ...r, layout: { header: headerAt, columns: c } };
  }

  const byCode = new Map(lines.map((l) => [l.code.trim().toLowerCase(), l]));
  const byName = new Map(lines.map((l) => [l.name.trim().toLowerCase(), l]));
  const groups = new Map<string, { rows: number[]; description: string; date: string; posted: boolean; lines: JournalLine[] }>();
  const indexes = new Map<string, number[]>();
  const missing = new Map<string, Omit<MissingAccount, 'mapCode' | 'nature' | 'basis'>>();
  const waiting = new Set<string>();
  let lastRef = '';
  const flag = (index: number, ref: string, message: string) => {
    errors.push(ref ? `${ref}, row ${index + 1}: ${message}` : `Row ${index + 1}: ${message}`);
    problems.push({ index, ref, message });
  };

  for (let index = headerAt + 1; index < rows.length; index++) {
    const r = rows[index] ?? [];
    const cell = (k: number) => (k >= 0 ? r[k] : undefined);
    const code = String(cell(c.account) ?? '').trim();
    const nameCell = String(cell(c.accountName) ?? '').trim();
    const dr = c.debit >= 0 ? parseAmount(cell(c.debit)) : null;
    const cr = c.credit >= 0 ? parseAmount(cell(c.credit)) : null;
    const amt = c.amount >= 0 ? parseAmount(cell(c.amount)) : null;
    if (!code && !nameCell && !dr && !cr && !amt) continue; // a blank row
    // A reference left blank continues the journal above, as many exports do.
    const ref = String(cell(c.ref) ?? '').trim() || lastRef;
    if (!ref) {
      flag(index, '', 'no journal reference.');
      continue;
    }
    lastRef = ref;
    indexes.set(ref, [...(indexes.get(ref) ?? []), index]);
    let amount: Kobo;
    if (amt !== null && (c.debit < 0 || (dr === null && cr === null))) amount = amt;
    else {
      if ((dr ?? 0) < 0 || (cr ?? 0) < 0) {
        flag(index, ref, 'enter debits and credits as positive numbers.');
        continue;
      }
      amount = (dr ?? 0) - (cr ?? 0);
    }
    if (amount === 0) {
      flag(index, ref, 'the line has no amount.');
      continue;
    }
    if (!code && !nameCell) {
      flag(index, ref, 'no account.');
      continue;
    }
    // The code decides when there is one; a file with names only is matched by name.
    const line = (code && byCode.get(code.toLowerCase())) || (!code && nameCell ? byName.get(nameCell.toLowerCase()) : undefined) || (code ? byName.get(code.toLowerCase()) : undefined);
    if (!line) {
      // Held back, not rejected: the account can be added to the trial balance and the file read again.
      const key = (code || nameCell).toLowerCase();
      const m = missing.get(key) ?? { code, name: '', refs: [], rows: [], debit: 0, credit: 0, net: 0 };
      // An account given by name in the code column is its own name.
      m.name ||= nameCell || (/[a-z]/i.test(code) && /\s/.test(code) ? code : '');
      if (!m.refs.includes(ref)) m.refs.push(ref);
      m.rows.push(index + 1);
      if (amount > 0) m.debit += amount;
      else m.credit -= amount;
      m.net += amount;
      missing.set(key, m);
      waiting.add(ref);
      continue;
    }
    const g = groups.get(ref) ?? { rows: [], description: '', date: '', posted: true, lines: [] };
    g.rows.push(index + 1);
    g.description ||= String(cell(c.description) ?? '').trim();
    g.date ||= String(cell(c.date) ?? '').trim();
    if (/propos|unadjust|not booked|no\b|false/i.test(String(cell(c.treatment) ?? ''))) g.posted = false;
    g.lines.push({ lineId: line.id, amount });
    groups.set(ref, g);
  }

  const journals: ImportedJournal[] = [];
  const faulty = new Set(problems.map((p) => p.ref).filter(Boolean));
  for (const [ref, g] of groups) {
    if (waiting.has(ref)) continue;
    if (faulty.has(ref)) continue; // a journal with a faulty row waits for it to be corrected
    const sum = g.lines.reduce((a, l) => a + l.amount, 0);
    const whole = (msg: string) => {
      errors.push(`${ref}: ${msg}`);
      for (const index of indexes.get(ref) ?? []) problems.push({ index, ref, message: msg });
    };
    if (g.lines.length < 2) whole('a journal needs at least two lines.');
    else if (sum !== 0) whole(`does not balance. Debits and credits differ by ${(Math.abs(sum) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`);
    else journals.push({ ref, description: g.description, date: g.date, posted: g.posted, lines: g.lines });
  }
  return {
    journals,
    errors,
    problems,
    missing: [...missing.values()].map((m) => ({ ...m, ...suggestFor(m.code, m.name, lines) })),
    waiting: [...waiting],
    layout: { header: headerAt, columns: c },
  };
}

/**
 * Where a new account most likely belongs. By its name when the name says (Bank, VAT, Salaries),
 * otherwise like the trial balance account whose code shares the most leading characters with it,
 * as charts of accounts number related accounts together: 6401004 sits beside 6401010.
 */
export function suggestFor(code: string, name: string, lines: TbLine[]): { mapCode: string | null; nature: Nature | null; basis: string } {
  if (name) {
    const s = suggestMapping(name);
    if (s.mapCode) return { mapCode: s.mapCode, nature: s.nature, basis: 'From its name.' };
  }
  let best: TbLine | null = null;
  let bestLen = 0;
  const k = code.toLowerCase();
  for (const l of lines) {
    if (!l.mapCode || !k) continue;
    const c = l.code.toLowerCase();
    let n = 0;
    while (n < k.length && n < c.length && k[n] === c[n]) n++;
    if (n > bestLen || (n === bestLen && best && Math.abs(Number(c) - Number(k)) < Math.abs(Number(best.code) - Number(k)))) {
      best = l;
      bestLen = n;
    }
  }
  // Fewer than three characters in common says nothing about where an account belongs.
  if (best && bestLen >= Math.min(3, k.length)) return { mapCode: best.mapCode, nature: best.nature, basis: `Like ${best.code} ${best.name}.` };
  return { mapCode: null, nature: null, basis: 'No similar account. Choose its line.' };
}

/** A code for an account the file names without one: NEW1, NEW2 and so on, not already used. */
export function newAccountCode(taken: Set<string>, n = 1): string {
  while (taken.has(`new${n}`)) n++;
  return `NEW${n}`;
}

/** The rows as a CSV file, for a corrected copy of the journal sheet. */
export function rowsToCsv(rows: unknown[][]): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => (r ?? []).map(cell).join(',')).join('\r\n') + '\r\n';
}
