import { describe, expect, it } from 'vitest';
import type { Figures } from './statements';
import { companyRate, computeTax, deferredTax, monthEnd, provisionalTax, sbcTable, taxCharge, taxJournals, taxOn, type TaxWorking } from './tax';

const R = (n: number) => Math.round(n * 100);

/** Figures with only what the tax engine reads. */
const fig = (pbt: number, v: Record<string, number> = {}): Figures =>
  ({
    pbt: R(pbt),
    depreciation: 0,
    v: { income_tax_expense: 0, deferred_tax_liability: 0, deferred_tax_asset: 0, ppe: 0, provisions: 0, ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, R(x)])) },
  }) as unknown as Figures;

const working = (over: Partial<TaxWorking> = {}): TaxWorking => ({ mode: 'flat', rate: 27, items: [], lossBroughtForward: 0, deferred: [], recogniseLoss: false, ...over });

describe('rates', () => {
  it('uses 27% from years ending 31 March 2023, and 28% before', () => {
    expect(companyRate('2026-02-28')).toBe(27);
    expect(companyRate('2023-03-31')).toBe(27);
    expect(companyRate('2022-12-31')).toBe(28);
  });

  it('applies the SBC table SARS published for 2026/27', () => {
    const ye = '2027-02-28';
    expect(sbcTable(ye)?.bands[1][0]).toBe(99_000);
    expect(taxOn(R(99_000), 'sbc', 27, ye)).toBe(0);
    expect(taxOn(R(365_000), 'sbc', 27, ye)).toBe(R(18_620));
    expect(taxOn(R(550_000), 'sbc', 27, ye)).toBe(R(57_470));
    expect(taxOn(R(650_000), 'sbc', 27, ye)).toBe(R(57_470 + 27_000));
  });

  it('applies the earlier table to a year ending February 2026', () => {
    expect(taxOn(R(200_000), 'sbc', 27, '2026-02-28')).toBe(R(0.07 * (200_000 - 95_750)));
  });

  it('falls back to the rate entered when no SBC table covers the year', () => {
    expect(taxOn(R(100_000), 'sbc', 27, '2019-02-28')).toBe(R(27_000));
  });
});

describe('the computation', () => {
  it('works from profit before tax to current tax', () => {
    const c = computeTax(
      fig(1_000_000),
      working({
        items: [
          { label: 'Depreciation', amount: R(200_000), kind: 'add' },
          { label: 'Fines and penalties', amount: R(10_000), kind: 'add' },
          { label: 'Wear-and-tear allowance, section 11(e)', amount: R(250_000), kind: 'deduct' },
          { label: 'Local dividends, exempt under section 10(1)(k)', amount: R(40_000), kind: 'deduct' },
        ],
      }),
      '2026-02-28',
    );
    expect(c.taxable).toBe(R(920_000));
    expect(c.currentTax).toBe(R(248_400));
  });

  it('limits the loss set off to the greater of R1 million and 80% of taxable income', () => {
    const big = computeTax(fig(5_000_000), working({ lossBroughtForward: R(10_000_000) }), '2026-02-28');
    expect(big.lossUsed).toBe(R(4_000_000));
    expect(big.taxable).toBe(R(1_000_000));
    expect(big.lossCarriedForward).toBe(R(6_000_000));

    const small = computeTax(fig(900_000), working({ lossBroughtForward: R(2_000_000) }), '2026-02-28');
    expect(small.lossUsed).toBe(R(900_000));
    expect(small.taxable).toBe(0);
    expect(small.currentTax).toBe(0);
  });

  it('adds a loss for the year to the balance carried forward', () => {
    const c = computeTax(fig(-300_000), working({ lossBroughtForward: R(100_000) }), '2026-02-28');
    expect(c.taxable).toBe(0);
    expect(c.lossCarriedForward).toBe(R(400_000));
  });
});

describe('deferred tax', () => {
  it('takes taxable differences on assets and deductible differences on provisions', () => {
    const cur = fig(1_000_000, { ppe: 800_000, provisions: 100_000, deferred_tax_liability: 20_000 });
    const prior = fig(0, { deferred_tax_liability: 20_000 });
    const w = working({
      deferred: [
        { label: 'Property, plant and equipment', kind: 'asset', carrying: 0, taxBase: R(500_000), source: 'ppe' },
        { label: 'Provisions', kind: 'liability', carrying: 0, taxBase: 0, source: 'provisions' },
        { label: 'Prepayments', kind: 'asset', carrying: R(50_000), taxBase: 0 },
      ],
    });
    const dt = deferredTax(cur, prior, w, computeTax(cur, w, '2026-02-28'));
    // (300,000 - 100,000 + 50,000) x 27%
    expect(dt.closing).toBe(R(67_500));
    expect(dt.movement).toBe(R(47_500));
    expect(dt.adjustment).toBe(R(47_500));
  });

  it('recognises the assessed loss only when asked', () => {
    const cur = fig(-100_000);
    const w = working({ recogniseLoss: true });
    const dt = deferredTax(cur, null, w, computeTax(cur, w, '2026-02-28'));
    expect(dt.closing).toBe(-R(27_000));
    const off = deferredTax(cur, null, working(), computeTax(cur, working(), '2026-02-28'));
    expect(off.closing).toBe(0);
  });
});

describe('journals', () => {
  it('post only the difference from what the accounts hold, and balance', () => {
    // The client booked R200,000 of tax expense, all of it current.
    const cur = fig(1_000_000, { income_tax_expense: 200_000 });
    const w = working({ deferred: [{ label: 'Prepayments', kind: 'asset', carrying: R(10_000), taxBase: 0 }] });
    const comp = computeTax(cur, w, '2026-02-28');
    const dt = deferredTax(cur, null, w, comp);
    const charge = taxCharge(cur, comp, dt);
    expect(charge.currentAdjustment).toBe(R(70_000));
    const js = taxJournals(charge, dt, { expense: 'e', payable: 'p', deferred: 'd' });
    expect(js.map((j) => j.ref)).toEqual(['TAX1', 'TAX2']);
    for (const j of js) expect(j.lines.reduce((a, l) => a + l.amount, 0)).toBe(0);
    expect(js[1].lines.find((l) => l.lineId === 'd')!.amount).toBe(-R(2_700));
  });

  it('proposes nothing when no account is chosen', () => {
    const cur = fig(1_000_000);
    const comp = computeTax(cur, working(), '2026-02-28');
    const dt = deferredTax(cur, null, working(), comp);
    expect(taxJournals(taxCharge(cur, comp, dt), dt, {})).toEqual([]);
  });
});

describe('provisional tax', () => {
  const ye = '2026-02-28';
  it('sets the due dates from the year end', () => {
    expect(monthEnd(ye, -6)).toBe('2025-08-31');
    const p = provisionalTax(computeTax(fig(1_000_000), working(), ye), {}, ye);
    expect(p.payments.map((x) => x.due)).toEqual(['2025-08-31', '2026-02-28', '2026-08-31']);
    const dec = provisionalTax(computeTax(fig(1_000_000), working(), '2025-12-31'), {}, '2025-12-31');
    expect(dec.payments[2].due).toBe('2026-07-31');
  });

  it('raises the basic amount by 8% a year when the assessment is more than 18 months old', () => {
    const p = provisionalTax(computeTax(fig(1_000_000), working(), ye), { basicTaxable: R(500_000), basicYearEnd: '2024-02-29' }, ye);
    expect(p.basicUplift).toBe(16);
    expect(p.basic).toBe(R(580_000));
  });

  it('charges 20% where the estimate falls short of 80% of taxable income above R1 million', () => {
    const comp = computeTax(fig(2_000_000), working(), ye);
    const p = provisionalTax(comp, { first: { estimate: R(1_000_000), paid: R(135_000), date: '2025-08-29' }, second: { estimate: R(1_200_000), paid: R(189_000), date: '2026-02-27' } }, ye);
    expect(p.test?.threshold).toBe(80);
    expect(p.test?.passed).toBe(false);
    // 20% x (tax on 1,600,000 - tax on 1,200,000)
    expect(p.test?.penalty).toBe(R(0.2 * 0.27 * 400_000));
    expect(p.payments[0].shortfall).toBe(0);
    expect(p.balance).toBe(R(540_000 - 324_000));
  });

  it('passes the 90% test on the basic amount for a smaller company', () => {
    const comp = computeTax(fig(800_000), working(), ye);
    const p = provisionalTax(comp, { basicTaxable: R(600_000), second: { estimate: R(600_000) } }, ye);
    expect(p.test?.threshold).toBe(90);
    expect(p.test?.passed).toBe(true);
  });

  it('charges 10% on a payment made late', () => {
    const comp = computeTax(fig(1_000_000), working(), ye);
    const p = provisionalTax(comp, { first: { estimate: R(1_000_000), paid: R(135_000), date: '2025-09-15' } }, ye);
    expect(p.payments[0].late).toBe(true);
    expect(p.payments[0].latePenalty).toBe(R(13_500));
  });

  it('works out interest only at the rate entered', () => {
    const comp = computeTax(fig(1_000_000), working(), ye);
    expect(provisionalTax(comp, {}, ye).interest).toBeNull();
    const p = provisionalTax(comp, { interestRate: 10, interestTo: '2026-09-30' }, ye);
    expect(p.interest?.days).toBe(30);
    expect(p.interest?.amount).toBe(Math.round((R(270_000) * 10 * 30) / 36500));
  });
});
