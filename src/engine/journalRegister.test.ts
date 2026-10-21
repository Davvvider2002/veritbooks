import { describe, expect, it } from 'vitest';
import { compareRefs, journalRegister, sourceOf } from './journalRegister';
import type { Adjustment, TbLine } from './types';

const tb: TbLine[] = [
  { id: 'b', code: '1100', name: 'Bank', balance: 0, prior: null, mapCode: null, nature: null },
  { id: 'c', code: '6100', name: 'Bank charges', balance: 0, prior: null, mapCode: null, nature: null },
  { id: 't', code: '2300', name: 'Tax payable', balance: 0, prior: null, mapCode: null, nature: null },
];
const adj = (ref: string, description: string, amount: number, posted = true): Adjustment => ({
  id: ref,
  ref,
  description,
  posted,
  lines: [
    { lineId: 'c', amount },
    { lineId: 'b', amount: -amount },
  ],
});

describe('journal register', () => {
  it('tells the source from the reference or the description', () => {
    expect(sourceOf({ ref: 'BR3', description: '' })).toBe('bank');
    expect(sourceOf({ ref: 'X9', description: 'Bank reconciliation: SMS charge (2025-03-01)' })).toBe('bank');
    expect(sourceOf({ ref: 'TAX1', description: '' })).toBe('tax');
    expect(sourceOf({ ref: 'J4', description: 'Accrual' })).toBe('audit');
  });

  it('orders references by number, not by text', () => {
    expect(['J10', 'J2', 'J1'].sort(compareRefs)).toEqual(['J1', 'J2', 'J10']);
  });

  it('lists every journal, series by series, with totals by source', () => {
    const r = journalRegister([adj('BR2', 'Bank reconciliation: interest', 500), adj('TAX1', 'Tax', 900), adj('J2', 'Accrual', 300), adj('BR1', 'Bank reconciliation: charges', 200), adj('J1', 'Cut-off', 100, false)], tb);
    expect(r.entries.map((e) => e.ref)).toEqual(['J1', 'J2', 'BR1', 'BR2', 'TAX1']);
    expect(r.entries[2].lines[0]).toMatchObject({ code: '6100', name: 'Bank charges', debit: 200, credit: 0 });
    expect(r.bySource).toEqual([
      { source: 'audit', count: 2, posted: 300, unadjusted: 100 },
      { source: 'bank', count: 2, posted: 700, unadjusted: 0 },
      { source: 'tax', count: 1, posted: 900, unadjusted: 0 },
    ]);
    expect(r.posted).toBe(1900);
    expect(r.unadjusted).toBe(100);
  });
});
