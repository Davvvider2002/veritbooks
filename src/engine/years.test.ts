import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { mergeImport, mergeYears } from './merge';
import { buildStatements } from './statements';
import { analyticalReview } from './analytical';
import { financialSummary } from './disclosures';
import { latestYear, placementProblems, readYears, slotFor, yearFromFileName } from './years';
import type { TbLine } from './types';

const csv = (file: string) => Papa.parse<string[]>(readFileSync(`public/samples/${file}`, 'utf8'), { skipEmptyLines: true }).data;

describe('finding the year', () => {
  it('reads the year from the title above the header', () => {
    const [y] = readYears(csv('trial-balance-2025.csv'), 'tb.csv');
    expect(y).toMatchObject({ year: 2025, how: 'title' });
  });

  it('falls back on the file name', () => {
    const [y] = readYears(csv('trial-balance-2024.csv'), 'trial-balance-2024.csv');
    expect(y).toMatchObject({ year: 2024, how: 'file name' });
    expect(yearFromFileName('TB_FY2023_final.xlsx')).toBe(2023);
    expect(yearFromFileName('trial balance.csv')).toBeNull();
  });

  it('says so when nothing names a year', () => {
    const [y] = readYears(csv('trial-balance-2024.csv'), 'client tb.csv');
    expect(y.year).toBeNull();
    expect(y.how).toBeNull();
  });

  it('takes the end of a period that spans two years', () => {
    expect(latestYear(['Trial balance for the period 1 April 2024 to 31 March 2025'])).toBe(2025);
    expect(latestYear(['Balance', '2,025.00'])).toBeNull();
  });

  it('splits a file with a column for each year', () => {
    const sets = readYears(csv('trial-balance-3-years.csv'), 'comparative.csv');
    expect(sets.map((s) => [s.year, s.how])).toEqual([[2025, 'column'], [2024, 'column'], [2023, 'column']]);
    for (const s of sets) expect(s.lines.reduce((a, l) => a + l.balance, 0)).toBe(0);
    expect(sets[2].lines.find((l) => l.code === '1400')?.balance).toBe(68_000_000);
  });

  it('reads Debit and Credit columns under each year', () => {
    const rows = [
      ['Code', 'Account', 'Debit 2025', 'Credit 2025', 'Debit 2024', 'Credit 2024'],
      ['1400', 'Bank', '1,000.00', '', '800.00', ''],
      ['3000', 'Share capital', '', '1,000.00', '', '800.00'],
    ];
    const sets = readYears(rows, 'x.csv');
    expect(sets.map((s) => s.year)).toEqual([2025, 2024]);
    expect(sets[1].lines.find((l) => l.code === '3000')?.balance).toBe(-80000);
  });

  it('does not mistake an account row that mentions years for a header', () => {
    const rows = [
      ['Trial balance as at 31 December 2025'],
      ['Code', 'Account', 'Debit', 'Credit'],
      ['2010', 'Loan drawn 2023', '', '5,000.00'],
      ['1400', 'Bank', '5,000.00', ''],
    ];
    const sets = readYears(rows, 'tb.csv');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ year: 2025, how: 'title' });
  });
});

describe('placing the years', () => {
  it('lines each year up against the engagement year end', () => {
    expect(slotFor(2025, '2025-12-31')).toBe('current');
    expect(slotFor(2024, '2025-12-31')).toBe('prior');
    expect(slotFor(2023, '2025-12-31')).toBe('prior2');
    expect(slotFor(2021, '2025-12-31')).toBeNull();
    expect(slotFor(2025, '2025-03-31')).toBe('current');
  });

  it('refuses two files in one year', () => {
    expect(placementProblems(['current', 'current'])).toHaveLength(1);
    expect(placementProblems([null])).toEqual(['Choose which year each file is.']);
    expect(placementProblems(['current', 'prior', 'prior2'])).toEqual([]);
  });

  it('imports three years at once and keeps accounts that appear in only one', () => {
    const sets = readYears(csv('trial-balance-3-years.csv'), 'comparative.csv');
    const merged = mergeYears([], sets.map((s) => ({ slot: slotFor(s.year, '2025-12-31')!, lines: s.lines })), new Map(), []);
    const bank = merged.find((l) => l.code === '1400')!;
    expect([bank.balance, bank.prior, bank.prior2]).toEqual([986_000_000, 179_000_000, 68_000_000]);
    for (const k of ['balance', 'prior', 'prior2'] as const) expect(merged.reduce((a, l) => a + (l[k] ?? 0), 0)).toBe(0);
  });

  it('adds the year before later without disturbing the two already there', () => {
    const two: TbLine[] = mergeImport([], readYears(csv('trial-balance-2025.csv'), 'a')[0].lines, 'current', new Map(), []).map((l, i) => ({ ...l, id: String(i) }));
    const withPrior = mergeImport(two, readYears(csv('trial-balance-2024.csv'), 'b')[0].lines, 'prior', new Map(), []).map((l, i) => ({ ...l, id: String(i) }));
    const three = mergeImport(withPrior, readYears(csv('trial-balance-2023.csv'), 'c')[0].lines, 'prior2', new Map(), []);
    const bank = three.find((l) => l.code === '1400')!;
    expect([bank.balance, bank.prior, bank.prior2]).toEqual([986_000_000, 179_000_000, 68_000_000]);
    const again = mergeImport(three.map((l, i) => ({ ...l, id: String(i) })), readYears(csv('trial-balance-2025.csv'), 'a')[0].lines, 'current', new Map(), []);
    expect(again.find((l) => l.code === '1400')!.prior2).toBe(68_000_000);
  });
});

describe('using the third year', () => {
  const sets = readYears(csv('trial-balance-3-years.csv'), 'comparative.csv');
  const lines: TbLine[] = mergeYears([], sets.map((s) => ({ slot: slotFor(s.year, '2025-12-31')!, lines: s.lines })), new Map(), []).map((l, i) => ({ ...l, id: String(i) }));
  const st = buildStatements(lines, []);

  it('adds a trend year to the analytical review', () => {
    const r = analyticalReview(st, null)!;
    expect(r.movements.find((m) => m.code === 'revenue')?.earlier).toBe(18_860_000_000);
    expect(r.ratios.find((x) => x.id === 'gross_margin')?.earlier).not.toBeNull();
  });

  it('fills the financial summary from the imported year, ahead of figures typed in', () => {
    const s = financialSummary(st, '2025-12-31', [{ year: '2023', revenue: 1, pbt: 1, tax: 0, nca: 0, ca: 0, liabilities: 0, capital: 0, reserves: 0 }, { year: '2022', revenue: 5, pbt: 1, tax: 0, nca: 0, ca: 0, liabilities: 0, capital: 0, reserves: 0 }]);
    expect(s.years).toEqual(['2025', '2024', '2023', '2022']);
    expect(s.rows.find((r) => r.label === 'Revenue')?.values[2]).toBe(18_860_000_000);
  });
});
