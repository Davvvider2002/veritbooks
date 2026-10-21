// The extended trial balance and lead schedules as an Excel workbook, for the file and for the
// client. Totals, final balances, movements and differences are Excel formulas, so the figures can
// be followed and checked in the sheet itself. Headings and the first two columns are frozen.
import { changePct, type Etb, type LeadSchedule } from './etb';
import { SOURCE_LABEL, type Register } from './journalRegister';
import type { Kobo } from './types';

type Cell = { value?: string | number; type?: 'Formula' | StringConstructor | NumberConstructor; format?: string; fontWeight?: 'bold'; fontStyle?: 'italic'; backgroundColor?: string; textColor?: string; topBorderStyle?: 'thin' | 'double'; bottomBorderStyle?: 'thin' | 'double'; align?: 'left' | 'right' | 'center'; wrap?: boolean; columnSpan?: number; indent?: number } | null;
export interface SheetSpec {
  sheet: string;
  data: Cell[][];
  columns: { width: number }[];
  stickyRowsCount: number;
  stickyColumnsCount: number;
  orientation: 'landscape';
}

export interface WorkbookInput {
  client: string;
  firm: string;
  yearEnd: string;
  /** "31 December 2025". */
  yearEndText: string;
  preparedBy: string;
  preparedOn: string;
  currency: string;
  etb: Etb;
  leads: LeadSchedule[];
  /** The journals passed, listed on their own sheet when given. */
  register?: Register;
}

const NUM = '#,##0.00;(#,##0.00);"-"';
const PCT = '0.0"%";(0.0"%");"-"';
const HEAD = '#1f3d33';
const units = (k: Kobo | null) => (k === null ? null : k / 100);
const num = (v: number | null, extra: Partial<NonNullable<Cell>> = {}): Cell => (v === null ? null : { value: v, type: Number, format: NUM, ...extra });
const formula = (f: string, extra: Partial<NonNullable<Cell>> = {}): Cell => ({ value: f, type: 'Formula', format: NUM, ...extra });
const text = (v: string, extra: Partial<NonNullable<Cell>> = {}): Cell => ({ value: v, type: String, ...extra });
const th = (v: string, right = false): Cell => ({ value: v, type: String, fontWeight: 'bold', textColor: '#ffffff', backgroundColor: HEAD, align: right ? 'right' : 'left', wrap: true });
const bold = { fontWeight: 'bold' as const };
const totalStyle = { fontWeight: 'bold' as const, topBorderStyle: 'thin' as const, bottomBorderStyle: 'double' as const };

/** The heading block every sheet starts with: who, what, which year, and space for sign-off. */
function header(input: Pick<WorkbookInput, 'client' | 'yearEndText' | 'currency' | 'preparedBy' | 'preparedOn'>, title: string, ref: string, width: number): Cell[][] {
  const pad = (c: Cell[]) => [...c, ...Array(Math.max(0, width - c.length)).fill(null)];
  return [
    pad([text(input.client, { fontWeight: 'bold', columnSpan: 4 })]),
    pad([text(`${title}, year ended ${input.yearEndText}`, { columnSpan: 4 })]),
    pad([text(`Amounts in ${input.currency}. Debit balances positive, credit balances in brackets.`, { fontStyle: 'italic', columnSpan: 6 })]),
    pad([text('W/P ref'), text(ref, bold), text('Prepared by'), text(`${input.preparedBy}, ${input.preparedOn}`), text('Reviewed by'), text('')]),
    pad([]),
  ];
}

/** A valid, distinct sheet name of at most 31 characters. */
function sheetName(s: string, used: Set<string>) {
  const clean = s.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim();
  // Cut at a word, so "F Other receivables and prepayments" reads "F Other receivables".
  let base = clean.length <= 31 ? clean : clean.slice(0, 32).replace(/\s+\S*$/, '').replace(/\s+(and|of|the)$/i, '');
  let n = 2;
  while (used.has(base.toLowerCase())) base = `${s.slice(0, 27)} (${n++})`;
  used.add(base.toLowerCase());
  return base;
}

export function etbWorkbook(input: WorkbookInput): SheetSpec[] {
  const used = new Set<string>();
  const withPrior = input.etb.totals.prior !== null;
  const sheets: SheetSpec[] = [];

  // --- The extended trial balance -------------------------------------------------------
  {
    const heads = ['Code', 'Account', 'Statement line', 'Lead', 'Prior year final', 'Draft TB', 'Adjustments Dr', 'Adjustments Cr', 'Journals', 'Final TB', 'Movement', 'Change %', 'W/P ref'];
    const data: Cell[][] = header(input, 'Extended trial balance', 'ETB', heads.length);
    data.push(heads.map((h, i) => th(h, i >= 4 && i !== 8 && i !== 12)));
    const first = data.length + 1; // Excel rows are numbered from 1
    for (const r of input.etb.rows) {
      const n = data.length + 1;
      data.push([
        text(r.code),
        text(r.name),
        text(r.line),
        text(r.lead, { align: 'center' }),
        withPrior ? num(units(r.prior)) : null,
        num(units(r.draft)),
        num(r.dr ? units(r.dr) : 0),
        num(r.cr ? units(r.cr) : 0),
        text(r.refs.join(', ')),
        formula(`F${n}+G${n}-H${n}`),
        withPrior ? formula(`J${n}-E${n}`) : null,
        withPrior ? { value: `IF(E${n}=0,"",(J${n}-E${n})/ABS(E${n})*100)`, type: 'Formula', format: PCT } : null,
        text(''),
      ]);
    }
    const last = data.length;
    const t = data.length + 1;
    const sum = (c: string) => formula(`SUM(${c}${first}:${c}${last})`, totalStyle);
    data.push([text('Total', bold), null, null, null, withPrior ? sum('E') : null, sum('F'), sum('G'), sum('H'), null, sum('J'), withPrior ? sum('K') : null, null, null]);
    data.push([]);
    data.push([text('Checks', bold)]);
    data.push([text('Draft trial balance totals nil'), null, null, null, null, formula(`F${t}`), null, null, null, null, null, null, null]);
    data.push([text('Adjustments: debits less credits'), null, null, null, null, null, formula(`G${t}-H${t}`), null, null, null, null, null, null]);
    data.push([text('Final trial balance totals nil'), null, null, null, null, null, null, null, null, formula(`J${t}`), null, null, null]);
    if (input.etb.unposted.length)
      data.push([text(`Unadjusted differences recorded but not posted, so not in the final column: ${input.etb.unposted.join(', ')}.`, { fontStyle: 'italic', columnSpan: 9 })]);
    sheets.push({
      sheet: sheetName('ETB', used),
      data,
      columns: [{ width: 12 }, { width: 36 }, { width: 30 }, { width: 6 }, { width: 17 }, { width: 17 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 17 }, { width: 16 }, { width: 10 }, { width: 10 }],
      stickyRowsCount: 6,
      stickyColumnsCount: 2,
      orientation: 'landscape',
    });
  }

  // --- The lead schedules summary --------------------------------------------------------
  {
    const heads = ['Lead', 'Area of the financial statements', 'Prior year final', 'Draft TB', 'Adjustments', 'Final TB', 'Movement', 'Change %'];
    const data: Cell[][] = header(input, 'Lead schedules: summary', 'LS', heads.length);
    data.push(heads.map((h, i) => th(h, i >= 2)));
    const first = data.length + 1;
    for (const l of input.leads) {
      const n = data.length + 1;
      data.push([
        text(l.ref, { align: 'center', fontWeight: 'bold' }),
        text(l.title),
        withPrior ? num(units(l.prior)) : null,
        num(units(l.draft)),
        num(units(l.dr - l.cr)),
        formula(`D${n}+E${n}`),
        withPrior ? formula(`F${n}-C${n}`) : null,
        withPrior ? { value: `IF(C${n}=0,"",(F${n}-C${n})/ABS(C${n})*100)`, type: 'Formula', format: PCT } : null,
      ]);
    }
    const last = data.length;
    const sum = (c: string) => formula(`SUM(${c}${first}:${c}${last})`, totalStyle);
    data.push([text('Total', bold), null, withPrior ? sum('C') : null, sum('D'), sum('E'), sum('F'), withPrior ? sum('G') : null, null]);
    sheets.push({
      sheet: sheetName('Lead summary', used),
      data,
      columns: [{ width: 7 }, { width: 40 }, { width: 17 }, { width: 17 }, { width: 16 }, { width: 17 }, { width: 16 }, { width: 10 }],
      stickyRowsCount: 6,
      stickyColumnsCount: 2,
      orientation: 'landscape',
    });
  }

  // --- One sheet for each lead schedule ----------------------------------------------------
  for (const l of input.leads) {
    const heads = ['Ref', 'Code', 'Account', 'Prior year final', 'Draft TB', 'Adjustments Dr', 'Adjustments Cr', 'Journals', 'Final TB', 'Movement', 'Change %', 'Tick / W/P ref'];
    const data: Cell[][] = header(input, `Lead schedule ${l.ref}: ${l.title}`, l.ref, heads.length);
    data.push(heads.map((h, i) => th(h, (i >= 3 && i <= 6) || (i >= 8 && i <= 10))));
    const subtotals: number[] = [];
    l.lines.forEach((line, li) => {
      data.push([text(`${l.ref}${li + 1}`, bold), null, text(`${line.label}${line.note ? ` (note ${line.note})` : ''}`, bold)]);
      const first = data.length + 1;
      line.rows.forEach((r, ri) => {
        const n = data.length + 1;
        data.push([
          text(`${l.ref}${li + 1}.${ri + 1}`),
          text(r.code),
          text(r.name),
          withPrior ? num(units(r.prior)) : null,
          num(units(r.draft)),
          num(units(r.dr)),
          num(units(r.cr)),
          text(r.refs.join(', ')),
          formula(`E${n}+F${n}-G${n}`),
          withPrior ? formula(`I${n}-D${n}`) : null,
          withPrior ? { value: `IF(D${n}=0,"",(I${n}-D${n})/ABS(D${n})*100)`, type: 'Formula', format: PCT } : null,
          text(''),
        ]);
      });
      const last = data.length;
      const s = data.length + 1;
      subtotals.push(s);
      const sum = (c: string) => formula(`SUM(${c}${first}:${c}${last})`, { fontWeight: 'bold', topBorderStyle: 'thin' });
      data.push([null, null, text(`Total ${line.label.toLowerCase()}`, bold), withPrior ? sum('D') : null, sum('E'), sum('F'), sum('G'), null, sum('I'), withPrior ? sum('J') : null, null, null]);
      const fs = data.length + 1;
      data.push([null, null, text(`Per financial statements${line.note ? `, note ${line.note}` : ''}`, { fontStyle: 'italic' }), withPrior ? num(units(line.fsPrior)) : null, null, null, null, null, num(units(line.fsFinal)), null, null, null]);
      data.push([null, null, text('Difference', { fontStyle: 'italic' }), withPrior ? formula(`D${s}-D${fs}`) : null, null, null, null, null, formula(`I${s}-I${fs}`), null, null, null]);
      data.push([]);
    });
    const total = (c: string) => formula(subtotals.map((r) => `${c}${r}`).join('+'), totalStyle);
    data.push([null, null, text(`Total lead schedule ${l.ref}`, bold), withPrior ? total('D') : null, total('E'), total('F'), total('G'), null, total('I'), withPrior ? total('J') : null, null, null]);
    data.push([]);
    data.push([text('Tick marks', bold)]);
    for (const [mark, meaning] of [
      ['✓', 'Agreed to the trial balance'],
      ['W', 'Agreed to supporting working paper'],
      ['F', 'Footed or recalculated'],
      ['PY', 'Agreed to last year’s audited financial statements'],
    ])
      data.push([text(mark, { align: 'center' }), null, text(meaning)]);
    sheets.push({
      sheet: sheetName(`${l.ref} ${l.title}`, used),
      data,
      columns: [{ width: 7 }, { width: 11 }, { width: 38 }, { width: 17 }, { width: 17 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 17 }, { width: 16 }, { width: 10 }, { width: 14 }],
      stickyRowsCount: 6,
      stickyColumnsCount: 3,
      orientation: 'landscape',
    });
  }
  if (input.register && input.register.entries.length) sheets.splice(1, 0, journalsSheet(input, input.register, used));
  return sheets;
}

type HeaderInput = Pick<WorkbookInput, 'client' | 'yearEndText' | 'currency' | 'preparedBy' | 'preparedOn'>;

/** Every journal passed, whichever step made it, with a total and a summary by source. */
function journalsSheet(input: HeaderInput, register: Register, used: Set<string>): SheetSpec {
  {
    const heads = ['Ref', 'Source', 'Description', 'Code', 'Account', 'Debit', 'Credit', 'Status'];
    const data: Cell[][] = [...header(input, 'Journals passed', 'JNL', heads.length), heads.map((h, i) => th(h, i === 5 || i === 6))];
    const first = data.length + 1;
    for (const e of register.entries) {
      e.lines.forEach((l, i) =>
        data.push([
          i === 0 ? text(e.ref, bold) : null,
          i === 0 ? text(SOURCE_LABEL[e.source]) : null,
          i === 0 ? text(e.description, { wrap: true }) : null,
          text(l.code),
          text(l.name),
          l.debit ? num(units(l.debit)) : null,
          l.credit ? num(units(l.credit)) : null,
          i === 0 ? text(e.posted ? 'Posted' : 'Unadjusted difference') : null,
        ]),
      );
    }
    const last = data.length;
    data.push([text('Total', bold), null, null, null, null, formula(`SUM(F${first}:F${last})`, totalStyle), formula(`SUM(G${first}:G${last})`, totalStyle), null]);
    data.push(Array(heads.length).fill(null));
    data.push([text('Summary by source', bold), null, null, null, null, text('Posted', { ...bold, align: 'right' }), text('Unadjusted', { ...bold, align: 'right' }), text('Journals', bold)]);
    for (const b of register.bySource) data.push([text(SOURCE_LABEL[b.source]), null, null, null, null, num(units(b.posted)), num(units(b.unadjusted)), { value: b.count, type: Number }]);
    return {
      sheet: sheetName('Journals passed', used),
      data,
      columns: [{ width: 9 }, { width: 20 }, { width: 44 }, { width: 10 }, { width: 34 }, { width: 17 }, { width: 17 }, { width: 22 }],
      stickyRowsCount: 6,
      stickyColumnsCount: 1,
      orientation: 'landscape',
    };
  }
}

/** The journals passed on their own, as a workbook. */
export function registerWorkbook(input: HeaderInput, register: Register): SheetSpec[] {
  return [journalsSheet(input, register, new Set())];
}

/** A plain-text rendering of the change percentage, for screens. */
export const pctText = (final: Kobo, prior: Kobo | null) => {
  const p = changePct(final, prior);
  return p === null ? '' : `${p > 0 ? '+' : ''}${p.toFixed(1)}%`;
};

/** The statements over several years as a workbook: one sheet for each statement, years across. */
export function multiYearWorkbook(input: { client: string; yearEndText: string; currency: string; preparedBy: string; preparedOn: string }, m: import('./multiYear').MultiYear): SheetSpec[] {
  const used = new Set<string>();
  const base = { client: input.client, firm: '', yearEnd: '', yearEndText: input.yearEndText, preparedBy: input.preparedBy, preparedOn: input.preparedOn, currency: input.currency, etb: null as never, leads: [] };
  const sheet = (title: string, years: number[], rows: import('./multiYear').MultiRow[]): SheetSpec => {
    const data: Cell[][] = header(base, title, 'FS', years.length + 1);
    // Header text says debit positive; these are statements, in presentation sign.
    data[2] = [text(`Amounts in ${input.currency}, as presented in the financial statements.`, { fontStyle: 'italic', columnSpan: 4 })];
    data.push([th(''), ...years.map((y) => th(String(y), true))]);
    for (const r of rows) {
      const style = r.style === 'total' ? totalStyle : r.style === 'subtotal' ? { fontWeight: 'bold' as const, topBorderStyle: 'thin' as const } : r.style === 'heading' ? bold : {};
      data.push([text(r.label, r.style === 'heading' ? bold : r.style === 'line' ? { indent: 1 } : bold), ...r.values.map((v) => (r.style === 'heading' ? null : num(units(v), style)))]);
    }
    return { sheet: sheetName(title, used), data, columns: [{ width: 52 }, ...years.map(() => ({ width: 18 }))], stickyRowsCount: 6, stickyColumnsCount: 1, orientation: 'landscape' };
  };
  return [
    sheet('Financial position', m.years, m.position),
    sheet('Profit or loss', m.years, m.income),
    ...(m.cashFlowYears.length ? [sheet('Cash flows', m.cashFlowYears, m.cashFlow)] : []),
  ];
}
