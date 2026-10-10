import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { CHECKLIST } from '../content/checklist';
import { CHART } from './chart';
import { buildChecklist, checklistOpen } from './checklist';
import { signOffChecks } from './checks';
import { suggestMapping } from './mapping';
import { parseTrialBalance } from './parse';
import { buildStatements } from './statements';
import type { Disclosures, TbLine } from './types';

const rows = (f: string) => Papa.parse<string[]>(readFileSync(`public/samples/${f}`, 'utf8'), { skipEmptyLines: true }).data;
const prior = new Map(parseTrialBalance(rows('trial-balance-2024.csv')).lines.map((l) => [l.code, l.balance]));
const cur: TbLine[] = parseTrialBalance(rows('trial-balance-2025.csv')).lines.map((l) => ({ id: l.code, code: l.code, name: l.name, balance: l.balance, prior: null, ...suggestMapping(l.name) }));
const both = cur.map((l) => ({ ...l, prior: prior.get(l.code) ?? 0 }));
const run = (lines: TbLine[], disclosures: Disclosures = {}, principalActivity = '') =>
  buildChecklist(CHECKLIST, { statements: buildStatements(lines, []), lines, adjustments: [], disclosures, principalActivity });
const state = (r: ReturnType<typeof run>, id: string) => r.find((x) => x.item.id === id)?.state;
const who = { by: 'N. Okafor', at: '2026-01-01T00:00:00Z' };

describe('disclosure checklist', () => {
  it('has unique ids and only refers to lines that exist', () => {
    expect(new Set(CHECKLIST.map((i) => i.id)).size).toBe(CHECKLIST.length);
    const codes = new Set(CHART.map((c) => c.code));
    for (const i of CHECKLIST) for (const c of i.when ?? []) expect(codes.has(c), `${i.id}: ${c}`).toBe(true);
  });

  it('leaves out items for lines the entity does not have', () => {
    const r = run(both);
    expect(state(r, 's13-policy')).toBeDefined(); // the sample holds inventories
    expect(state(r, 's18-intangibles')).toBeUndefined(); // and no intangible assets
    expect(state(r, 's29-deferred')).toBeUndefined();
    expect(state(r, 's21-provisions')).toBeUndefined();
  });

  it('covers what the file itself shows, and asks for the rest', () => {
    const bare = run(cur);
    expect(state(bare, 's3-comparatives')).toBe('open');
    expect(state(bare, 's3-set')).toBe('open');
    expect(state(bare, 's17-reconciliation')).toBe('open');
    const r = run(both);
    expect(state(r, 's3-comparatives')).toBe('covered');
    expect(state(r, 's3-set')).toBe('covered');
    expect(state(r, 's17-reconciliation')).toBe('covered');
    expect(state(r, 's3-going-concern')).toBe('open');
    expect(state(r, 's29-reconciliation')).toBe('open');
    expect(state(r, 's8-judgements')).toBe('open'); // never automatic
    const done = run(both, { goingConcern: 'Assessed.', registeredOffice: 'Ikeja', noRelatedParties: true, directorsRemuneration: 0 }, 'food processing');
    expect(state(done, 's3-going-concern')).toBe('covered');
    expect(state(done, 's3-general')).toBe('covered');
    expect(state(done, 's33-transactions')).toBe('covered');
    expect(state(done, 's33-key-management')).toBe('covered');
  });

  it('takes the preparer’s answer, and needs a reason when an item does not apply', () => {
    const r = run(both, {
      checklist: {
        's8-judgements': { status: 'disclosed', note: 'Note 2', ...who },
        's20-leases': { status: 'na', note: '', ...who },
        's27-impairment': { status: 'na', note: 'No impairment indicators or losses in either year.', ...who },
        's3-comparatives': { status: 'na', note: 'ignored: the file shows it', ...who },
      },
    });
    expect(state(r, 's8-judgements')).toBe('disclosed');
    expect(state(r, 's20-leases')).toBe('open');
    expect(state(r, 's27-impairment')).toBe('na');
    expect(state(r, 's3-comparatives')).toBe('covered');
  });

  it('lets the preparer answer an item the software could not confirm', () => {
    const r = run(cur, { checklist: { 's3-comparatives': { status: 'na', note: 'First period of trading.', ...who } } });
    expect(state(r, 's3-comparatives')).toBe('na');
  });

  it('blocks sign-off while any item is open', () => {
    const open = checklistOpen(run(both)).length;
    expect(open).toBeGreaterThan(10);
    const gate = (n: number) =>
      signOffChecks({ type: 'compilation', lines: both, adjustments: [], planning: {}, programme: {}, programmeItemIds: [], report: {}, firmFrc: 'F', signerRole: 'partner', signerFrc: 'F', checklistOpen: n }).find((c) => c.id === 'checklist')!;
    expect(gate(open)).toMatchObject({ ok: false, blocking: true });
    expect(gate(0).ok).toBe(true);
  });
});
