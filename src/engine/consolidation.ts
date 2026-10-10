import { CHART, ITEM, type Section } from './chart';
import type { Figures, Period, Row } from './statements';
import type { Kobo } from './types';

/**
 * Consolidation of a parent and its subsidiaries, in the manner of Section 9 of the IFRS for SMEs,
 * with associates and joint ventures (Sections 14 and 15) and foreign subsidiaries (Section 30).
 *
 * What it does: adds the statements line by line, removes the parent's investment against the
 * subsidiary's equity at acquisition, recognises goodwill and its amortisation, measures
 * non-controlling interests at their share of the subsidiary's net assets, applies the
 * intercompany eliminations the preparer enters, brings a subsidiary in from the day it was
 * bought and out from the day it was sold, translates a foreign subsidiary, and carries
 * associates at cost or by the equity method.
 *
 * What it assumes, because the file does not hold the detail to do better:
 * - A subsidiary held for part of a year earns its results evenly through that year.
 * - Unrealised profit eliminations are borne wholly by the owners of the parent.
 * - A subsidiary's reserves since acquisition are shown within group retained earnings.
 * - Goodwill on a foreign subsidiary is kept at the naira amount fixed at acquisition.
 */

const DEBIT: Section[] = ['nca', 'ca', 'expense', 'distribution'];
const BALANCE_SHEET: Section[] = ['nca', 'ca', 'ncl', 'cl'];
const EQUITY_CODES = ['share_capital', 'share_premium', 'other_reserves', 'retained_earnings'];
/** Lines an elimination may use. Share capital and other equity lines are dealt with by the engine. */
export const ELIMINATION_CODES = CHART.filter((i) => !['share_capital', 'share_premium', 'other_reserves'].includes(i.code)).map((i) => i.code);

export interface ForeignCurrency {
  /** The subsidiary's own currency, such as GHS. */
  currency: string;
  /** Naira for one unit of that currency at each year end, and on average through each year. */
  closing: number;
  average: number;
  closingPrior: number;
  averagePrior: number;
  /** The group's share of all exchange differences on this subsidiary up to the end of last year. */
  reservePriorEnd: Kobo;
  /** The exchange difference that arose last year on the whole subsidiary, for last year's column. */
  differencePrior: Kobo;
}

export interface GroupSubsidiary {
  engagementId: string;
  /** Percentage of the equity held by the parent, above 0 and up to 100. */
  ownership: number;
  /** Cost of the investment in naira, as carried in the parent's own statement of financial position. */
  cost: Kobo;
  /** Fair value of the subsidiary's net assets on the day it was acquired, in naira. */
  netAssets: Kobo;
  /** Goodwill amortised and impaired up to the end of the current year, or to the day of disposal. */
  amortised: Kobo;
  /** Of which charged in the current year. */
  charge: Kobo;
  /** And charged in the prior year. */
  chargePrior: Kobo;
  /** The day control was obtained, when that falls inside the two years presented. */
  acquired?: string;
  /** The day control was lost. The subsidiary is not owned on this day. */
  disposed?: string;
  /** The subsidiary's net assets on the day it was sold, in naira. */
  netAssetsAtDisposal?: Kobo;
  foreign?: ForeignCurrency;
}

export interface Associate {
  id: string;
  name: string;
  kind: 'associate' | 'joint_venture';
  ownership: number;
  /** Cost: the investment stays at cost. Equity: it is carried at cost plus the share of profits kept by the investee. */
  method: 'cost' | 'equity';
  /** Cost, as carried in the parent's own books. */
  cost: Kobo;
  /** Equity method only. The carrying amount at the start of last year. */
  carryingStartPrior: Kobo;
  /** The group's share of the investee's profit after tax, and dividends received from it, in each year. */
  share: Kobo;
  dividends: Kobo;
  sharePrior: Kobo;
  dividendsPrior: Kobo;
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
  associates?: Associate[];
}

/** One company, or one sub-group already consolidated, for one year, in its own currency. */
export interface Unit {
  name: string;
  /** Every statement line, in the sign the statements use. */
  v: Record<string, Kobo>;
  /** Profit for the full year belonging to the unit's own shareholders. */
  ownersProfit: Kobo;
  closingRetained: Kobo;
  /** Outside shareholders within the unit. Nil unless the unit is a sub-group. */
  nci: Kobo;
  nciProfit: Kobo;
  nciDividends: Kobo;
  /** Share of associates' profit inside the unit, which is not on any statement line. */
  associateShare: Kobo;
  associateDividends: Kobo;
  depreciation: Kobo;
  /** Goodwill carried inside the unit. Nil unless the unit is a sub-group. */
  goodwill: Kobo;
  problems: string[];
}

/** @deprecated Use `Unit`. Kept for callers that hold a company's figures. */
export interface GroupEntity {
  name: string;
  figures: Figures;
}

export function unitOf(name: string, f: Figures): Unit {
  const problems: string[] = [];
  if (f.unmappedCount > 0) problems.push(`${f.unmappedCount} account(s) are not mapped, so its figures are incomplete.`);
  if (f.totalAssets !== f.totalEquityAndLiabilities) problems.push('its own statement of financial position does not balance.');
  return { name, v: f.v, ownersProfit: f.profit, closingRetained: f.closingRetained, nci: 0, nciProfit: 0, nciDividends: 0, associateShare: 0, associateDividends: 0, depreciation: f.depreciation, goodwill: 0, problems };
}

/** A subsidiary that is itself a parent, taken into the larger group as one unit. */
export function unitOfGroup(name: string, c: Consolidated): Unit {
  const problems = [...c.warnings];
  if (c.difference !== 0 || c.unbalanced.length > 0) problems.push('its own consolidation does not balance.');
  if (c.oci !== 0) problems.push('it holds a foreign subsidiary. Exchange differences inside a sub-group are not carried up, and will show as an unreconciled movement in equity.');
  return {
    name,
    v: c.v,
    ownersProfit: c.ownersProfit,
    closingRetained: c.v.retained_earnings,
    nci: c.nci,
    nciProfit: c.nciProfit,
    nciDividends: c.nciDividends,
    associateShare: c.associateShare,
    associateDividends: c.associateDividends,
    depreciation: c.depreciation,
    goodwill: c.goodwill,
    problems,
  };
}

export interface SubsidiaryResult {
  engagementId: string;
  name: string;
  ownership: number;
  /** Owned at the end of the period, so its assets and liabilities are in the group's. */
  present: boolean;
  /** Share of the period for which it was owned, from 0 to 1. */
  fraction: number;
  acquiredInPeriod: boolean;
  disposedInPeriod: boolean;
  foreign: boolean;
  cost: Kobo;
  shareOfNetAssets: Kobo;
  /** Cost less the share of net assets acquired. Negative when the purchase was a bargain. */
  atAcquisition: Kobo;
  carrying: Kobo;
  amortised: Kobo;
  charge: Kobo;
  /** Gain on a bargain purchase, taken to group reserves. */
  bargainGain: Kobo;
  /** Net assets belonging to the subsidiary's shareholders at the period end, in naira. */
  equity: Kobo;
  nci: Kobo;
  nciProfit: Kobo;
  nciDividends: Kobo;
  nciAtAcquisition: Kobo;
  /** Exchange difference for the period on the whole subsidiary, and the outside shareholders' part. */
  oci: Kobo;
  nciOci: Kobo;
  /** The group's share of all exchange differences to date, held in other reserves. */
  reserve: Kobo;
  /** Reduction in the parent's gain on sale, to arrive at the group's gain. */
  disposalAdjustment: Kobo;
}

export interface AssociateResult {
  id: string;
  name: string;
  kind: Associate['kind'];
  ownership: number;
  method: Associate['method'];
  cost: Kobo;
  carrying: Kobo;
  share: Kobo;
  dividends: Kobo;
}

export interface Consolidated {
  /** One column for each company in the group this period, parent first, in naira and in the sign the statements use. */
  columns: { name: string; v: Record<string, Kobo> }[];
  /** Consolidation adjustments by line, in the same sign. */
  adjustments: Record<string, Kobo>;
  /** The group figure for each line. Equity lines hold the group's own equity. */
  v: Record<string, Kobo>;
  /** One for each subsidiary in the setup, in the same order, whether or not it was owned this period. */
  subs: SubsidiaryResult[];
  associates: AssociateResult[];
  associateShare: Kobo;
  associateDividends: Kobo;
  /** Goodwill carried on every subsidiary, including those inside sub-groups. */
  goodwill: Kobo;
  nci: Kobo;
  nciProfit: Kobo;
  nciDividends: Kobo;
  /** Dividends declared by the parent to its own shareholders. */
  parentDividends: Kobo;
  pbt: Kobo;
  profit: Kobo;
  ownersProfit: Kobo;
  /** Exchange differences on foreign subsidiaries for the period, and the split. */
  oci: Kobo;
  ownersOci: Kobo;
  nciOci: Kobo;
  depreciation: Kobo;
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

const DAY = 86400000;
const day = (iso: string) => Math.round(Date.parse(iso + 'T00:00:00Z') / DAY);
/** The last day of the period, and the last day of the period before it. */
export function periodBounds(yearEnd: string, period: Period): { start: string; end: string } {
  const back = (iso: string) => {
    const y = Number(iso.slice(0, 4)) - 1;
    const rest = iso.slice(4);
    // 29 February has no anniversary in the year before.
    return rest === '-02-29' ? `${y}-02-28` : `${y}${rest}`;
  };
  const end = period === 'current' ? yearEnd : back(yearEnd);
  return { start: back(end), end };
}
/** For how much of a period a subsidiary was owned, and whether it was owned on the last day. */
export function ownedIn(s: Pick<GroupSubsidiary, 'acquired' | 'disposed'>, yearEnd: string, period: Period) {
  const { start, end } = periodBounds(yearEnd, period);
  const first = day(start) + 1;
  const last = day(end);
  const from = Math.max(first, s.acquired ? day(s.acquired) : -Infinity);
  const to = Math.min(last, s.disposed ? day(s.disposed) - 1 : Infinity);
  const days = Math.max(0, to - from + 1);
  return {
    fraction: days / (last - first + 1),
    present: (!s.acquired || day(s.acquired) <= last) && (!s.disposed || day(s.disposed) > last),
    acquiredInPeriod: !!s.acquired && day(s.acquired) >= first && day(s.acquired) <= last,
    disposedInPeriod: !!s.disposed && day(s.disposed) > first && day(s.disposed) <= last,
  };
}

/**
 * Consolidates one period. `subs` are in the order of `setup.subsidiaries`. `opening` is the
 * consolidation of the period before, which a foreign subsidiary's exchange difference needs.
 */
export function consolidate(
  parent: Unit | GroupEntity,
  subUnits: (Unit | GroupEntity)[],
  setup: GroupSetup,
  period: Period,
  yearEnd = '2025-12-31',
  opening: Consolidated | null = null,
): Consolidated {
  const unit = (x: Unit | GroupEntity): Unit => ('figures' in x ? unitOf(x.name, x.figures) : x);
  const top = unit(parent);
  const warnings: string[] = top.problems.map((p) => `${top.name}: ${p}`);
  const adj: Record<string, Kobo> = Object.fromEntries(CHART.map((i) => [i.code, 0]));
  const sign = (code: string) => (DEBIT.includes(ITEM.get(code)!.section) ? 1 : -1);
  /** Posts a debit-positive amount to a line. */
  const post = (code: string, debit: Kobo) => {
    adj[code] += sign(code) * debit;
  };

  // 1. Each subsidiary: when it was owned, its figures in naira, goodwill and outside shareholders.
  const columns: Consolidated['columns'] = [{ name: top.name, v: top.v }];
  const subs: SubsidiaryResult[] = [];
  let retainedFromSubs = 0;
  let goodwillWrittenOff = 0;
  let reserves = 0;
  let innerNci = 0;
  let innerGoodwill = 0;
  let innerNciProfit = 0;
  let innerNciDividends = 0;
  let associateShare = 0;
  let associateDividends = 0;
  let depreciation = top.depreciation;

  setup.subsidiaries.forEach((s, i) => {
    const u = unit(subUnits[i]);
    const own = ownedIn(s, yearEnd, period);
    const p = Math.min(Math.max(s.ownership, 0), 100) / 100;
    const fx = s.foreign;
    const closing = fx ? (period === 'current' ? fx.closing : fx.closingPrior) : 1;
    const average = fx ? (period === 'current' ? fx.average : fx.averagePrior) : 1;
    const flow = own.fraction * average;
    const tr = (amount: Kobo, rate: number) => (rate === 1 ? amount : Math.round(amount * rate));

    // Assets and liabilities at the closing rate if it was owned at the year end. Income and
    // expenses at the average rate, for the part of the year it was owned.
    const v: Record<string, Kobo> = {};
    for (const item of CHART) {
      if (EQUITY_CODES.includes(item.code)) v[item.code] = 0;
      else if (BALANCE_SHEET.includes(item.section)) v[item.code] = own.present ? tr(u.v[item.code], closing) : 0;
      else v[item.code] = tr(u.v[item.code], flow);
    }
    const net = (sections: Section[]) => CHART.filter((x) => sections.includes(x.section)).reduce((a, x) => a + v[x.code], 0);
    const inner = own.present ? tr(u.nci, closing) : 0;
    const equity = net(['nca', 'ca']) - net(['ncl', 'cl']) - inner;
    const profit = tr(u.ownersProfit, flow);
    const dividends = v.dividends;
    const nci = own.present ? Math.round((1 - p) * equity) : 0;
    const nciProfit = Math.round((1 - p) * profit);
    const shareOfNetAssets = Math.round(p * s.netAssets);
    const atAcquisition = s.cost - shareOfNetAssets;
    const bargainGain = Math.max(-atAcquisition, 0);
    const hasGoodwill = atAcquisition > 0;
    const owned = own.present || own.fraction > 0;
    const amortised = hasGoodwill && owned ? (period === 'current' ? s.amortised : s.amortised - s.charge) : 0;
    const charge = hasGoodwill && owned ? (period === 'current' ? s.charge : s.chargePrior) : 0;
    const carrying = own.present ? Math.max(atAcquisition, 0) - amortised : 0;

    // Exchange differences: what the year-end rate adds to the subsidiary's net assets beyond its profit kept.
    let oci = 0;
    let reserve = 0;
    if (fx && own.present) {
      const before = opening?.subs[i];
      if (period === 'prior') oci = fx.differencePrior;
      else if (before?.present && !own.acquiredInPeriod) oci = equity - before.equity - profit + dividends;
      const share = Math.round(p * oci);
      reserve = period === 'prior' ? fx.reservePriorEnd : fx.reservePriorEnd + share;
      if (period === 'current' && !own.acquiredInPeriod && !before?.present) warnings.push(`${u.name}: this year’s exchange difference needs last year’s figures for every company in the group. Without them it sits within retained earnings.`);
      if (period === 'current' && own.acquiredInPeriod) warnings.push(`${u.name}: the exchange difference for the year it was bought is not worked out, and sits within retained earnings.`);
    }
    const ownersOci = Math.round(p * oci);

    let disposalAdjustment = 0;
    if (own.present) {
      post('investments', -s.cost);
      post('intangibles', carrying);
      retainedFromSubs += equity - nci - shareOfNetAssets + bargainGain - reserve;
      goodwillWrittenOff += amortised;
      reserves += reserve;
      innerNci += inner;
      innerGoodwill += tr(u.goodwill, closing);
    } else if (own.disposedInPeriod) {
      // The parent's own gain is proceeds less cost. The group's is proceeds less its share of the
      // net assets sold and the goodwill still carried. The difference comes off other income.
      disposalAdjustment = Math.round(p * ((s.netAssetsAtDisposal ?? s.netAssets) - s.netAssets)) - amortised + bargainGain;
      post('other_income', disposalAdjustment);
      if (s.netAssetsAtDisposal === undefined) warnings.push(`${u.name}: enter its net assets on the day it was sold, so the group’s gain or loss on the sale is right.`);
    }
    if (owned) {
      post('admin_expenses', charge);
      innerNciProfit += tr(u.nciProfit, flow);
      innerNciDividends += tr(u.nciDividends, flow);
      associateShare += tr(u.associateShare, flow);
      associateDividends += tr(u.associateDividends, flow);
      depreciation += tr(u.depreciation, flow) + charge;
      columns.push({ name: u.name, v });
      for (const problem of u.problems) warnings.push(`${u.name}: ${problem}`);
      if (s.ownership <= 50) warnings.push(`${u.name}: ${s.ownership}% is not a majority. Consolidate only if the parent controls it by other means.`);
      if (own.present && carrying < 0) warnings.push(`${u.name}: more goodwill has been amortised than arose on acquisition.`);
      if (own.fraction > 0 && own.fraction < 1) warnings.push(`${u.name}: owned for ${Math.round(own.fraction * 365)} days of the year. ${Math.round(own.fraction * 100)}% of its income and expenses for the year are included, on the basis that they arose evenly.`);
    }
    subs.push({
      engagementId: s.engagementId,
      name: u.name,
      ownership: s.ownership,
      present: own.present,
      fraction: own.fraction,
      acquiredInPeriod: own.acquiredInPeriod,
      disposedInPeriod: own.disposedInPeriod,
      foreign: !!fx,
      cost: s.cost,
      shareOfNetAssets,
      atAcquisition,
      carrying,
      amortised,
      charge,
      bargainGain,
      equity: own.present ? equity : 0,
      nci,
      nciProfit: owned ? nciProfit : 0,
      nciDividends: owned ? Math.round((1 - p) * dividends) : 0,
      nciAtAcquisition: s.netAssets - shareOfNetAssets,
      oci,
      nciOci: oci - ownersOci,
      reserve,
      disposalAdjustment,
    });
  });

  // 2. Associates and joint ventures.
  const associates: AssociateResult[] = (setup.associates ?? []).map((a) => {
    if (a.method === 'cost') return { id: a.id, name: a.name, kind: a.kind, ownership: a.ownership, method: a.method, cost: a.cost, carrying: a.cost, share: 0, dividends: 0 };
    const priorEnd = a.carryingStartPrior + a.sharePrior - a.dividendsPrior;
    const carrying = period === 'current' ? priorEnd + a.share - a.dividends : priorEnd;
    const share = period === 'current' ? a.share : a.sharePrior;
    const dividends = period === 'current' ? a.dividends : a.dividendsPrior;
    // The parent carries it at cost and takes dividends to income. The group carries its share of the
    // investee's net assets and takes its share of the profit instead.
    post('investments', carrying - a.cost);
    post('other_income', dividends);
    return { id: a.id, name: a.name, kind: a.kind, ownership: a.ownership, method: a.method, cost: a.cost, carrying, share, dividends };
  });
  const ownAssociateShare = associates.reduce((x, a) => x + a.share, 0);
  const ownAssociateDividends = associates.reduce((x, a) => x + a.dividends, 0);
  const retainedFromAssociates = associates.reduce((x, a) => x + a.carrying - a.cost, 0);
  associateShare += ownAssociateShare;
  associateDividends += ownAssociateDividends;

  // 3. Intercompany eliminations entered by the preparer.
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

  // 4. Line by line.
  const v: Record<string, Kobo> = {};
  for (const i of CHART) {
    v[i.code] = EQUITY_CODES.includes(i.code) ? top.v[i.code] : columns.reduce((a, c) => a + c.v[i.code], 0) + adj[i.code];
  }
  if (v.investments < 0) warnings.push('The cost of investments entered is more than the investments the group carries. Check the costs, and that the parent’s investment is mapped to Investments.');
  const sum = (s: Section) => CHART.filter((i) => i.section === s).reduce((a, i) => a + v[i.code], 0);
  const grossProfit = v.revenue - v.cost_of_sales;
  const operatingProfit = grossProfit + v.other_income - v.distribution_costs - v.admin_expenses - v.other_expenses;
  const pbt = operatingProfit + v.finance_income - v.finance_costs + associateShare;
  const profit = pbt - v.income_tax_expense;
  const goodwill = subs.reduce((a, s) => a + s.carrying, 0) + innerGoodwill;
  const nci = subs.reduce((a, s) => a + s.nci, 0) + innerNci;
  const nciProfit = subs.reduce((a, s) => a + s.nciProfit, 0) + innerNciProfit;
  const nciDividends = subs.reduce((a, s) => a + s.nciDividends, 0) + innerNciDividends;
  const oci = subs.reduce((a, s) => a + s.oci, 0);
  const nciOci = subs.reduce((a, s) => a + s.nciOci, 0);

  const retained = top.closingRetained + retainedFromSubs + retainedFromAssociates - goodwillWrittenOff - throughReserves;
  v.retained_earnings = retained;
  v.other_reserves = top.v.other_reserves + reserves;
  const ownersEquity = v.share_capital + v.share_premium + v.other_reserves + retained;
  const totalEquity = ownersEquity + nci;
  const totalNca = sum('nca');
  const totalCa = sum('ca');
  const totalNcl = sum('ncl');
  const totalCl = sum('cl');
  const totalAssets = totalNca + totalCa;
  const totalLiabilities = totalNcl + totalCl;

  // 5. The statements. One period a call, so each row carries its figure in the first column.
  const line = (label: string, amount: Kobo, style: Row['style'] = 'line'): Row => ({ label, cur: amount, prior: null, style });
  const head = (label: string): Row => ({ label, cur: null, prior: null, style: 'heading' });
  const label = (code: string) => {
    if (code === 'intangibles' && goodwill !== 0) return 'Goodwill and intangible assets';
    if (code === 'investments' && associates.some((a) => a.method === 'equity')) return 'Investments, including associates and joint ventures';
    return ITEM.get(code)!.label;
  };
  const section = (s: Section, negate = false) =>
    CHART.filter((i) => i.section === s && v[i.code] !== 0).map((i) => ({ ...line(label(i.code), negate ? -v[i.code] : v[i.code]), code: i.code }));
  const item = (code: string, negate = false) => ({ ...line(label(code), negate ? -v[code] : v[code]), code });
  const shown = (r: Row) => r.cur !== 0;
  const outsiders = nci !== 0 || nciProfit !== 0 || setup.subsidiaries.some((s) => s.ownership < 100);

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
    ...['share_capital', 'share_premium'].map((c) => item(c)).filter(shown),
    ...[{ ...line(reserves !== 0 ? 'Other reserves, including the translation reserve' : 'Other reserves', v.other_reserves), code: 'other_reserves' }].filter(shown),
    { ...line('Retained earnings', retained), code: 'retained_earnings' },
    line('Equity attributable to owners of the parent', ownersEquity, 'subtotal'),
    ...(outsiders ? [line('Non-controlling interests', nci)] : []),
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
    ...[line('Share of profit of associates and joint ventures', associateShare)].filter(shown),
    line('Profit before tax', pbt, 'subtotal'),
    item('income_tax_expense', true),
    line('Profit for the year', profit, 'total'),
    ...(oci !== 0 || subs.some((s) => s.foreign && s.present)
      ? [head('Other comprehensive income'), line('Exchange differences on translating foreign operations', oci), line('Total comprehensive income for the year', profit + oci, 'total')]
      : []),
    head('Profit attributable to'),
    line('Owners of the parent', profit - nciProfit),
    line('Non-controlling interests', nciProfit),
    ...(oci !== 0
      ? [head('Total comprehensive income attributable to'), line('Owners of the parent', profit - nciProfit + oci - nciOci), line('Non-controlling interests', nciProfit + nciOci)]
      : []),
  ];

  return {
    columns,
    adjustments: adj,
    v,
    subs,
    associates,
    associateShare,
    associateDividends,
    goodwill,
    nci,
    nciProfit,
    nciDividends,
    parentDividends: top.v.dividends,
    pbt,
    profit,
    ownersProfit: profit - nciProfit,
    oci,
    ownersOci: oci - nciOci,
    nciOci,
    depreciation,
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

export interface GroupEquity {
  columns: string[];
  rows: { label: string; values: Kobo[]; style: 'line' | 'total' | 'check' }[];
  /** Movement in owners' reserves and in non-controlling interests that the year's results do not explain. */
  unexplained: Kobo;
}

/**
 * Consolidated statement of changes in equity, from one year end to the next.
 * The last row before the closing balances shows any movement the year's results do not explain.
 * That is usually a profit eliminated at the last year end and not brought forward, an intragroup
 * dividend left in income, or an acquisition or disposal figure that does not agree to the books.
 */
export function groupEquity(cur: Consolidated, prior: Consolidated): GroupEquity {
  const columns = ['Share capital', 'Share premium', 'Other reserves', 'Retained earnings', 'Owners of the parent', 'Non-controlling interests', 'Total equity'];
  const at = (c: Consolidated) => [c.v.share_capital, c.v.share_premium, c.v.other_reserves, c.v.retained_earnings, c.nci];
  /** [capital, premium, reserves, retained, nci] to the seven columns. */
  const wide = (x: Kobo[]) => [x[0], x[1], x[2], x[3], x[0] + x[1] + x[2] + x[3], x[4], x[0] + x[1] + x[2] + x[3] + x[4]];
  const open = at(prior);
  const close = at(cur);
  const acquired = cur.subs.filter((s) => s.acquiredInPeriod && s.present).reduce((a, s) => a + s.nciAtAcquisition, 0);
  const disposed = cur.subs
    .map((s, i) => (s.disposedInPeriod ? (prior.subs[i]?.nci ?? 0) + s.nciProfit - s.nciDividends : 0))
    .reduce((a, x) => a + x, 0);
  const moves: [string, Kobo[]][] = [
    ['Profit for the year', [0, 0, 0, cur.ownersProfit, cur.nciProfit]],
    ['Exchange differences on translating foreign operations', [0, 0, cur.ownersOci, 0, cur.nciOci]],
    ['Dividends', [0, 0, 0, -cur.parentDividends, -cur.nciDividends]],
    ['Issue of shares', [close[0] - open[0], close[1] - open[1], 0, 0, 0]],
    ['Acquisition of subsidiary', [0, 0, 0, 0, acquired]],
    ['Disposal of subsidiary', [0, 0, 0, 0, -disposed]],
  ];
  const explained = open.map((o, i) => o + moves.reduce((a, [, m]) => a + m[i], 0));
  const gap = close.map((c, i) => c - explained[i]);
  // A movement in the parent's own other reserves is a transfer the trial balance shows, not a difference.
  const reserveMove: Kobo[] = [0, 0, gap[2], 0, 0];
  const unexplainedRow: Kobo[] = [0, 0, 0, gap[3], gap[4]];
  const rows: GroupEquity['rows'] = [{ label: 'At start of year', values: wide(open), style: 'line' }];
  for (const [label, m] of moves) if (m.some((x) => x !== 0) || label === 'Profit for the year') rows.push({ label, values: wide(m), style: 'line' });
  if (gap[2] !== 0) rows.push({ label: 'Other movements in reserves', values: wide(reserveMove), style: 'line' });
  if (gap[3] !== 0 || gap[4] !== 0) rows.push({ label: 'Movement not explained by the year’s results', values: wide(unexplainedRow), style: 'check' });
  rows.push({ label: 'At end of year', values: wide(close), style: 'total' });
  return { columns, rows, unexplained: gap[3] + gap[4] };
}

/** Why the consolidated cash flow cannot be drawn from year-end figures alone, or null when it can. */
export function cashFlowBlocker(cur: Consolidated): string | null {
  const moved = cur.subs.filter((s) => s.acquiredInPeriod || s.disposedInPeriod).map((s) => s.name);
  if (moved.length)
    return `${moved.join(' and ')} joined or left the group in the year. The cash flow needs its assets and liabilities on that day, to separate what the group bought or sold from what it traded. That balance sheet is not held in the file.`;
  const foreign = cur.subs.filter((s) => s.foreign && s.present).map((s) => s.name);
  if (foreign.length)
    return `${foreign.join(' and ')} reports in a foreign currency. Its cash flows must be translated at the rates when they happened, and the effect of rate changes on cash shown separately. Year-end balances cannot give that.`;
  return null;
}

/**
 * Consolidated statement of cash flows, indirect method, from the movement between two consolidated
 * statements of financial position. Returns null when the group changed in the year or holds a foreign
 * subsidiary: see `cashFlowBlocker`.
 */
export function groupCashFlow(cur: Consolidated, prior: Consolidated): { rows: Row[]; difference: Kobo } | null {
  if (cashFlowBlocker(cur)) return null;
  const d = (code: string) => cur.v[code] - prior.v[code];
  const line = (label: string, amount: Kobo, style: Row['style'] = 'line'): Row => ({ label, cur: amount, prior: null, style });
  const head = (label: string): Row => ({ label, cur: null, prior: null, style: 'heading' });
  const total = (rows: Row[]) => rows.reduce((a, r) => a + (r.cur ?? 0), 0);
  const operating = [
    line('Profit before tax', cur.pbt),
    line('Depreciation and amortisation, including goodwill', cur.depreciation),
    line('Finance costs', cur.v.finance_costs),
    line('Finance income', -cur.v.finance_income),
    line('Share of profit of associates and joint ventures', -cur.associateShare),
    line('Change in inventories', -d('inventories')),
    line('Change in trade receivables', -d('trade_receivables')),
    line('Change in other receivables and prepayments', -d('other_receivables')),
    line('Change in trade payables', d('trade_payables')),
    line('Change in other payables and accruals', d('other_payables')),
    line('Change in provisions', d('provisions')),
  ];
  const generated = total(operating);
  const taxPaid = -(cur.v.income_tax_expense - d('current_tax_payable') - d('deferred_tax_liability') + d('deferred_tax_asset'));
  const investing = [
    line('Purchase of property, plant, equipment and intangibles, net of disposals', -(d('ppe') + d('intangibles') + cur.depreciation)),
    line('Change in other investments', -(d('investments') - (cur.associateShare - cur.associateDividends))),
    line('Dividends received from associates and joint ventures', cur.associateDividends),
    line('Finance income received', cur.v.finance_income),
  ];
  const financing = [
    line('Proceeds from issue of shares', d('share_capital') + d('share_premium')),
    line('Net movement in borrowings', d('borrowings_nc') + d('borrowings_c')),
    line('Finance costs paid', -cur.v.finance_costs),
    line('Dividends paid to owners of the parent', -cur.parentDividends),
    line('Dividends paid to non-controlling interests', -cur.nciDividends),
    line('Movement in other reserves', d('other_reserves')),
  ];
  const net = generated + taxPaid + total(investing) + total(financing);
  const difference = cur.v.cash - prior.v.cash - net;
  const nonZero = (r: Row) => r.cur !== 0;
  const rows: Row[] = [
    head('Cash flows from operating activities'),
    ...operating.filter((r, i) => i === 0 || nonZero(r)),
    line('Cash generated from operations', generated, 'subtotal'),
    line('Income tax paid', taxPaid),
    line('Net cash from operating activities', generated + taxPaid, 'subtotal'),
    head('Cash flows from investing activities'),
    ...investing.filter(nonZero),
    line('Net cash used in investing activities', total(investing), 'subtotal'),
    head('Cash flows from financing activities'),
    ...financing.filter(nonZero),
    line('Net cash from financing activities', total(financing), 'subtotal'),
    line('Net change in cash and cash equivalents', net, 'subtotal'),
    line('Cash and cash equivalents at start of year', prior.v.cash),
    line('Cash and cash equivalents at end of year', cur.v.cash, 'total'),
  ];
  if (difference !== 0) rows.push(line('Unreconciled difference: see the statement of changes in equity', difference, 'check'));
  return { rows, difference };
}

/** Puts two single-period statements side by side. A line that appears in only one year is kept. */
export function mergePeriods(cur: Row[], prior: Row[] | null): Row[] {
  if (!prior) return cur;
  // The same label can appear under two headings, so a line is known by its label and which time it appears.
  const keys = (rows: Row[]) => {
    const seen = new Map<string, number>();
    return rows.map((r) => {
      const base = `${r.style === 'heading' ? 'h:' : ''}${r.label}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return `${base}#${n}`;
    });
  };
  const curKeys = keys(cur);
  const priorKeys = keys(prior);
  const out = cur.map((r, i) => ({ key: curKeys[i], row: { ...r, prior: r.style === 'heading' ? null : (prior[priorKeys.indexOf(curKeys[i])]?.cur ?? 0) } as Row }));
  prior.forEach((p, i) => {
    if (out.some((o) => o.key === priorKeys[i])) return;
    // Place it after the line it followed last year, or at the top.
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const found = out.findIndex((o) => o.key === priorKeys[j]);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    out.splice(at, 0, { key: priorKeys[i], row: { ...p, cur: p.style === 'heading' ? null : 0, prior: p.cur } });
  });
  return out.map((o) => o.row);
}
