// Opening balances against last year's audited closing balances.
// This year's prior-year column should equal last year's final trial balance, after the
// journals that were posted in last year's file. Lines are compared statement line by line.
import { ITEM } from './chart';
import type { Adjustment, Kobo, TbLine } from './types';

export interface OpeningRow {
  code: string;
  label: string;
  lastAudited: Kobo;
  opening: Kobo;
  difference: Kobo;
}

const byLine = (lines: TbLine[], amount: (l: TbLine) => Kobo | null) => {
  const out = new Map<string, Kobo>();
  for (const l of lines) {
    const v = amount(l);
    if (v === null || !l.mapCode) continue;
    out.set(l.mapCode, (out.get(l.mapCode) ?? 0) + v);
  }
  return out;
};

export function openingComparison(current: TbLine[], last: TbLine[], lastAdjustments: Adjustment[]): { rows: OpeningRow[]; differences: number; unmapped: number } {
  const posted = new Map<string, Kobo>();
  for (const a of lastAdjustments) if (a.posted) for (const j of a.lines) posted.set(j.lineId, (posted.get(j.lineId) ?? 0) + j.amount);
  const audited = byLine(last, (l) => l.balance + (posted.get(l.id) ?? 0));
  const opening = byLine(current, (l) => l.prior);
  const codes = [...new Set([...audited.keys(), ...opening.keys()])];
  const order = (c: string) => [...ITEM.keys()].indexOf(c);
  const rows = codes
    .sort((a, b) => order(a) - order(b))
    .map((code) => {
      const lastAudited = audited.get(code) ?? 0;
      const o = opening.get(code) ?? 0;
      return { code, label: ITEM.get(code)?.label ?? code, lastAudited, opening: o, difference: o - lastAudited };
    })
    .filter((r) => r.lastAudited !== 0 || r.opening !== 0);
  return {
    rows,
    differences: rows.filter((r) => r.difference !== 0).length,
    unmapped: current.filter((l) => l.prior !== null && !l.mapCode).length + last.filter((l) => !l.mapCode).length,
  };
}
