import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { disclosureGaps, rightOfUseSchedule } from './disclosures';
import { buildStatements } from './statements';
import { suggestMapping } from './mapping';
import { parseTrialBalance } from './parse';
import { leadOf } from './etb';
import { presentLines, programmeFor } from '../content/packs';
import type { TbLine } from './types';

const N = (naira: number) => Math.round(naira * 100);
const rows = (f: string) => Papa.parse<string[]>(readFileSync(`public/samples/${f}`, 'utf8'), { skipEmptyLines: true }).data;

function base(): TbLine[] {
  const prior = new Map(parseTrialBalance(rows('trial-balance-2024.csv')).lines.map((l) => [l.code, l.balance]));
  return parseTrialBalance(rows('trial-balance-2025.csv')).lines.map((l) => ({ id: l.code, code: l.code, name: l.name, balance: l.balance, prior: prior.get(l.code) ?? 0, ...suggestMapping(l.name) }));
}

/**
 * The sample with a lease, investment property and livestock. In 2025 a new lease of 1,000,000 is
 * signed, 600,000 of lease principal is paid, 400,000 of depreciation is charged on the leased
 * building, 1,000,000 of investment property and 200,000 of livestock are bought for cash.
 */
function withAssets(): TbLine[] {
  const add = (code: string, name: string, balance: number, prior: number): TbLine => ({ id: code, code, name, balance: N(balance), prior: N(prior), ...suggestMapping(name) });
  const lines = base();
  const extra = [
    add('1700', 'Right-of-use asset - office building', 3_000_000, 2_000_000),
    add('1710', 'Accumulated depreciation - right-of-use assets', -900_000, -500_000),
    add('6950', 'Depreciation of right-of-use assets', 400_000, 0),
    add('2700', 'Lease liabilities', -1_800_000, -1_500_000),
    add('2710', 'Lease liabilities - current portion', -500_000, -400_000),
    add('1800', 'Investment property', 5_000_000, 4_000_000),
    add('1900', 'Livestock - cattle', 800_000, 600_000),
    add('3900', 'Share capital - additional', -4_200_000, -4_200_000),
  ];
  lines.find((l) => l.mapCode === 'cash')!.balance -= N(1_800_000);
  return [...lines, ...extra];
}

describe('investment property, right-of-use assets and biological assets', () => {
  it('maps each to its own line, and leaves income and charges on them in profit or loss', () => {
    expect(suggestMapping('Right-of-use asset - office building').mapCode).toBe('right_of_use');
    expect(suggestMapping('Accumulated depreciation - right-of-use assets').mapCode).toBe('right_of_use');
    expect(suggestMapping('Depreciation of right-of-use assets')).toMatchObject({ mapCode: 'admin_expenses', nature: 'depreciation' });
    expect(suggestMapping('Interest on lease liabilities').mapCode).toBe('finance_costs');
    expect(suggestMapping('Lease liabilities').mapCode).toBe('lease_liabilities_nc');
    expect(suggestMapping('Current portion of lease liabilities').mapCode).toBe('lease_liabilities_c');
    expect(suggestMapping('Investment property').mapCode).toBe('investment_property');
    expect(suggestMapping('Fair value gain on investment property').mapCode).toBe('other_income');
    expect(suggestMapping('Livestock - cattle').mapCode).toBe('biological_assets');
    expect(suggestMapping('Sale of livestock').mapCode).not.toBe('inventories');
    expect(leadOf('right_of_use').ref).toBe('W');
    expect(leadOf('investment_property').ref).toBe('Q');
  });

  it('shows each on its own line in the statement of financial position', () => {
    const st = buildStatements(withAssets(), []);
    expect(st.cur.v.right_of_use).toBe(N(2_100_000));
    expect(st.cur.v.investment_property).toBe(N(5_000_000));
    expect(st.cur.v.biological_assets).toBe(N(800_000));
    expect(st.cur.v.lease_liabilities_nc + st.cur.v.lease_liabilities_c).toBe(N(2_300_000));
  });

  it('keeps the new lease out of cash, and shows the lease principal paid under financing', () => {
    const plain = buildStatements(base(), []);
    const st = buildStatements(withAssets(), []);
    expect(st.cashFlowDifference).toBe(plain.cashFlowDifference);
    const row = (label: string) => st.cashFlow!.find((r) => r.label === label);
    expect(row('Principal elements of lease payments')?.cur).toBe(-N(600_000));
    expect(row('Purchase of investment property, net of disposals')?.cur).toBe(-N(1_000_000));
    expect(row('Purchase of biological assets, net of disposals')?.cur).toBe(-N(200_000));
    // The lease depreciation is not counted as a purchase of property, plant and equipment.
    expect(row('Purchase of property, plant, equipment and intangibles, net of disposals')?.cur).toBe(
      plain.cashFlow!.find((r) => r.label === 'Purchase of property, plant, equipment and intangibles, net of disposals')?.cur,
    );
    // Every figure adds up from its parts.
    for (const r of [row('Principal elements of lease payments')!, row('Purchase of property, plant, equipment and intangibles, net of disposals')!])
      expect(r.parts!.reduce((a, x) => a + x.cur, 0)).toBe(r.cur);
  });

  it('gives right-of-use assets a movement schedule checked with the depreciation charge', () => {
    const lines = withAssets();
    const st = buildStatements(lines, []);
    const s = rightOfUseSchedule(lines, [], st.cur)!;
    expect(s.cost[0]).toMatchObject({ opening: N(2_000_000), increase: N(1_000_000), closing: N(3_000_000) });
    expect(s.totalDepreciation).toMatchObject({ increase: N(400_000), closing: N(900_000) });
    expect(s.chargeDifference).toBe(0);
    expect(disclosureGaps({}, st, lines, [], '2025-12-31').some((g) => /schedule/.test(g))).toBe(false);
  });

  it('adds work programme steps for each class held', () => {
    const areas = new Set(programmeFor('audit', {}, 'NG', presentLines(withAssets())).map((i) => i.area));
    for (const a of ['Right-of-use assets and lease liabilities', 'Investment property', 'Biological assets']) expect(areas.has(a)).toBe(true);
    const none = new Set(programmeFor('audit', {}, 'NG', presentLines(base())).map((i) => i.area));
    expect(none.has('Investment property')).toBe(false);
  });
});
