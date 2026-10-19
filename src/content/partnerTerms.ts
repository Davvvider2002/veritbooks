import { priceText } from '../engine/billing';
import type { PartnerProgramme } from '../engine/partners';

/**
 * The partner terms, written from the programme's settings so the figures always match what
 * the software applies. Starter wording: have it reviewed by a lawyer before the programme opens.
 */
export function partnerTerms(p: PartnerProgramme): { heading: string; text: string }[] {
  const months = p.months === null ? 'for as long as the firm pays' : `for ${p.months} months from the date the firm was referred`;
  const mins = Object.entries(p.min_payout)
    .map(([c, v]) => priceText(v, c))
    .join(', ');
  return [
    {
      heading: 'Referrals',
      text: `A firm is credited to you when it signs up through your link within ${p.cookie_days} days of the visit, or enters your referral code when it sets up. A firm can be credited to one partner only, and only before it has paid for anything. You may not refer your own firm, or a firm you own or work for.`,
    },
    {
      heading: 'Commission',
      text: `You earn ${p.percent}% of every payment a firm you referred makes ${months}, measured on the amount paid excluding VAT, in the currency the firm paid in. Trials, credits and amounts given without payment earn nothing. VeritBooks may set a different rate in writing for your account.`,
    },
    {
      heading: 'Hold and reversals',
      text: `Each commission is held for ${p.hold_days} days after the payment, so refunds and disputes can come to light. A commission on a payment that is refunded, reversed or found to be fraudulent is cancelled, and if it has already been paid it may be deducted from later commissions.`,
    },
    {
      heading: 'Payouts',
      text: `Once commissions clear the hold, you can ask for a payout of your available balance in each currency. The least that can be paid at once is ${mins}, by currency. VeritBooks pays by bank transfer or mobile money to the details on your profile and records the transfer reference in your portal. You are responsible for the tax on what you earn.`,
    },
    {
      heading: 'Promotion',
      text: 'Describe VeritBooks accurately, and say that you earn a commission when you recommend it. Do not send unsolicited bulk messages, bid on the VeritBooks name in search advertising, pose as VeritBooks, or offer discounts VeritBooks has not approved. Follow the data protection law of each country you promote in.',
    },
    {
      heading: 'Ending',
      text: 'Either side may end the arrangement at any time. VeritBooks may suspend an account that breaks these terms, and commissions earned through a breach are cancelled. Commissions properly earned before the end are paid in the usual way.',
    },
  ];
}
