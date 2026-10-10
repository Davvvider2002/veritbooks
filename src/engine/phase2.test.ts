import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { balanceAt, parseBankStatement, reconcile } from './bank';
import { analyticsChecks } from './checks';
import { parseDate } from './dates';
import { disclosureGaps, financialSummary, ppeSchedule, priorEquity, STANDARD_NOTES, taxReconciliation } from './disclosures';
import { buildStatements } from './statements';
import { parseLedger, testLedger } from './ledger';
import { suggestMapping } from './mapping';
import { parseTrialBalance } from './parse';
import type { TbLine } from './types';

const N = (naira: number) => Math.round(naira * 100);
const rows = (f: string) =>
  Papa.parse<string[]>(readFileSync(`public/samples/${f}`, 'utf8'), { skipEmptyLines: true }).data;

function tb(): TbLine[] {
  const prior = new Map(parseTrialBalance(rows('trial-balance-2024.csv')).lines.map((l) => [l.code, l.balance]));
  return parseTrialBalance(rows('trial-balance-2025.csv')).lines.map((l) => ({
    id: l.code, code: l.code, name: l.name, balance: l.balance, prior: prior.get(l.code) ?? 0, ...suggestMapping(l.name),
  }));
}
const gl = () => parseLedger(rows('general-ledger-2025.csv')).entries;
const YE = '2025-12-31';

describe('dates', () => {
  it('reads Nigerian day-first dates and the other formats banks export', () => {
    expect(parseDate('03/04/2025')).toBe('2025-04-03');
    expect(parseDate('3-4-25')).toBe('2025-04-03');
    expect(parseDate('03-Apr-2025')).toBe('2025-04-03');
    expect(parseDate('3 April 2025 14:22')).toBe('2025-04-03');
    expect(parseDate('2025-04-03T10:00:00')).toBe('2025-04-03');
    expect(parseDate(new Date(Date.UTC(2025, 3, 3)))).toBe('2025-04-03');
    expect(parseDate(45750)).toBe('2025-04-03');
    expect(parseDate('31/06/2025')).toBeNull();
    expect(parseDate('Total')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('general ledger', () => {
  it('imports the sample ledger and every journal balances', () => {
    const p = parseLedger(rows('general-ledger-2025.csv'));
    expect(p.entries).toHaveLength(3176);
    expect(p.warnings).toEqual([]);
    expect(p.entries.reduce((a, e) => a + e.amount, 0)).toBe(0);
    expect(p.entries[0]).toMatchObject({ entryNo: 'JV-00001', date: '2025-01-01', accountCode: '1300', user: 'sales.clerk' });
  });
  it('splits journals on a nil running total when there is no journal number', () => {
    const p = parseLedger([
      ['Date', 'Account', 'Amount'],
      ['01/02/2025', '1400', '100'], ['01/02/2025', '4000', '-100'],
      ['02/02/2025', '6000', '30'], ['02/02/2025', '6010', '20'], ['02/02/2025', '1400', '(50)'],
    ]);
    expect(p.entries.map((e) => e.entryNo)).toEqual(['#1', '#1', '#2', '#2', '#2']);
    expect(p.warnings).toHaveLength(1);
  });
  it('agrees the ledger movement to the trial balance on every account', () => {
    const t = testLedger(gl(), tb(), { yearEnd: YE, performance: null });
    expect(t.disagreements).toBe(0);
    expect(t.unknownAccounts).toEqual([]);
    expect(t.agreement.find((a) => a.code === '4000')).toMatchObject({ ledger: -N(248_600_000), difference: 0 });
    expect(t.agreement.find((a) => a.code === '1400')).toMatchObject({ ledger: N(8_070_000), difference: 0 });
    expect(t.agreement.find((a) => a.code === '3100')).toMatchObject({ ledger: 0, expected: null });
  });
  it('reports an account whose ledger does not explain the trial balance', () => {
    const lines = tb().map((l) => (l.code === '6230' ? { ...l, balance: l.balance + N(1000) } : l));
    const t = testLedger(gl(), lines, { yearEnd: YE, performance: null });
    expect(t.disagreements).toBe(1);
    expect(t.agreement.find((a) => a.code === '6230')!.difference).toBe(-N(1000));
  });
  it('finds the planted journals', () => {
    const t = testLedger(gl(), tb(), { yearEnd: YE, performance: N(1_864_500) });
    const md = t.journals.find((j) => j.description === 'Manual adjustment per MD')!;
    expect(md.flags.sort()).toEqual(['keyword', 'large', 'period_end', 'round', 'weekend']);
    expect(t.journals[0]).toBe(md);
    const barter = t.journals.find((j) => j.description === 'Barter arrangement')!;
    expect(barter.flags).toContain('revenue_pair');
    const dup = t.journals.filter((j) => j.flags.includes('duplicate'));
    expect(dup.map((j) => j.description)).toEqual(['Electricity bill June', 'Electricity bill June']);
    expect(t.flagCounts.no_description).toBe(1);
    expect(t.flagCounts.unbalanced).toBeUndefined();
    expect(t.highRisk.length).toBeGreaterThan(0);
    expect(t.highRisk.length).toBeLessThan(15);
    // Ordinary sales invoices are not flagged for crediting revenue.
    expect(t.journals.filter((j) => j.flags.includes('revenue_pair')).length).toBe(1);
  });
  it('flags unbalanced journals, unknown accounts and dates outside the year', () => {
    const t = testLedger(
      [
        { entryNo: 'A', date: '2026-01-05', accountCode: '1400', description: 'Late receipt', amount: 500, user: '' },
        { entryNo: 'A', date: '2026-01-05', accountCode: '9999', description: 'Late receipt', amount: -400, user: '' },
      ],
      tb(),
      { yearEnd: YE, performance: null },
    );
    expect(t.journals[0].flags).toEqual(expect.arrayContaining(['unbalanced', 'outside_period', 'unknown_account']));
    expect(t.unknownAccounts).toEqual(['9999']);
  });
});

describe('bank statement', () => {
  const p = parseBankStatement(rows('bank-statement-2025.csv'));
  it('reads the statement below the bank header rows', () => {
    expect(p.lines).toHaveLength(759);
    expect(p.opening).toBe(N(1_790_000));
    expect(p.breaks).toBe(0);
    expect(p.warnings).toEqual([]);
    expect(p.lines[0].date).toBe('2025-01-01');
    expect(p.opening! + p.lines.reduce((a, l) => a + l.amount, 0)).toBe(N(9_985_874.34));
    expect(balanceAt(p, YE)).toBe(N(9_985_874.34));
    expect(p.lines.at(-1)!.amount).toBeLessThan(0); // a bank debit is money out
  });
  it('counts breaks in the running balance', () => {
    const r = rows('bank-statement-2025.csv');
    r.splice(200, 1); // a missing transaction
    const broken = parseBankStatement(r);
    expect(broken.breaks).toBe(1);
    expect(broken.firstBreak).not.toBeNull();
  });
  it('reconciles the sample account to the ledger with nothing unexplained', () => {
    const ledger = gl().filter((e) => e.accountCode === '1400');
    const r = reconcile({ bank: p.lines, ledger, bankClosing: balanceAt(p, YE)!, ledgerBalance: N(9_860_000), yearEnd: YE });
    expect(r.bankOnly.map((b) => [b.description, b.amount])).toEqual([
      ['NIP TRANSFER FROM OKEKE STORES', N(250_000)],
      ['SMS ALERT CHARGES', -N(15_000)],
    ]);
    expect(r.matched).toBe(757);
    expect(r.ledgerOnly.length).toBe(ledger.length - 757);
    expect(r.ledgerOnly.every((e) => e.date >= '2025-12-27' && e.clearedOn === null)).toBe(true);
    expect(r.expectedLedger).toBe(N(9_860_000));
    expect(r.difference).toBe(0);
  });
  it('shows items that cleared after the year end when the statement runs into the new year', () => {
    const ledger = [
      { entryNo: '1', date: '2025-12-30', accountCode: '1400', description: 'Cheque 1', amount: -N(500), user: '' },
      { entryNo: '2', date: '2025-12-15', accountCode: '1400', description: 'Receipt', amount: N(900), user: '' },
    ];
    const bank = [
      { date: '2025-12-15', description: 'IN', amount: N(900), balance: N(1900) },
      { date: '2026-01-03', description: 'CHQ 1', amount: -N(500), balance: N(1400) },
    ];
    const r = reconcile({ bank, ledger, bankClosing: N(1900), ledgerBalance: N(1400), yearEnd: YE });
    expect(r.ledgerOnly).toHaveLength(1);
    expect(r.ledgerOnly[0].clearedOn).toBe('2026-01-03');
    expect(r.difference).toBe(0);
  });
  it('leaves a difference when the ledger holds something the bank never saw and the window has passed', () => {
    const ledger = [{ entryNo: '1', date: '2025-03-01', accountCode: '1400', description: 'Receipt', amount: N(700), user: '' }];
    const r = reconcile({ bank: [], ledger, bankClosing: 0, ledgerBalance: N(700), yearEnd: YE });
    expect(r.ledgerOnly).toHaveLength(1); // listed for the auditor: a March lodgement still uncredited at year end
    expect(r.difference).toBe(0);
  });
});

describe('phase 2 sign-off gates', () => {
  const t = testLedger(gl(), tb(), { yearEnd: YE, performance: N(1_864_500) });
  const blocked = (c: ReturnType<typeof analyticsChecks>) => c.filter((x) => !x.ok && x.blocking).map((x) => x.id);
  it('does not apply to reviews and compilations', () => {
    expect(analyticsChecks({ type: 'compilation', ledger: null, bank: [] })).toEqual([]);
  });
  it('is advisory only when no ledger or statement has been imported', () => {
    const c = analyticsChecks({ type: 'audit', ledger: null, bank: [] });
    expect(c.map((x) => x.id)).toEqual(['ledger_present', 'bank_present']);
    expect(blocked(c)).toEqual([]);
  });
  it('blocks until every high-risk journal has a conclusion', () => {
    expect(blocked(analyticsChecks({ type: 'audit', ledger: t, testing: {}, bank: [] }))).toEqual(['journals_concluded']);
    const journals = Object.fromEntries(t.highRisk.map((j) => [j.entryNo, { status: 'clear' as const, note: 'Agreed to support', by: 'x', at: 'y' }]));
    expect(blocked(analyticsChecks({ type: 'audit', ledger: t, testing: { journals }, bank: [] }))).toEqual([]);
    journals[t.highRisk[0].entryNo].status = 'exception' as never;
    const c = analyticsChecks({ type: 'audit', ledger: t, testing: { journals }, bank: [] });
    expect(c.find((x) => x.id === 'journal_exceptions')).toMatchObject({ ok: false, blocking: false });
  });
  it('blocks on a bank account that does not reconcile until a conclusion is recorded', () => {
    const acct = { id: 'b1', name: 'Main', difference: 0, bankOnly: 2, unbooked: N(235_000), breaks: 0, matched: true };
    expect(blocked(analyticsChecks({ type: 'audit', ledger: null, bank: [acct] }))).toEqual(['bank_b1']);
    const testing = { bank: { b1: { note: 'Two items adjusted by AJ2.', by: 'x', at: 'y' } } };
    expect(blocked(analyticsChecks({ type: 'audit', ledger: null, testing, bank: [acct] }))).toEqual([]);
    expect(blocked(analyticsChecks({ type: 'audit', ledger: null, bank: [{ ...acct, bankOnly: 0 }] }))).toEqual([]);
    // Posting a journal for the statement-only items clears the gate without a written conclusion.
    expect(blocked(analyticsChecks({ type: 'audit', ledger: null, bank: [{ ...acct, unbooked: 0 }] }))).toEqual([]);
    expect(blocked(analyticsChecks({ type: 'audit', ledger: null, bank: [{ ...acct, bankOnly: 0, matched: false }] }))).toEqual(['bank_b1']);
  });
});

describe('disclosures', () => {
  const lines = tb();
  const st = buildStatements(lines, []);
  it('builds the fixed asset schedule from the two trial balances', () => {
    const s = ppeSchedule(lines, [], st.cur)!;
    expect(s.cost.map((r) => [r.name, r.opening / 100, r.increase / 100, r.closing / 100])).toEqual([
      ['Land and buildings', 45_000_000, 0, 45_000_000],
      ['Motor vehicles', 12_000_000, 6_500_000, 18_500_000],
      ['Office equipment', 5_100_000, 1_100_000, 6_200_000],
    ]);
    expect(s.depreciation[0]).toMatchObject({ opening: N(9_600_000), increase: N(5_300_000), closing: N(14_900_000) });
    expect(s.carryingClosing).toBe(st.cur.v.ppe);
    expect(s.carryingOpening).toBe(st.prior!.v.ppe);
    expect(s.chargeDifference).toBe(0);
  });
  it('grosses up additions and the charge for disposals', () => {
    const s = ppeSchedule(lines, [], st.cur, { '1010': N(2_000_000), '1090': N(1_500_000) })!;
    expect(s.cost.find((r) => r.code === '1010')).toMatchObject({ increase: N(8_500_000), disposals: N(2_000_000), closing: N(18_500_000) });
    expect(s.totalDepreciation).toMatchObject({ increase: N(6_800_000), disposals: N(1_500_000) });
    expect(s.chargeDifference).toBe(N(1_500_000)); // the charge no longer agrees to the tagged depreciation
    expect(s.carryingClosing).toBe(st.cur.v.ppe);
  });
  it('has no schedule without a prior year', () => {
    expect(ppeSchedule(lines.map((l) => ({ ...l, prior: null })), [], st.cur)).toBeNull();
  });
  it('reconciles the tax charge at the rate entered', () => {
    expect(taxReconciliation(st.cur, {})).toBeNull();
    const t = taxReconciliation(st.cur, { taxRate: 30 })!;
    expect(t.atRate).toBe(N(9_036_000)); // 30% of 30,120,000
    expect(t.difference).toBe(N(6_900_000 - 9_036_000));
    const done = taxReconciliation(st.cur, { taxRate: 30, taxItems: [{ label: 'Capital allowances in excess of depreciation', amount: -N(2_136_000) }] })!;
    expect(done.difference).toBe(0);
    expect(done.effectiveRate).toBe(22.9);
  });
  it('rolls prior year equity forward to the opening balance of this year', () => {
    const e = priorEquity(st)!;
    expect(e.rows[0].values[3]).toBe(N(28_500_000));
    expect(e.rows.at(-1)!.values).toEqual(st.equity.rows[0].values);
  });
  it('extends the financial summary with earlier years as entered', () => {
    const two = financialSummary(st, YE);
    expect(two.years).toEqual(['2025', '2024']);
    expect(two.rows.find((r) => r.label === 'Net assets')!.values).toEqual([st.cur.totalEquity, st.prior!.totalEquity]);
    expect(two.rows.find((r) => r.label === 'Total equity')!.values).toEqual([st.cur.totalEquity, st.prior!.totalEquity]);
    const e = { year: '2023', revenue: N(180), pbt: N(20), tax: N(6), nca: N(50), ca: N(40), liabilities: N(52), capital: N(10), reserves: N(28) };
    const three = financialSummary(st, YE, [e]);
    expect(three.years).toEqual(['2025', '2024', '2023']);
    expect(three.rows.find((r) => r.label === 'Profit for the year')!.values[2]).toBe(N(14));
  });
  it('lists what is missing, and nothing once the disclosures are complete', () => {
    expect(disclosureGaps({}, st, lines, [], YE).length).toBe(11);
    const year = (y: string) => ({ year: y, revenue: 1, pbt: 1, tax: 0, nca: 1, ca: 1, liabilities: 1, capital: 1, reserves: 0 });
    const complete = {
      directors: 'Adunni Balogun\nEmeka Nwosu', registeredOffice: '14 Allen Avenue, Ikeja', taxRate: 30,
      taxItems: [{ label: 'Capital allowances', amount: -N(2_136_000) }], noRelatedParties: true, employees: 42,
      directorsRemuneration: N(9_000_000), ...STANDARD_NOTES, earlierYears: [year('2023'), year('2022'), year('2021')],
    };
    expect(disclosureGaps(complete, st, lines, [], YE)).toEqual([]);
    expect(disclosureGaps({ ...complete, ppeDisposals: { '1090': N(100) } }, st, lines, [], YE)).toHaveLength(1);
    expect(disclosureGaps({ ...complete, taxItems: [] }, st, lines, [], YE)[0]).toMatch(/unexplained difference/);
  });
});
