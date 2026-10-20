import { readFileSync, writeFileSync } from 'node:fs';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import writeExcelFile from 'write-excel-file/node';
import { extendedTrialBalance, leadSchedules } from './etb';
import { etbWorkbook } from './etbSheets';
import { mergeYears } from './merge';
import { buildStatements } from './statements';
import type { TbLine } from './types';
import { readYears } from './years';

const read = (f: string) => readYears(Papa.parse<string[]>(readFileSync(`public/samples/${f}`, 'utf8'), { skipEmptyLines: true }).data, f)[0].lines;
const lines: TbLine[] = mergeYears(
  [],
  [
    { slot: 'current', lines: read('trial-balance-2025.csv') },
    { slot: 'prior', lines: read('trial-balance-2024.csv') },
  ],
  new Map(),
  [],
).map((l, i) => ({ ...l, id: `l${i}` }));
const id = (code: string) => lines.find((l) => l.code === code)!.id;
const adjustments = [{ id: 'j', ref: 'AJ1', description: 'Accrue diesel', posted: true, lines: [{ lineId: id('6210'), amount: 100_000_00 }, { lineId: id('2100'), amount: -100_000_00 }] }];

describe('the ETB workbook', () => {
  const etb = extendedTrialBalance(lines, adjustments);
  const leads = leadSchedules(etb, buildStatements(lines, adjustments));
  const sheets = etbWorkbook({ client: 'Adunni Foods Limited', firm: 'Okafor & Bello', yearEnd: '2025-12-31', yearEndText: '31 December 2025', preparedBy: 'Ada Okafor', preparedOn: '20 October 2026', currency: 'Nigerian naira', etb, leads });

  it('has the ETB, a summary, and a sheet for each lead schedule', () => {
    expect(sheets.slice(0, 2).map((s) => s.sheet)).toEqual(['ETB', 'Lead summary']);
    expect(sheets.length).toBe(2 + leads.length);
    expect(sheets.every((s) => s.sheet.length <= 31)).toBe(true);
    const etbSheet = sheets[0];
    const row = etbSheet.data.find((r) => r[0]?.value === '6210')!;
    expect(row[8]?.value).toBe('AJ1');
    expect(row[9]).toMatchObject({ type: 'Formula' });
  });

  it('writes a file Excel can open', async () => {
    const buf = await writeExcelFile(sheets as never).toBuffer();
    expect(buf.length).toBeGreaterThan(5000);
    if (process.env.XLSX_OUT) writeFileSync(process.env.XLSX_OUT, buf);
  });
});
