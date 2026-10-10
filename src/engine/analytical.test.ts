import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { analyticalReview, unexplainedMovements } from './analytical';
import { signOffChecks } from './checks';
import { suggestMapping } from './mapping';
import { parseTrialBalance } from './parse';
import { buildStatements } from './statements';
import type { TbLine } from './types';

const N = (naira: number) => naira * 100;
let n = 0;
const tb = (rows: [string, number, number | null][]): TbLine[] =>
  rows.map(([mapCode, balance, prior]) => ({ id: `l${++n}`, code: `c${n}`, name: mapCode, balance: N(balance), prior: prior === null ? null : N(prior), mapCode, nature: null }));
// revenue 1,000 (800), cost of sales 600 (500), receivables 200 (100), inventory 120 (100), payables 90 (100), cash 170 (150)
const lines = tb([
  ['revenue', -1000, -800], ['cost_of_sales', 600, 500], ['admin_expenses', 104, 100], ['trade_receivables', 200, 100], ['inventories', 120, 100],
  ['cash', 170, 150], ['trade_payables', -90, -100], ['share_capital', -50, -50], ['retained_earnings', -54, 0],
]);

describe('analytical review', () => {
  it('needs a prior year', () => {
    expect(analyticalReview(buildStatements(tb([['cash', 10, null], ['share_capital', -10, null]]), []), null)).toBeNull();
  });

  it('measures each line against last year and marks the ones that need explaining', () => {
    const r = analyticalReview(buildStatements(lines, []), N(30))!;
    expect(r).toMatchObject({ threshold: N(30), basis: 'performance materiality' });
    const m = (code: string) => r.movements.find((x) => x.code === code)!;
    expect(m('revenue')).toMatchObject({ cur: N(1000), prior: N(800), change: N(200), percent: 25, significant: true });
    expect(m('trade_receivables')).toMatchObject({ change: N(100), percent: 100, significant: true });
    // up 20%, but only 20 in amount: below the threshold
    expect(m('inventories')).toMatchObject({ change: N(20), percent: 20, significant: false });
    // 4 on 100: neither large nor a big percentage
    expect(m('admin_expenses').significant).toBe(false);
    expect(m('trade_payables')).toMatchObject({ change: -N(10), percent: -10, significant: false });
    expect(r.movements.some((x) => x.code === 'ppe')).toBe(false);
  });

  it('falls back to 1% of revenue when materiality is not set', () => {
    const r = analyticalReview(buildStatements(lines, []), null)!;
    expect(r).toMatchObject({ threshold: N(10), basis: '1% of revenue' });
    expect(r.movements.find((x) => x.code === 'inventories')!.significant).toBe(true);
  });

  it('treats a line that appears from nothing as significant when it is large', () => {
    const withLoan = [...lines, ...tb([['borrowings_nc', -80, 0], ['investments', 80, 0]])];
    const r = analyticalReview(buildStatements(withLoan, []), N(30))!;
    expect(r.movements.find((x) => x.code === 'borrowings_nc')).toMatchObject({ percent: null, significant: true });
  });

  it('works out the ratios for both years', () => {
    const r = analyticalReview(buildStatements(lines, []), N(30))!;
    const ratio = (id: string) => r.ratios.find((x) => x.id === id)!;
    expect(ratio('gross_margin')).toMatchObject({ cur: 40, prior: 37.5 });
    expect(ratio('receivable_days')).toMatchObject({ cur: 73, prior: 46 }); // 200/1000 and 100/800 of 365
    expect(ratio('inventory_days')).toMatchObject({ cur: 73, prior: 73 });
    expect(ratio('payable_days')).toMatchObject({ cur: 55, prior: 73 });
    expect(ratio('current_ratio')).toMatchObject({ cur: 5.44, prior: 3.5 });
    expect(ratio('effective_tax')).toMatchObject({ cur: 0, prior: 0 }); // no tax charge in the test figures
  });

  it('lists significant movements with no explanation, and gates sign-off on them', () => {
    const r = analyticalReview(buildStatements(lines, []), N(30))!;
    expect(unexplainedMovements(r, undefined).map((m) => m.code)).toEqual(['trade_receivables', 'revenue', 'cost_of_sales']);
    expect(unexplainedMovements(r, { revenue: { note: 'Two new distributors.' }, cost_of_sales: { note: '  ' } }).map((m) => m.code)).toEqual(['trade_receivables', 'cost_of_sales']);
    const gate = (type: 'audit' | 'review', unexplained: string[]) =>
      signOffChecks({ type, lines, adjustments: [], planning: {}, programme: {}, programmeItemIds: [], report: {}, firmFrc: 'F', signerRole: 'partner', signerFrc: 'F', movements: { unexplained } }).find((c) => c.id === 'movements')!;
    expect(gate('audit', ['Revenue'])).toMatchObject({ ok: false, blocking: false });
    expect(gate('review', ['Revenue'])).toMatchObject({ ok: false, blocking: true });
    expect(gate('review', []).ok).toBe(true);
  });

  it('runs on the sample company', () => {
    const rows = (f: string) => Papa.parse<string[]>(readFileSync(`public/samples/${f}`, 'utf8'), { skipEmptyLines: true }).data;
    const prior = new Map(parseTrialBalance(rows('trial-balance-2024.csv')).lines.map((l) => [l.code, l.balance]));
    const sample: TbLine[] = parseTrialBalance(rows('trial-balance-2025.csv')).lines.map((l) => ({ id: l.code, code: l.code, name: l.name, balance: l.balance, prior: prior.get(l.code) ?? 0, ...suggestMapping(l.name) }));
    const r = analyticalReview(buildStatements(sample, []), null)!;
    expect(r.movements.length).toBeGreaterThan(10);
    expect(r.ratios.find((x) => x.id === 'gross_margin')!.cur).toBeGreaterThan(0);
  });
});
