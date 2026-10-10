import { ITEM } from './chart';
import { normaliseNature, suggestMapping } from './mapping';
import type { ParsedLine } from './parse';
import type { Adjustment, Nature, TbLine } from './types';

export type SavedMaps = Map<string, { mapCode: string; nature: Nature | null }>;
export type MergedLine = Omit<TbLine, 'id'>;

/**
 * Combine a newly imported trial balance with what the engagement already holds.
 * A current-year import keeps the comparatives; a prior-year import keeps the current year.
 * Mapping comes from, in order: the existing line, the client's remembered mapping, a keyword suggestion.
 */
export function mergeImport(
  existing: TbLine[],
  parsed: ParsedLine[],
  period: 'current' | 'prior',
  saved: SavedMaps,
  adjustments: Adjustment[],
): MergedLine[] {
  const byCode = new Map(existing.map((l) => [l.code, l]));
  const incoming = new Map(parsed.map((p) => [p.code, p]));
  const hadPrior = existing.some((l) => l.prior !== null);

  const mapFor = (code: string, name: string) => {
    const ex = byCode.get(code);
    if (ex?.mapCode) return { mapCode: ex.mapCode, nature: ex.nature };
    const s = saved.get(code);
    if (s && ITEM.has(s.mapCode)) return { mapCode: s.mapCode, nature: normaliseNature(s.mapCode, s.nature) };
    return suggestMapping(name);
  };

  const out: MergedLine[] = [];
  if (period === 'current') {
    for (const p of parsed) {
      const ex = byCode.get(p.code);
      out.push({ code: p.code, name: p.name, balance: p.balance, prior: ex?.prior ?? (hadPrior ? 0 : null), ...mapFor(p.code, p.name) });
    }
    for (const l of existing) {
      if (!incoming.has(l.code) && l.prior) out.push({ ...stripId(l), balance: 0 });
    }
  } else {
    for (const l of existing) {
      const prior = incoming.get(l.code)?.balance ?? 0;
      if (l.balance === 0 && prior === 0) continue;
      out.push({ ...stripId(l), prior });
    }
    for (const p of parsed) {
      if (!byCode.has(p.code)) out.push({ code: p.code, name: p.name, balance: 0, prior: p.balance, ...mapFor(p.code, p.name) });
    }
  }

  const kept = new Set(out.map((l) => l.code));
  for (const l of existing) {
    if (kept.has(l.code)) continue;
    const used = adjustments.find((a) => a.lines.some((j) => j.lineId === l.id));
    if (used) {
      throw new Error(
        `Account ${l.code} ${l.name} is no longer in the trial balance but journal ${used.ref} posts to it. Delete that journal first.`,
      );
    }
  }
  return out.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

function stripId(l: TbLine): MergedLine {
  const { id: _id, ...rest } = l;
  return rest;
}
