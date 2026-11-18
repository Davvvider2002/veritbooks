import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RELEASES } from './releases';

describe("what's new", () => {
  it('lists releases newest first, each with a unique id and a real date', () => {
    const ids = RELEASES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RELEASES) expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = RELEASES.map((r) => r.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('gives every release highlights and steps, and every screenshot exists with a description', () => {
    for (const r of RELEASES) {
      expect(r.highlights.length).toBeGreaterThan(0);
      expect(r.steps.length).toBeGreaterThan(0);
      for (const s of r.steps.filter((x) => x.image)) {
        expect(existsSync(`public${s.image}`), s.image).toBe(true);
        expect(s.alt?.length ?? 0).toBeGreaterThan(10);
      }
    }
  });
});
