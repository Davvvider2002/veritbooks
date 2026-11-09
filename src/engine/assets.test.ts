import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { intangiblesSchedule, ppeSchedule, disclosureGaps } from './disclosures';
import { buildStatements } from './statements';
import { suggestMapping } from './mapping';
import { parseTrialBalance } from './parse';
import { presentLines, programmeFor } from '../content/packs';
import type { TbLine } from './types';

const N = (naira: number) => Math.round(naira * 100);
const rows = (f: string) => Papa.parse<string[]>(readFileSync(`public/samples/${f}`, 'utf8'), { skipEmptyLines: true }).data;

/** The sample trial balance, with software and investment accounts added and the bank reduced to keep it in balance. */
function tb(): TbLine[] {
  const prior = new Map(parseTrialBalance(rows('trial-balance-2024.csv')).lines.map((l) => [l.code, l.balance]));
  const base: TbLine[] = parseTrialBalance(rows('trial-balance-2025.csv')).lines.map((l) => ({
    id: l.code, code: l.code, name: l.name, balance: l.balance, prior: prior.get(l.code) ?? 0, ...suggestMapping(l.name),
  }));
  const add = (code: string, name: string, balance: number, prior: number): TbLine => ({ id: code, code, name, balance: N(balance), prior: N(prior), ...suggestMapping(name) });
  const extra = [
    add('1500', 'Computer software at cost', 2_000_000, 1_500_000),
    add('1510', 'Accumulated amortisation - software', -700_000, -400_000),
    add('6900', 'Amortisation of software', 300_000, 0),
    add('1600', 'Investment in quoted shares', 3_000_000, 3_000_000),
  ];
  // Keep both years in balance through retained earnings.
  const shift = extra.reduce((a, l) => a + l.balance, 0);
  const shiftPrior = extra.reduce((a, l) => a + (l.prior ?? 0), 0);
  const re = base.find((l) => l.mapCode === 'retained_earnings')!;
  re.balance -= shift - N(300_000);
  re.prior = (re.prior ?? 0) - shiftPrior;
  const bank = base.find((l) => l.mapCode === 'cash')!;
  bank.balance -= N(300_000);
  return [...base, ...extra];
}

describe('assets other than property, plant and equipment', () => {
  it('maps accumulated amortisation to intangible assets, and the amortisation charge to expenses', () => {
    expect(suggestMapping('Accumulated amortisation - software').mapCode).toBe('intangibles');
    expect(suggestMapping('Accumulated amortization').mapCode).toBe('intangibles');
    expect(suggestMapping('Accumulated depreciation - motor vehicles').mapCode).toBe('ppe');
    expect(suggestMapping('Amortisation of software')).toMatchObject({ mapCode: 'admin_expenses', nature: 'depreciation' });
    expect(suggestMapping('Patents and trademarks').mapCode).toBe('intangibles');
  });

  it('gives intangible assets their own movement schedule, checked with PPE against the charge', () => {
    const lines = tb();
    const st = buildStatements(lines, []);
    const s = intangiblesSchedule(lines, [], st.cur)!;
    expect(s.cost).toEqual([expect.objectContaining({ name: 'Computer software at cost', opening: N(1_500_000), increase: N(500_000), closing: N(2_000_000) })]);
    expect(s.totalDepreciation).toMatchObject({ name: 'Total accumulated amortisation', opening: N(400_000), increase: N(300_000), closing: N(700_000) });
    expect(s.carryingClosing).toBe(st.cur.v.intangibles);
    // Depreciation and amortisation share one tag, so the two schedules together explain it.
    expect(s.chargeDifference).toBe(0);
    expect(ppeSchedule(lines, [], st.cur)!.chargeDifference).toBe(0);
    expect(disclosureGaps({}, st, lines, [], '2025-12-31').some((g) => /schedule/.test(g))).toBe(false);
  });

  it('flags the pair of schedules when the charge is not explained', () => {
    const lines = tb().map((l) => (l.code === '6900' ? { ...l, nature: null } : l));
    const st = buildStatements(lines, []);
    expect(intangiblesSchedule(lines, [], st.cur)!.chargeDifference).toBe(N(300_000));
    expect(disclosureGaps({}, st, lines, [], '2025-12-31')).toContain(
      'The fixed asset and intangible asset schedules do not agree to the depreciation and amortisation charge. Check disposals and the depreciation tags in the mapping.',
    );
  });

  it('builds the audit programme from the balances on the trial balance', () => {
    const lines = tb();
    const areas = (ls: TbLine[]) => new Set(programmeFor('audit', {}, 'NG', presentLines(ls)).map((i) => i.area));
    const full = areas(lines);
    for (const a of ['Property, plant and equipment', 'Intangible assets', 'Investments']) expect(full.has(a)).toBe(true);
    // Without software and investments, their steps fall away.
    const plain = areas(lines.filter((l) => !['1500', '1510', '1600'].includes(l.code)));
    expect(plain.has('Intangible assets')).toBe(false);
    expect(plain.has('Investments')).toBe(false);
    expect(plain.has('Property, plant and equipment')).toBe(true);
    // Steps every engagement needs stay.
    expect(plain.has('Completion')).toBe(true);
    // Before a trial balance, only the general steps show; without balances given, every step shows.
    expect(areas([]).has('Property, plant and equipment')).toBe(false);
    expect(programmeFor('audit', {}, 'NG').some((i) => i.area === 'Intangible assets')).toBe(true);
  });

  it('does the same for Canadian engagements', () => {
    const items = programmeFor('audit', {}, 'CA', presentLines(tb())).map((i) => i.area);
    expect(items).toContain('Intangible assets and goodwill');
    expect(items).toContain('Investments');
  });
});
