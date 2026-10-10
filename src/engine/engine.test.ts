import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { PROGRAMMES } from '../content/programmes';
import { canSign, computeMateriality, signOffChecks, unadjustedEffect, validateTrialBalance } from './checks';
import { suggestMapping } from './mapping';
import { mergeImport } from './merge';
import { fmt, parseAmount } from './money';
import { parseTrialBalance } from './parse';
import { draftReport } from './report';
import { buildStatements } from './statements';
import type { Adjustment, TbLine } from './types';

const N = (naira: number) => naira * 100;
const rows = (f: string) =>
  Papa.parse<string[]>(readFileSync(`public/samples/${f}`, 'utf8'), { skipEmptyLines: true }).data;

function load(): TbLine[] {
  const cur = parseTrialBalance(rows('trial-balance-2025.csv')).lines;
  const prior = new Map(parseTrialBalance(rows('trial-balance-2024.csv')).lines.map((l) => [l.code, l.balance]));
  return cur.map((l) => ({
    id: l.code,
    code: l.code,
    name: l.name,
    balance: l.balance,
    prior: prior.get(l.code) ?? 0,
    ...suggestMapping(l.name),
  }));
}

describe('amounts', () => {
  it('parses the formats found in exported trial balances', () => {
    expect(parseAmount('1,234.50')).toBe(123450);
    expect(parseAmount('(1,234.50)')).toBe(-123450);
    expect(parseAmount('-1234.5')).toBe(-123450);
    expect(parseAmount('1,234.50 Cr')).toBe(-123450);
    expect(parseAmount('₦2,000')).toBe(200000);
    expect(parseAmount(19.99)).toBe(1999);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('Assets')).toBeNull();
  });
  it('formats in whole naira with brackets for negatives', () => {
    expect(fmt(N(1234567))).toBe('1,234,567');
    expect(fmt(-N(500))).toBe('(500)');
    expect(fmt(0)).toBe('–');
  });
});

describe('trial balance import', () => {
  it('finds the header below title rows and skips the total row', () => {
    const r = parseTrialBalance(rows('trial-balance-2025.csv'));
    expect(r.headerRow).toBe(3);
    expect(r.lines).toHaveLength(32);
    expect(r.lines.reduce((a, l) => a + l.balance, 0)).toBe(0);
    expect(r.lines.find((l) => l.code === '1090')!.balance).toBe(-N(14_900_000));
  });
  it('reads a single balance column', () => {
    const r = parseTrialBalance([
      ['Account', 'Balance'],
      ['Bank', '500.00'],
      ['Share capital', '(500.00)'],
    ]);
    expect(r.lines.map((l) => l.balance)).toEqual([50000, -50000]);
  });
  it('rejects a sheet with no recognisable header', () => {
    expect(() => parseTrialBalance([['a', 'b'], ['1', '2']])).toThrow(/header/i);
  });
});

describe('mapping suggestions', () => {
  it('maps every account in the sample', () => {
    const lines = load();
    expect(lines.filter((l) => !l.mapCode).map((l) => l.name)).toEqual([]);
  });
  it('places the awkward accounts correctly', () => {
    const m = (n: string) => suggestMapping(n).mapCode;
    expect(m('Accumulated depreciation')).toBe('ppe');
    expect(m('Depreciation')).toBe('admin_expenses');
    expect(suggestMapping('Depreciation').nature).toBe('depreciation');
    expect(m('Company income tax payable')).toBe('current_tax_payable');
    expect(m('Company income tax')).toBe('income_tax_expense');
    expect(m('Prepaid rent')).toBe('other_receivables');
    expect(m('Rent and rates')).toBe('admin_expenses');
    expect(m('Interest expense on loan')).toBe('finance_costs');
    expect(m('Term loan')).toBe('borrowings_nc');
    expect(m('Bank overdraft')).toBe('borrowings_c');
    expect(m('Staff loans')).toBe('other_receivables');
    expect(suggestMapping('Salaries and wages').nature).toBe('staff');
    expect(m('Zxqv')).toBeNull();
  });
});

describe('financial statements', () => {
  const st = buildStatements(load(), []);
  it('computes profit and loss', () => {
    expect(st.cur.grossProfit).toBe(N(87_300_000));
    expect(st.cur.operatingProfit).toBe(N(33_300_000));
    expect(st.cur.pbt).toBe(N(30_120_000));
    expect(st.cur.profit).toBe(N(23_220_000));
    expect(st.prior!.profit).toBe(N(13_270_000));
  });
  it('balances the statement of financial position in both years', () => {
    expect(st.cur.totalAssets).toBe(N(119_850_000));
    expect(st.cur.totalAssets).toBe(st.cur.totalEquityAndLiabilities);
    expect(st.cur.closingRetained).toBe(N(59_990_000));
    expect(st.prior!.totalAssets).toBe(st.prior!.totalEquityAndLiabilities);
    expect(st.prior!.closingRetained).toBe(st.cur.v.retained_earnings);
  });
  it('reconciles the cash flow to the movement in cash', () => {
    expect(st.cashFlowDifference).toBe(0);
    const net = st.cashFlow!.find((r) => r.label.startsWith('Net change'))!.cur;
    expect(net).toBe(N(10_000_000 - 1_890_000));
    const ops = st.cashFlow!.find((r) => r.label === 'Net cash from operating activities')!.cur;
    // PBT 30,120 + dep 5,300 + finance costs 3,600 - finance income 420 - inventories 3,500
    // - receivables 5,150 - prepayments 400 + payables 2,500 + other payables 940 = 32,990; tax paid 6,100.
    expect(ops).toBe(N(26_890_000));
  });
  it('makes the value added statement agree with itself', () => {
    const added = st.valueAdded.filter((r) => r.label === 'Value added');
    const applied = st.valueAdded.slice(4, 10).reduce((a, r) => a + (r.cur ?? 0), 0);
    expect(added[0].cur).toBe(applied);
    expect(added[0].cur).toBe(N(249_020_000 - 179_330_000));
  });
  it('rolls equity forward to the closing balance', () => {
    const last = st.equity.rows.at(-1)!;
    expect(last.values[4]).toBe(st.cur.totalEquity);
    const col = st.equity.rows.slice(0, -1).reduce((a, r) => a + r.values[4], 0);
    expect(col).toBe(st.cur.totalEquity);
  });
  it('flags opening balances that do not agree to the prior year', () => {
    const lines = load().map((l) =>
      l.code === '3100' ? { ...l, balance: l.balance + N(1000) } : l.code === '1400' ? { ...l, balance: l.balance - N(1000) } : l,
    );
    const s = buildStatements(lines, []);
    expect(s.cashFlowDifference).toBe(-N(1000));
    expect(s.cashFlow!.at(-1)!.style).toBe('check');
  });
  it('applies posted journals and leaves proposed ones out', () => {
    const adj: Adjustment[] = [
      { id: 'a1', ref: 'AJ1', description: 'Accrue audit fee', posted: true, lines: [{ lineId: '6220', amount: N(500_000) }, { lineId: '2100', amount: -N(500_000) }] },
      { id: 'a2', ref: 'AJ2', description: 'Cut-off error', posted: false, lines: [{ lineId: '4000', amount: N(900_000) }, { lineId: '1300', amount: -N(900_000) }] },
    ];
    const s = buildStatements(load(), adj);
    expect(s.cur.profit).toBe(N(23_220_000 - 500_000));
    expect(s.cur.totalAssets).toBe(s.cur.totalEquityAndLiabilities);
    expect(unadjustedEffect(load(), adj)).toBe(-N(900_000));
  });
});

describe('validation and sign-off', () => {
  it('catches a trial balance that does not foot and unmapped accounts', () => {
    const lines = load();
    lines[0] = { ...lines[0], balance: lines[0].balance + 1, mapCode: null };
    const c = validateTrialBalance(lines);
    expect(c.find((x) => x.id === 'tb_foots')!.ok).toBe(false);
    expect(c.find((x) => x.id === 'mapped')!.ok).toBe(false);
  });
  it('computes materiality from the chosen benchmark', () => {
    const st = buildStatements(load(), []);
    const m = computeMateriality(st.cur, { benchmark: 'revenue', percent: 1 })!;
    expect(m.overall).toBe(N(2_486_000));
    expect(m.performance).toBe(N(1_864_500));
    expect(m.trivial).toBe(N(124_300));
  });
  it('blocks sign-off until every gate is met, and only lets a partner sign', () => {
    const ids = PROGRAMMES.audit.map((i) => i.id);
    const base = {
      type: 'audit' as const,
      lines: load(),
      adjustments: [],
      planning: {},
      programme: {},
      programmeItemIds: ids,
      report: {},
      firmFrc: 'FRC/2020/00000000001',
      signerRole: 'partner',
      signerFrc: 'FRC/2015/ICAN/00000012345',
    };
    expect(canSign(signOffChecks(base))).toBe(false);
    const ready = {
      ...base,
      planning: { benchmark: 'revenue' as const, percent: 1, rationale: 'Revenue is the stable measure users focus on.' },
      programme: Object.fromEntries(ids.map((id) => [id, { done: true }])),
      report: { opinion: 'unmodified' as const, ceoName: 'A', ceoFrc: 'F1', cfoName: 'B', cfoFrc: 'F2' },
    };
    expect(canSign(signOffChecks(ready))).toBe(true);
    expect(canSign(signOffChecks({ ...ready, signerRole: 'manager' }))).toBe(false);
    expect(canSign(signOffChecks({ ...ready, signerFrc: '' }))).toBe(false);
    expect(canSign(signOffChecks({ ...ready, report: { ...ready.report, opinion: 'qualified' as const } }))).toBe(false);
  });
});

describe('draft report', () => {
  const input = { clientName: 'Adunni Foods Limited', yearEnd: '2025-12-31', hasCashFlow: true };
  it('drafts each opinion type', () => {
    const u = draftReport({ ...input, type: 'audit', settings: { opinion: 'unmodified' } });
    expect(u.sections[0].heading).toBe('Opinion');
    expect(u.sections[0].paragraphs[1]).toContain('true and fair view');
    expect(u.sections[0].paragraphs[0]).toContain('31 December 2025');
    const q = draftReport({ ...input, type: 'audit', settings: { opinion: 'qualified', basis: 'Inventory count not attended.' } });
    expect(q.sections[1].heading).toBe('Basis for qualified opinion');
    expect(q.sections[1].paragraphs[0]).toBe('Inventory count not attended.');
    const d = draftReport({ ...input, type: 'audit', settings: { opinion: 'disclaimer', basis: 'x' } });
    expect(d.sections[0].paragraphs[1]).toContain('do not express an opinion');
  });
  it('never words a compilation as assurance', () => {
    const c = draftReport({ ...input, type: 'compilation', settings: {} });
    expect(c.sections[0].paragraphs.join(' ')).toContain('do not express an audit opinion');
  });
});

describe('import merge', () => {
  const cur = parseTrialBalance(rows('trial-balance-2025.csv')).lines;
  const prior = parseTrialBalance(rows('trial-balance-2024.csv')).lines;
  const withIds = (ls: ReturnType<typeof mergeImport>): TbLine[] => ls.map((l) => ({ ...l, id: l.code }));
  it('gives the same statements whichever year is imported first', () => {
    const a = withIds(mergeImport(withIds(mergeImport([], cur, 'current', new Map(), [])), prior, 'prior', new Map(), []));
    const b = withIds(mergeImport(withIds(mergeImport([], prior, 'prior', new Map(), [])), cur, 'current', new Map(), []));
    expect(a).toEqual(b);
    expect(buildStatements(a, []).cashFlowDifference).toBe(0);
    expect(a.every((l) => l.prior !== null)).toBe(true);
  });
  it('keeps confirmed mappings on re-import and uses remembered ones for new accounts', () => {
    const first = withIds(mergeImport([], cur, 'current', new Map(), []));
    first.find((l) => l.code === '6230')!.mapCode = 'finance_costs';
    const again = mergeImport(first, cur, 'current', new Map(), []);
    expect(again.find((l) => l.code === '6230')!.mapCode).toBe('finance_costs');
    const saved = new Map([['6230', { mapCode: 'finance_costs', nature: null }]]);
    const fresh = mergeImport([], cur, 'current', saved, []);
    expect(fresh.find((l) => l.code === '6230')!.mapCode).toBe('finance_costs');
    expect(fresh.find((l) => l.code === '1000')!.prior).toBeNull();
  });
  it('refuses to drop an account that a journal posts to', () => {
    const first = withIds(mergeImport([], cur, 'current', new Map(), []));
    const adj: Adjustment[] = [{ id: 'a', ref: 'AJ1', description: '', posted: true, lines: [{ lineId: '6230', amount: 1 }] }];
    expect(() => mergeImport(first, cur.filter((l) => l.code !== '6230'), 'current', new Map(), adj)).toThrow(/AJ1/);
  });
});

describe('mapping dividends', () => {
  it('treats dividends received as income and dividends paid as a distribution', async () => {
    const { suggestMapping } = await import('./mapping');
    expect(suggestMapping('Dividend income').mapCode).toBe('other_income');
    expect(suggestMapping('Dividends received from subsidiary').mapCode).toBe('other_income');
    expect(suggestMapping('Dividend receivable').mapCode).toBe('other_receivables');
    expect(suggestMapping('Dividends paid').mapCode).toBe('dividends');
    expect(suggestMapping('Dividend declared').mapCode).toBe('dividends');
    expect(suggestMapping('Investment in subsidiary').mapCode).toBe('investments');
  });
});

describe('group report wording', () => {
  const input = { clientName: 'Zuma Holdings Limited', yearEnd: '2025-12-31', hasCashFlow: true, group: true, groupCashFlow: true };
  const text = (r: ReturnType<typeof draftReport>) => r.sections.flatMap((s) => [s.heading, ...s.paragraphs]).join('\n');
  it('covers the consolidated and the separate statements in an audit report', () => {
    const t = text(draftReport({ ...input, type: 'audit', settings: { opinion: 'unmodified' } }));
    expect(t).toContain('We have audited the consolidated and separate financial statements of Zuma Holdings Limited (the Company) and its subsidiaries (together, the Group)');
    expect(t).toContain('the consolidated and separate statements of financial position as at 31 December 2025');
    expect(t).toContain('the consolidated statement of cash flows');
    expect(t).toContain('give a true and fair view of the consolidated and separate financial position of the Group and the Company as at 31 December 2025, and their consolidated and separate financial performance and cash flows');
    expect(t).toContain('We are independent of the Group and the Company');
    expect(t).toContain('the Group’s and the Company’s ability to continue as a going concern');
    expect(t).toContain('We remain solely responsible for our audit opinion.');
    expect(t).not.toMatch(/consolidated and separate consolidated/);
    expect(t).not.toMatch(/(?<!separate |consolidated )financial statements/);
    expect(t).not.toMatch(/\bthe company\b/);
  });
  it('leaves the group audit paragraph out of a disclaimer, and rewords the other report types', () => {
    expect(text(draftReport({ ...input, type: 'audit', settings: { opinion: 'disclaimer', basis: 'x' } }))).not.toContain('We remain solely responsible');
    expect(text(draftReport({ ...input, groupCashFlow: false, type: 'audit', settings: {} }))).not.toContain('consolidated statement of cash flows');
    for (const type of ['review', 'compilation'] as const) {
      const t = text(draftReport({ ...input, type, settings: {} }));
      expect(t).toContain('consolidated and separate financial statements of Zuma Holdings Limited (the Company) and its subsidiaries');
      expect(t).not.toContain('We remain solely responsible');
    }
  });
  it('is unchanged for a company with no subsidiaries', () => {
    const t = text(draftReport({ ...input, group: false, type: 'audit', settings: {} }));
    expect(t).not.toContain('consolidated');
    expect(t).toContain('We have audited the financial statements of Zuma Holdings Limited');
  });
});

describe('paragraphs the partner adds to a report', () => {
  const input = { clientName: 'Adunni Foods Limited', yearEnd: '2025-12-31', hasCashFlow: true };
  const headings = (r: ReturnType<typeof draftReport>) => r.sections.map((s) => s.heading);
  const added = { goingConcern: 'We draw attention to Note 4.', emphasis: 'We draw attention to Note 9.', otherMatter: 'The prior year was audited by another firm.' };

  it('always carries an Other information section in an audit report, with nothing to report by default', () => {
    const r = draftReport({ ...input, type: 'audit', settings: { opinion: 'unmodified' } });
    expect(headings(r)).toEqual(['Opinion', 'Basis for opinion', 'Other information', 'Responsibilities of the directors for the financial statements', 'Auditor’s responsibilities for the audit of the financial statements', 'Report on other legal and regulatory requirements']);
    const other = r.sections[2].paragraphs;
    expect(other.at(-1)).toBe('We have nothing to report in this regard.');
    expect(other.join(' ')).toContain('statement of value added');
    const found = draftReport({ ...input, type: 'audit', settings: { opinion: 'unmodified', otherInformation: 'The report of the directors states revenue of ₦2bn.' } });
    expect(found.sections[2].paragraphs.at(-1)).toBe('The report of the directors states revenue of ₦2bn.');
    expect(found.sections[2].paragraphs.join(' ')).not.toContain('nothing to report');
  });

  it('places the partner’s paragraphs in order after the basis, each closed as the standards require', () => {
    const r = draftReport({ ...input, type: 'audit', settings: { opinion: 'qualified', basis: 'x', ...added } });
    expect(headings(r).slice(0, 6)).toEqual(['Qualified opinion', 'Basis for qualified opinion', 'Material uncertainty related to going concern', 'Emphasis of matter', 'Other matter', 'Other information']);
    expect(r.sections[2].paragraphs).toEqual(['We draw attention to Note 4.', 'Our opinion is not modified in respect of this matter.']);
    expect(r.sections[3].paragraphs[1]).toBe('Our opinion is not modified in respect of this matter.');
    expect(r.sections[4].paragraphs).toEqual(['The prior year was audited by another firm.']);
  });

  it('adds none of them to a disclaimer, and no going concern section to an adverse opinion', () => {
    const d = draftReport({ ...input, type: 'audit', settings: { opinion: 'disclaimer', basis: 'x', ...added } });
    expect(headings(d).some((h) => /going concern|Emphasis|Other matter|Other information/.test(h))).toBe(false);
    const a = draftReport({ ...input, type: 'audit', settings: { opinion: 'adverse', basis: 'x', ...added } });
    expect(headings(a)).not.toContain('Material uncertainty related to going concern');
    expect(headings(a)).toContain('Emphasis of matter');
  });

  it('modifies a review conclusion, and blocks sign-off without a basis', () => {
    const u = draftReport({ ...input, type: 'review', settings: {} });
    expect(headings(u).at(-1)).toBe('Conclusion');
    const q = draftReport({ ...input, type: 'review', settings: { opinion: 'qualified', basis: 'Inventory was not counted.', emphasis: 'We draw attention to Note 9.' } });
    expect(headings(q).slice(-3)).toEqual(['Basis for qualified conclusion', 'Qualified conclusion', 'Emphasis of matter']);
    expect(q.sections.at(-2)!.paragraphs[0]).toContain('except for the effects of the matter described in the Basis for qualified conclusion paragraph, nothing has come to our attention');
    expect(q.sections.at(-1)!.paragraphs[1]).toBe('Our conclusion is not modified in respect of this matter.');
    expect(draftReport({ ...input, type: 'review', settings: { opinion: 'adverse', basis: 'x' } }).sections.at(-1)!.paragraphs[0]).toContain('do not present fairly');
    expect(draftReport({ ...input, type: 'review', settings: { opinion: 'disclaimer', basis: 'x' } }).sections.at(-1)!.paragraphs[0]).toContain('we do not express a conclusion');
    const gate = (report: object) =>
      signOffChecks({ type: 'review', lines: [], adjustments: [], planning: {}, programme: {}, programmeItemIds: [], report, firmFrc: 'F', signerRole: 'partner', signerFrc: 'F' }).find((c) => c.id === 'review_basis');
    expect(gate({})).toBeUndefined();
    expect(gate({ opinion: 'qualified' })).toMatchObject({ ok: false, blocking: true });
    expect(gate({ opinion: 'qualified', basis: 'x' })).toMatchObject({ ok: true });
  });

  it('rewords the added paragraphs for a group', () => {
    const r = draftReport({ ...input, type: 'audit', group: true, groupCashFlow: true, settings: { opinion: 'unmodified' } });
    const other = r.sections.find((s) => s.heading === 'Other information')!.paragraphs.join(' ');
    expect(other).toContain('Our opinion on the consolidated and separate financial statements does not cover the other information');
  });
});
