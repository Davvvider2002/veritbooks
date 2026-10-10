import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { parseLedger } from './ledger';
import { suggestMapping } from './mapping';
import { parseTrialBalance } from './parse';
import { priorEquity } from './disclosures';
import { buildStatements, type Part, type Period } from './statements';
import { traceItem } from './trace';
import type { Adjustment, TbLine } from './types';

const rows = (f: string) => Papa.parse<string[]>(readFileSync(`public/samples/${f}`, 'utf8'), { skipEmptyLines: true }).data;
const prior = new Map(parseTrialBalance(rows('trial-balance-2024.csv')).lines.map((l) => [l.code, l.balance]));
const lines: TbLine[] = parseTrialBalance(rows('trial-balance-2025.csv')).lines.map((l) => ({
  id: l.code, code: l.code, name: l.name, balance: l.balance, prior: prior.get(l.code) ?? 0, ...suggestMapping(l.name),
}));
const ledger = parseLedger(rows('general-ledger-2025.csv')).entries;
const journal: Adjustment = {
  id: 'a1', ref: 'AJ1', description: 'Bank items not booked', posted: true,
  lines: [{ lineId: '1400', amount: 23500000 }, { lineId: '6230', amount: 1500000 }, { lineId: '1300', amount: -25000000 }],
};
const proposed: Adjustment = { ...journal, id: 'a2', ref: 'AJ2', posted: false };

describe('tracing a figure to its source', () => {
  it('every line on the face of both statements equals its trace, in both years', () => {
    const st = buildStatements(lines, [journal, proposed]);
    let checked = 0;
    for (const r of [...st.position, ...st.income]) {
      if (!r.code) continue;
      for (const period of ['current', 'prior'] as const) {
        const t = traceItem(r.code, period, lines, [journal, proposed], ledger)!;
        const shown = period === 'current' ? r.cur : r.prior;
        expect(r.negated ? -t.total : t.total, `${r.label} ${period}`).toBe(shown);
        expect(t.total).toBe(t.subtotal + t.derived.reduce((s, d) => s + d.amount, 0));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('shows posted journals against the account and leaves proposed ones out', () => {
    const t = traceItem('cash', 'current', lines, [journal, proposed], ledger)!;
    const bank = t.accounts.find((a) => a.line.code === '1400')!;
    expect(bank.journals).toEqual([{ id: 'a1', ref: 'AJ1', description: 'Bank items not booked', amount: 23500000 }]);
    expect(bank.reported).toBe(bank.tb + 23500000);
    expect(bank.entries.length).toBeGreaterThan(100);
    expect(bank.entries.every((e) => e.accountCode === '1400')).toBe(true);
    expect([...bank.entries].sort((a, b) => a.date.localeCompare(b.date)).map((e) => e.date)).toEqual(bank.entries.map((e) => e.date));
  });

  it('shows a credit journal on a liability or income line in the sign the statement uses', () => {
    const rev = lines.find((l) => l.mapCode === 'revenue')!;
    const j: Adjustment = { id: 'x', ref: 'AJ9', description: 'Cut-off', posted: true, lines: [{ lineId: rev.id, amount: -500000 }] };
    const t = traceItem('revenue', 'current', lines, [j])!;
    expect(t.accounts.find((a) => a.line.id === rev.id)!.journals[0].amount).toBe(500000);
    expect(t.total).toBe(buildStatements(lines, [j]).cur.v.revenue);
  });

  it('explains retained earnings as the brought forward accounts, profit and dividends', () => {
    const st = buildStatements(lines, []);
    const t = traceItem('retained_earnings', 'current', lines, [])!;
    expect(t.subtotal).toBe(st.cur.v.retained_earnings);
    expect(t.derived[0].amount).toBe(st.cur.profit);
    expect(t.total).toBe(st.cur.closingRetained);
  });

  it('has no journals for the prior year, shows that year’s ledger when given one, and nothing for an unknown line', () => {
    const t = traceItem('cash', 'prior', lines, [journal], [])!;
    expect(t.accounts.every((a) => a.entries.length === 0 && a.journals.length === 0)).toBe(true);
    const lastYear = ledger.slice(0, 50).map((e) => ({ ...e, date: e.date.replace('2025', '2024') }));
    const withLedger = traceItem('cash', 'prior', lines, [journal], lastYear)!;
    expect(withLedger.accounts.flatMap((a) => a.entries).length).toBe(lastYear.filter((e) => e.accountCode === '1400' || lines.find((l) => l.code === e.accountCode)?.mapCode === 'cash').length);
    expect(withLedger.total).toBe(t.total);
    expect(traceItem('nonsense', 'current', lines, [])).toBeNull();
  });

  // Every figure that can be opened must equal what it opens to, all the way down to the accounts.
  const all = [journal, proposed];
  let leaves = 0;
  function check(what: string, amount: number, src: { code?: string; period?: Period; parts?: Part[]; nature?: Part['nature']; lineId?: string; accountsOnly?: boolean }, col: Period) {
    if (src.code) {
      const t = traceItem(src.code, src.period ?? col, lines, all, [], src)!;
      expect(Math.abs(t.total), what).toBe(Math.abs(amount));
      leaves++;
      return;
    }
    if (!src.parts) return;
    const amt = (x: Part) => (col === 'current' ? x.cur : (x.prior ?? 0));
    expect(src.parts.reduce((a, x) => a + amt(x), 0), what).toBe(amount);
    for (const x of src.parts) check(`${what} > ${x.label}`, amt(x), x, col);
  }

  it('subtotals, the cash flow statement and the value added statement open to figures that add up to them', () => {
    const st = buildStatements(lines, all);
    for (const [name, rows] of Object.entries({ position: st.position, income: st.income, cashFlow: st.cashFlow!, valueAdded: st.valueAdded })) {
      for (const r of rows) {
        if (r.style === 'heading' || r.style === 'check') continue;
        expect(r.code || r.parts, `${name}: ${r.label} can be opened`).toBeTruthy();
        if (r.code) continue; // covered above
        check(`${name}: ${r.label}`, r.cur!, r, 'current');
        if (r.prior !== null) check(`${name}: ${r.label} (prior)`, r.prior, r, 'prior');
      }
    }
    expect(leaves).toBeGreaterThan(150);
  });

  it('every cell of the statement of changes in equity opens to figures that add up to it, in both years', () => {
    const st = buildStatements(lines, all);
    let cells = 0;
    for (const table of [st.equity, priorEquity(st)!]) {
      for (const row of table.rows) {
        row.values.forEach((v, i) => {
          if (v === 0) return;
          expect(row.sources?.[i]?.length, `${row.label} ${table.columns[i]}`).toBeGreaterThan(0);
          check(`${row.label} ${table.columns[i]}`, v, { parts: row.sources![i] }, 'current');
          cells++;
        });
      }
    }
    expect(cells).toBeGreaterThanOrEqual(15);
  });

  it('opens a note line to its one account, and depreciation to the accounts of that nature', () => {
    const st = buildStatements(lines, all);
    for (const n of st.noteBreakdowns) {
      for (const r of n.rows) {
        const t = traceItem(n.code, 'current', lines, all, [], { lineId: r.lineId })!;
        expect(t.accounts.length).toBeLessThanOrEqual(1);
        expect(t.total, `${n.title}: ${r.name}`).toBe(r.cur);
      }
    }
    const dep = st.cashFlow!.find((r) => r.label === 'Depreciation and amortisation')!;
    expect(dep.parts!.length).toBeGreaterThan(0);
    for (const x of dep.parts!) {
      const t = traceItem(x.code!, 'current', lines, all, [], x)!;
      expect(t.accounts.every((a) => a.line.nature === 'depreciation')).toBe(true);
    }
  });
});
