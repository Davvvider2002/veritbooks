import { describe, expect, it } from 'vitest';
import { buildStatements, type Row } from './statements';
import { gaapOf, present, retainedEarningsRows, titlesFor } from './frameworks';
import { draftReport, longDate, setDateLocale } from './report';
import { JURISDICTIONS } from '../content/jurisdictions';
import { basisNote, npoRequirement } from '../content/canada';
import { aspePolicies } from '../content/aspe';
import { signOffChecks } from './checks';
import type { ReportSettings, TbLine } from './types';

const line = (id: string, mapCode: string, balance: number, prior: number | null = null, fund: string | null = null): TbLine => ({ id, code: id, name: id, balance, prior, mapCode, nature: null, fund });
const value = (rows: Row[], label: string) => rows.find((r) => r.label === label)?.cur;

// A small Ontario company with two years.
const company: TbLine[] = [
  line('cash', 'cash', 5000, 3000),
  line('ar', 'trade_receivables', 2000, 1500),
  line('ap', 'trade_payables', -1500, -1000),
  line('sc', 'share_capital', -100, -100),
  line('re', 'retained_earnings', -3400, -2400),
  line('rev', 'revenue', -10000, -8000),
  line('cos', 'cost_of_sales', 6000, 5000),
  line('adm', 'admin_expenses', 2000, 2000),
  line('tax', 'income_tax_expense', 0, 0),
];

describe('ASPE presentation', () => {
  const st = present(buildStatements(company, []), 'aspe');
  it('uses Canadian statement names', () => {
    expect(titlesFor('aspe', false)).toEqual({ position: 'Balance sheet', income: 'Statement of income', equity: 'Statement of retained earnings', cashFlow: 'Statement of cash flows' });
    expect(gaapOf('CA', {})).toBe('aspe');
    expect(gaapOf('CA', { entity: 'npo' })).toBe('asnpo');
    expect(gaapOf('NG', {})).toBe('ifrs-smes');
  });
  it('words the lines the Canadian way, with the figures unchanged', () => {
    expect(value(st.income, 'Net income')).toBe(2000);
    expect(value(st.income, 'Gross margin')).toBe(4000);
    expect(st.income.some((r) => r.label === 'Profit for the year')).toBe(false);
    expect(value(st.position, 'Total shareholders’ equity')).toBe(5500);
    expect(value(st.position, 'Accounts receivable')).toBe(2000);
  });
  it('gives a statement of retained earnings for both years', () => {
    const base = buildStatements(company, []);
    const rows = retainedEarningsRows(base.equity, { columns: base.equity.columns, rows: [
      { label: 'At start of year', values: [100, 0, 0, 1000, 1100], style: 'line' },
      { label: 'Profit for the year', values: [0, 0, 0, 1000, 1000], style: 'line' },
      { label: 'Dividends', values: [0, 0, 0, 0, 0], style: 'line' },
      { label: 'At end of year', values: [100, 0, 0, 2000, 2100], style: 'total' },
    ] });
    expect(rows.map((r) => r.label)).toEqual(['Retained earnings, beginning of year', 'Net income', 'Dividends', 'Retained earnings, end of year']);
    expect(rows[0].cur).toBe(3400);
    expect(rows[1].cur).toBe(2000);
    expect(rows.at(-1)!.cur).toBe(5400);
    expect(rows.at(-1)!.prior).toBe(2000);
  });
  it('leaves the IFRS for SMEs statements untouched elsewhere', () => {
    const base = buildStatements(company, []);
    expect(present(base, 'ifrs-smes')).toBe(base);
  });
});

// A federal not-for-profit: a restricted grant partly spent, and a balance brought forward.
const npo: TbLine[] = [
  line('cash', 'cash', 800, 300),
  line('grant', 'grant_income', -800, -400, 'Trillium grant'),
  line('don', 'donations', -300, -200),
  line('prog', 'programme_expenses', 500, 200, 'Trillium grant'),
  line('adm', 'admin_expenses', 100, 100),
  line('rf', 'restricted_funds', -200, 0, 'Trillium grant'),
  line('acc', 'retained_earnings', -100, 0),
];

describe('ASNPO, deferral method', () => {
  const base = buildStatements(npo, [], { npo: true });
  const st = present(base, 'asnpo', 'deferral');
  it('defers restricted contributions not yet spent', () => {
    expect(base.cur.restrictedSurplus).toBe(300);
    expect(value(st.income, 'Restricted contributions deferred, net of amounts recognized')).toBe(-300);
    expect(value(st.income, 'Total revenue')).toBe(800);
    expect(value(st.income, 'Excess (deficiency) of revenue over expenses')).toBe(200);
    expect(st.income.some((r) => r.label.startsWith('Of which'))).toBe(false);
  });
  it('shows deferred contributions as a liability, and still balances', () => {
    expect(value(st.position, 'Deferred contributions')).toBe(500);
    expect(st.position.some((r) => r.label === 'Externally restricted net assets')).toBe(false);
    expect(value(st.position, 'Total net assets')).toBe(300);
    expect(value(st.position, 'Total liabilities')).toBe(500);
    expect(value(st.position, 'Total liabilities and net assets')).toBe(value(st.position, 'Total assets'));
  });
  it('gives a statement of changes in net assets with no restricted column', () => {
    expect(st.equity.columns).toEqual(['Unrestricted', 'Endowment', 'Total']);
    expect(st.equity.rows.at(-1)).toMatchObject({ label: 'Balance, end of year', values: [300, 0, 300] });
  });
  it('adds the increase in deferred contributions back in the cash flow, so cash still reconciles', () => {
    const cf = st.cashFlow!;
    expect(value(cf, 'Increase (decrease) in deferred contributions')).toBe(300);
    expect(value(cf, 'Excess (deficiency) of revenue over expenses before income taxes')).toBe(base.cur.pbt - 300);
    expect(value(cf, 'Cash generated from operations')).toBe(value(base.cashFlow!, 'Cash generated from operations'));
  });
  it('keeps every changed total equal to the sum of its parts', () => {
    for (const r of [...st.income, ...st.position]) {
      if (!r.parts || r.style === 'line') continue;
      const sum = r.parts.reduce((a, p) => a + p.cur, 0);
      expect([r.label, sum]).toEqual([r.label, r.cur]);
    }
  });
});

describe('ASNPO, restricted fund method', () => {
  const st = present(buildStatements(npo, [], { npo: true }), 'asnpo', 'restricted-fund');
  it('keeps restricted net assets and words them for Canada', () => {
    expect(value(st.position, 'Externally restricted net assets')).toBe(500);
    expect(value(st.income, 'Excess (deficiency) of revenue over expenses')).toBe(500);
    expect(st.equity.columns).toEqual(['Unrestricted', 'Externally restricted', 'Endowment', 'Total']);
  });
});

const settings = (s: Partial<ReportSettings> = {}): ReportSettings => s;
const ca = JURISDICTIONS.CA;

describe('Canadian reports', () => {
  setDateLocale('CA');
  it('writes dates the Canadian way', () => {
    expect(longDate('2025-12-31')).toBe('December 31, 2025');
  });
  it('drafts a CAS 700 auditor’s report for ASPE statements', () => {
    const r = draftReport({ type: 'audit', clientName: 'Maple Ltd', yearEnd: '2025-12-31', settings: settings({ opinion: 'unmodified' }), hasCashFlow: true, jurisdiction: ca });
    const text = r.sections.flatMap((s) => s.paragraphs).join(' ');
    expect(r.title).toBe('Independent auditor’s report');
    expect(r.addressee).toBe('To the Shareholders of Maple Ltd');
    expect(text).toContain('the balance sheet as at December 31, 2025, and the statements of income, retained earnings and cash flows for the year then ended');
    expect(text).toContain('present fairly, in all material respects');
    expect(text).toContain('in accordance with Canadian accounting standards for private enterprises');
    expect(text).toContain('Canadian generally accepted auditing standards');
    expect(text).not.toContain('true and fair');
    expect(text).not.toContain('International Standards on Auditing');
    expect(r.sections.map((s) => s.heading)).toContain('Responsibilities of management and those charged with governance for the financial statements');
  });
  it('drafts a CSRE 2400 review engagement report', () => {
    const r = draftReport({ type: 'review', clientName: 'Maple Ltd', yearEnd: '2025-12-31', settings: settings(), hasCashFlow: true, jurisdiction: ca });
    const text = r.sections.flatMap((s) => s.paragraphs).join(' ');
    expect(r.title).toBe('Independent practitioner’s review engagement report');
    expect(text).toContain('Canadian generally accepted standards for review engagements');
    expect(text).toContain('nothing has come to our attention');
  });
  it('drafts a CSRS 4200 compilation engagement report naming Note 1 when the basis is not ASPE', () => {
    const r = draftReport({ type: 'compilation', clientName: 'Maple Ltd', yearEnd: '2025-12-31', settings: settings(), hasCashFlow: false, jurisdiction: ca, specialBasis: true });
    const text = r.sections.flatMap((s) => s.paragraphs).join(' ');
    expect(r.title).toBe('Compilation engagement report');
    expect(r.addressee).toBe('To Management of Maple Ltd');
    expect(text).toContain('On the basis of information provided by management, we have compiled the balance sheet of Maple Ltd as at December 31, 2025');
    expect(text).toContain('Note 1, which describes the basis of accounting');
    expect(text).toContain('Canadian Standard on Related Services (CSRS) 4200, Compilation Engagements');
    expect(text).toContain('Readers are cautioned that the financial information may not be appropriate for their purposes.');
  });
  it('drafts an ASNPO audit report to the members', () => {
    const r = draftReport({ type: 'audit', clientName: 'Trillium Society', yearEnd: '2025-12-31', settings: settings({ opinion: 'unmodified' }), hasCashFlow: true, jurisdiction: ca, npo: { governors: { plural: 'directors', possessive: 'directors’' }, addressee: 'x' } });
    const text = r.sections.flatMap((s) => s.paragraphs).join(' ');
    expect(r.addressee).toBe('To the Members of Trillium Society');
    expect(text).toContain('the statements of operations, changes in net assets and cash flows');
    expect(text).toContain('Canadian accounting standards for not-for-profit organizations');
  });
  it('leaves other countries’ reports as they were', () => {
    setDateLocale('NG');
    const r = draftReport({ type: 'audit', clientName: 'Ade Ltd', yearEnd: '2025-12-31', settings: settings({ opinion: 'unmodified' }), hasCashFlow: true, jurisdiction: JURISDICTIONS.NG });
    expect(r.sections.flatMap((s) => s.paragraphs).join(' ')).toContain('31 December 2025');
  });
});

describe('Canadian content', () => {
  it('says what a not-for-profit’s statute asks for', () => {
    expect(npoRequirement('cnca', true, 300_000_00)?.need).toBe('audit');
    expect(npoRequirement('cnca', true, 40_000_00)?.need).toBe('review');
    expect(npoRequirement('cnca', false, 900_000_00)?.need).toBe('review');
    expect(npoRequirement('onca', true, 90_000_00)?.need).toBe('none');
    expect(npoRequirement('onca', true, 600_000_00)?.need).toBe('audit');
    expect(npoRequirement('society', true, 600_000_00)).toBeNull();
  });
  it('writes the basis of accounting note', () => {
    expect(basisNote('cash-accruals', 'Maple Ltd', 'accounts receivable', '', false)).toContain('reflects cash transactions with the addition of accounts receivable');
    expect(basisNote('aspe', 'Maple Ltd', '', '', false)).toContain('Canadian accounting standards for private enterprises');
  });
  it('words the income tax policy by the method chosen', () => {
    expect(aspePolicies({ npo: false, taxMethod: 'taxes-payable' }).income_tax_expense.text).toContain('taxes payable method');
    expect(aspePolicies({ npo: false, taxMethod: 'future' }).income_tax_expense.text).toContain('future income taxes method');
    expect(aspePolicies({ npo: true, method: 'deferral' }).revenue.text).toContain('deferral method');
  });
});

describe('Canadian sign-off', () => {
  const base = { lines: company, adjustments: [], planning: {}, programme: {}, programmeItemIds: [], firmFrc: '', signerRole: 'partner', signerFrc: '', jurisdiction: ca };
  it('needs the engagement letter and management’s acknowledgment for a compilation', () => {
    const checks = signOffChecks({ ...base, type: 'compilation', report: {} });
    expect(checks.find((c) => c.id === 'ca_letter')).toMatchObject({ ok: false, blocking: true });
    expect(checks.find((c) => c.id === 'ca_ack')).toMatchObject({ ok: false, blocking: true });
    const done = signOffChecks({ ...base, type: 'compilation', report: { engagementLetter: '2026-01-10', managementAck: '2026-03-01', intendedUse: 'the bank' } });
    expect(done.find((c) => c.id === 'ca_letter')?.ok).toBe(true);
    expect(done.some((c) => c.id === 'ca_licence')).toBe(false);
  });
  it('needs the partner’s licence confirmed for an audit or review, and prints no licence numbers', () => {
    const checks = signOffChecks({ ...base, type: 'review', report: {} });
    expect(checks.find((c) => c.id === 'ca_licence')).toMatchObject({ ok: false, blocking: true });
    expect(checks.some((c) => c.id === 'firm_frc' || c.id === 'signer_frc')).toBe(false);
    const ok = signOffChecks({ ...base, type: 'review', report: { licenceConfirmed: { by: 'Sam Lee', at: '2026-03-01', province: 'ON' } } });
    expect(ok.find((c) => c.id === 'ca_licence')?.ok).toBe(true);
  });
});

import { gifiCsv, gifiSchedules, suggestGifi } from './gifi';

describe('GIFI', () => {
  it('suggests codes from the statement line and the account name', () => {
    expect(suggestGifi({ name: 'Bank current account', mapCode: 'cash' })).toBe('1002');
    expect(suggestGifi({ name: 'Bank overdraft', mapCode: 'cash' })).toBe('2600');
    expect(suggestGifi({ name: 'Accumulated amortization – vehicles', mapCode: 'ppe' })).toBe('1743');
    expect(suggestGifi({ name: 'Motor vehicles', mapCode: 'ppe' })).toBe('1742');
    expect(suggestGifi({ name: 'Allowance for doubtful accounts', mapCode: 'trade_receivables' })).toBe('1061');
    expect(suggestGifi({ name: 'Rent', mapCode: 'admin_expenses' })).toBe('8910');
    expect(suggestGifi({ name: 'Salaries and wages', mapCode: 'admin_expenses' })).toBe('9060');
    expect(suggestGifi({ name: 'Sundry', mapCode: 'other_expenses' })).toBe('9270');
    expect(suggestGifi({ name: 'Sales', mapCode: 'revenue' })).toBe('8000');
    expect(suggestGifi({ name: 'Retained earnings', mapCode: 'retained_earnings' })).toBe('3660');
    expect(suggestGifi({ name: 'Unknown', mapCode: null })).toBeNull();
  });
  it('works out the totals the CRA requires, and they agree with the statements', () => {
    const coded = company.map((l) => ({ ...l, gifi: suggestGifi(l) }));
    const st = buildStatements(coded, []);
    const g = gifiSchedules(coded, [], st);
    const at = (code: string) => g.rows.find((r) => r.code === code)?.cur;
    expect(g.uncoded).toEqual([]);
    expect(g.disagreements).toEqual([]);
    expect(at('2599')).toBe(7000);
    expect(at('3499')).toBe(1500);
    expect(at('8299')).toBe(10000);
    expect(at('9368')).toBe(8000);
    expect(at('9999')).toBe(2000);
    expect(at('3849')).toBe(5400);
    expect(at('3640')).toBe(7000);
    expect(g.rows.find((r) => r.code === '2599')?.prior).toBe(4500);
    const csv = gifiCsv(g, '2025', '2024');
    expect(csv.split('\n')[0]).toBe('GIFI code,Description,2025,2024');
    expect(csv).toContain('9999,Net income/loss after taxes and extraordinary items,20.00,10.00');
  });
  it('shows accumulated amortization as a negative amount', () => {
    const tb = [...company, line('veh', 'ppe', 3000, 3000), line('vehacc', 'ppe', -1000, -500)].map((l) => ({ ...l, name: l.id === 'vehacc' ? 'Accumulated amortization vehicles' : l.id === 'veh' ? 'Vehicles' : l.name }));
    const coded = tb.map((l) => ({ ...l, gifi: suggestGifi(l) }));
    const g = gifiSchedules(coded, [], buildStatements(coded, []));
    expect(g.rows.find((r) => r.code === '1743')?.cur).toBe(-1000);
    expect(g.rows.find((r) => r.code === '2009')?.cur).toBe(-1000);
    expect(g.rows.find((r) => r.code === '2589')?.cur).toBe(2000);
  });
  it('lists accounts with a balance and no code', () => {
    const g = gifiSchedules(company, [], buildStatements(company, []));
    expect(g.uncoded.length).toBe(8);
  });
});
