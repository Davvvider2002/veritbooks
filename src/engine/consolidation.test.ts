import { describe, expect, it } from 'vitest';
import { cashFlowBlocker, consolidate, groupCashFlow, groupEquity, mergePeriods, ownedIn, unitOf, unitOfGroup, type Associate, type GroupSetup } from './consolidation';
import { figures } from './statements';
import type { TbLine } from './types';

const N = (naira: number) => naira * 100;
let n = 0;
/** A trial balance from [mapCode, debit-positive naira, prior naira] rows. */
const tb = (rows: [string, number, number][]): TbLine[] =>
  rows.map(([mapCode, balance, prior]) => ({ id: `l${++n}`, code: `c${n}`, name: mapCode, balance: N(balance), prior: N(prior), mapCode, nature: null }));
const entity = (name: string, lines: TbLine[], period: 'current' | 'prior' = 'current') => ({ name, figures: figures(lines, [], period) });

// Parent: holds 80% of Sub, bought for 500 when Sub's net assets were 400.
const parentTb = tb([
  ['ppe', 1000, 900], ['investments', 500, 500], ['trade_receivables', 300, 250], ['cash', 200, 150],
  ['share_capital', -1000, -1000], ['retained_earnings', -600, -500], ['trade_payables', -200, -200],
  ['revenue', -900, -800], ['cost_of_sales', 500, 450], ['admin_expenses', 150, 150], ['other_income', -40, 0], ['income_tax_expense', 90, 100],
]);
// profit P = 900 - 500 - 150 + 40 - 90 = 200. closing RE = 800. equity 1,800. assets 2,000.
const subTb = tb([
  ['ppe', 600, 550], ['inventories', 200, 150], ['cash', 100, 100],
  ['share_capital', -300, -300], ['retained_earnings', -350, -250], ['trade_payables', -150, -150], ['dividends', 50, 0],
  ['revenue', -600, -500], ['cost_of_sales', 350, 300], ['admin_expenses', 80, 70], ['income_tax_expense', 20, 30],
]);
// profit S = 600 - 350 - 80 - 20 = 150. closing RE = 350 + 150 - 50 = 450. equity 750. assets 900.
const sub = { engagementId: 's', ownership: 80, cost: N(500), netAssets: N(400), amortised: N(54), charge: N(18), chargePrior: N(18) };
const setup: GroupSetup = { subsidiaries: [sub], eliminations: [] };

describe('consolidation', () => {
  it('both sets of test figures are valid trial balances', () => {
    for (const t of [parentTb, subTb]) {
      expect(t.reduce((a, l) => a + l.balance, 0)).toBe(0);
      expect(t.reduce((a, l) => a + (l.prior ?? 0), 0)).toBe(0);
      const f = figures(t, [], 'current');
      expect(f.totalAssets).toBe(f.totalEquityAndLiabilities);
    }
  });

  it('eliminates the investment, recognises goodwill and non-controlling interests, and balances', () => {
    const c = consolidate(entity('Parent', parentTb), [entity('Sub', subTb)], setup, 'current');
    // goodwill 500 - 80% x 400 = 180, less 54 amortised = 126
    expect(c.subs[0]).toMatchObject({ shareOfNetAssets: N(320), atAcquisition: N(180), carrying: N(126), nci: N(150), nciProfit: N(30) });
    expect(c.v.investments).toBe(0);
    expect(c.v.intangibles).toBe(N(126));
    expect(c.v.ppe).toBe(N(1600));
    expect(c.totalAssets).toBe(N(1600 + 126 + 200 + 300 + 300));
    // profit 200 + 150 - 18 = 332, of which 30 to the non-controlling interests
    expect(c.profit).toBe(N(332));
    expect(c.ownersProfit).toBe(N(302));
    // retained 800 + 80% x (750 - 400) - 54 = 1,026
    expect(c.v.retained_earnings).toBe(N(1026));
    expect(c.v.share_capital).toBe(N(1000));
    expect(c.nci).toBe(N(150));
    expect(c.totalEquity).toBe(N(2176));
    expect(c.totalLiabilities).toBe(N(350));
    expect(c.difference).toBe(0);
    expect(c.warnings).toEqual([]);
    expect(c.position.find((r) => r.label === 'Goodwill and intangible assets')?.cur).toBe(N(126));
    expect(c.position.find((r) => r.label === 'Non-controlling interests')?.cur).toBe(N(150));
    expect(c.income.find((r) => r.label === 'Owners of the parent')?.cur).toBe(N(302));
  });

  it('consolidates the prior year with last year’s goodwill and no current year charge', () => {
    const c = consolidate(entity('Parent', parentTb, 'prior'), [entity('Sub', subTb, 'prior')], setup, 'prior');
    // prior: parent profit 800-450-150-100 = 100, RE 600. sub profit 500-300-70-30 = 100, RE 350, equity 650.
    expect(c.v.intangibles).toBe(N(180 - 36));
    expect(c.profit).toBe(N(100 + 100 - 18));
    expect(c.nci).toBe(N(130));
    expect(c.v.retained_earnings).toBe(N(600 + 0.8 * 250 - 36));
    expect(c.difference).toBe(0);
  });

  it('applies intercompany eliminations and still balances', () => {
    const withElims: GroupSetup = {
      ...setup,
      eliminations: [
        { id: '1', description: 'Intercompany balance', period: 'current', lines: [{ code: 'trade_payables', amount: N(60) }, { code: 'trade_receivables', amount: -N(60) }] },
        { id: '2', description: 'Intercompany sales', period: 'current', lines: [{ code: 'revenue', amount: N(100) }, { code: 'cost_of_sales', amount: -N(100) }] },
        { id: '3', description: 'Unrealised profit in inventory', period: 'current', lines: [{ code: 'cost_of_sales', amount: N(10) }, { code: 'inventories', amount: -N(10) }] },
        { id: '4', description: 'Dividend from subsidiary', period: 'current', lines: [{ code: 'other_income', amount: N(40) }, { code: 'dividends', amount: -N(40) }] },
        { id: '5', description: 'Last year only', period: 'prior', lines: [{ code: 'revenue', amount: N(999) }, { code: 'cost_of_sales', amount: -N(999) }] },
      ],
    };
    const c = consolidate(entity('Parent', parentTb), [entity('Sub', subTb)], withElims, 'current');
    expect(c.v.trade_receivables).toBe(N(240));
    expect(c.v.trade_payables).toBe(N(290));
    expect(c.v.revenue).toBe(N(1400));
    expect(c.v.cost_of_sales).toBe(N(760));
    expect(c.v.inventories).toBe(N(190));
    expect(c.v.other_income).toBe(0);
    // 332 less unrealised profit 10 and the dividend income 40
    expect(c.profit).toBe(N(282));
    // reserves fall by the unrealised profit only: the dividend moves within the group
    expect(c.v.retained_earnings).toBe(N(1016));
    expect(c.difference).toBe(0);
    expect(c.unbalanced).toEqual([]);
  });

  it('reports an elimination that does not balance, and the consolidation then does not balance either', () => {
    const bad: GroupSetup = { ...setup, eliminations: [{ id: 'x', description: 'One-sided', period: 'current', lines: [{ code: 'trade_receivables', amount: -N(60) }] }] };
    const c = consolidate(entity('Parent', parentTb), [entity('Sub', subTb)], bad, 'current');
    expect(c.unbalanced.map((e) => e.id)).toEqual(['x']);
    expect(c.difference).toBe(-N(60));
  });

  it('takes a bargain purchase to reserves with no goodwill, and handles a wholly owned subsidiary', () => {
    const cheap: GroupSetup = { subsidiaries: [{ ...sub, ownership: 100, cost: N(500), netAssets: N(560), amortised: N(99), charge: N(9), chargePrior: 0 }], eliminations: [] };
    const c = consolidate(entity('Parent', parentTb), [entity('Sub', subTb)], cheap, 'current');
    expect(c.subs[0]).toMatchObject({ atAcquisition: -N(60), carrying: 0, bargainGain: N(60), nci: 0 });
    expect(c.v.intangibles).toBe(0);
    expect(c.profit).toBe(N(350)); // no amortisation where there is no goodwill
    expect(c.v.retained_earnings).toBe(N(800 + 750 - 560 + 60));
    expect(c.position.some((r) => r.label === 'Non-controlling interests')).toBe(false);
    expect(c.difference).toBe(0);
  });

  it('balances to the kobo when the percentage does not divide evenly, and warns about what looks wrong', () => {
    const odd: GroupSetup = { subsidiaries: [{ ...sub, ownership: 66.67, cost: N(500) + 1, netAssets: N(400) + 7, amortised: 0, charge: 0, chargePrior: 0 }], eliminations: [] };
    expect(consolidate(entity('Parent', parentTb), [entity('Sub', subTb)], odd, 'current').difference).toBe(0);
    const minority: GroupSetup = { subsidiaries: [{ ...sub, ownership: 40, cost: N(900), amortised: N(900) }], eliminations: [] };
    const c = consolidate(entity('Parent', parentTb), [entity('Sub', subTb)], minority, 'current');
    expect(c.warnings.join(' ')).toMatch(/not a majority/);
    expect(c.warnings.join(' ')).toMatch(/more goodwill has been amortised/);
    expect(c.warnings.join(' ')).toMatch(/more than the investments the group carries/);
    expect(c.difference).toBe(0);
  });

  it('consolidates two subsidiaries', () => {
    const two: GroupSetup = { subsidiaries: [{ ...sub, cost: N(250) }, { ...sub, ownership: 100, cost: N(250), netAssets: N(250), amortised: 0, charge: 0, chargePrior: 0 }], eliminations: [] };
    const c = consolidate(entity('Parent', parentTb), [entity('Sub A', subTb), entity('Sub B', subTb)], two, 'current');
    expect(c.columns.map((x) => x.name)).toEqual(['Parent', 'Sub A', 'Sub B']);
    expect(c.v.investments).toBe(0);
    expect(c.v.ppe).toBe(N(2200));
    expect(c.nci).toBe(N(150));
    expect(c.difference).toBe(0);
  });

  // ---- the statements that need two years
  const dividendOut = { id: 'd', description: 'Dividend from subsidiary', period: 'current' as const, lines: [{ code: 'other_income', amount: N(40) }, { code: 'dividends', amount: -N(40) }] };
  const pair = (s: GroupSetup, ye = '2025-12-31') => {
    const prior = consolidate(entity('Parent', parentTb, 'prior'), [entity('Sub', subTb, 'prior')], s, 'prior', ye);
    const cur = consolidate(entity('Parent', parentTb), [entity('Sub', subTb)], s, 'current', ye, prior);
    return { cur, prior };
  };
  const cell = (e: ReturnType<typeof groupEquity>, row: string, column: string) => e.rows.find((r) => r.label === row)?.values[e.columns.indexOf(column)];

  it('changes in equity: flags an intragroup dividend left in income, and reconciles once it is eliminated', () => {
    const raw = pair(setup);
    const flagged = groupEquity(raw.cur, raw.prior);
    expect(flagged.unexplained).toBe(-N(40));
    expect(flagged.rows.some((r) => r.style === 'check')).toBe(true);

    const { cur, prior } = pair({ ...setup, eliminations: [dividendOut] });
    const e = groupEquity(cur, prior);
    expect(e.unexplained).toBe(0);
    expect(e.rows.some((r) => r.style === 'check')).toBe(false);
    expect(cell(e, 'At start of year', 'Retained earnings')).toBe(N(764));
    expect(cell(e, 'Profit for the year', 'Retained earnings')).toBe(N(262));
    expect(cell(e, 'At end of year', 'Retained earnings')).toBe(N(1026));
    expect(cell(e, 'At start of year', 'Non-controlling interests')).toBe(N(130));
    expect(cell(e, 'Profit for the year', 'Non-controlling interests')).toBe(N(30));
    expect(cell(e, 'Dividends', 'Non-controlling interests')).toBe(-N(10));
    expect(cell(e, 'At end of year', 'Non-controlling interests')).toBe(N(150));
    expect(cell(e, 'At end of year', 'Total equity')).toBe(cur.totalEquity);
    for (const r of e.rows) expect(r.values[6]).toBe(r.values[4] + r.values[5]);
  });

  it('cash flow: reconciles to the movement in cash', () => {
    const { cur, prior } = pair({ ...setup, eliminations: [dividendOut] });
    const cf = groupCashFlow(cur, prior)!;
    const row = (label: string) => cf.rows.find((r) => r.label.startsWith(label))?.cur;
    expect(cf.difference).toBe(0);
    expect(row('Profit before tax')).toBe(cur.pbt);
    expect(row('Depreciation and amortisation')).toBe(N(18));
    // ppe 1,450 to 1,600 and goodwill 144 to 126 after an 18 charge: 150 spent
    expect(row('Purchase of property')).toBe(-N(150));
    expect(row('Dividends paid to non-controlling interests')).toBe(-N(10));
    expect(row('Net change in cash')).toBe(N(50));
    expect(row('Cash and cash equivalents at end of year')).toBe(N(300));
    const raw = pair(setup);
    expect(groupCashFlow(raw.cur, raw.prior)!.difference).toBe(groupEquity(raw.cur, raw.prior).unexplained);
  });

  // ---- bought or sold in the year
  it('works out the days a subsidiary was owned', () => {
    expect(ownedIn({}, '2025-12-31', 'current')).toMatchObject({ fraction: 1, present: true, acquiredInPeriod: false });
    expect(ownedIn({ acquired: '2025-07-01' }, '2025-12-31', 'current')).toMatchObject({ fraction: 184 / 365, present: true, acquiredInPeriod: true });
    expect(ownedIn({ acquired: '2025-07-01' }, '2025-12-31', 'prior')).toMatchObject({ fraction: 0, present: false, acquiredInPeriod: false });
    expect(ownedIn({ disposed: '2025-07-01' }, '2025-12-31', 'current')).toMatchObject({ fraction: 181 / 365, present: false, disposedInPeriod: true });
    expect(ownedIn({ disposed: '2025-07-01' }, '2025-12-31', 'prior')).toMatchObject({ fraction: 1, present: true, disposedInPeriod: false });
    expect(ownedIn({ acquired: '2024-01-01' }, '2025-12-31', 'prior')).toMatchObject({ fraction: 1, acquiredInPeriod: true });
    expect(ownedIn({ acquired: '2024-03-01' }, '2024-12-31', 'current').fraction).toBe(306 / 366); // a leap year
  });

  it('brings a subsidiary in from the day it was bought', () => {
    const s: GroupSetup = { subsidiaries: [{ ...sub, amortised: N(9), charge: N(9), chargePrior: 0, acquired: '2025-07-01' }], eliminations: [] };
    const { cur, prior } = pair(s);
    const f = 184 / 365;
    // last year the subsidiary was not in the group: the parent alone
    expect(prior.columns.map((c) => c.name)).toEqual(['Parent']);
    expect(prior.nci).toBe(0);
    expect(prior.v.investments).toBe(N(500));
    expect(prior.difference).toBe(0);
    // this year: all of its assets and liabilities, and 184 days of its results
    expect(cur.v.ppe).toBe(N(1600));
    expect(cur.v.revenue).toBe(N(900) + Math.round(N(600) * f));
    expect(cur.v.intangibles).toBe(N(171));
    expect(cur.subs[0]).toMatchObject({ present: true, acquiredInPeriod: true, nci: N(150), nciProfit: Math.round(0.2 * Math.round(N(150) * f)), nciAtAcquisition: N(80) });
    expect(cur.difference).toBe(0);
    expect(cur.warnings.join(' ')).toMatch(/owned for 184 days/);
    const e = groupEquity(cur, prior);
    expect(cell(e, 'Acquisition of subsidiary', 'Non-controlling interests')).toBe(N(80));
    expect(groupCashFlow(cur, prior)).toBeNull();
    expect(cashFlowBlocker(cur)).toMatch(/joined or left the group/);
  });

  it('takes a subsidiary out from the day it was sold, and restates the gain on sale', () => {
    const s: GroupSetup = { subsidiaries: [{ ...sub, disposed: '2025-07-01', netAssetsAtDisposal: N(700) }], eliminations: [] };
    const { cur, prior } = pair(s);
    const f = 181 / 365;
    // last year it was a full member of the group
    expect(prior.nci).toBe(N(130));
    expect(prior.v.retained_earnings).toBe(N(764));
    // this year none of its assets, 181 days of its results, and the parent's gain reduced by
    // the group's share of its growth since acquisition, 80% x (700 - 400) = 240, less goodwill written off 54
    expect(cur.columns.map((c) => c.name)).toEqual(['Parent', 'Sub']);
    expect(cur.v.ppe).toBe(N(1000));
    expect(cur.nci).toBe(0);
    expect(cur.v.intangibles).toBe(0);
    expect(cur.subs[0]).toMatchObject({ present: false, disposedInPeriod: true, disposalAdjustment: N(186) });
    expect(cur.v.other_income).toBe(N(40) - N(186));
    expect(cur.v.revenue).toBe(N(900) + Math.round(N(600) * f));
    expect(cur.v.retained_earnings).toBe(N(800));
    expect(cur.difference).toBe(0);
    const e = groupEquity(cur, prior);
    expect(cell(e, 'At end of year', 'Non-controlling interests')).toBe(0);
    expect(e.rows.find((r) => r.style === 'check')?.values[5] ?? 0).toBe(0); // outside shareholders are fully accounted for
    const noFigure = consolidate(entity('Parent', parentTb), [entity('Sub', subTb)], { subsidiaries: [{ ...sub, disposed: '2025-07-01' }], eliminations: [] }, 'current');
    expect(noFigure.warnings.join(' ')).toMatch(/net assets on the day it was sold/);
  });

  // ---- associates and joint ventures
  const assoc: Associate = { id: 'a', name: 'Kano Feeds', kind: 'associate', ownership: 30, method: 'equity', cost: N(500), carryingStartPrior: N(520), share: N(80), dividends: N(30), sharePrior: N(60), dividendsPrior: N(20) };
  it('carries an associate by the equity method', () => {
    const s: GroupSetup = { subsidiaries: [], eliminations: [], associates: [assoc] };
    const prior = consolidate(entity('Parent', parentTb, 'prior'), [], s, 'prior');
    const cur = consolidate(entity('Parent', parentTb), [], s, 'current', '2025-12-31', prior);
    // carrying 520 + 60 - 20 = 560 last year, + 80 - 30 = 610 this year
    expect(prior.v.investments).toBe(N(560));
    expect(cur.v.investments).toBe(N(610));
    expect(cur.v.other_income).toBe(N(10)); // the 30 dividend comes out of income
    expect(cur.associateShare).toBe(N(80));
    expect(cur.profit).toBe(N(250));
    expect(cur.v.retained_earnings).toBe(N(910));
    expect(prior.v.retained_earnings).toBe(N(660));
    expect(cur.difference).toBe(0);
    expect(prior.difference).toBe(0);
    expect(cur.income.find((r) => r.label === 'Share of profit of associates and joint ventures')?.cur).toBe(N(80));
    expect(groupEquity(cur, prior).unexplained).toBe(0);
    const cf = groupCashFlow(cur, prior)!;
    expect(cf.difference).toBe(0);
    expect(cf.rows.find((r) => r.label === 'Dividends received from associates and joint ventures')?.cur).toBe(N(30));
    expect(cf.rows.find((r) => r.label === 'Change in other investments')).toBeUndefined(); // nothing else was bought
  });

  it('leaves an associate held at cost as the parent carries it', () => {
    const c = consolidate(entity('Parent', parentTb), [], { subsidiaries: [], eliminations: [], associates: [{ ...assoc, method: 'cost' }] }, 'current');
    expect(c.v.investments).toBe(N(500));
    expect(c.profit).toBe(N(200));
    expect(c.associates[0]).toMatchObject({ carrying: N(500), share: 0 });
    expect(c.difference).toBe(0);
  });

  // ---- a foreign subsidiary
  it('translates a foreign subsidiary and takes the exchange difference to reserves', () => {
    const s: GroupSetup = {
      subsidiaries: [{ ...sub, amortised: 0, charge: 0, chargePrior: 0, foreign: { currency: 'GHS', closing: 2, average: 1.8, closingPrior: 1.5, averagePrior: 1.4, reservePriorEnd: N(60), differencePrior: N(70) } }],
      eliminations: [],
    };
    const { cur, prior } = pair(s);
    // last year: net assets 650 at 1.5 = 975
    expect(prior.subs[0]).toMatchObject({ equity: N(975), nci: N(195), reserve: N(60), oci: N(70), nciOci: N(14) });
    expect(prior.v.retained_earnings).toBe(N(1000));
    expect(prior.difference).toBe(0);
    // this year: assets and liabilities at 2, income and expenses at 1.8
    expect(cur.v.ppe).toBe(N(1000 + 1200));
    expect(cur.v.revenue).toBe(N(900 + 1080));
    expect(cur.profit).toBe(N(470));
    // opening net assets 650 x 0.5, profit 150 x 0.2, less dividends 50 x 0.2 = 345
    expect(cur.oci).toBe(N(345));
    expect(cur.subs[0]).toMatchObject({ equity: N(1500), nci: N(300), reserve: N(336), nciOci: N(69) });
    expect(cur.v.other_reserves).toBe(N(336));
    expect(cur.v.retained_earnings).toBe(N(1344));
    expect(cur.totalEquity).toBe(N(2980));
    expect(cur.difference).toBe(0);
    expect(cur.income.find((r) => r.label === 'Total comprehensive income for the year')?.cur).toBe(N(815));
    const e = groupEquity(cur, prior);
    expect(cell(e, 'Exchange differences on translating foreign operations', 'Other reserves')).toBe(N(276));
    expect(cell(e, 'At end of year', 'Other reserves')).toBe(N(336));
    expect(e.rows.some((r) => r.label === 'Other movements in reserves')).toBe(false);
    // outside shareholders: 195 + 54 profit + 69 exchange - 18 dividends = 300
    expect(e.rows.find((r) => r.style === 'check')?.values[5] ?? 0).toBe(0);
    expect(groupCashFlow(cur, prior)).toBeNull();
    expect(cashFlowBlocker(cur)).toMatch(/foreign currency/);
    // both columns of the income statement line up, though "Owners of the parent" appears twice
    const merged = mergePeriods(cur.income, prior.income);
    expect(merged.filter((r) => r.label === 'Owners of the parent').map((r) => [r.cur, r.prior])).toEqual([
      [N(416), prior.ownersProfit],
      [N(416 + 276), prior.ownersProfit + N(56)],
    ]);
  });

  // ---- a subsidiary that is itself a parent
  it('consolidates a sub-group as one unit, carrying its outside shareholders up', () => {
    const tTb = tb([['cash', 100, 80], ['share_capital', -50, -50], ['retained_earnings', -30, -20], ['revenue', -40, -30], ['cost_of_sales', 20, 20]]);
    const inner: GroupSetup = { subsidiaries: [{ engagementId: 't', ownership: 60, cost: 0, netAssets: 0, amortised: 0, charge: 0, chargePrior: 0 }], eliminations: [] };
    const sGroup = consolidate(entity('Sub', subTb), [entity('T', tTb)], inner, 'current');
    expect(sGroup).toMatchObject({ nci: N(40), ownersEquity: N(810), ownersProfit: N(162), difference: 0 });
    const c = consolidate(unitOf('Parent', figures(parentTb, [], 'current')), [unitOfGroup('Sub group', sGroup)], setup, 'current');
    expect(c.subs[0]).toMatchObject({ equity: N(810), nci: N(162), carrying: N(126) });
    expect(c.nci).toBe(N(202));
    expect(c.v.retained_earnings).toBe(N(1074));
    expect(c.profit).toBe(N(352));
    expect(c.nciProfit).toBe(N(40.4));
    expect(c.totalAssets).toBe(N(2626));
    expect(c.difference).toBe(0);
  });
});
