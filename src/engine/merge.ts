import { ITEM } from './chart';
import { normaliseNature, suggestMapping } from './mapping';
import type { ParsedLine } from './parse';
import type { Adjustment, Nature, TbLine } from './types';
import type { Slot } from './years';

export type SavedMaps = Map<string, { mapCode: string; nature: Nature | null }>;
export type MergedLine = Omit<TbLine, 'id'>;

/**
 * Combine a newly imported trial balance with what the engagement already holds.
 * Each import fills one year (current, prior, or the year before that) and keeps the others.
 * Mapping comes from, in order: the existing line, the client's remembered mapping, a keyword suggestion.
 */
export function mergeImport(
  existing: TbLine[],
  parsed: ParsedLine[],
  period: Slot,
  saved: SavedMaps,
  adjustments: Adjustment[],
): MergedLine[] {
  const byCode = new Map(existing.map((l) => [l.code, l]));
  const incoming = new Map(parsed.map((p) => [p.code, p]));
  const hadPrior = existing.some((l) => l.prior !== null);
  const hadPrior2 = existing.some((l) => l.prior2 !== null && l.prior2 !== undefined);
  const prior2Of = (l: TbLine | undefined) => l?.prior2 ?? (hadPrior2 ? 0 : null);

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
      out.push({ code: p.code, name: p.name, balance: p.balance, prior: ex?.prior ?? (hadPrior ? 0 : null), prior2: prior2Of(ex), ...mapFor(p.code, p.name) });
    }
    for (const l of existing) {
      if (!incoming.has(l.code) && (l.prior || l.prior2)) out.push({ ...stripId(l), balance: 0 });
    }
  } else {
    const key = period === 'prior' ? 'prior' : 'prior2';
    for (const l of existing) {
      const v = incoming.get(l.code)?.balance ?? 0;
      const others = l.balance !== 0 || (key === 'prior2' ? !!l.prior : !!l.prior2);
      if (!others && v === 0) continue;
      out.push({ ...stripId(l), prior: l.prior, prior2: prior2Of(l), [key]: v });
    }
    for (const p of parsed) {
      if (byCode.has(p.code)) continue;
      out.push({
        code: p.code,
        name: p.name,
        balance: 0,
        prior: key === 'prior' ? p.balance : hadPrior ? 0 : null,
        prior2: key === 'prior2' ? p.balance : hadPrior2 ? 0 : null,
        ...mapFor(p.code, p.name),
      });
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

/**
 * Brings in several years at once, current year first, so each is placed against the accounts
 * the others brought. Accounts keep their ids, so journals stay attached.
 */
export function mergeYears(existing: TbLine[], years: { slot: Slot; lines: ParsedLine[] }[], saved: SavedMaps, adjustments: Adjustment[]): MergedLine[] {
  const order: Slot[] = ['current', 'prior', 'prior2'];
  const ids = new Map(existing.map((l) => [l.code, l.id]));
  let held: TbLine[] = existing;
  let merged: MergedLine[] = existing.map(stripId);
  for (const slot of order) {
    const y = years.find((x) => x.slot === slot);
    if (!y) continue;
    merged = mergeImport(held, y.lines, slot, saved, adjustments);
    held = merged.map((l) => ({ ...l, id: ids.get(l.code) ?? `new:${l.code}` }));
  }
  return merged;
}
