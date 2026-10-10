import { describe, expect, it } from 'vitest';
import { consolidate, type GroupSetup } from './consolidation';
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
    expect(c.goodwill[0]).toMatchObject({ shareOfNetAssets: N(320), atAcquisition: N(180), carrying: N(126), nci: N(150), nciProfit: N(30) });
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
    expect(c.goodwill[0]).toMatchObject({ atAcquisition: -N(60), carrying: 0, bargainGain: N(60), nci: 0 });
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
});
