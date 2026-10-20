import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { JURISDICTIONS, frameworkText } from '../content/jurisdictions';
import { COUNTRY_PRICING, planQuote, PLANS, priceText } from './billing';
import { signOffChecks } from './checks';
import { parseAmount } from './money';
import { draftReport } from './report';

const audit = (code: keyof typeof JURISDICTIONS) =>
  draftReport({
    type: 'audit',
    clientName: 'Kumasi Traders Limited',
    yearEnd: '2025-12-31',
    settings: { opinion: 'unmodified' },
    hasCashFlow: true,
    jurisdiction: JURISDICTIONS[code],
  });
const text = (r: ReturnType<typeof audit>) => r.sections.flatMap((s) => [s.heading, ...s.paragraphs]).join('\n');

describe('report wording follows the firm’s country', () => {
  it('keeps the Nigerian wording unchanged', () => {
    const t = text(audit('NG'));
    expect(t).toContain('the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011');
    expect(t).toContain('financial statements in Nigeria');
    expect(t).toContain('the statement of value added and the financial summary');
    expect(t).toContain('In accordance with the requirements of the Companies and Allied Matters Act 2020, we confirm that:');
  });

  it('cites the Ghana Companies Act and leaves out the Nigerian statements', () => {
    const t = text(audit('GH'));
    expect(t).toContain('the IFRS for SMEs Accounting Standard and the Companies Act, 2019 (Act 992)');
    expect(t).toContain('financial statements in Ghana');
    expect(t).toContain('In accordance with the requirements of the Companies Act, 2019 (Act 992), we confirm that:');
    expect(t).not.toMatch(/Nigeria|value added|Allied Matters/);
  });

  it('gives Liberia the LICPA framework and no companies act confirmations', () => {
    const t = text(audit('LR'));
    expect(t).toContain('the IFRS for SMEs Accounting Standard, as adopted by the Liberian Institute of Certified Public Accountants');
    expect(t).not.toContain('Report on other legal and regulatory requirements');
  });

  it('names a law for every other country', () => {
    expect(frameworkText(JURISDICTIONS.SL)).toBe('the IFRS for SMEs Accounting Standard and the Companies Act 2009');
    expect(frameworkText(JURISDICTIONS.GM)).toBe('the IFRS for SMEs Accounting Standard, the Companies Act, 2013 and the Financial Reporting Act 2013');
  });
});

describe('sign-off checks name the local licence', () => {
  const base = {
    type: 'audit' as const,
    lines: [],
    adjustments: [],
    planning: {},
    programme: {},
    programmeItemIds: [],
    report: { opinion: 'unmodified' as const, ceoName: 'Ama Owusu', cfoName: 'Kwame Boateng' },
    firmFrc: '',
    signerRole: 'partner',
    signerFrc: '',
  };
  it('asks a Ghanaian firm for ICAG numbers, and its directors for none', () => {
    const checks = signOffChecks({ ...base, jurisdiction: JURISDICTIONS.GH });
    expect(checks.find((c) => c.id === 'firm_frc')?.label).toBe('The firm’s ICAG practising licence number is on file');
    expect(checks.find((c) => c.id === 'directors')?.ok).toBe(true);
  });
  it('asks for Nigerian directors’ FRC numbers without requiring them', () => {
    const checks = signOffChecks({ ...base, jurisdiction: JURISDICTIONS.NG });
    expect(checks.find((c) => c.id === 'directors')?.ok).toBe(true);
    const numbers = checks.find((c) => c.id === 'officer_numbers')!;
    expect(numbers.label).toContain('FRC number');
    expect(numbers.blocking).toBe(false);
  });
});

describe('prices by country', () => {
  it('match the database’s starting price lists', () => {
    const sql = readFileSync('supabase/migrations/0016_west_africa.sql', 'utf8');
    const gh = COUNTRY_PRICING.find((c) => c.code === 'GH')!;
    expect(sql).toContain(`('GH', 'solo', ${gh.plans.solo}), ('GH', 'practice', ${gh.plans.practice}), ('GH', 'firm', ${gh.plans.firm})`);
    expect(sql).toContain(`('GH', 'compilation', ${gh.engagements.compilation}), ('GH', 'review', ${gh.engagements.review}), ('GH', 'audit', ${gh.engagements.audit}), ('GH', 'group', ${gh.engagements.group})`);
    for (const code of ['SL', 'LR', 'GM'] as const) {
      const c = COUNTRY_PRICING.find((x) => x.code === code)!;
      expect(c.currency).toBe('USD');
      expect(sql).toContain(`('${code}', 'solo', ${c.plans.solo}), ('${code}', 'practice', ${c.plans.practice}), ('${code}', 'firm', ${c.plans.firm})`);
    }
    const ng = COUNTRY_PRICING[0];
    expect(PLANS.find((p) => p.code === 'solo')!.priceKobo).toBe(ng.plans.solo);
  });

  it('formats each currency', () => {
    expect(priceText(180_000_00, 'NGN')).toBe('₦180,000');
    expect(priceText(1_500_00, 'GHS')).toBe('GH₵1,500');
    expect(priceText(99_00, 'USD')).toBe('US$99');
    expect(priceText(43_50, 'USD')).toBe('US$43.50');
  });

  it('keeps a dollar, not a thousand naira, as the least an upgrade costs in US dollars', () => {
    const sub = { trialEndsAt: '2025-01-01', plan: 'solo' as const, paidUntil: '2027-01-01T00:00:00Z', foundingNumber: null, priceLockUntil: null, lockedPrices: null, hasPaid: true };
    const usd = COUNTRY_PRICING.find((c) => c.code === 'LR')!;
    const plans = PLANS.map((p) => ({ ...p, priceKobo: p.code === 'trial' ? 0 : usd.plans[p.code] }));
    const now = new Date('2026-01-02T00:00:00Z');
    const q = planQuote(sub, plans[2], plans, 20, [{ valueKobo: 1_000_000_00, coversUntil: '2027-01-01T00:00:00Z' }], now, usd.minCharge);
    expect(q.mode).toBe('upgrade');
    expect(q.amountKobo).toBe(1_00);
  });
});

describe('amounts in other currencies', () => {
  it('reads cedi, dollar and leone amounts from a trial balance', () => {
    expect(parseAmount('GH₵1,234.50')).toBe(123450);
    expect(parseAmount('US$ 2,000')).toBe(200000);
    expect(parseAmount('(Le 500.00)')).toBe(-50000);
    expect(parseAmount('1,000.00 Cr')).toBe(-100000);
    expect(parseAmount('₦1,234')).toBe(123400);
  });
});

describe('South Africa', () => {
  it('words the audit report as IRBA’s illustrative reports do', () => {
    const t = text(audit('ZA'));
    expect(t).toContain('in accordance with the IFRS for SMEs Accounting Standard and the requirements of the Companies Act of South Africa');
    expect(t).toContain('Code of Professional Conduct for Registered Auditors (IRBA Code)');
    expect(t).not.toContain('Report on other legal and regulatory requirements');
    expect(t).not.toMatch(/Nigeria|value added/);
  });

  it('is priced in rand, as the database starts it', () => {
    const sql = readFileSync('supabase/migrations/0018_south_africa.sql', 'utf8');
    const za = COUNTRY_PRICING.find((c) => c.code === 'ZA')!;
    expect(za.currency).toBe('ZAR');
    expect(sql).toContain(`('ZA', 'solo', ${za.plans.solo}), ('ZA', 'practice', ${za.plans.practice}), ('ZA', 'firm', ${za.plans.firm})`);
    expect(sql).toContain(`('ZA', 'compilation', ${za.engagements.compilation}), ('ZA', 'review', ${za.engagements.review}), ('ZA', 'audit', ${za.engagements.audit}), ('ZA', 'group', ${za.engagements.group})`);
    expect(priceText(za.plans.solo, 'ZAR')).toBe('R3,500');
  });

  it('reads rand amounts from a trial balance', () => {
    expect(parseAmount('R1,234.50')).toBe(123450);
    expect(parseAmount('ZAR 2,000')).toBe(200000);
  });
});
