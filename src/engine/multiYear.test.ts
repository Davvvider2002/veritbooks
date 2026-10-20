import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { mergeYears } from './merge';
import { multiYear } from './multiYear';
import { buildStatements } from './statements';
import type { TbLine } from './types';
import { readYears, slotFor } from './years';
import { yearsHeld } from './yearsOf';

const sets = readYears(Papa.parse<string[]>(readFileSync('public/samples/trial-balance-5-years.csv', 'utf8'), { skipEmptyLines: true }).data, 'trial-balance-5-years.csv');
const lines: TbLine[] = mergeYears(
  [],
  sets.map((s) => ({ slot: slotFor(s.year, '2025-12-31')!, lines: s.lines })),
  new Map(),
  [],
).map((l, i) => ({ ...l, id: `l${i}` }));

describe('five years of trial balances', () => {
  it('reads all five years from one file and places each one', () => {
    expect(sets.map((s) => s.year)).toEqual([2025, 2024, 2023, 2022, 2021]);
    expect(yearsHeld(lines)).toBe(5);
    expect(lines.find((l) => l.code === '2300')).toMatchObject({ balance: -20_000_000_00, prior: -25_000_000_00, prior2: -36_000_000_00, prior3: -43_200_000_00, prior4: -51_840_000_00 });
  });

  it('gives the cash flow statement its comparative year, both reconciling', () => {
    const st = buildStatements(lines, []);
    expect(st.cashFlowDifference).toBe(0);
    const end = st.cashFlow!.find((r) => r.label === 'Cash and cash equivalents at end of year')!;
    expect(end.cur).toBe(st.cur.v.cash);
    expect(end.prior).toBe(st.prior!.v.cash);
    const start = st.cashFlow!.find((r) => r.label === 'Cash and cash equivalents at start of year')!;
    expect(start.prior).toBe(st.earlier!.v.cash);
    expect(st.cashFlow!.some((r) => r.style === 'check')).toBe(false);
  });

  it('presents three years of cash flows and position and results for every year', () => {
    const m = multiYear(lines, [], '2025-12-31');
    expect(m.years).toEqual([2025, 2024, 2023, 2022, 2021]);
    expect(m.cashFlowYears).toEqual([2025, 2024, 2023, 2022]);
    const end = m.cashFlow.find((r) => r.label === 'Cash and cash equivalents at end of year')!;
    const start = m.cashFlow.find((r) => r.label === 'Cash and cash equivalents at start of year')!;
    // Each year opens where the year before it closed.
    expect(start.values.slice(0, 3)).toEqual(end.values.slice(1, 4));
    const total = m.position.find((r) => r.label === 'Total assets')!;
    expect(total.values).toHaveLength(5);
    expect(m.income.find((r) => r.label === 'Revenue')!.values).toEqual([248_600_000_00, 212_300_000_00, 188_600_000_00, 169_740_000_00, 152_766_000_00]);
    expect(multiYear(lines, [], '2025-12-31', 3).years).toEqual([2025, 2024, 2023]);
  });
});
