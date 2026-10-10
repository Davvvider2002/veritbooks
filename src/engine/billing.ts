// The free trial, the annual plans and the founding firm offer. The database applies the
// same rules (supabase/migrations/0009_billing.sql); a unit test keeps the two in step.
import type { Kobo } from './types';

export const TRIAL_DAYS = 14;
export const FOUNDING_PLACES = 20;
/** Founding firms pay 60% of the list price for their first year. */
export const FOUNDING_PERCENT = 60;
export const PRICE_HOLD_YEARS = 2;

export interface Plan {
  code: 'trial' | 'solo' | 'practice' | 'firm';
  name: string;
  priceKobo: Kobo;
  /** null means no limit. */
  maxUsers: number | null;
  /** New engagements in a paid year. In the trial, engagements in total. */
  maxEngagements: number;
}

export const PLANS: Plan[] = [
  { code: 'trial', name: 'Free trial', priceKobo: 0, maxUsers: 3, maxEngagements: 3 },
  { code: 'solo', name: 'Solo', priceKobo: 180_000_00, maxUsers: 3, maxEngagements: 15 },
  { code: 'practice', name: 'Practice', priceKobo: 480_000_00, maxUsers: 8, maxEngagements: 50 },
  { code: 'firm', name: 'Firm', priceKobo: 1_200_000_00, maxUsers: null, maxEngagements: 150 },
];
export const planOf = (code: string): Plan => PLANS.find((p) => p.code === code) ?? PLANS[0];

export interface Subscription {
  trialEndsAt: string;
  plan: Plan['code'];
  paidUntil: string | null;
  foundingNumber: number | null;
  priceLockUntil: string | null;
  lockedPrices: Record<string, Kobo> | null;
  hasPaid: boolean;
}

export type FirmState = 'trial' | 'active' | 'expired';

export function firmState(s: Pick<Subscription, 'trialEndsAt' | 'paidUntil'>, now: Date): FirmState {
  if (s.paidUntil && new Date(s.paidUntil) > now) return 'active';
  return new Date(s.trialEndsAt) > now ? 'trial' : 'expired';
}

/** The plan whose limits apply now. A lapsed firm keeps the limits of the trial. */
export const currentPlan = (s: Subscription, now: Date): Plan => (firmState(s, now) === 'active' ? planOf(s.plan) : PLANS[0]);

/** Whole days left, counting a part day as a day. Never negative. */
export function daysLeft(until: string | null, now: Date): number {
  if (!until) return 0;
  return Math.max(0, Math.ceil((new Date(until).getTime() - now.getTime()) / 86_400_000));
}

/** What a firm pays today for a year of a plan. foundingTaken counts places already gone. */
export function quote(s: Subscription, plan: Plan, foundingTaken: number, now: Date): { amountKobo: Kobo; listKobo: Kobo; founding: boolean } {
  const listKobo = plan.priceKobo;
  if (s.foundingNumber !== null) {
    const held = s.priceLockUntil && new Date(s.priceLockUntil) > now ? s.lockedPrices?.[plan.code] : undefined;
    return { amountKobo: held === undefined ? listKobo : Math.min(listKobo, held), listKobo, founding: false };
  }
  if (!s.hasPaid && foundingTaken < FOUNDING_PLACES) return { amountKobo: Math.round((listKobo * FOUNDING_PERCENT) / 100), listKobo, founding: true };
  return { amountKobo: listKobo, listKobo, founding: false };
}

export const addYears = (from: Date, years: number): string => {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
};
