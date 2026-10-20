import { describe, expect, it } from 'vitest';
import { CHART } from './chart';
import { LEADS, changePct, extendedTrialBalance, leadSchedules } from './etb';
import { buildStatements } from './statements';
import type { Adjustment, TbLine } from './types';

const tb: TbLine[] = [
  { id: 'a', code: '1400', name: 'Bank', balance: 500_00, prior: 400_00, mapCode: 'cash', nature: null },
  { id: 'b', code: '1300', name: 'Trade debtors', balance: 300_00, prior: 200_00, mapCode: 'trade_receivables', nature: null },
  { id: 'c', code: '4000', name: 'Sales', balance: -900_00, prior: -700_00, mapCode: 'revenue', nature: null },
  { id: 'd', code: '6200', name: 'Rent', balance: 100_00, prior: 100_00, mapCode: 'admin_expenses', nature: 'other' },
  { id: 'e', code: '9999', name: 'Suspense', balance: 0, prior: 0, mapCode: null, nature: null },
];
const adj: Adjustment[] = [
  { id: 'j1', ref: 'AJ1', description: 'Cut-off', posted: true, lines: [{ lineId: 'c', amount: 50_00 }, { lineId: 'b', amount: -50_00 }] },
  { id: 'j2', ref: 'AJ2', description: 'Not corrected', posted: false, lines: [{ lineId: 'd', amount: 10_00 }, { lineId: 'a', amount: -10_00 }] },
];

describe('extended trial balance', () => {
  const etb = extendedTrialBalance(tb, adj);
  it('runs each account from the draft to the final balance, by account code', () => {
    expect(etb.rows.map((r) => r.code)).toEqual(['1300', '1400', '4000', '6200', '9999']);
    expect(etb.rows.find((r) => r.code === '1300')).toMatchObject({ prior: 200_00, draft: 300_00, dr: 0, cr: 50_00, final: 250_00, movement: 50_00, refs: ['AJ1'], lead: 'E' });
    expect(etb.rows.find((r) => r.code === '4000')).toMatchObject({ dr: 50_00, final: -850_00, lead: 'R' });
    expect(etb.rows.find((r) => r.code === '9999')).toMatchObject({ lead: 'Z', line: 'Not mapped' });
  });
  it('leaves unposted journals out of the final column and totals every column', () => {
    expect(etb.unposted).toEqual(['AJ2']);
    expect(etb.rows.find((r) => r.code === '6200')!.final).toBe(100_00);
    expect(etb.totals).toEqual({ prior: 0, draft: 0, dr: 50_00, cr: 50_00, final: 0 });
    expect(etb.balanced).toBe(true);
  });
  it('gives every statement line one lead schedule', () => {
    const covered = LEADS.flatMap((l) => l.codes);
    expect(new Set(covered).size).toBe(covered.length);
    expect(CHART.map((c) => c.code).filter((c) => !covered.includes(c))).toEqual([]);
  });
  it('builds lead schedules that agree to the statements', () => {
    const leads = leadSchedules(etb, buildStatements(tb, adj));
    expect(leads.map((l) => l.ref)).toEqual(['E', 'G', 'R', 'U', 'Z']);
    const e = leads[0];
    expect(e.lines[0]).toMatchObject({ label: 'Trade receivables', final: 250_00, fsFinal: 250_00, prior: 200_00, fsPrior: 200_00 });
    const r = leads.find((l) => l.ref === 'R')!;
    expect(r.lines[0]).toMatchObject({ final: -850_00, fsFinal: -850_00 });
    expect(changePct(250_00, 200_00)).toBe(25);
    expect(changePct(1, 0)).toBeNull();
  });
});
