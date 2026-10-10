import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHECKLIST } from './checklist';
import { buildReviewPack } from './reviewPack';
import { PROGRAMMES } from './programmes';

const FILE = 'docs/REVIEW-PACK.md';

describe('technical review pack', () => {
  const pack = buildReviewPack();

  // Run with UPDATE_PACK=1 to write the file after a deliberate change to the content.
  if (process.env.UPDATE_PACK) writeFileSync(FILE, pack);

  it('matches the file a reviewer is given, so the pack cannot fall behind the product', () => {
    expect(existsSync(FILE), 'run: UPDATE_PACK=1 npx vitest run src/content/reviewPack.test.ts').toBe(true);
    expect(readFileSync(FILE, 'utf8')).toBe(pack);
  });

  it('carries every programme step and checklist item, and every report variant', () => {
    for (const type of ['audit', 'review', 'compilation'] as const) for (const i of PROGRAMMES[type]) expect(pack).toContain(`| ${i.id} |`);
    for (const i of CHECKLIST) expect(pack).toContain(`| ${i.id} |`);
    for (const heading of ['Audit, unmodified opinion', 'Audit, qualified opinion', 'Audit, adverse opinion', 'Audit, disclaimer of opinion', 'Audit of a group', '### Review', '### Compilation'])
      expect(pack).toContain(heading);
    expect(pack).toContain('We remain solely responsible for our audit opinion.');
    expect(pack).not.toContain('undefined');
  });
});
