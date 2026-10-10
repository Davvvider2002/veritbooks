import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENGAGEMENT_PRICES, PLANS, TRIAL_DAYS, currentPlan, daysLeft, firmState, planOf, planQuote, quote, unusedCredit, vatOn, vatWithin, type Subscription } from './billing';

const now = new Date('2026-10-10T12:00:00Z');
const sub = (over: Partial<Subscription> = {}): Subscription => ({
  trialEndsAt: '2026-10-24T12:00:00Z', plan: 'trial', paidUntil: null, foundingNumber: null, priceLockUntil: null, lockedPrices: null, hasPaid: false, ...over,
});

describe('trial and plans', () => {
  it('moves from trial to expired to active', () => {
    expect(firmState(sub(), now)).toBe('trial');
    expect(firmState(sub({ trialEndsAt: '2026-10-10T11:59:00Z' }), now)).toBe('expired');
    expect(firmState(sub({ trialEndsAt: '2026-01-01T00:00:00Z', paidUntil: '2027-10-10T12:00:00Z' }), now)).toBe('active');
    expect(firmState(sub({ paidUntil: '2026-10-09T12:00:00Z', trialEndsAt: '2026-01-01T00:00:00Z' }), now)).toBe('expired');
  });
  it('counts days left, a part day as a day', () => {
    expect(daysLeft('2026-10-24T12:00:00Z', now)).toBe(TRIAL_DAYS);
    expect(daysLeft('2026-10-10T13:00:00Z', now)).toBe(1);
    expect(daysLeft('2026-10-01T00:00:00Z', now)).toBe(0);
  });
  it('gives a lapsed firm the limits of the trial', () => {
    expect(currentPlan(sub({ plan: 'firm', paidUntil: '2026-01-01T00:00:00Z' }), now).code).toBe('trial');
    expect(currentPlan(sub({ plan: 'firm', paidUntil: '2027-01-01T00:00:00Z' }), now).maxUsers).toBeNull();
  });
  it('prices the founding offer at 40% off while places remain', () => {
    expect(quote(sub(), planOf('solo'), 0, now)).toEqual({ amountKobo: 108_000_00, listKobo: 180_000_00, founding: true });
    expect(quote(sub(), planOf('firm'), 19, now).amountKobo).toBe(720_000_00);
    expect(quote(sub(), planOf('solo'), 20, now)).toEqual({ amountKobo: 180_000_00, listKobo: 180_000_00, founding: false });
    expect(quote(sub({ hasPaid: true }), planOf('solo'), 0, now).founding).toBe(false);
  });
  it('holds a founding firm at the prices of the day it joined, for as long as they are held', () => {
    const f = sub({ foundingNumber: 3, hasPaid: true, priceLockUntil: '2028-01-01T00:00:00Z', lockedPrices: { solo: 150_000_00 } });
    expect(quote(f, planOf('solo'), 5, now).amountKobo).toBe(150_000_00);
    expect(quote({ ...f, priceLockUntil: '2026-01-01T00:00:00Z' }, planOf('solo'), 5, now).amountKobo).toBe(180_000_00);
  });
  it('matches the plans in the database migration', () => {
    const sql = readFileSync('supabase/migrations/0009_billing.sql', 'utf8');
    for (const p of PLANS) {
      const row = new RegExp(`\\('${p.code}',\\s*'${p.name}',\\s*${p.priceKobo},\\s*${p.maxUsers ?? 'null'},\\s*${p.maxEngagements},`);
      expect(sql).toMatch(row);
    }
    expect(sql).toContain(`interval '${TRIAL_DAYS} days'`);
  });
  it('credits the unused part of the year when moving to a bigger plan', () => {
    const paid = sub({ plan: 'solo', paidUntil: '2027-04-10T12:00:00Z', hasPaid: true, trialEndsAt: '2026-01-01T00:00:00Z' });
    const pays = [{ valueKobo: 180_000_00, coversUntil: '2027-04-10T12:00:00Z' }];
    expect(Math.abs(unusedCredit(pays, now) - 90_000_00)).toBeLessThan(40_000);
    const up = planQuote(paid, planOf('practice'), PLANS, 20, pays, now);
    expect(up.mode).toBe('upgrade');
    expect(up.amountKobo + up.creditKobo).toBe(480_000_00);
    expect(planQuote(paid, planOf('solo'), PLANS, 20, pays, now).mode).toBe('renew');
    expect(planQuote({ ...paid, plan: 'firm' }, planOf('solo'), PLANS, 20, pays, now).mode).toBe('later');
    expect(planQuote({ ...paid, plan: 'firm', paidUntil: '2026-10-30T12:00:00Z' }, planOf('solo'), PLANS, 20, pays, now).mode).toBe('switch');
    expect(planQuote(sub(), planOf('solo'), PLANS, 0, [], now).mode).toBe('new');
  });
  it('never credits more than leaves 1,000 naira to pay', () => {
    const paid = sub({ plan: 'solo', paidUntil: '2028-10-10T12:00:00Z', hasPaid: true });
    const pays = [{ valueKobo: 900_000_00, coversUntil: '2027-10-10T12:00:00Z' }];
    expect(planQuote(paid, planOf('practice'), PLANS, 20, pays, now).amountKobo).toBe(1_000_00);
  });
  it('matches the engagement prices in the database migration', () => {
    const sql = readFileSync('supabase/migrations/0010_admin_and_pay_per.sql', 'utf8');
    for (const p of ENGAGEMENT_PRICES) expect(sql).toMatch(new RegExp(`\\('${p.code}',\\s*'${p.name}',\\s*${p.priceKobo},`));
  });
  it('adds VAT on top, and finds it inside an inclusive amount', () => {
    expect(vatOn(108_000_00, 7.5)).toBe(8_100_00);
    expect(vatWithin(116_100_00, 7.5)).toBe(8_100_00);
    expect(vatOn(40_000_00, 0)).toBe(0);
    expect(readFileSync('supabase/migrations/0011_vat.sql', 'utf8')).toContain('default 7.5');
  });
});
