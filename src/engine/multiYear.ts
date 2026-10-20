// Statements over several years: the financial position and the income statement for each year
// held (up to five), and the cash flow for each year that has the year before it (up to four).
// The current year carries the posted audit journals; earlier years are as imported.
import { buildStatements, type Row, type Statements } from './statements';
import type { Adjustment, Kobo, TbLine } from './types';
import { shiftYears, yearsHeld } from './yearsOf';

export interface YearColumn {
  year: number;
  statements: Statements;
}

export interface MultiRow {
  label: string;
  style: Row['style'];
  /** One value for each year column, latest first. Null where the year has no figure. */
  values: (Kobo | null)[];
}

export interface MultiYear {
  years: number[];
  position: MultiRow[];
  income: MultiRow[];
  /** The years with a cash flow: each needs the year before it. */
  cashFlowYears: number[];
  cashFlow: MultiRow[];
}

/** The rows of several years in one order: each year's rows, with rows missing from earlier years slotted in after the row before them. */
function lineUp(lists: Row[][]): MultiRow[] {
  const order: { label: string; style: Row['style'] }[] = [];
  const at = new Map<string, number>();
  for (const rows of lists) {
    let after = -1;
    for (const r of rows) {
      if (r.style === 'check') continue;
      const i = at.get(r.label);
      if (i !== undefined) {
        after = i;
        continue;
      }
      order.splice(after + 1, 0, { label: r.label, style: r.style });
      for (const [k, v] of at) if (v > after) at.set(k, v + 1);
      at.set(r.label, after + 1);
      after += 1;
    }
  }
  return order.map((o) => ({
    ...o,
    values: lists.map((rows) => {
      if (o.style === 'heading') return null;
      const r = rows.find((x) => x.label === o.label);
      return r ? r.cur : 0;
    }),
  }));
}

/** Statements for each year held, latest first, up to the number asked for. */
export function multiYear(lines: TbLine[], adjustments: Adjustment[], yearEnd: string, max = 5): MultiYear {
  const held = Math.min(yearsHeld(lines), max);
  const year = Number(yearEnd.slice(0, 4));
  const cols: YearColumn[] = Array.from({ length: held }, (_, i) => ({
    year: year - i,
    statements: i === 0 ? buildStatements(lines, adjustments, { comparativeCashFlow: false }) : buildStatements(shiftYears(lines, i), [], { comparativeCashFlow: false }),
  }));
  const flows = cols.filter((c) => c.statements.cashFlow !== null);
  return {
    years: cols.map((c) => c.year),
    position: lineUp(cols.map((c) => c.statements.position)),
    income: lineUp(cols.map((c) => c.statements.income)),
    cashFlowYears: flows.map((c) => c.year),
    cashFlow: lineUp(flows.map((c) => c.statements.cashFlow!)),
  };
}
