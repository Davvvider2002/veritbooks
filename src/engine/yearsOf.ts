// The years of balances an account can hold: the current year and up to four before it.
import type { Kobo, TbLine } from './types';

/** The fields holding each year, current year first. */
export const YEAR_KEYS = ['balance', 'prior', 'prior2', 'prior3', 'prior4'] as const;
export type YearKey = (typeof YEAR_KEYS)[number];

/** An account's balance for a year: 0 is the current year, 1 the prior year, and so on. Null when that year is not held. */
export function yearValue(l: Partial<Pick<TbLine, YearKey>>, i: number): Kobo | null {
  const v = l[YEAR_KEYS[i]];
  return v === null || v === undefined ? (i === 0 ? 0 : null) : v;
}

/** How many years the trial balance holds, counting back from the current year: 1 to 5. */
export function yearsHeld(lines: TbLine[]): number {
  let n = 1;
  for (let i = 1; i < YEAR_KEYS.length; i++) if (lines.some((l) => yearValue(l, i) !== null)) n = i + 1;
  return n;
}

/** The account as it is saved, every year kept. For writing the trial balance back with changes. */
export function keepLine(l: TbLine) {
  return {
    code: l.code,
    name: l.name,
    balance: l.balance,
    prior: l.prior,
    prior2: l.prior2 ?? null,
    prior3: l.prior3 ?? null,
    prior4: l.prior4 ?? null,
    mapCode: l.mapCode,
    nature: l.nature,
  };
}

/**
 * The trial balance seen from an earlier year: year i becomes the current year and the year
 * before it the prior year. No journals are carried, as journals belong to the current year.
 */
export function shiftYears(lines: TbLine[], i: number): TbLine[] {
  return lines.map((l) => ({
    ...l,
    balance: yearValue(l, i) ?? 0,
    prior: yearValue(l, i + 1),
    prior2: yearValue(l, i + 2),
    prior3: yearValue(l, i + 3),
    prior4: yearValue(l, i + 4),
  }));
}
