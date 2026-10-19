// Reads journals from a spreadsheet: one row per journal line, grouped by reference.
// Columns are found by their headings. Reference, account and an amount are needed;
// date, description and treatment are optional.
import { suggestMapping } from './mapping';
import { parseAmount } from './money';
import type { Adjustment, JournalLine, Kobo, Nature, TbLine } from './types';

export interface ImportedJournal extends Omit<Adjustment, 'id'> {
  date: string;
}
/** An account a journal uses that the trial balance does not have yet. */
export interface MissingAccount {
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
  /** Net debit of its lines in the file. */
  net: Kobo;
}

export interface JournalImport {
  journals: ImportedJournal[];
  /** Problems that stop a journal being added, each naming its reference and row. */
  errors: string[];
  /** Accounts not in the trial balance. Journals using them wait until they are added. */
  missing: MissingAccount[];
  /** The journals waiting for those accounts. */
  waiting: string[];
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const HEADINGS: Record<string, RegExp> = {
  ref: /^(ref|reference|journal|journal no|journal number|jnl|jnl no|entry|entry no|voucher|voucher no)$/,
  date: /^(date|journal date|posting date)$/,
  description: /^(description|narration|narrative|details|memo)$/,
  account: /^(account|account code|code|gl code|ledger code|account no|account number|gl account|gl account code)$/,
  accountName: /^(account name|name|account description|gl name|gl account name|ledger name|account title)$/,
  debit: /^(debit|dr|debit amount|debit ngn)$/,
  credit: /^(credit|cr|credit amount|credit ngn)$/,
  amount: /^(amount|value|amount ngn)$/,
  treatment: /^(treatment|status|type|posted)$/,
};

export function parseJournals(rows: unknown[][], lines: TbLine[]): JournalImport {
  const errors: string[] = [];
  const headerAt = rows.findIndex((r) => {
    const cells = r.map(norm);
    return cells.some((c) => HEADINGS.ref.test(c)) && cells.some((c) => HEADINGS.account.test(c));
  });
  if (headerAt < 0) return { journals: [], missing: [], waiting: [], errors: ['No heading row was found. The sheet needs columns for the journal reference and the account, and a debit and credit (or a signed amount).'] };
  const head = rows[headerAt].map(norm);
  const col = (k: string) => head.findIndex((c) => HEADINGS[k].test(c));
  const c = { ref: col('ref'), date: col('date'), description: col('description'), account: col('account'), accountName: col('accountName'), debit: col('debit'), credit: col('credit'), amount: col('amount'), treatment: col('treatment') };
  if (c.amount < 0 && (c.debit < 0 || c.credit < 0)) return { journals: [], missing: [], waiting: [], errors: ['The sheet needs Debit and Credit columns, or a single Amount column with debits positive.'] };

  const byCode = new Map(lines.map((l) => [l.code.trim().toLowerCase(), l]));
  const byName = new Map(lines.map((l) => [l.name.trim().toLowerCase(), l]));
  const groups = new Map<string, { rows: number[]; description: string; date: string; posted: boolean; lines: JournalLine[] }>();
  let lastRef = '';
  const missing = new Map<string, { code: string; name: string; refs: string[]; rows: number[]; net: Kobo }>();
  const waiting = new Set<string>();
  rows.slice(headerAt + 1).forEach((r, i) => {
    const rowNo = headerAt + i + 2;
    const cell = (k: number) => (k >= 0 ? r[k] : undefined);
    const account = String(cell(c.account) ?? '').trim();
    const dr = c.debit >= 0 ? parseAmount(cell(c.debit)) : null;
    const cr = c.credit >= 0 ? parseAmount(cell(c.credit)) : null;
    const amt = c.amount >= 0 ? parseAmount(cell(c.amount)) : null;
    if (!account && !dr && !cr && !amt) return; // a blank row
    // A reference left blank continues the journal above, as many exports do.
    const ref = String(cell(c.ref) ?? '').trim() || lastRef;
    if (!ref) return void errors.push(`Row ${rowNo}: no journal reference.`);
    lastRef = ref;
    const line = byCode.get(account.toLowerCase()) ?? byName.get(account.toLowerCase());
    let amount: Kobo;
    if (amt !== null && c.debit < 0) amount = amt;
    else {
      if ((dr ?? 0) < 0 || (cr ?? 0) < 0) return void errors.push(`${ref}, row ${rowNo}: enter debits and credits as positive numbers.`);
      amount = (dr ?? 0) - (cr ?? 0);
    }
    if (amount === 0) return void errors.push(`${ref}, row ${rowNo}: the line has no amount.`);
    if (!line) {
      if (!account) return void errors.push(`${ref}, row ${rowNo}: no account.`);
      // Held back, not rejected: the account can be added to the trial balance and the file read again.
      const m = missing.get(account.toLowerCase()) ?? { code: account, name: '', refs: [], rows: [], net: 0 };
      // An account given by name rather than code is its own name.
      m.name ||= String(cell(c.accountName) ?? '').trim() || (/[a-z]/i.test(account) && /\s/.test(account) ? account : '');
      if (!m.refs.includes(ref)) m.refs.push(ref);
      m.rows.push(rowNo);
      m.net += amount;
      missing.set(account.toLowerCase(), m);
      waiting.add(ref);
      return;
    }
    const g = groups.get(ref) ?? { rows: [], description: '', date: '', posted: true, lines: [] };
    g.rows.push(rowNo);
    g.description ||= String(cell(c.description) ?? '').trim();
    g.date ||= String(cell(c.date) ?? '').trim();
    if (/propos|unadjust|not booked|no\b|false/i.test(String(cell(c.treatment) ?? ''))) g.posted = false;
    g.lines.push({ lineId: line.id, amount });
    groups.set(ref, g);
  });

  const journals: ImportedJournal[] = [];
  for (const [ref, g] of groups) {
    if (waiting.has(ref)) continue;
    const sum = g.lines.reduce((a, l) => a + l.amount, 0);
    if (g.lines.length < 2) errors.push(`${ref}: a journal needs at least two lines.`);
    else if (sum !== 0) errors.push(`${ref}: does not balance. Debits and credits differ by ${(Math.abs(sum) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`);
    else journals.push({ ref, description: g.description, date: g.date, posted: g.posted, lines: g.lines });
  }
  return { journals, errors, missing: [...missing.values()].map((m) => ({ ...m, ...suggestFor(m.code, m.name, lines) })), waiting: [...waiting] };
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
    if (!l.mapCode) continue;
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
