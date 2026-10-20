import { ITEM } from './chart';
import { normaliseNature, suggestMapping } from './mapping';
import type { ParsedLine } from './parse';
import type { Adjustment, Nature, TbLine } from './types';
import { SLOTS, type Slot } from './years';
import { YEAR_KEYS, yearValue, type YearKey } from './yearsOf';

export type SavedMaps = Map<string, { mapCode: string; nature: Nature | null }>;
export type MergedLine = Omit<TbLine, 'id'>;

/**
 * Combine a newly imported trial balance with what the engagement already holds.
 * Each import fills one year (the current year or one of the four before it) and keeps the others.
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
  const target = SLOTS.indexOf(period);
  // A year already held stays held: an account missing from it reads nil, not "not imported".
  const held = YEAR_KEYS.map((_, i) => i === 0 || existing.some((l) => yearValue(l, i) !== null));
  const years = (l: TbLine | undefined, set?: number) =>
    Object.fromEntries(YEAR_KEYS.map((k, i) => [k, i === target && set !== undefined ? set : l ? (yearValue(l, i) ?? (held[i] ? 0 : null)) : i === 0 ? 0 : held[i] ? 0 : null])) as Pick<MergedLine, YearKey>;

  const mapFor = (code: string, name: string) => {
    const ex = byCode.get(code);
    if (ex?.mapCode) return { mapCode: ex.mapCode, nature: ex.nature };
    const s = saved.get(code);
    if (s && ITEM.has(s.mapCode)) return { mapCode: s.mapCode, nature: normaliseNature(s.mapCode, s.nature) };
    return suggestMapping(name);
  };

  const out: MergedLine[] = [];
  for (const l of existing) {
    const p = incoming.get(l.code);
    const v = p?.balance ?? 0;
    // An account with nothing in any year once this one is replaced is left out.
    const others = YEAR_KEYS.some((_, i) => i !== target && !!yearValue(l, i));
    if (!others && !p) continue;
    // The current year's file names the accounts as they now stand.
    out.push({ ...stripId(l), name: target === 0 && p ? p.name : l.name, ...years(l, v) });
  }
  for (const p of parsed) {
    if (byCode.has(p.code)) continue;
    out.push({ code: p.code, name: p.name, ...years(undefined, p.balance), ...mapFor(p.code, p.name) });
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
  const order: Slot[] = SLOTS;
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

/**
 * Clears an imported trial balance so a revised one can be imported, before the file is signed.
 * 'current' clears this year's balances and keeps earlier years; 'all' clears every year.
 * Accounts a journal posts to are kept, at nil, so the journal stays attached; it is matched to
 * the fresh import by account code. Mapping stays on the accounts kept, and the client's
 * remembered mapping maps the rest again on import.
 */
export function purgeLines(lines: TbLine[], adjustments: Adjustment[], scope: 'current' | 'all'): MergedLine[] {
  const used = new Set(adjustments.flatMap((a) => a.lines.map((j) => j.lineId)));
  const out: MergedLine[] = [];
  for (const l of lines) {
    const next: MergedLine =
      scope === 'current'
        ? { ...stripId(l), balance: 0 }
        : { ...stripId(l), balance: 0, prior: null, prior2: null, prior3: null, prior4: null };
    const holds = YEAR_KEYS.some((_, i) => !!yearValue(next, i));
    if (holds || used.has(l.id)) out.push(next);
  }
  return out;
}
