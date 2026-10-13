// Reads journals from a spreadsheet: one row per journal line, grouped by reference.
// Columns are found by their headings. Reference, account and an amount are needed;
// date, description and treatment are optional.
import { parseAmount } from './money';
import type { Adjustment, JournalLine, Kobo, TbLine } from './types';

export interface ImportedJournal extends Omit<Adjustment, 'id'> {
  date: string;
}
export interface JournalImport {
  journals: ImportedJournal[];
  /** Problems that stop a journal being added, each naming its reference and row. */
  errors: string[];
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const HEADINGS: Record<string, RegExp> = {
  ref: /^(ref|reference|journal|journal no|journal number|jnl|jnl no|entry|entry no|voucher|voucher no)$/,
  date: /^(date|journal date|posting date)$/,
  description: /^(description|narration|narrative|details|memo)$/,
  account: /^(account|account code|code|gl code|ledger code|account no|account number)$/,
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
  if (headerAt < 0) return { journals: [], errors: ['No heading row was found. The sheet needs columns for the journal reference and the account, and a debit and credit (or a signed amount).'] };
  const head = rows[headerAt].map(norm);
  const col = (k: string) => head.findIndex((c) => HEADINGS[k].test(c));
  const c = { ref: col('ref'), date: col('date'), description: col('description'), account: col('account'), debit: col('debit'), credit: col('credit'), amount: col('amount'), treatment: col('treatment') };
  if (c.amount < 0 && (c.debit < 0 || c.credit < 0)) return { journals: [], errors: ['The sheet needs Debit and Credit columns, or a single Amount column with debits positive.'] };

  const byCode = new Map(lines.map((l) => [l.code.trim().toLowerCase(), l]));
  const byName = new Map(lines.map((l) => [l.name.trim().toLowerCase(), l]));
  const groups = new Map<string, { rows: number[]; description: string; date: string; posted: boolean; lines: JournalLine[] }>();
  let lastRef = '';
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
    if (!line) return void errors.push(`${ref}, row ${rowNo}: account "${account}" is not in the trial balance.`);
    let amount: Kobo;
    if (amt !== null && c.debit < 0) amount = amt;
    else {
      if ((dr ?? 0) < 0 || (cr ?? 0) < 0) return void errors.push(`${ref}, row ${rowNo}: enter debits and credits as positive numbers.`);
      amount = (dr ?? 0) - (cr ?? 0);
    }
    if (amount === 0) return void errors.push(`${ref}, row ${rowNo}: the line has no amount.`);
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
    const sum = g.lines.reduce((a, l) => a + l.amount, 0);
    if (g.lines.length < 2) errors.push(`${ref}: a journal needs at least two lines.`);
    else if (sum !== 0) errors.push(`${ref}: does not balance. Debits and credits differ by ${(Math.abs(sum) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`);
    else journals.push({ ref, description: g.description, date: g.date, posted: g.posted, lines: g.lines });
  }
  return { journals, errors };
}
