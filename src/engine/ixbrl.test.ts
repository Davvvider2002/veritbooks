import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildIxbrl, publicInterestScore, type IxbrlInput } from './ixbrl';
import { buildStatements } from './statements';
import type { TbLine } from './types';

const R = (n: number) => Math.round(n * 100);
let k = 0;
const line = (mapCode: string, balance: number, prior: number | null): TbLine => ({ id: `l${++k}`, code: String(1000 + k), name: mapCode, balance: R(balance), prior: prior === null ? null : R(prior), mapCode, nature: null });

const lines: TbLine[] = [
  line('ppe', 500_000, 400_000),
  line('trade_receivables', 120_000, 100_000),
  line('cash', 80_000, 50_000),
  line('share_capital', -100_000, -100_000),
  line('retained_earnings', -350_000, -350_000),
  line('trade_payables', -60_000, -100_000),
  line('revenue', -1_000_000, -900_000),
  line('cost_of_sales', 600_000, 500_000),
  line('admin_expenses', 200_000, 400_000),
  line('income_tax_expense', 10_000, 0),
];

const input = (over: Partial<IxbrlInput> = {}): IxbrlInput => ({
  entityName: 'Karoo Traders (Pty) Ltd',
  registrationNumber: '2015/123456/07',
  yearEnd: '2026-02-28',
  yearStart: '2025-03-01',
  currency: 'ZAR',
  currencyName: 'South African rand',
  type: 'audit',
  st: buildStatements(lines, []),
  details: { customerCode: 'ABC123', companyType: 'Private company', beneficialHolders: 2 },
  employees: 12,
  directors: ['T. Nkosi', 'A. van Wyk'],
  principalActivity: 'wholesale of building materials',
  blocks: { directorsReport: '<p>The directors present their report.</p>', responsibilities: '<p>The directors are responsible.</p>', report: '<p>Opinion</p>', policies: '<p>Policies.</p>', notes: '<p>Notes &amp; more.</p>' },
  software: { name: 'VeritBooks', version: '1.0' },
  ...over,
});

describe('public interest score', () => {
  it('adds employees, a point per R1 million or part of it, and beneficial holders', () => {
    const s = publicInterestScore({ employees: 40, thirdPartyLiabilities: R(2_500_000), turnover: R(30_000_000), beneficialHolders: 3 });
    expect([s.liabilities, s.turnover, s.total]).toEqual([3, 30, 76]);
    expect(s.meaning).toContain('independent review');
    expect(publicInterestScore({ employees: 300, thirdPartyLiabilities: 0, turnover: R(60_000_000) }).meaning).toContain('requires an audit');
  });
});

describe('the iXBRL file', () => {
  const { xhtml, facts, missing } = buildIxbrl(input());

  it('is one XHTML document with the inline XBRL header', () => {
    expect(xhtml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xhtml).toContain('xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"');
    expect(xhtml.match(/<ix:header>/g)).toHaveLength(1);
    expect(xhtml).toContain('<link:schemaRef xlink:type="simple"');
    expect(xhtml).toContain('<xbrli:identifier scheme="http://www.cipc.co.za">2015/123456/07</xbrli:identifier>');
    expect(xhtml).toContain('<xbrli:measure>iso4217:ZAR</xbrli:measure>');
    expect(facts).toBeGreaterThan(40);
  });

  it('tags the figures CIPC makes mandatory', () => {
    for (const c of [
      'ifrs-full:Revenue',
      'ifrs-full:ProfitLossBeforeTax',
      'ifrs-full:IncomeTaxExpenseContinuingOperations',
      'ifrs-full:ProfitLoss',
      'ifrs-full:ComprehensiveIncome',
      'ifrs-full:OtherComprehensiveIncome',
      'ifrs-full:Assets',
      'ifrs-full:Equity',
      'ifrs-full:Liabilities',
      'ifrs-full:EquityAndLiabilities',
      'ifrs-full:CashAndCashEquivalents',
      'ifrs-full:CashFlowsFromUsedInOperatingActivities',
      'ifrs-full:CashFlowsFromUsedInInvestingActivities',
      'ifrs-full:CashFlowsFromUsedInFinancingActivities',
      'ifrs-full:IncreaseDecreaseInCashAndCashEquivalents',
      'ifrs-full:ChangesInEquity',
      'cipc-ca:Turnover',
      'cipc-ca:ThirdPartyLiabilities',
      'cipc-ca:PublicInterestScore',
      'cipc-ca:RegistrationNumberOfCompany',
      'cipc-ca:CustomerCode',
      'cipc:DisclosureOfDirectorsReportExplanatory',
      'cipc:DisclosureOfDirectorsResponsibilityExplanatory',
    ])
      expect(xhtml, c).toContain(`name="${c}"`);
  });

  it('gives each fact the sign of its concept, and keeps the brackets outside the tag', () => {
    // Cost of sales shows as (600,000) and is reported as a positive expense.
    expect(xhtml).toMatch(/\(<ix:nonFraction name="ifrs-full:CostOfSales" id="f\d+" contextRef="CY" unitRef="ZAR" decimals="0" format="ixt:num-dot-decimal">600,000<\/ix:nonFraction>\)/);
    // Profit before tax of 200,000 is positive.
    expect(xhtml).toMatch(/name="ifrs-full:ProfitLossBeforeTax"[^>]*contextRef="CY"[^>]*>200,000</);
    // The investing outflow is negative.
    expect(xhtml).toMatch(/name="ifrs-full:CashFlowsFromUsedInInvestingActivities"[^>]*sign="-"/);
    // Opening cash belongs to the prior year end.
    expect(xhtml).toMatch(/name="ifrs-full:CashAndCashEquivalents" id="f\d+" contextRef="PY_I"[^>]*>50,000</);
  });

  it('lists what is still needed', () => {
    expect(missing).toContain('Email address of company');
    expect(missing).not.toContain('Customer code');
  });

  it('leaves out the directors block until they are named', () => {
    const r = buildIxbrl(input({ directors: [] }));
    expect(r.xhtml).not.toContain('<ul></ul>');
    expect(r.missing).toContain('Names of the directors');
  });

  it('escapes the company name and adds a footnote to nil turnover', () => {
    const r = buildIxbrl(input({ entityName: 'A & B <Pty> Ltd', details: { turnover: 0 } }));
    expect(r.xhtml).toContain('A &amp; B &lt;Pty&gt; Ltd');
    expect(r.xhtml).toContain('The company had no turnover in the year.');
    expect(r.xhtml).toMatch(/<ix:relationship fromRefs="f\d+" toRefs="fn1"\/>/);
  });
});

// For checking the file with Arelle against a stub taxonomy: IXBRL_OUT=/path/file.xhtml IXBRL_ENTRY=stub.xsd npx vitest run src/engine/ixbrl.test.ts
if (process.env.IXBRL_OUT) {
  const full = input({
    details: {
      customerCode: 'ABC123', companyType: 'Private company', beneficialHolders: 2, complianceName: 'T. Nkosi', designatedName: 'A. van Wyk', designatedPhone: '+27 11 555 0100',
      email: 'finance@karoo.example', street: '1 Main Road', city: 'Johannesburg', postalCode: '2001', principalPlace: 'Johannesburg', approvalDate: '2026-05-20',
      publicationDate: '2026-05-21', authorisedDirector: 'T. Nkosi', preparerName: 'L. Dlamini', preparerDesignation: 'CA(SA)', turnover: 0, entryPoint: process.env.IXBRL_ENTRY,
    },
  });
  writeFileSync(process.env.IXBRL_OUT, buildIxbrl(full).xhtml);
}
