import { describe, expect, it } from 'vitest';
import { CHECKLIST } from '../content/checklist';
import { PACKS, checklistFor, packOf, programmeFor, requestsFor } from '../content/packs';
import { PROGRAMMES } from '../content/programmes';
import { STANDARD_REQUESTS } from '../content/requests';
import { CHART } from './chart';

describe('industry packs', () => {
  it('uses the general content alone when no pack, or an unknown one, is chosen', () => {
    for (const planning of [{}, { industry: 'no-such-pack' }]) {
      expect(packOf(planning)).toBeNull();
      expect(programmeFor('audit', planning)).toEqual(PROGRAMMES.audit);
      expect(checklistFor(planning)).toBe(CHECKLIST);
      expect(requestsFor(planning)).toEqual(STANDARD_REQUESTS);
    }
  });

  it('only adds: every general step, item and request is still there', () => {
    for (const pack of PACKS) {
      const planning = { industry: pack.id };
      for (const type of ['audit', 'review', 'compilation'] as const) {
        const ids = programmeFor(type, planning).map((i) => i.id);
        expect(new Set(ids).size, `${pack.id} ${type} step ids are unique`).toBe(ids.length);
        for (const i of PROGRAMMES[type]) expect(ids).toContain(i.id);
        expect(ids.length).toBe(PROGRAMMES[type].length + (pack.programme[type]?.length ?? 0));
      }
      const list = checklistFor(planning);
      expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
      expect(list.length).toBe(CHECKLIST.length + pack.checklist.length);
      const titles = requestsFor(planning).map((r) => r.title);
      expect(new Set(titles).size).toBe(titles.length);
      const codes = new Set(CHART.map((c) => c.code));
      for (const i of pack.checklist) for (const c of i.when ?? []) expect(codes.has(c)).toBe(true);
    }
  });

  it('places pack checklist items at the end of their section', () => {
    const list = checklistFor({ industry: 'trading_manufacturing' });
    const sections = list.map((i) => i.section);
    // each section appears as one unbroken run
    const runs = sections.filter((s, i) => s !== sections[i - 1]);
    expect(new Set(runs).size).toBe(runs.length);
    const inv = list.filter((i) => i.section === 'Section 13: Inventories').map((i) => i.id);
    expect(inv.slice(0, 2)).toEqual(['s13-policy', 's13-expense']);
    expect(inv.slice(2).every((id) => id.startsWith('tm-'))).toBe(true);
  });

  it('gives a compilation no extra steps, since no assurance work is done', () => {
    expect(programmeFor('compilation', { industry: 'trading_manufacturing' })).toEqual(PROGRAMMES.compilation);
    expect(programmeFor('audit', { industry: 'trading_manufacturing' }).length).toBe(PROGRAMMES.audit.length + 11);
  });
});
