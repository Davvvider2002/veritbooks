import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { balanceAt, parseBankStatement, reconcile } from './bank';
import { analyticsChecks } from './checks';
import { parseDate } from './dates';
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
