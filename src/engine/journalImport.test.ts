import { describe, expect, it } from 'vitest';
import { parseJournals } from './journalImport';
import { openingComparison } from './opening';
import type { TbLine } from './types';

const tb: TbLine[] = [
  { id: 'a', code: '1000', name: 'Cash at bank', balance: 500_00, prior: 400_00, mapCode: 'cash', nature: null },
  { id: 'b', code: '4000', name: 'Sales', balance: -900_00, prior: -800_00, mapCode: 'revenue', nature: null },
  { id: 'c', code: '6100', name: 'Rent', balance: 400_00, prior: 400_00, mapCode: 'admin_expenses', nature: null },
];

describe('journal import', () => {
  it('groups lines by reference and matches accounts by code or name', () => {
    const r = parseJournals(
      [
        ['Journal listing'],
        ['Ref', 'Date', 'Narration', 'Account', 'Debit', 'Credit', 'Treatment'],
        ['AJ1', '2025-12-31', 'Accrue rent', '6100', '1,000.00', '', 'Posted'],
        ['', '', '', 'Cash at bank', '', '1,000.00', ''],
        ['AJ2', '2025-12-31', 'Cut-off', '4000', '250', '', 'Proposed'],
        ['AJ2', '', '', '1000', '', '250', ''],
        [],
      ],
      tb,
    );
    expect(r.errors).toEqual([]);
    expect(r.journals).toHaveLength(2);
    expect(r.journals[0]).toMatchObject({ ref: 'AJ1', description: 'Accrue rent', posted: true, lines: [{ lineId: 'c', amount: 100000 }, { lineId: 'a', amount: -100000 }] });
    expect(r.journals[1].posted).toBe(false);
  });
  it('accepts a single signed amount column', () => {
    const r = parseJournals([['Journal no', 'Account code', 'Amount'], ['J1', '6100', '50'], ['J1', '1000', '-50']], tb);
    expect(r.journals[0].lines.map((l) => l.amount)).toEqual([5000, -5000]);
  });
  it('refuses journals that do not balance, unknown accounts and missing headings', () => {
    const r = parseJournals([['Ref', 'Account', 'Debit', 'Credit'], ['X1', '6100', '10', ''], ['X1', '1000', '', '9'], ['X2', '9999', '5', ''], ['X2', '1000', '', '5']], tb);
    expect(r.journals).toHaveLength(0);
    expect(r.errors.join(' ')).toMatch(/X1: does not balance/);
    expect(r.errors.join(' ')).toMatch(/"9999" is not in the trial balance/);
    expect(parseJournals([['a', 'b'], ['1', '2']], tb).errors[0]).toMatch(/No heading row/);
  });
});

describe('opening balances', () => {
  it('compares this year’s opening figures with last year’s final figures, after posted journals', () => {
    const last: TbLine[] = [
      { id: 'x', code: '1000', name: 'Cash', balance: 350_00, prior: null, mapCode: 'cash', nature: null },
      { id: 'y', code: '4000', name: 'Sales', balance: -800_00, prior: null, mapCode: 'revenue', nature: null },
      { id: 'z', code: '6100', name: 'Rent', balance: 450_00, prior: null, mapCode: 'admin_expenses', nature: null },
    ];
    const adj = [{ id: 'j', ref: 'AJ1', description: '', posted: true, lines: [{ lineId: 'x', amount: 50_00 }, { lineId: 'z', amount: -50_00 }] }];
    const r = openingComparison(tb, last, adj);
    expect(r.differences).toBe(0);
    const unposted = openingComparison(tb, last, [{ ...adj[0], posted: false }]);
    expect(unposted.differences).toBe(2);
    expect(unposted.rows.find((x) => x.code === 'cash')).toMatchObject({ lastAudited: 35000, opening: 40000, difference: 5000 });
  });
});
