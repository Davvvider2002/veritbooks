// The register of journals passed: every journal on the file, whichever step made it, in one
// list. Journals from the bank reconciliation (BR1, BR2), the tax computation (TAX1, TAX2) and
// those entered or imported in the Journals step are numbered in their own series and listed
// series by series, in number order.
import type { Adjustment, Kobo, TbLine } from './types';

export type JournalSource = 'audit' | 'bank' | 'tax';

export const SOURCE_LABEL: Record<JournalSource, string> = {
  audit: 'Audit team',
  bank: 'Bank reconciliation',
  tax: 'Tax computation',
};

export function sourceOf(a: Pick<Adjustment, 'ref' | 'description'>): JournalSource {
  const ref = a.ref.trim().toUpperCase();
  if (/^BR\d+$/.test(ref) || /^bank reconciliation:/i.test(a.description)) return 'bank';
  if (/^TAX\d+$/.test(ref)) return 'tax';
  return 'audit';
}

const ORDER: JournalSource[] = ['audit', 'bank', 'tax'];

/** Splits a reference into its letters and its number, so J2 comes before J10. */
function refKey(ref: string): [string, number, string] {
  const m = ref.trim().toUpperCase().match(/^([A-Z]*)\s*(\d+)(.*)$/);
  return m ? [m[1], Number(m[2]), m[3]] : [ref.trim().toUpperCase(), 0, ''];
}

export function compareRefs(a: string, b: string): number {
  const [pa, na, ra] = refKey(a);
  const [pb, nb, rb] = refKey(b);
  return pa.localeCompare(pb) || na - nb || ra.localeCompare(rb);
}

export interface RegisterLine {
  lineId: string;
  code: string;
  name: string;
  debit: Kobo;
  credit: Kobo;
}

export interface RegisterEntry {
  id: string;
  ref: string;
  description: string;
  source: JournalSource;
  posted: boolean;
  lines: RegisterLine[];
  /** The journal's debits, which equal its credits. */
  total: Kobo;
}

export interface Register {
  entries: RegisterEntry[];
  /** Number of journals and total debits, by source and overall, for posted journals and unadjusted differences. */
  bySource: { source: JournalSource; count: number; posted: Kobo; unadjusted: Kobo }[];
  posted: Kobo;
  unadjusted: Kobo;
}

/** Every journal on the file, series by series and in number order, with account codes and names. */
export function journalRegister(adjustments: Adjustment[], lines: TbLine[]): Register {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const entries: RegisterEntry[] = adjustments
    .map((a) => {
      const rl = a.lines.map((j) => {
        const l = byId.get(j.lineId);
        return { lineId: j.lineId, code: l?.code ?? '', name: l?.name ?? 'Unknown account', debit: j.amount > 0 ? j.amount : 0, credit: j.amount < 0 ? -j.amount : 0 };
      });
      return { id: a.id, ref: a.ref, description: a.description, source: sourceOf(a), posted: a.posted, lines: rl, total: rl.reduce((s, x) => s + x.debit, 0) };
    })
    .sort((x, y) => ORDER.indexOf(x.source) - ORDER.indexOf(y.source) || compareRefs(x.ref, y.ref));
  const bySource = ORDER.map((source) => {
    const of = entries.filter((e) => e.source === source);
    return {
      source,
      count: of.length,
      posted: of.filter((e) => e.posted).reduce((s, e) => s + e.total, 0),
      unadjusted: of.filter((e) => !e.posted).reduce((s, e) => s + e.total, 0),
    };
  }).filter((s) => s.count > 0);
  return {
    entries,
    bySource,
    posted: bySource.reduce((s, x) => s + x.posted, 0),
    unadjusted: bySource.reduce((s, x) => s + x.unadjusted, 0),
  };
}
