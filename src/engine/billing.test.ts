import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLANS, TRIAL_DAYS, currentPlan, daysLeft, firmState, planOf, quote, type Subscription } from './billing';

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
});
