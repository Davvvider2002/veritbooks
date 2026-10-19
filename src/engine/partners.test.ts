import { describe, expect, it } from 'vitest';
import {
  balancesOf,
  campaignTag,
  commissionOn,
  commissionState,
  monthlyReport,
  newCode,
  referralLink,
  sameCompanyDomain,
  shareMessages,
  toCsv,
  validCode,
  withinPeriod,
} from './partners';

describe('codes and links', () => {
  it('makes a code from the first name and keeps it unique', () => {
    const taken = new Set(['THANDI10']);
    let n = 0;
    const code = newCode('Thandi Nkosi', (c) => taken.has(c), () => [0, 0.5][n++] ?? 0.5);
    expect(code).toBe('THANDI505');
    expect(newCode('Al', () => false, () => 0)).toBe('VBAL10');
    expect(validCode('thandi505')).toBe(true);
    expect(validCode('AB')).toBe(false);
  });

  it('builds a link with the code, a campaign and a country', () => {
    expect(referralLink('thandi505')).toBe('https://veritbooks.com/?ref=THANDI505');
    expect(referralLink('THANDI505', { campaign: 'SAIPA Webinar, Nov', country: 'ZA' })).toBe('https://veritbooks.com/?ref=THANDI505&c=saipa-webinar-nov&country=ZA');
    expect(campaignTag('  LinkedIn!!  ')).toBe('linkedin');
  });

  it('puts the link and code into every ready-made message', () => {
    const msgs = shareMessages({ name: 'Thandi', code: 'THANDI505' }, (c) => referralLink('THANDI505', { campaign: c }));
    expect(msgs.map((m) => m.channel)).toEqual(['Email', 'WhatsApp', 'LinkedIn', 'X']);
    expect(msgs[0].text).toContain('c=email');
    expect(msgs[1].text).toContain('THANDI505');
    expect(msgs.every((m) => !/ — | – /.test(m.text))).toBe(true);
  });
});

describe('commission', () => {
  it('is a share of the payment net of VAT, rounded down', () => {
    expect(commissionOn(95_000, 20)).toBe(19_000);
    expect(commissionOn(12_345, 20)).toBe(2_469);
  });

  it('runs for the months set from the referral, or for good', () => {
    expect(withinPeriod('2026-01-15T00:00:00Z', '2027-01-14T00:00:00Z', 12)).toBe(true);
    expect(withinPeriod('2026-01-15T00:00:00Z', '2027-01-16T00:00:00Z', 12)).toBe(false);
    expect(withinPeriod('2020-01-01T00:00:00Z', '2030-01-01T00:00:00Z', null)).toBe(true);
  });

  it('holds a commission until its date, then makes it available', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const list = [
      { currency: 'ZAR', status: 'pending' as const, amount_kobo: 100, available_at: '2026-07-01T00:00:00Z' },
      { currency: 'ZAR', status: 'pending' as const, amount_kobo: 200, available_at: '2026-05-01T00:00:00Z' },
      { currency: 'ZAR', status: 'paid' as const, amount_kobo: 50, available_at: '2026-01-01T00:00:00Z' },
      { currency: 'NGN', status: 'review' as const, amount_kobo: 70, available_at: '2026-01-01T00:00:00Z' },
      { currency: 'NGN', status: 'void' as const, amount_kobo: 999, available_at: '2026-01-01T00:00:00Z' },
    ];
    expect(balancesOf(list, now)).toEqual({
      ZAR: { review: 0, held: 100, available: 200, requested: 0, paid: 50 },
      NGN: { review: 70, held: 0, available: 0, requested: 0, paid: 0 },
    });
    expect(commissionState(list[0], now)).toBe('Held');
    expect(commissionState(list[1], now)).toBe('Available');
  });

  it('holds a referral from the partner’s own company domain, not from a free mailbox', () => {
    expect(sameCompanyDomain('a@growth.co.za', 'b@GROWTH.co.za')).toBe(true);
    expect(sameCompanyDomain('a@gmail.com', 'b@gmail.com')).toBe(false);
  });
});

describe('reports', () => {
  it('totals clicks, referrals, sales, commission and payouts by month, partner and currency', () => {
    const rows = monthlyReport({
      partners: [{ id: 'p1', name: 'Lindiwe', company: 'Growth Agency', code: 'LINDIWE10' } as never],
      clicks: [{ partner_id: 'p1', month: '2026-10', campaign: 'linkedin', clicks: 40 }],
      referrals: [{ firm_id: 'f', firm: 'Cape', country: 'ZA', partner_id: 'p1', referred_at: '2026-10-03T00:00:00Z', campaign: '', review: null, state: 'trial' }],
      commissions: [
        { id: 'c', partner_id: 'p1', firm: 'Cape', currency: 'ZAR', base_kobo: 95_000, percent: 20, amount_kobo: 19_000, status: 'pending', created_at: '2026-10-20T00:00:00Z', available_at: '', payout_id: null, void_reason: '', kind: 'plan' },
        { id: 'v', partner_id: 'p1', firm: 'Cape', currency: 'ZAR', base_kobo: 1, percent: 20, amount_kobo: 1, status: 'void', created_at: '2026-10-20T00:00:00Z', available_at: '', payout_id: null, void_reason: 'refund', kind: 'plan' },
      ],
      payouts: [{ id: 'o', partner_id: 'p1', currency: 'ZAR', amount_kobo: 19_000, status: 'paid', requested_at: '', decided_at: '2026-11-30T00:00:00Z', reference: 'EFT', method: '', note: '' }],
    });
    expect(rows.map((r) => [r.month, r.currency, r.clicks, r.referrals, r.sales, r.commission, r.paid])).toEqual([
      ['2026-11', 'ZAR', 0, 0, 0, 0, 19_000],
      ['2026-10', '', 40, 1, 0, 0, 0],
      ['2026-10', 'ZAR', 0, 0, 95_000, 19_000, 0],
    ]);
  });

  it('writes CSV that a spreadsheet opens safely', () => {
    expect(toCsv([['Name', 'Note'], ['A, B', '=HYPERLINK("x")'], ['-12.50', 'He said "hi"']])).toBe(
      'Name,Note\r\n"A, B","\'=HYPERLINK(""x"")"\r\n-12.50,"He said ""hi"""\r\n',
    );
  });
});
