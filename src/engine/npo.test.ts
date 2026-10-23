import { describe, expect, it } from 'vitest';
import { buildStatements } from './statements';
import type { TbLine } from './types';

const line = (id: string, mapCode: string, balance: number, fund: string | null = null, prior: number | null = null): TbLine => ({ id, code: id, name: id, balance, prior, mapCode, nature: null, fund });

// A small NGO: a USAID grant partly spent, unrestricted donations, and a fund brought forward.
const tb: TbLine[] = [
  line('cash', 'cash', 800),
  line('grant', 'grant_income', -800, 'USAID WASH project'),
  line('don', 'donations', -300),
  line('prog', 'programme_expenses', 500, 'USAID WASH project'),
  line('adm', 'admin_expenses', 100),
  line('rf', 'restricted_funds', -200, 'USAID WASH project'),
  line('acc', 'retained_earnings', -100),
];

describe('not-for-profit statements', () => {
  const st = buildStatements(tb, [], { npo: true });
  it('presents income and expenditure, and splits the surplus by fund', () => {
    expect(st.cur.totalIncome).toBe(1100);
    expect(st.cur.totalExpenditure).toBe(600);
    expect(st.cur.profit).toBe(500);
    expect(st.cur.restrictedSurplus).toBe(300);
    const labels = st.income.map((r) => r.label);
    expect(labels).toContain('Total income');
    expect(labels).toContain('Surplus/(deficit) for the year');
    expect(st.income.find((r) => r.label === 'Of which, restricted funds')?.cur).toBe(300);
  });
  it('shows funds in place of equity, and balances', () => {
    expect(st.cur.closingRestricted).toBe(500);
    expect(st.cur.closingRetained).toBe(300);
    expect(st.cur.totalEquity).toBe(st.cur.totalAssets);
    expect(st.position.find((r) => r.label === 'Unrestricted funds')?.cur).toBe(300);
    expect(st.position.find((r) => r.label === 'Restricted funds')?.cur).toBe(500);
    expect(st.position.some((r) => r.label === 'Total funds')).toBe(true);
  });
  it('gives a statement of changes in funds and each fund’s movement', () => {
    expect(st.equity.columns).toEqual(['Unrestricted funds', 'Restricted funds', 'Endowment funds', 'Total']);
    expect(st.equity.rows.at(-1)!.values).toEqual([300, 500, 0, 800]);
    expect(st.funds).toEqual([{ name: 'USAID WASH project', opening: 200, income: 800, expenditure: 500, closing: 500 }]);
  });
  it('leaves a company’s statements as they were', () => {
    const co = buildStatements(tb.map((l) => ({ ...l, fund: null })), []);
    expect(co.npo).toBeUndefined();
    expect(co.income.some((r) => r.label === 'Profit for the year')).toBe(true);
    expect(co.equity.columns[0]).toBe('Share capital');
  });
});

import { draftReport } from './report';
import { JURISDICTIONS } from '../content/jurisdictions';
import { LEGAL_FORMS, npoJurisdiction, formPhrase } from '../content/entities';

describe('a not-for-profit’s auditor’s report', () => {
  const trustees = LEGAL_FORMS.NG.find((f) => f.id === 'trustees')!;
  const j = npoJurisdiction(JURISDICTIONS.NG, trustees);
  const r = draftReport({
    type: 'audit',
    clientName: 'Hope Foundation',
    yearEnd: '2025-12-31',
    settings: { opinion: 'unmodified' },
    hasCashFlow: true,
    jurisdiction: j,
    npo: { governors: { plural: 'trustees', possessive: 'trustees’' }, addressee: 'To the Trustees of Hope Foundation' },
  });
  const text = [r.addressee, ...r.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join(' ');
  it('is addressed to the trustees and names the not-for-profit statements', () => {
    expect(r.addressee).toBe('To the Trustees of Hope Foundation');
    expect(text).toContain('the statement of income and expenditure');
    expect(text).toContain('the statement of changes in funds');
    expect(text).toContain('The trustees are responsible');
    expect(text).not.toMatch(/the company|profit or loss|The directors/);
  });
  it('cites Part F of CAMA, and drops the company confirmations for incorporated trustees', () => {
    expect(text).toContain('Part F of the Companies and Allied Matters Act 2020');
    expect(text).not.toContain('Report on other legal and regulatory requirements');
    expect(j.nationalStatements).toBe(false);
    expect(j.officerNumbers).toBe(false);
  });
  it('keeps the confirmations for a company limited by guarantee', () => {
    const g = npoJurisdiction(JURISDICTIONS.GH, LEGAL_FORMS.GH[0]);
    expect(g.statutoryConfirmations).toBe(true);
    expect(g.companiesAct).toBe('the Companies Act, 2019 (Act 992)');
  });
  it('phrases the legal form', () => {
    expect(formPhrase(trustees)).toBe('incorporated trustees');
    expect(formPhrase(LEGAL_FORMS.GH[0])).toBe('a company limited by guarantee');
  });
});
