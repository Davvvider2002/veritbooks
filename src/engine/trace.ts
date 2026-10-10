import { ITEM, type Section } from './chart';
import type { GlEntry } from './ledger';
import { figures, type Period } from './statements';
import type { Adjustment, Kobo, TbLine } from './types';

const DEBIT_SECTIONS: Section[] = ['nca', 'ca', 'expense', 'distribution'];

export interface TraceAccount {
  line: TbLine;
  /** Balance per the client's trial balance, in the sign the statement shows. */
  tb: Kobo;
  /** Posted audit journals on this account, in the same sign. Current year only. */
  journals: { id: string; ref: string; description: string; amount: Kobo }[];
  /** What the statement carries for this account: trial balance plus posted journals. */
  reported: Kobo;
  /** The client's ledger entries on this account, oldest first. Empty without a general ledger, and for the prior year. */
  entries: GlEntry[];
}

export interface Trace {
  code: string;
  label: string;
  period: Period;
  accounts: TraceAccount[];
  /** Sum of the accounts. */
  subtotal: Kobo;
  /** Amounts the statement adds that are not accounts: profit and dividends, for retained earnings. */
  derived: { label: string; amount: Kobo }[];
  /** The figure on the face of the statement. Always the subtotal plus the derived amounts. */
  total: Kobo;
}

/**
 * The accounts, audit journals and ledger entries behind one statement line.
 * It reads the same inputs as the statements, so it cannot drift from them.
 */
export function traceItem(
  code: string,
  period: Period,
  lines: TbLine[],
  adjustments: Adjustment[],
  ledger: GlEntry[] = [],
): Trace | null {
  const item = ITEM.get(code);
  if (!item) return null;
  const sign = DEBIT_SECTIONS.includes(item.section) ? 1 : -1;
  const byAccount = new Map<string, GlEntry[]>();
  if (period === 'current') {
    for (const e of ledger) {
      const list = byAccount.get(e.accountCode);
      if (list) list.push(e);
      else byAccount.set(e.accountCode, [e]);
    }
  }

  const accounts: TraceAccount[] = [];
  for (const line of lines) {
    if (line.mapCode !== code) continue;
    const raw = period === 'current' ? line.balance : (line.prior ?? 0);
    const journals =
      period === 'current'
        ? adjustments.flatMap((a) =>
            a.posted
              ? a.lines.filter((j) => j.lineId === line.id).map((j) => ({ id: a.id, ref: a.ref, description: a.description, amount: sign * j.amount }))
              : [],
          )
        : [];
    const reported = sign * raw + journals.reduce((s, j) => s + j.amount, 0);
    const entries = [...(byAccount.get(line.code) ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.entryNo.localeCompare(b.entryNo));
    if (raw === 0 && reported === 0 && journals.length === 0 && entries.length === 0) continue;
    accounts.push({ line, tb: sign * raw, journals, reported, entries });
  }
  accounts.sort((a, b) => a.line.code.localeCompare(b.line.code, undefined, { numeric: true }));
  const subtotal = accounts.reduce((s, a) => s + a.reported, 0);

  const derived: Trace['derived'] = [];
  if (code === 'retained_earnings') {
    const f = figures(lines, adjustments, period);
    derived.push({ label: 'Profit for the year, per the statement of profit or loss', amount: f.profit });
    if (f.v.dividends !== 0) derived.push({ label: 'Dividends declared', amount: -f.v.dividends });
  }
  return { code, label: item.label, period, accounts, subtotal, derived, total: subtotal + derived.reduce((s, d) => s + d.amount, 0) };
}
