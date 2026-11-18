import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { buildStatements } from './statements';
import { suggestMapping } from './mapping';
import { parseTrialBalance } from './parse';
import { cashFlowFromProfit, effectivePresentation, presentFor, scaledFmt, unitHeading, unitLine } from './presentation';
import type { TbLine } from './types';

const rows = (f: string) => Papa.parse<string[]>(readFileSync(`public/samples/${f}`, 'utf8'), { skipEmptyLines: true }).data;
function tb(): TbLine[] {
  const prior = new Map(parseTrialBalance(rows('trial-balance-2024.csv')).lines.map((l) => [l.code, l.balance]));
  return parseTrialBalance(rows('trial-balance-2025.csv')).lines.map((l) => ({ id: l.code, code: l.code, name: l.name, balance: l.balance, prior: prior.get(l.code) ?? 0, ...suggestMapping(l.name) }));
}
const sum = (xs: { cur: number | null }[]) => xs.reduce((a, r) => a + (r.cur ?? 0), 0);

describe('presentation of the financial statements', () => {
  it('takes the file’s choices over the firm’s defaults, and thousands for the international style', () => {
    expect(effectivePresentation(undefined, undefined)).toMatchObject({ style: 'standard', rounding: 'units', expenses: 'function', valueAdded: true, summary: true });
    const e = effectivePresentation({ style: 'illustrative', captions: { trade_receivables: 'Accounts receivable' } }, { captions: { cash: 'Bank and cash', trade_receivables: ' ' }, expenses: 'nature' });
    expect(e).toMatchObject({ style: 'illustrative', rounding: 'thousands', expenses: 'nature' });
    // A blank caption on the file does not wipe the firm's own; blank is dropped.
    expect(e.captions).toEqual({ trade_receivables: 'Accounts receivable', cash: 'Bank and cash' });
    expect(effectivePresentation({ style: 'illustrative' }, { rounding: 'units' }).rounding).toBe('units');
  });

  it('rounds figures to thousands or millions and labels the columns', () => {
    expect(scaledFmt('thousands')(1_234_567_89)).toBe('1,235');
    expect(scaledFmt('millions')(-2_500_000_00)).toBe('(3)');
    expect(scaledFmt('units')(1_234_00)).toBe('1,234');
    expect(unitHeading('thousands', '₦')).toBe("₦'000");
    expect(unitLine('thousands', 'Nigerian naira')).toBe('In thousands of Nigerian naira');
    expect(unitLine('millions', 'Canadian dollars')).toBe('In millions of Canadian dollars');
    expect(unitLine('units', 'Ghanaian cedis')).toBe('');
  });

  it('renames lines wherever they appear, without touching the figures', () => {
    const st = buildStatements(tb(), []);
    const out = presentFor(st, effectivePresentation(undefined, { captions: { trade_receivables: 'Accounts receivable', borrowings_nc: 'Leases' } }));
    const row = out.position.find((r) => r.code === 'trade_receivables')!;
    expect(row.label).toBe('Accounts receivable');
    expect(row.cur).toBe(st.position.find((r) => r.code === 'trade_receivables')!.cur);
    expect(out.position.find((r) => r.code === 'borrowings_nc')!.label).toBe('Leases');
    expect(out.noteBreakdowns.find((n) => n.code === 'trade_receivables')!.title).toBe('Accounts receivable');
    expect(out.cashFlow!.some((r) => r.label === 'Change in accounts receivable')).toBe(true);
    expect(sum(out.position)).toBe(sum(st.position));
  });

  it('groups and renumbers the notes in the international style, keeping the Note column in step', () => {
    const st = buildStatements(tb(), []);
    const out = presentFor(st, effectivePresentation({ style: 'illustrative' }, undefined));
    const order = out.noteBreakdowns.map((n) => n.code);
    expect(order[0]).toBe('revenue');
    expect(order.indexOf('income_tax_expense')).toBeLessThan(order.indexOf('ppe'));
    expect(order.indexOf('ppe')).toBeLessThan(order.indexOf('share_capital'));
    expect(out.noteBreakdowns.map((n) => n.number)).toEqual(out.noteBreakdowns.map((_, i) => 3 + i));
    for (const r of [...out.position, ...out.income].filter((x) => x.code && x.note !== undefined)) expect(out.notes.get(r.code!)).toBe(r.note);
    expect([...out.noteGroup.values()]).toEqual(['Performance for the year', 'Income taxes', 'Assets', 'Equity and liabilities']);
  });

  it('analyses expenses by nature to the same operating profit', () => {
    const lines = tb();
    const st = buildStatements(lines, []);
    const op = (rs: typeof st.income) => rs.find((r) => r.label === 'Operating profit')!;
    expect(op(st.incomeByNature).cur).toBe(op(st.income).cur);
    expect(st.incomeByNature.find((r) => r.label === 'Employee benefits expense')!.cur).toBe(-st.cur.staff);
    expect(st.incomeByNature.find((r) => r.label === 'Depreciation and amortisation')!.cur).toBe(-st.cur.depreciation);
    // Every line between revenue and operating profit adds up to it.
    const at = st.incomeByNature.findIndex((r) => r.label === 'Operating profit');
    expect(sum(st.incomeByNature.slice(0, at))).toBe(op(st.income).cur);
    for (const r of st.incomeByNature.filter((x) => x.parts)) expect(r.parts!.reduce((a, x) => a + x.cur, 0)).toBe(r.cur);
  });

  it('starts the cash flow from profit for the year, with the same cash generated', () => {
    const st = buildStatements(tb(), []);
    const out = cashFlowFromProfit(st.cashFlow!, { cur: st.cur.profit, prior: null }, { cur: st.cur.v.income_tax_expense, prior: null }, false);
    expect(out[1]).toMatchObject({ label: 'Profit for the year', cur: st.cur.profit });
    expect(out.find((r) => r.label === 'Income tax expense')!.cur).toBe(st.cur.v.income_tax_expense);
    const cash = (rs: typeof out) => rs.find((r) => r.label === 'Cash generated from operations')!.cur;
    expect(cash(out)).toBe(cash(st.cashFlow!));
  });
});
