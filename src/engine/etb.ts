// The extended trial balance and the lead schedules.
//
// The extended trial balance (ETB) shows every account from the client's draft trial balance to
// the final figures in the financial statements: last year's final balance, this year's draft
// balance, the audit adjustments posted (debits and credits, with the journal references), the
// final balance, and the movement on last year. It follows the layout of a working trial balance
// in accounts production software such as Draftworx, with each account carrying the lead
// schedule it belongs to.
//
// A lead schedule gathers the accounts behind one area of the financial statements (revenue,
// trade receivables, reserves) under a working paper reference, with the same columns, a subtotal
// for each statement line, and its agreement to the statements.
//
// Amounts keep the trial balance sign: debits positive, credits negative (shown in brackets).
import { ITEM } from './chart';
import type { Statements } from './statements';
import type { Adjustment, Kobo, TbLine } from './types';

export interface Lead {
  ref: string;
  title: string;
  /** The statement lines whose accounts it gathers, in the order they are shown. */
  codes: string[];
}

/** The lead schedules, by working paper reference. Every statement line belongs to one. */
export const LEADS: Lead[] = [
  { ref: 'A', title: 'Property, plant and equipment', codes: ['ppe'] },
  { ref: 'B', title: 'Intangible assets', codes: ['intangibles'] },
  { ref: 'C', title: 'Investments', codes: ['investments'] },
  { ref: 'D', title: 'Inventories', codes: ['inventories'] },
  { ref: 'E', title: 'Trade receivables', codes: ['trade_receivables'] },
  { ref: 'F', title: 'Other receivables and prepayments', codes: ['other_receivables'] },
  { ref: 'G', title: 'Cash and cash equivalents', codes: ['cash'] },
  { ref: 'H', title: 'Share capital and share premium', codes: ['share_capital', 'share_premium'] },
  { ref: 'I', title: 'Reserves and dividends', codes: ['other_reserves', 'retained_earnings', 'dividends'] },
  { ref: 'J', title: 'Borrowings', codes: ['borrowings_nc', 'borrowings_c'] },
  { ref: 'K', title: 'Provisions', codes: ['provisions'] },
  { ref: 'L', title: 'Trade payables', codes: ['trade_payables'] },
  { ref: 'M', title: 'Other payables and accruals', codes: ['other_payables'] },
  { ref: 'N', title: 'Taxation', codes: ['current_tax_payable', 'deferred_tax_asset', 'deferred_tax_liability', 'income_tax_expense'] },
  { ref: 'O', title: 'Restricted and endowment funds', codes: ['restricted_funds', 'endowment_funds'] },
  { ref: 'P', title: 'Grants and donations', codes: ['grant_income', 'donations'] },
  { ref: 'R', title: 'Revenue', codes: ['revenue'] },
  { ref: 'S', title: 'Other income and finance income', codes: ['other_income', 'finance_income'] },
  { ref: 'T', title: 'Cost of sales', codes: ['cost_of_sales'] },
  { ref: 'U', title: 'Operating expenses', codes: ['distribution_costs', 'admin_expenses', 'other_expenses', 'programme_expenses', 'fundraising_costs'] },
  { ref: 'V', title: 'Finance costs', codes: ['finance_costs'] },
];
/** Accounts not mapped to a statement line. */
export const UNMAPPED_LEAD: Lead = { ref: 'Z', title: 'Not mapped', codes: [] };

const LEAD_OF = new Map(LEADS.flatMap((l) => l.codes.map((c) => [c, l] as const)));
export const leadOf = (mapCode: string | null): Lead => (mapCode && LEAD_OF.get(mapCode)) || UNMAPPED_LEAD;

export interface EtbRow {
  lineId: string;
  code: string;
  name: string;
  mapCode: string | null;
  /** The statement line, in words. */
  line: string;
  lead: string;
  /** Last year's final balance. Null when no prior year is held. */
  prior: Kobo | null;
  /** This year's balance in the client's trial balance. */
  draft: Kobo;
  /** Audit adjustments posted to the account. */
  dr: Kobo;
  cr: Kobo;
  /** The journals behind them. */
  refs: string[];
  final: Kobo;
  /** Final balance less last year's. Null without a prior year. */
  movement: Kobo | null;
}

export interface Totals {
  prior: Kobo | null;
  draft: Kobo;
  dr: Kobo;
  cr: Kobo;
  final: Kobo;
}

export interface Etb {
  rows: EtbRow[];
  totals: Totals;
  /** Journals recorded but not posted, which are not in the final column. */
  unposted: string[];
  /** True when the draft and final columns each total nil and the adjustments balance. */
  balanced: boolean;
}

const add = (rows: { prior: Kobo | null; draft: Kobo; dr: Kobo; cr: Kobo; final: Kobo }[], withPrior: boolean): Totals => ({
  prior: withPrior ? rows.reduce((a, r) => a + (r.prior ?? 0), 0) : null,
  draft: rows.reduce((a, r) => a + r.draft, 0),
  dr: rows.reduce((a, r) => a + r.dr, 0),
  cr: rows.reduce((a, r) => a + r.cr, 0),
  final: rows.reduce((a, r) => a + r.final, 0),
});

export function extendedTrialBalance(lines: TbLine[], adjustments: Adjustment[]): Etb {
  const withPrior = lines.some((l) => l.prior !== null);
  const moves = new Map<string, { dr: Kobo; cr: Kobo; refs: Set<string> }>();
  for (const a of adjustments) {
    if (!a.posted) continue;
    for (const j of a.lines) {
      const m = moves.get(j.lineId) ?? { dr: 0, cr: 0, refs: new Set<string>() };
      if (j.amount > 0) m.dr += j.amount;
      else m.cr -= j.amount;
      m.refs.add(a.ref);
      moves.set(j.lineId, m);
    }
  }
  const rows: EtbRow[] = lines
    .map((l) => {
      const m = moves.get(l.id);
      const dr = m?.dr ?? 0;
      const cr = m?.cr ?? 0;
      const final = l.balance + dr - cr;
      const prior = withPrior ? (l.prior ?? 0) : null;
      return {
        lineId: l.id,
        code: l.code,
        name: l.name,
        mapCode: l.mapCode,
        line: (l.mapCode && ITEM.get(l.mapCode)?.label) || 'Not mapped',
        lead: leadOf(l.mapCode).ref,
        prior,
        draft: l.balance,
        dr,
        cr,
        refs: [...(m?.refs ?? [])],
        final,
        movement: prior === null ? null : final - prior,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const totals = add(rows, withPrior);
  return {
    rows,
    totals,
    unposted: adjustments.filter((a) => !a.posted).map((a) => a.ref),
    balanced: totals.draft === 0 && totals.final === 0 && totals.dr === totals.cr,
  };
}

export interface LeadLine extends Totals {
  code: string;
  label: string;
  note?: number;
  rows: EtbRow[];
  /** The figure the financial statements carry for the line, in trial balance sign, this year and last. */
  fsFinal: Kobo;
  fsPrior: Kobo | null;
}

export interface LeadSchedule extends Totals {
  ref: string;
  title: string;
  lines: LeadLine[];
}

const DEBIT = new Set(['nca', 'ca', 'expense', 'distribution']);

/** The lead schedules with accounts in them, in working paper order, then any accounts not mapped. */
export function leadSchedules(etb: Etb, st: Statements): LeadSchedule[] {
  const withPrior = etb.totals.prior !== null;
  const out: LeadSchedule[] = [];
  for (const lead of [...LEADS, UNMAPPED_LEAD]) {
    const lines: LeadLine[] = [];
    const codes = lead === UNMAPPED_LEAD ? [null] : lead.codes;
    for (const code of codes) {
      const rows = etb.rows.filter((r) => (code === null ? !r.mapCode || !ITEM.has(r.mapCode) : r.mapCode === code));
      if (!rows.length) continue;
      const t = add(rows, withPrior);
      // The statements carry each line in presentation sign; turned back to the trial balance sign here.
      const sign = code && DEBIT.has(ITEM.get(code)!.section) ? 1 : -1;
      lines.push({
        code: code ?? 'unmapped',
        label: code ? ITEM.get(code)!.label : 'Accounts not mapped to a statement line',
        note: code ? st.notes.get(code) : undefined,
        rows,
        ...t,
        fsFinal: code ? sign * st.cur.v[code] : 0,
        fsPrior: code && st.prior ? sign * st.prior.v[code] : null,
      });
    }
    if (!lines.length) continue;
    out.push({ ref: lead.ref, title: lead.title, lines, ...add(lines, withPrior) });
  }
  return out;
}

/** The change on last year as a percentage, to one decimal place. Null when last year was nil. */
export const changePct = (final: Kobo, prior: Kobo | null): number | null =>
  prior === null || prior === 0 ? null : Math.round(((final - prior) / Math.abs(prior)) * 1000) / 10;
