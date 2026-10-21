import { describe, expect, it } from 'vitest';
import { bankItemDescription, bankItemLines, nextBankRef, postedFor, suggestAccount } from './bankPost';
import type { TbLine } from './types';

const tb: TbLine[] = [
  { id: 'bank', code: '1400', name: 'Bank current account', balance: 0, prior: null, mapCode: 'cash', nature: null },
  { id: 'dr', code: '1300', name: 'Trade debtors', balance: 0, prior: null, mapCode: 'trade_receivables', nature: null },
  { id: 'chg', code: '6230', name: 'Bank charges', balance: 0, prior: null, mapCode: 'admin_expenses', nature: 'other' },
  { id: 'int', code: '4100', name: 'Interest income', balance: 0, prior: null, mapCode: 'finance_income', nature: null },
];
const receipt = { date: '2025-12-29', description: 'NIP TRANSFER FROM OKEKE STORES', amount: 250_000_00, balance: null };
const sms = { date: '2025-12-30', description: 'SMS ALERT CHARGES', amount: -15_000_00, balance: null };

describe('posting statement items from the bank reconciliation', () => {
  it('suggests an account from the narration', () => {
    expect(suggestAccount(receipt, tb, 'bank')).toBe('dr');
    expect(suggestAccount(sms, tb, 'bank')).toBe('chg');
    expect(suggestAccount({ ...receipt, description: 'INTEREST ON CALL DEPOSIT' }, tb, 'bank')).toBe('int');
    expect(suggestAccount({ ...receipt, description: 'POS SETTLEMENT' }, tb, 'bank')).toBeNull();
  });
  it('builds a balanced journal, debiting the bank for money in', () => {
    expect(bankItemLines(receipt, 'bank', 'dr')).toEqual([{ lineId: 'bank', amount: 250_000_00 }, { lineId: 'dr', amount: -250_000_00 }]);
    expect(bankItemLines(sms, 'bank', 'chg').reduce((a, l) => a + l.amount, 0)).toBe(0);
  });
  it('numbers BR journals and knows an item already posted', () => {
    const adj = [{ id: 'a', ref: 'BR1', description: bankItemDescription(receipt), posted: true, lines: bankItemLines(receipt, 'bank', 'dr') }];
    expect(nextBankRef(adj)).toBe('BR2');
    expect(nextBankRef(adj, new Set(['BR2']))).toBe('BR3');
    expect(postedFor(receipt, 'bank', adj)?.ref).toBe('BR1');
    expect(postedFor(sms, 'bank', adj)).toBeUndefined();
  });
});
