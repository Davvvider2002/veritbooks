import { daysBetween } from './dates';
import type { Figures } from './statements';
import type { Kobo } from './types';

/**
 * South African company income tax: the computation of taxable income and current tax, provisional
 * tax (IRP6) and deferred tax under Section 29 of the IFRS for SMEs Accounting Standard.
 *
 * Sources, checked October 2026:
 * - Rates and the small business corporation tables: SARS, "Companies, Trusts and Small Business
 *   Corporations (SBC)". https://www.sars.gov.za/tax-rates/income-tax/companies-trusts-and-small-business-corporations-sbc/
 * - Assessed losses: section 20(1)(a) of the Income Tax Act as amended for years of assessment ending
 *   on or after 31 March 2023. The set-off is limited to the greater of R1 million and 80% of taxable
 *   income before the set-off.
 * - Provisional tax: Fourth Schedule to the Income Tax Act. Paragraph 19 (basic amount, increased by
 *   8% a year where the last assessment is more than 18 months old), paragraph 20 (the 20% penalty for
 *   an underestimate), paragraph 21 and section 89quat (interest), and the 10% late payment penalty.
 *
 * Every figure is a working paper for the engagement partner, who must check the rates and the
 * treatment against the law in force for the year of assessment.
 */

export type TaxMode = 'flat' | 'sbc';

export interface TaxItem {
  label: string;
  /** Always entered as a positive figure; kind says which way it goes. */
  amount: Kobo;
  kind: 'add' | 'deduct';
}

export interface DeferredRow {
  label: string;
  kind: 'asset' | 'liability';
  carrying: Kobo;
  taxBase: Kobo;
  /** The chart line the carrying amount follows, so it stays in step with the statements. */
  source?: string;
}

export interface ProvisionalPayment {
  /** The taxable income the company estimated for the year when it made this payment. */
  estimate?: Kobo;
  paid?: Kobo;
  /** The date the payment reached SARS, yyyy-mm-dd. */
  date?: string;
}

export interface ProvisionalWorking {
  /** Taxable income of the latest year SARS has assessed. */
  basicTaxable?: Kobo;
  /** The year end of that assessed year, yyyy-mm-dd. */
  basicYearEnd?: string;
  first?: ProvisionalPayment;
  second?: ProvisionalPayment;
  third?: ProvisionalPayment;
  /** The prescribed rate of interest, percent a year, for interest on underpayment. Not assumed. */
  interestRate?: number;
  /** The date to which interest runs: the assessment, or the date the balance is paid. */
  interestTo?: string;
}

export interface TaxWorking {
  mode: TaxMode;
  /** Percent. Used for the flat rate, and as the rate for deferred tax unless deferredRate is set. */
  rate: number;
  items: TaxItem[];
  /** The balance of assessed loss brought forward from the previous year of assessment. */
  lossBroughtForward: Kobo;
  deferredRate?: number;
  deferred: DeferredRow[];
  /** Recognise a deferred tax asset on the assessed loss carried forward. Only where future taxable profit is probable. */
  recogniseLoss: boolean;
  provisional?: ProvisionalWorking;
  /** The accounts each journal posts to, by TB line id. */
  accounts?: { expense?: string; payable?: string; deferred?: string };
}

const R = (rand: number): Kobo => rand * 100;

/** The small business corporation table for one span of years of assessment, in rand. */
export interface SbcTable {
  /** Years of assessment ending on or after this date… */
  from: string;
  /** …and on or before this date. */
  to: string;
  label: string;
  /** [threshold, tax at the threshold, rate above it] for each band, the first band at nil. */
  bands: [number, number, number][];
}

export const SBC_TABLES: SbcTable[] = [
  {
    from: '2026-04-01',
    to: '2027-03-31',
    label: 'years of assessment ending 1 April 2026 to 31 March 2027',
    bands: [
      [0, 0, 0],
      [99_000, 0, 7],
      [365_000, 18_620, 21],
      [550_000, 57_470, 27],
    ],
  },
  {
    from: '2023-04-01',
    to: '2026-03-31',
    label: 'years of assessment ending 1 April 2023 to 31 March 2026',
    bands: [
      [0, 0, 0],
      [95_750, 0, 7],
      [365_000, 18_848, 21],
      [550_000, 57_698, 27],
    ],
  },
  {
    from: '2023-03-31',
    to: '2023-03-31',
    label: 'years of assessment ending on 31 March 2023',
    bands: [
      [0, 0, 0],
      [91_250, 0, 7],
      [365_000, 19_163, 21],
      [550_000, 58_013, 27],
    ],
  },
  {
    from: '2022-04-01',
    to: '2023-03-30',
    label: 'years of assessment ending 1 April 2022 to 30 March 2023',
    bands: [
      [0, 0, 0],
      [91_250, 0, 7],
      [365_000, 19_163, 21],
      [550_000, 58_013, 28],
    ],
  },
];

export const sbcTable = (yearEnd: string): SbcTable | null => SBC_TABLES.find((t) => yearEnd >= t.from && yearEnd <= t.to) ?? null;

/** The company rate for a year of assessment: 27% for years ending on or after 31 March 2023, 28% before. */
export const companyRate = (yearEnd: string): number => (yearEnd >= '2023-03-31' ? 27 : 28);

/** A fresh working: the company rate, nothing added back yet, and the balances the statements already hold. */
export function startingWorking(yearEnd: string, cur: Figures): TaxWorking {
  const items: TaxItem[] = [];
  if (cur.depreciation !== 0) items.push({ label: 'Depreciation and amortisation charged in the accounts', amount: Math.abs(cur.depreciation), kind: 'add' });
  return {
    mode: 'flat',
    rate: companyRate(yearEnd),
    items,
    lossBroughtForward: 0,
    deferred: [
      { label: 'Property, plant and equipment', kind: 'asset', carrying: 0, taxBase: 0, source: 'ppe' },
      { label: 'Provisions', kind: 'liability', carrying: 0, taxBase: 0, source: 'provisions' },
    ],
    recogniseLoss: false,
    provisional: {},
  };
}

const pct = (amount: Kobo, rate: number): Kobo => Math.round((amount * rate) / 100);

/** Tax on a taxable income, at the flat rate or on the SBC table for the year. Nil on a loss. */
export function taxOn(taxable: Kobo, mode: TaxMode, rate: number, yearEnd: string): Kobo {
  if (taxable <= 0) return 0;
  if (mode === 'sbc') {
    const t = sbcTable(yearEnd);
    if (t) {
      // Taxable income is assessed in whole rand.
      const rand = Math.floor(taxable / 100);
      let band = t.bands[0];
      for (const b of t.bands) if (rand > b[0]) band = b;
      return R(band[1]) + Math.round(((rand - band[0]) * 100 * band[2]) / 100);
    }
  }
  return pct(taxable, rate);
}

export interface TaxComputation {
  pbt: Kobo;
  additions: TaxItem[];
  deductions: TaxItem[];
  totalAdditions: Kobo;
  totalDeductions: Kobo;
  /** Taxable income, or an assessed loss when negative, before any loss brought forward. */
  beforeLoss: Kobo;
  lossBroughtForward: Kobo;
  /** The part of the loss brought forward set off this year. */
  lossUsed: Kobo;
  /** The most the law would let be set off this year: the greater of R1m and 80% of taxable income. */
  lossCap: Kobo | null;
  taxable: Kobo;
  lossCarriedForward: Kobo;
  mode: TaxMode;
  rate: number;
  /** The SBC table used, when the computation is on it. */
  table: SbcTable | null;
  currentTax: Kobo;
  effectiveRate: number | null;
}

/** Taxable income and current tax, starting from accounting profit before tax. */
export function computeTax(cur: Figures, w: TaxWorking, yearEnd: string): TaxComputation {
  const items = w.items.filter((i) => i.label.trim() && i.amount !== 0);
  const additions = items.filter((i) => i.kind === 'add');
  const deductions = items.filter((i) => i.kind === 'deduct');
  const totalAdditions = additions.reduce((a, i) => a + Math.abs(i.amount), 0);
  const totalDeductions = deductions.reduce((a, i) => a + Math.abs(i.amount), 0);
  const beforeLoss = cur.pbt + totalAdditions - totalDeductions;
  const lossBroughtForward = Math.max(0, w.lossBroughtForward || 0);
  let lossUsed = 0;
  let lossCap: Kobo | null = null;
  let taxable: Kobo;
  let lossCarriedForward: Kobo;
  if (beforeLoss > 0) {
    lossCap = Math.max(R(1_000_000), pct(beforeLoss, 80));
    lossUsed = Math.min(lossBroughtForward, lossCap, beforeLoss);
    taxable = beforeLoss - lossUsed;
    lossCarriedForward = lossBroughtForward - lossUsed;
  } else {
    // A loss for the year adds to the balance carried forward.
    taxable = 0;
    lossCarriedForward = lossBroughtForward - beforeLoss;
  }
  const table = w.mode === 'sbc' ? sbcTable(yearEnd) : null;
  const currentTax = taxOn(taxable, w.mode, w.rate, yearEnd);
  return {
    pbt: cur.pbt,
    additions,
    deductions,
    totalAdditions,
    totalDeductions,
    beforeLoss,
    lossBroughtForward,
    lossUsed,
    lossCap,
    taxable,
    lossCarriedForward,
    mode: w.mode,
    rate: w.rate,
    table,
    currentTax,
    effectiveRate: cur.pbt > 0 ? Math.round((currentTax / cur.pbt) * 1000) / 10 : null,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Deferred tax
 * ---------------------------------------------------------------------------------------------- */

export interface DeferredLine {
  label: string;
  kind: 'asset' | 'liability';
  carrying: Kobo;
  taxBase: Kobo;
  /** Positive: a taxable temporary difference, giving a liability. Negative: deductible, giving an asset. */
  difference: Kobo;
  /** Positive: deferred tax liability. Negative: deferred tax asset. */
  deferred: Kobo;
  computed?: boolean;
}

export interface DeferredTax {
  rate: number;
  lines: DeferredLine[];
  /** Net closing balance required. Positive is a liability, negative an asset. */
  closing: Kobo;
  /** Net balance at the start of the year, from the prior year column. */
  opening: Kobo;
  /** The charge (positive) or credit (negative) to profit or loss for the year. */
  movement: Kobo;
  /** Net balance in the accounts now, after posted journals. */
  booked: Kobo;
  /** What a journal must add to the booked balance. Nil when the accounts agree. */
  adjustment: Kobo;
}

/** The carrying amount of a chart line as the statement of financial position shows it. */
export const carryingOf = (cur: Figures, code: string): Kobo => cur.v[code] ?? 0;

const netDeferred = (f: Figures | null) => (f ? f.v.deferred_tax_liability - f.v.deferred_tax_asset : 0);

export function deferredTax(cur: Figures, prior: Figures | null, w: TaxWorking, comp: TaxComputation): DeferredTax {
  const rate = w.deferredRate ?? w.rate;
  const lines: DeferredLine[] = w.deferred
    .filter((r) => r.label.trim())
    .map((r) => {
      const carrying = r.source ? carryingOf(cur, r.source) : r.carrying;
      const difference = r.kind === 'asset' ? carrying - r.taxBase : r.taxBase - carrying;
      return { label: r.label, kind: r.kind, carrying, taxBase: r.taxBase, difference, deferred: pct(difference, rate) };
    });
  if (w.recogniseLoss && comp.lossCarriedForward > 0) {
    lines.push({
      label: 'Assessed loss carried forward',
      kind: 'asset',
      carrying: 0,
      taxBase: comp.lossCarriedForward,
      difference: -comp.lossCarriedForward,
      deferred: -pct(comp.lossCarriedForward, rate),
      computed: true,
    });
  }
  const closing = lines.reduce((a, l) => a + l.deferred, 0);
  const opening = netDeferred(prior);
  const booked = netDeferred(cur);
  return { rate, lines, closing, opening, movement: closing - opening, booked, adjustment: closing - booked };
}

/* ------------------------------------------------------------------------------------------------
 * The tax charge, and the journals that bring the accounts into line with it
 * ---------------------------------------------------------------------------------------------- */

export interface TaxCharge {
  current: Kobo;
  deferred: Kobo;
  total: Kobo;
  /** The income tax expense in the accounts now, after posted journals. */
  booked: Kobo;
  /** Of that, the part that is current tax: the expense less the deferred tax already booked this year. */
  bookedCurrent: Kobo;
  /** What a journal must add to current tax. */
  currentAdjustment: Kobo;
}

export function taxCharge(cur: Figures, comp: TaxComputation, dt: DeferredTax): TaxCharge {
  const booked = cur.v.income_tax_expense;
  const bookedCurrent = booked - (dt.booked - dt.opening);
  return {
    current: comp.currentTax,
    deferred: dt.movement,
    total: comp.currentTax + dt.movement,
    booked,
    bookedCurrent,
    currentAdjustment: comp.currentTax - bookedCurrent,
  };
}

export interface ProposedJournal {
  ref: string;
  description: string;
  lines: { lineId: string; amount: Kobo }[];
}

/**
 * The journals that post current and deferred tax. Each is the difference between what the
 * computation requires and what the accounts already hold, so posting twice is never needed.
 * Returns only the journals with something to post and an account to post to.
 */
export function taxJournals(charge: TaxCharge, dt: DeferredTax, accounts: { expense?: string; payable?: string; deferred?: string }): ProposedJournal[] {
  const out: ProposedJournal[] = [];
  if (charge.currentAdjustment !== 0 && accounts.expense && accounts.payable) {
    out.push({
      ref: 'TAX1',
      description: 'Current income tax for the year, per the tax computation',
      lines: [
        { lineId: accounts.expense, amount: charge.currentAdjustment },
        { lineId: accounts.payable, amount: -charge.currentAdjustment },
      ],
    });
  }
  if (dt.adjustment !== 0 && accounts.expense && accounts.deferred) {
    out.push({
      ref: 'TAX2',
      description: 'Deferred tax movement for the year, per the deferred tax schedule',
      lines: [
        { lineId: accounts.expense, amount: dt.adjustment },
        // A liability is a credit balance: an increase in it is a credit.
        { lineId: accounts.deferred, amount: -dt.adjustment },
      ],
    });
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------
 * Provisional tax (IRP6)
 * ---------------------------------------------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0');

/** The last day of the month k months after the month of iso. */
export function monthEnd(iso: string, k: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1 + k;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  return `${yy}-${pad(mm + 1)}-${pad(last)}`;
}

export interface ProvisionalDue {
  period: 'first' | 'second' | 'third';
  label: string;
  due: string;
  /** What should have been paid, from the estimate. */
  required: Kobo;
  paid: Kobo;
  date: string | null;
  shortfall: Kobo;
  late: boolean;
  /** The 10% penalty on the amount not paid by the due date. */
  latePenalty: Kobo;
}

export interface Provisional {
  /** The basic amount: the latest assessed taxable income, increased by 8% a year when that assessment is more than 18 months old. */
  basic: Kobo | null;
  basicUplift: number;
  payments: ProvisionalDue[];
  totalPaid: Kobo;
  /** Normal tax on assessment less provisional tax paid. Positive is owed to SARS. */
  balance: Kobo;
  /** The underestimation test of paragraph 20, on the second period estimate. */
  test: {
    threshold: 80 | 90;
    estimate: Kobo | null;
    /** The figure the estimate had to reach. */
    required: Kobo;
    passed: boolean;
    penalty: Kobo;
    reason: string;
  } | null;
  interest: { from: string; to: string; days: number; amount: Kobo } | null;
}

export function provisionalTax(comp: TaxComputation, p: ProvisionalWorking, yearEnd: string): Provisional {
  const tax = (x: Kobo) => taxOn(x, comp.mode, comp.rate, yearEnd);
  // Paragraph 19: increased by 8% a year from the end of the assessed year to the end of this one, when more than 18 months apart.
  let basic: Kobo | null = null;
  let basicUplift = 0;
  if (p.basicTaxable !== undefined && p.basicTaxable !== null) {
    basic = p.basicTaxable;
    if (p.basicYearEnd) {
      const months = (Number(yearEnd.slice(0, 4)) - Number(p.basicYearEnd.slice(0, 4))) * 12 + Number(yearEnd.slice(5, 7)) - Number(p.basicYearEnd.slice(5, 7));
      if (months > 18) {
        basicUplift = 8 * Math.floor(months / 12);
        basic = Math.round(basic * (1 + basicUplift / 100));
      }
    }
  }

  const feb = yearEnd.slice(5, 7) === '02';
  const firstDue = monthEnd(yearEnd, -6);
  const thirdDue = monthEnd(yearEnd, feb ? 6 : 7);
  const firstPaid = p.first?.paid ?? 0;
  const secondPaid = p.second?.paid ?? 0;
  const firstRequired = p.first?.estimate !== undefined ? Math.round(tax(p.first.estimate) / 2) : basic !== null ? Math.round(tax(basic) / 2) : 0;
  const secondRequired = Math.max(0, (p.second?.estimate !== undefined ? tax(p.second.estimate) : comp.currentTax) - firstPaid);
  const thirdRequired = Math.max(0, comp.currentTax - firstPaid - secondPaid);
  const row = (period: ProvisionalDue['period'], label: string, due: string, required: Kobo, pay: ProvisionalPayment | undefined, penalised: boolean): ProvisionalDue => {
    const paid = pay?.paid ?? 0;
    const date = pay?.date || null;
    const late = !!date && date > due;
    const onTime = late ? 0 : paid;
    const shortfall = Math.max(0, required - onTime);
    return { period, label, due, required, paid, date, shortfall, late, latePenalty: penalised ? pct(shortfall, 10) : 0 };
  };
  const payments = [
    row('first', 'First period', firstDue, firstRequired, p.first, true),
    row('second', 'Second period', yearEnd, secondRequired, p.second, true),
    // The third payment is voluntary. It stops interest running but carries no late payment penalty.
    row('third', 'Third (top-up) payment', thirdDue, thirdRequired, p.third, false),
  ];
  const totalPaid = firstPaid + secondPaid + (p.third?.paid ?? 0);
  const balance = comp.currentTax - totalPaid;

  // Paragraph 20.
  let test: Provisional['test'] = null;
  const actual = comp.taxable;
  if (actual > 0) {
    const est = p.second?.estimate ?? null;
    if (actual <= R(1_000_000)) {
      const ninety = pct(actual, 90);
      const required = basic !== null ? Math.min(ninety, basic) : ninety;
      const passed = est !== null && (est >= ninety || (basic !== null && est >= basic));
      test = {
        threshold: 90,
        estimate: est,
        required,
        passed,
        penalty: passed || est === null ? 0 : pct(Math.max(0, tax(required) - tax(est)), 20),
        reason:
          'Taxable income is R1 million or less, so the second period estimate must reach 90% of taxable income or the basic amount, whichever is lower.',
      };
    } else {
      const required = pct(actual, 80);
      const passed = est !== null && est >= required;
      test = {
        threshold: 80,
        estimate: est,
        required,
        passed,
        penalty: passed || est === null ? 0 : pct(Math.max(0, tax(required) - tax(est)), 20),
        reason: 'Taxable income is more than R1 million, so the second period estimate must reach 80% of taxable income.',
      };
    }
  }

  let interest: Provisional['interest'] = null;
  if (p.interestRate && p.interestRate > 0) {
    // Interest runs on what is still unpaid at the effective date: the third payment's due date.
    const unpaidAtEffective = comp.currentTax - firstPaid - secondPaid - (p.third?.date && p.third.date <= thirdDue ? (p.third.paid ?? 0) : 0);
    const to = p.interestTo || thirdDue;
    const days = Math.max(0, daysBetween(thirdDue, to));
    if (unpaidAtEffective > 0 && days > 0) {
      interest = { from: thirdDue, to, days, amount: Math.round((unpaidAtEffective * p.interestRate * days) / 36500) };
    }
  }
  return { basic, basicUplift, payments, totalPaid, balance, test, interest };
}
