import { CHART, ITEM, type Section } from './chart';
import type { Figures, Period, Row } from './statements';
import type { Kobo } from './types';

/**
 * Consolidation of a parent and its subsidiaries, in the manner of Section 9 of the IFRS for SMEs.
 *
 * What it does: adds the statements line by line, removes the parent's investment against the
 * subsidiary's equity at acquisition, recognises goodwill and its amortisation, measures
 * non-controlling interests at their share of the subsidiary's net assets, and applies the
 * intercompany eliminations the preparer enters.
 *
 * What it assumes: each subsidiary was held for the whole of both years, at the same percentage,
 * and has the same year end. Unrealised profit eliminations are borne wholly by the owners of
 * the parent. Subsidiaries' reserves since acquisition are shown within group retained earnings.
 */

const DEBIT: Section[] = ['nca', 'ca', 'expense', 'distribution'];
const EQUITY_CODES = ['share_capital', 'share_premium', 'other_reserves', 'retained_earnings'];
/** Lines an elimination may use. Share capital and other equity lines are dealt with by the engine. */
export const ELIMINATION_CODES = CHART.filter((i) => !['share_capital', 'share_premium', 'other_reserves'].includes(i.code)).map((i) => i.code);

export interface GroupSubsidiary {
  engagementId: string;
  /** Percentage of the equity held by the parent, above 0 and up to 100. */
  ownership: number;
  /** Cost of the investment, as carried in the parent's own statement of financial position. */
  cost: Kobo;
  /** Fair value of the subsidiary's net assets on the day it was acquired. */
  netAssets: Kobo;
  /** Goodwill amortised and impaired up to the end of the current year. */
  amortised: Kobo;
  /** Of which charged in the current year. */
  charge: Kobo;
  /** And charged in the prior year. */
  chargePrior: Kobo;
}

export interface Elimination {
  id: string;
  description: string;
  period: Period;
  /** Entries on statement lines, debit positive. They must add to nil. */
  lines: { code: string; amount: Kobo }[];
}

export interface GroupSetup {
  subsidiaries: GroupSubsidiary[];
  eliminations: Elimination[];
}

export interface GroupEntity {
  name: string;
  figures: Figures;
}

export interface GoodwillLine {
  name: string;
  ownership: number;
  cost: Kobo;
  shareOfNetAssets: Kobo;
  /** Cost less the share of net assets acquired. Negative when the purchase was a bargain. */
  atAcquisition: Kobo;
  carrying: Kobo;
  /** Gain on a bargain purchase, taken to group reserves. */
  bargainGain: Kobo;
  nci: Kobo;
  nciProfit: Kobo;
}

export interface Consolidated {
  /** One column for each entity, parent first, in the sign the statements use. */
  columns: { name: string; v: Record<string, Kobo> }[];
  /** Consolidation adjustments by line, in the same sign. */
  adjustments: Record<string, Kobo>;
  /** The group figure for each line. Equity lines hold the group's own equity. */
  v: Record<string, Kobo>;
  goodwill: GoodwillLine[];
  nci: Kobo;
  nciProfit: Kobo;
  profit: Kobo;
  ownersProfit: Kobo;
  ownersEquity: Kobo;
  totalEquity: Kobo;
  totalAssets: Kobo;
  totalLiabilities: Kobo;
  /** Total assets less total equity and liabilities. Nil when the consolidation balances. */
  difference: Kobo;
  /** Eliminations for this period whose debits do not equal their credits. */
  unbalanced: Elimination[];
  position: Row[];
  income: Row[];
  warnings: string[];
}

export const eliminationNet = (e: Elimination) => e.lines.reduce((a, l) => a + l.amount, 0);

/** Consolidates one period. `subs` are in the order of `setup.subsidiaries`. */
export function consolidate(parent: GroupEntity, subs: GroupEntity[], setup: GroupSetup, period: Period): Consolidated {
  const entities = [parent, ...subs];
  const warnings: string[] = [];
  const adj: Record<string, Kobo> = Object.fromEntries(CHART.map((i) => [i.code, 0]));
  const sign = (code: string) => (DEBIT.includes(ITEM.get(code)!.section) ? 1 : -1);
  /** Posts a debit-positive amount to a line. */
  const post = (code: string, debit: Kobo) => {
    adj[code] += sign(code) * debit;
  };

  // 1. Investment, goodwill and non-controlling interests, one subsidiary at a time.
  const goodwill: GoodwillLine[] = [];
  let retainedFromSubs = 0;
  let goodwillWrittenOff = 0;
  setup.subsidiaries.forEach((s, i) => {
    const f = subs[i].figures;
    const p = Math.min(Math.max(s.ownership, 0), 100) / 100;
    const nci = Math.round((1 - p) * f.totalEquity);
    const nciProfit = Math.round((1 - p) * f.profit);
    const shareOfNetAssets = Math.round(p * s.netAssets);
    const atAcquisition = s.cost - shareOfNetAssets;
    const bargainGain = Math.max(-atAcquisition, 0);
    const amortised = atAcquisition > 0 ? (period === 'current' ? s.amortised : s.amortised - s.charge) : 0;
    const charge = atAcquisition > 0 ? (period === 'current' ? s.charge : s.chargePrior) : 0;
    const carrying = Math.max(atAcquisition, 0) - amortised;
    post('investments', -s.cost);
    post('intangibles', carrying);
    post('admin_expenses', charge);
    // The group's share of what the subsidiary has earned since it was acquired.
    retainedFromSubs += f.totalEquity - nci - shareOfNetAssets + bargainGain;
    goodwillWrittenOff += amortised;
    goodwill.push({ name: subs[i].name, ownership: s.ownership, cost: s.cost, shareOfNetAssets, atAcquisition, carrying, bargainGain, nci, nciProfit });
    if (s.ownership <= 50) warnings.push(`${subs[i].name}: ${s.ownership}% is not a majority. Consolidate only if the parent controls it by other means.`);
    if (carrying < 0) warnings.push(`${subs[i].name}: more goodwill has been amortised than arose on acquisition.`);
    if (f.unmappedCount > 0) warnings.push(`${subs[i].name}: ${f.unmappedCount} account(s) are not mapped, so its figures are incomplete.`);
    if (f.totalAssets !== f.totalEquityAndLiabilities) warnings.push(`${subs[i].name}: its own statement of financial position does not balance.`);
  });
  const investments = entities.reduce((a, e) => a + e.figures.v.investments, 0) + adj.investments;
  if (investments < 0) warnings.push('The cost of investments entered is more than the investments the group carries. Check the costs, and that the parent’s investment is mapped to Investments.');

  // 2. Intercompany eliminations entered by the preparer.
  const mine = setup.eliminations.filter((e) => e.period === period);
  const unbalanced = mine.filter((e) => eliminationNet(e) !== 0);
  let throughReserves = 0; // net debit to profit or loss, dividends and reserves
  for (const e of mine) {
    for (const l of e.lines) {
      if (!ITEM.has(l.code)) continue;
      if (l.code === 'retained_earnings') throughReserves += l.amount;
      else {
        post(l.code, l.amount);
        const section = ITEM.get(l.code)!.section;
        if (section === 'income' || section === 'expense' || section === 'distribution') throughReserves += l.amount;
      }
    }
  }

  // 3. Line by line.
  const v: Record<string, Kobo> = {};
  for (const i of CHART) {
    v[i.code] = EQUITY_CODES.includes(i.code)
      ? parent.figures.v[i.code]
      : entities.reduce((a, e) => a + e.figures.v[i.code], 0) + adj[i.code];
  }
  const sum = (s: Section) => CHART.filter((i) => i.section === s).reduce((a, i) => a + v[i.code], 0);
  const grossProfit = v.revenue - v.cost_of_sales;
  const operatingProfit = grossProfit + v.other_income - v.distribution_costs - v.admin_expenses - v.other_expenses;
  const pbt = operatingProfit + v.finance_income - v.finance_costs;
  const profit = pbt - v.income_tax_expense;
  const nci = goodwill.reduce((a, g) => a + g.nci, 0);
  const nciProfit = goodwill.reduce((a, g) => a + g.nciProfit, 0);

  const retained = parent.figures.closingRetained + retainedFromSubs - goodwillWrittenOff - throughReserves;
  v.retained_earnings = retained;
  const ownersEquity = v.share_capital + v.share_premium + v.other_reserves + retained;
  const totalEquity = ownersEquity + nci;
  const totalNca = sum('nca');
  const totalCa = sum('ca');
  const totalNcl = sum('ncl');
  const totalCl = sum('cl');
  const totalAssets = totalNca + totalCa;
  const totalLiabilities = totalNcl + totalCl;

  // 4. The statements. One period a call, so each row carries its figure in the first column.
  const line = (label: string, amount: Kobo, style: Row['style'] = 'line'): Row => ({ label, cur: amount, prior: null, style });
  const head = (label: string): Row => ({ label, cur: null, prior: null, style: 'heading' });
  const label = (code: string) => (code === 'intangibles' && goodwill.some((g) => g.carrying !== 0) ? 'Goodwill and intangible assets' : ITEM.get(code)!.label);
  const section = (s: Section, negate = false) =>
    CHART.filter((i) => i.section === s && v[i.code] !== 0).map((i) => ({ ...line(label(i.code), negate ? -v[i.code] : v[i.code]), code: i.code }));
  const item = (code: string, negate = false) => ({ ...line(label(code), negate ? -v[code] : v[code]), code });
  const shown = (r: Row) => r.cur !== 0;

  const position: Row[] = [
    head('Assets'),
    head('Non-current assets'),
    ...section('nca'),
    line('Total non-current assets', totalNca, 'subtotal'),
    head('Current assets'),
    ...section('ca'),
    line('Total current assets', totalCa, 'subtotal'),
    line('Total assets', totalAssets, 'total'),
    head('Equity and liabilities'),
    head('Equity'),
    ...['share_capital', 'share_premium', 'other_reserves'].map((c) => item(c)).filter(shown),
    { ...line('Retained earnings', retained), code: 'retained_earnings' },
    line('Equity attributable to owners of the parent', ownersEquity, 'subtotal'),
    ...(nci !== 0 || setup.subsidiaries.some((s) => s.ownership < 100) ? [line('Non-controlling interests', nci)] : []),
    line('Total equity', totalEquity, 'subtotal'),
    head('Non-current liabilities'),
    ...section('ncl'),
    line('Total non-current liabilities', totalNcl, 'subtotal'),
    head('Current liabilities'),
    ...section('cl'),
    line('Total current liabilities', totalCl, 'subtotal'),
    line('Total liabilities', totalLiabilities, 'subtotal'),
    line('Total equity and liabilities', totalEquity + totalLiabilities, 'total'),
  ];
  const income: Row[] = [
    item('revenue'),
    item('cost_of_sales', true),
    line('Gross profit', grossProfit, 'subtotal'),
    ...[item('other_income')].filter(shown),
    ...['distribution_costs', 'admin_expenses', 'other_expenses'].map((c) => item(c, true)).filter(shown),
    line('Operating profit', operatingProfit, 'subtotal'),
    ...[item('finance_income')].filter(shown),
    ...[item('finance_costs', true)].filter(shown),
    line('Profit before tax', pbt, 'subtotal'),
    item('income_tax_expense', true),
    line('Profit for the year', profit, 'total'),
    head('Profit attributable to'),
    line('Owners of the parent', profit - nciProfit),
    line('Non-controlling interests', nciProfit),
  ];

  return {
    columns: entities.map((e) => ({ name: e.name, v: e.figures.v })),
    adjustments: adj,
    v,
    goodwill,
    nci,
    nciProfit,
    profit,
    ownersProfit: profit - nciProfit,
    ownersEquity,
    totalEquity,
    totalAssets,
    totalLiabilities,
    difference: totalAssets - totalEquity - totalLiabilities,
    unbalanced,
    position,
    income,
    warnings,
  };
}

/** Puts two single-period statements side by side. A line that appears in only one year is kept. */
export function mergePeriods(cur: Row[], prior: Row[] | null): Row[] {
  if (!prior) return cur;
  const key = (r: Row) => `${r.style === 'heading' ? 'h:' : ''}${r.label}`;
  const out: Row[] = cur.map((r) => ({ ...r, prior: r.style === 'heading' ? null : (prior.find((p) => key(p) === key(r))?.cur ?? 0) }));
  prior.forEach((p, i) => {
    if (out.some((r) => key(r) === key(p))) return;
    // Place it after the line it followed last year, or at the top.
    const before = prior.slice(0, i).reverse().find((x) => out.some((r) => key(r) === key(x)));
    const at = before ? out.findIndex((r) => key(r) === key(before)) + 1 : 0;
    out.splice(at, 0, { ...p, cur: p.style === 'heading' ? null : 0, prior: p.cur });
  });
  return out;
}
