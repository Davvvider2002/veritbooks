import type { Presentation, PresentationTitle } from './types';
import type { Row, Statements } from './statements';
import { ITEM } from './chart';
import { fmt } from './money';

/** The settings that apply to one client's statements: the firm's defaults, then the file's own choices. */
export interface EffectivePresentation {
  style: 'standard' | 'illustrative';
  rounding: 'units' | 'thousands' | 'millions';
  captions: Record<string, string>;
  titles: Partial<Record<PresentationTitle, string>>;
  expenses: 'function' | 'nature';
  valueAdded: boolean;
  summary: boolean;
}

export function effectivePresentation(firm: Presentation | undefined, file: Presentation | undefined): EffectivePresentation {
  const f = firm ?? {};
  const e = file ?? {};
  const style = e.style ?? f.style ?? 'standard';
  return {
    style,
    // The international style shows thousands unless a rounding is chosen.
    rounding: e.rounding ?? f.rounding ?? (style === 'illustrative' ? 'thousands' : 'units'),
    // A blank entry on the file leaves the firm's own wording in place.
    captions: { ...clean(f.captions ?? {}), ...clean(e.captions ?? {}) },
    titles: { ...clean(f.titles ?? {}), ...clean(e.titles ?? {}) },
    expenses: e.expenses ?? f.expenses ?? 'function',
    valueAdded: e.valueAdded ?? f.valueAdded ?? true,
    summary: e.summary ?? f.summary ?? true,
  };
}

const clean = <T extends Record<string, string | undefined>>(o: T): Record<string, string> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, v!.trim()]));

const SCALE = { units: 1, thousands: 1000, millions: 1_000_000 } as const;

/**
 * Formats an amount at the chosen rounding: each figure is rounded on its own, as published
 * statements are, with halves rounded away from zero.
 */
export const scaledFmt =
  (rounding: EffectivePresentation['rounding']) =>
  (k: number | null | undefined, opts: { zero?: string } = {}): string => {
    if (k === null || k === undefined) return '';
    const units = k / 100 / SCALE[rounding];
    return fmt(Math.sign(units) * Math.round(Math.abs(units)) * 100, opts);
  };

/** The column heading under the year: ₦, ₦'000 or ₦m. */
export const unitHeading = (rounding: EffectivePresentation['rounding'], symbol: string) =>
  rounding === 'thousands' ? `${symbol}'000` : rounding === 'millions' ? `${symbol}m` : symbol;

/** The line under a statement's title: "In thousands of naira". Empty in whole units. */
export const unitLine = (rounding: EffectivePresentation['rounding'], currencyName: string) =>
  rounding === 'thousands' ? `In thousands of ${currencyName}` : rounding === 'millions' ? `In millions of ${currencyName}` : '';

/** The groups notes fall into in the international style, in the order they are printed. */
export const NOTE_GROUPS: { title: string; codes: string[] }[] = [
  { title: 'Performance for the year', codes: ['revenue', 'grant_income', 'donations', 'other_income', 'cost_of_sales', 'programme_expenses', 'fundraising_costs', 'distribution_costs', 'admin_expenses', 'other_expenses', 'finance_income', 'finance_costs'] },
  { title: 'Income taxes', codes: ['income_tax_expense', 'current_tax_payable', 'deferred_tax_asset', 'deferred_tax_liability'] },
  { title: 'Assets', codes: ['ppe', 'right_of_use', 'investment_property', 'biological_assets', 'intangibles', 'investments', 'inventories', 'trade_receivables', 'other_receivables', 'cash'] },
  { title: 'Equity and liabilities', codes: ['share_capital', 'share_premium', 'other_reserves', 'retained_earnings', 'restricted_funds', 'endowment_funds', 'borrowings_nc', 'borrowings_c', 'lease_liabilities_nc', 'lease_liabilities_c', 'provisions', 'trade_payables', 'other_payables'] },
];

/**
 * The statements as this client wants them laid out. Captions replace the line names wherever the
 * line appears; the international style also orders the notes by group (performance, taxes, assets,
 * equity and liabilities) and renumbers them to match. The figures are never changed.
 */
export function presentFor(st: Statements, p: EffectivePresentation): Statements & { noteGroup: Map<string, string> } {
  const caption = (code: string | undefined, label: string) => (code && p.captions[code]) || label;
  // Captions on the lines that carry a chart code, and in the cash flow's "Change in …" lines.
  const original = (code: string) => ITEM.get(code)?.label ?? code;
  const relabelRow = (r: Row): Row => {
    if (r.code && p.captions[r.code] && r.style !== 'total' && r.style !== 'subtotal') return { ...r, label: p.captions[r.code] };
    for (const [code, text] of Object.entries(p.captions)) {
      const from = `Change in ${original(code).toLowerCase()}`;
      if (r.label === from) return { ...r, label: `Change in ${text.charAt(0).toLowerCase()}${text.slice(1)}` };
    }
    return r;
  };
  let out: Statements = {
    ...st,
    position: st.position.map(relabelRow),
    income: st.income.map(relabelRow),
    incomeByNature: st.incomeByNature.map(relabelRow),
    cashFlow: st.cashFlow && st.cashFlow.map(relabelRow),
    cashFlowFull: st.cashFlowFull && st.cashFlowFull.map(relabelRow),
    valueAdded: st.valueAdded.map(relabelRow),
    noteBreakdowns: st.noteBreakdowns.map((n) => ({ ...n, title: caption(n.code, n.title) })),
  };
  const noteGroup = new Map<string, string>();
  if (p.style !== 'illustrative') return { ...out, noteGroup };

  // Renumber: notes 1 and 2 stay (reporting entity, basis of preparation), then the groups in order.
  const order = NOTE_GROUPS.flatMap((g) => g.codes);
  const rank = (code: string) => (order.indexOf(code) === -1 ? order.length : order.indexOf(code));
  const sorted = [...out.noteBreakdowns].sort((a, b) => rank(a.code) - rank(b.code));
  const renumber = new Map<number, number>();
  sorted.forEach((n, i) => renumber.set(n.number, 3 + i));
  const fix = (r: Row): Row => (r.note !== undefined && renumber.has(r.note) ? { ...r, note: renumber.get(r.note) } : r);
  out = {
    ...out,
    position: out.position.map(fix),
    income: out.income.map(fix),
    incomeByNature: out.incomeByNature.map(fix),
    noteBreakdowns: sorted.map((n) => ({ ...n, number: renumber.get(n.number)! })),
    notes: new Map([...st.notes].map(([code, n]) => [code, renumber.get(n) ?? n])),
  };
  for (const g of NOTE_GROUPS) {
    const first = out.noteBreakdowns.find((n) => g.codes.includes(n.code));
    if (first) noteGroup.set(first.code, g.title);
  }
  return { ...out, noteGroup };
}

/**
 * The international style starts the cash flow from profit for the year and adds the tax charge
 * back with the other adjustments. Cash generated is unchanged.
 */
export function cashFlowFromProfit(rows: Row[], profit: { cur: number; prior: number | null }, tax: { cur: number; prior: number | null }, npo: boolean): Row[] {
  const at = rows.findIndex((r) => r.label === 'Profit before tax' || r.label === 'Surplus/(deficit) before tax' || r.label === 'Excess of revenue over expenses before income taxes');
  if (at === -1 || (tax.cur === 0 && !tax.prior)) return rows;
  return [
    ...rows.slice(0, at),
    { label: npo ? 'Surplus/(deficit) for the year' : 'Profit for the year', cur: profit.cur, prior: profit.prior, style: 'line' },
    { label: 'Adjustments for:', cur: null, prior: null, style: 'heading' },
    { label: 'Income tax expense', cur: tax.cur, prior: tax.prior, style: 'line', code: 'income_tax_expense' },
    ...rows.slice(at + 1),
  ];
}
