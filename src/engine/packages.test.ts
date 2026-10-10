import { describe, expect, it } from 'vitest';
import { parseBankStatement } from './bank';
import { detectDateOrder, parseDate } from './dates';
import { parseLedger, resolveAccounts, testLedger } from './ledger';
import { parseAmount } from './money';
import { parseTrialBalance, splitAccount } from './parse';
import type { TbLine } from './types';

/**
 * These files are modelled on how each package lays out its exports, written from knowledge of
 * the products. They are not real exports. A tiny company: opening bank and capital of 500,
 * one sale of 1,000 on credit, 700 received, 300 rent paid.
 */
const MAP: Record<string, string> = { bank: 'cash', debtors: 'trade_receivables', capital: 'share_capital', sales: 'revenue', rent: 'admin_expenses' };
const PRIOR: Record<string, number> = { bank: 50000, capital: -50000 };
const tb = (rows: unknown[][]): TbLine[] =>
  parseTrialBalance(rows).lines.map((l) => {
    const key = l.name.toLowerCase();
    return { id: l.code, code: l.code, name: l.name, balance: l.balance, prior: PRIOR[key] ?? 0, mapCode: MAP[key], nature: key === 'rent' ? 'other' : null };
  });
const check = (ledgerRows: unknown[][], lines: TbLine[]) => {
  const parsed = parseLedger(ledgerRows);
  const resolved = resolveAccounts(parsed.entries, lines);
  const t = testLedger(resolved.entries, lines, { yearEnd: '2025-12-31', performance: null });
  return { parsed, resolved, t };
};

describe('dates in either order', () => {
  it('tells day first from month first when the file allows', () => {
    expect(detectDateOrder(['01/02/2025', '13/02/2025'])).toEqual({ monthFirst: false, certain: true });
    expect(detectDateOrder(['01/02/2025', '02/13/2025'])).toEqual({ monthFirst: true, certain: true });
    expect(detectDateOrder(['01/02/2025', '03/04/2025'])).toEqual({ monthFirst: false, certain: false });
    expect(detectDateOrder(['03-Jan-2025', new Date()])).toEqual({ monthFirst: false, certain: true });
    expect(parseDate('2/13/25', true)).toBe('2025-02-13');
    expect(parseDate('2/13/25')).toBeNull();
  });
  it('reads a month-first bank statement', () => {
    const p = parseBankStatement([['Date', 'Details', 'Debit', 'Credit', 'Balance'], ['01/15/2025', 'IN', '', '700.00', '1,200.00'], ['02/13/2025', 'RENT', '300.00', '', '900.00']]);
    expect(p.dateOrder).toEqual({ monthFirst: true, certain: true });
    expect(p.lines.map((l) => l.date)).toEqual(['2025-01-15', '2025-02-13']);
    expect(parseBankStatement([['Date', 'Details', 'Amount'], ['01/02/2025', 'x', '5']], 'month').lines[0].date).toBe('2025-01-02');
  });
});

describe('Sage 50 style exports', () => {
  const trial = [
    ['Adunni Foods Limited'], ['General Ledger Trial Balance'], ['As of Dec 31, 2025'], ['Filter Criteria includes: Report order is by ID.'],
    ['Account ID', 'Account Description', 'Debit Amt', 'Credit Amt'],
    ['1000', 'Bank', '900.00', ''], ['1100', 'Debtors', '300.00', ''], ['3000', 'Capital', '', '500.00'], ['4000', 'Sales', '', '1,000.00'], ['6000', 'Rent', '300.00', ''],
    ['', 'Total:', '1,500.00', '1,500.00'],
  ];
  const ledger = [
    ['Adunni Foods Limited'], ['General Ledger'], ['For the Period From Jan 1, 2025 to Dec 31, 2025'],
    ['Account ID', 'Account Description', 'Date', 'Reference', 'Jrnl', 'Trans Description', 'Debit Amt', 'Credit Amt', 'Balance'],
    ['1000', 'Bank', '1/1/25', '', '', 'Beginning Balance', '', '', '500.00'],
    ['', '', '1/15/25', 'RCT01', 'CRJ', 'Customer receipt', '700.00', '', ''],
    ['', '', '2/13/25', 'CHQ01', 'CDJ', 'Rent paid', '', '300.00', ''],
    ['', '', '', '', '', 'Current Period Change', '700.00', '300.00', '400.00'],
    ['', '', '12/31/25', '', '', 'Ending Balance', '', '', '900.00'],
    ['1100', 'Debtors', '1/1/25', '', '', 'Beginning Balance', '', '', ''],
    ['', '', '1/10/25', 'INV01', 'SJ', 'Sales invoice', '1,000.00', '', ''],
    ['', '', '1/15/25', 'RCT01', 'CRJ', 'Customer receipt', '', '700.00', ''],
    ['', '', '', '', '', 'Current Period Change', '1,000.00', '700.00', '300.00'],
    ['', '', '12/31/25', '', '', 'Ending Balance', '', '', '300.00'],
    ['4000', 'Sales', '1/1/25', '', '', 'Beginning Balance', '', '', ''],
    ['', '', '1/10/25', 'INV01', 'SJ', 'Sales invoice', '', '1,000.00', ''],
    ['', '', '', '', '', 'Current Period Change', '', '1,000.00', '-1,000.00'],
    ['6000', 'Rent', '1/1/25', '', '', 'Beginning Balance', '', '', ''],
    ['', '', '2/13/25', 'CHQ01', 'CDJ', 'Rent paid', '300.00', '', ''],
    ['', '', '', '', '', 'Current Period Change', '300.00', '', '300.00'],
  ];
  it('reads the trial balance under its title rows', () => {
    const lines = parseTrialBalance(trial).lines;
    expect(lines.map((l) => [l.code, l.name, l.balance])).toEqual([['1000', 'Bank', 90000], ['1100', 'Debtors', 30000], ['3000', 'Capital', -50000], ['4000', 'Sales', -100000], ['6000', 'Rent', 30000]]);
  });
  it('reads a ledger listed by account, with balance and period-change rows left out', () => {
    const { parsed, resolved, t } = check(ledger, tb(trial));
    expect(parsed.dateOrder).toEqual({ monthFirst: true, certain: true });
    expect(parsed.badDates).toBe(0);
    expect(parseLedger(ledger, { dateOrder: 'day' }).badDates).toBe(4); // 1/15/25 and 2/13/25 are not day-first dates
    expect(parsed.entries).toHaveLength(6);
    expect(parsed.entries[1]).toMatchObject({ entryNo: 'CDJ CHQ01', date: '2025-02-13', accountCode: '1000', amount: -30000 });
    expect(resolved.unresolved).toEqual([]);
    expect(t.journals.map((j) => j.entryNo).sort()).toEqual(['CDJ CHQ01', 'CRJ RCT01', 'SJ INV01']);
    expect(t.flagCounts.unbalanced).toBeUndefined();
    expect(t.disagreements).toBe(0);
  });
});

describe('QuickBooks Desktop style exports', () => {
  const trial = [
    ['', 'Dec 31, 25'], ['', 'Debit', 'Credit'],
    ['1000 · Bank', '900.00', ''], ['1100 · Debtors', '300.00', ''], ['3000 · Capital', '', '500.00'], ['4000 · Sales', '', '1,000.00'], ['6000 · Rent', '300.00', ''],
    ['TOTAL', '1,500.00', '1,500.00'],
  ];
  const journal = (acct: (n: string, name: string) => string) => [
    ['Trans #', 'Type', 'Date', 'Num', 'Name', 'Memo', 'Account', 'Debit', 'Credit'],
    ['1', 'Invoice', '01/10/2025', 'INV01', 'Shoprite', 'Sales invoice', acct('1100', 'Debtors'), '1,000.00', ''],
    ['', '', '', '', 'Shoprite', 'Sales invoice', acct('4000', 'Sales'), '', '1,000.00'],
    ['', '', '', '', '', '', '', '1,000.00', '1,000.00'],
    [],
    ['2', 'Payment', '01/15/2025', 'RCT01', 'Shoprite', 'Customer receipt', acct('1000', 'Bank'), '700.00', ''],
    ['', '', '', '', 'Shoprite', 'Customer receipt', acct('1100', 'Debtors'), '', '700.00'],
    ['', '', '', '', '', '', '', '700.00', '700.00'],
    [],
    ['3', 'Check', '02/13/2025', 'CHQ01', 'Landlord', 'Rent paid', acct('6000', 'Rent'), '300.00', ''],
    ['', '', '', '', 'Landlord', 'Rent paid', acct('1000', 'Bank'), '', '300.00'],
    ['', '', '', '', '', '', '', '300.00', '300.00'],
    ['TOTAL', '', '', '', '', '', '', '2,000.00', '2,000.00'],
  ];
  it('reads a trial balance with a blank heading over "number · name" accounts', () => {
    expect(splitAccount('1000 · Bank')).toEqual({ code: '1000', name: 'Bank' });
    expect(splitAccount('Bank - Lagos')).toEqual({ code: '', name: 'Bank - Lagos' });
    expect(parseTrialBalance(trial).lines.map((l) => [l.code, l.name])).toEqual([['1000', 'Bank'], ['1100', 'Debtors'], ['3000', 'Capital'], ['4000', 'Sales'], ['6000', 'Rent']]);
  });
  it('reads the Journal report, carrying the date and number down each transaction', () => {
    const { parsed, resolved, t } = check(journal((n, name) => `${n} · ${name}`), tb(trial));
    expect(parsed.entries).toHaveLength(6);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.entries[1]).toMatchObject({ entryNo: '1', date: '2025-01-10', accountCode: '4000', description: 'Sales invoice', amount: -100000 });
    expect(resolved.unresolved).toEqual([]);
    expect(t.journals).toHaveLength(3);
    expect(t.flagCounts.unbalanced).toBeUndefined();
    expect(t.disagreements).toBe(0);
  });
  it('matches by name when account numbers are switched off, including sub-accounts', () => {
    const names = [['', 'Debit', 'Credit'], ['Bank', '900.00', ''], ['Debtors', '300.00', ''], ['Capital', '', '500.00'], ['Sales', '', '1,000.00'], ['Rent', '300.00', ''], ['TOTAL', '1,500.00', '1,500.00']];
    const { resolved, t } = check(journal((_, name) => (name === 'Rent' ? 'Overheads:Rent' : name)), tb(names));
    expect(resolved.unresolved).toEqual([]);
    expect(t.unknownAccounts).toEqual([]);
    expect(t.disagreements).toBe(0);
  });
  it('reports accounts it cannot find in the trial balance', () => {
    const { resolved, t } = check(journal((n, name) => (name === 'Rent' ? '6999 · Sundry' : `${n} · ${name}`)), tb(trial));
    expect(resolved.unresolved).toEqual(['6999 Sundry']);
    expect(t.unknownAccounts).toEqual(['6999']);
  });
});

describe('Tally style exports', () => {
  it('reads Indian digit grouping and a Dr or Cr suffix', () => {
    expect(parseAmount('1,23,45,678.50')).toBe(1234567850);
    expect(parseAmount('12,500.00 Cr')).toBe(-1250000);
    expect(parseAmount('12,500.00 Dr')).toBe(1250000);
  });
  it('reads a day book where Particulars names the ledger account', () => {
    const trial = [['Particulars', 'Debit', 'Credit'], ['Bank', '900.00', ''], ['Debtors', '300.00', ''], ['Capital', '', '500.00'], ['Sales', '', '1,000.00'], ['Rent', '300.00', '']];
    const daybook = [
      ['Date', 'Particulars', 'Vch Type', 'Vch No.', 'Debit', 'Credit'],
      ['10-Jan-2025', 'Debtors', 'Sales', '1', '1,000.00', ''], ['', 'Sales', '', '', '', '1,000.00'],
      ['15-Jan-2025', 'Bank', 'Receipt', '2', '700.00', ''], ['', 'Debtors', '', '', '', '700.00'],
      ['13-Feb-2025', 'Rent', 'Payment', '3', '300.00', ''], ['', 'Bank', '', '', '', '300.00'],
    ];
    const { parsed, resolved, t } = check(daybook, tb(trial));
    expect(parsed.entries.map((e) => e.entryNo)).toEqual(['1', '1', '2', '2', '3', '3']);
    expect(resolved.unresolved).toEqual([]);
    expect(t.disagreements).toBe(0);
    expect(t.flagCounts.unbalanced).toBeUndefined();
  });
});
