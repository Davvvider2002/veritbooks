import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { PdfPasswordError, readPdfText, type PdfLib } from '../pdf';
import { balanceAt, parseBankStatement, reconcile } from './bank';
import { parseLedger } from './ledger';
import { pdfToRows, type PdfItem } from './pdfTable';

const lib = pdfjs as unknown as PdfLib;
const file = (f: string) => {
  const b = readFileSync(`public/samples/${f}`);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const N = (naira: number) => Math.round(naira * 100);

describe('bank statement PDF', () => {
  it('reads the sample statement to the same transactions as the CSV', async () => {
    const pages = await readPdfText(lib, file('bank-statement-2025.pdf'));
    expect(pages).toHaveLength(22);
    const t = pdfToRows(pages);
    expect(t.pagesWithHeader).toBe(22);
    expect(t.rows[0]).toEqual(['Trans Date', 'Value Date', 'Narration', 'Debit', 'Credit', 'Balance']);
    const pdf = parseBankStatement(t.rows);
    const csv = parseBankStatement(Papa.parse<string[]>(readFileSync('public/samples/bank-statement-2025.csv', 'utf8'), { skipEmptyLines: true }).data);
    expect(pdf.lines).toHaveLength(759);
    expect(pdf.breaks).toBe(0);
    expect(pdf.opening).toBe(N(1_790_000));
    expect(balanceAt(pdf, '2025-12-31')).toBe(N(9_985_874.34));
    expect(pdf.lines.map((l) => [l.date, l.amount, l.balance])).toEqual(csv.lines.map((l) => [l.date, l.amount, l.balance]));
    // Wrapped narrations are joined back into one description.
    expect(pdf.lines[2].description).toBe('CUSTOMER RECEIPT RCT-5039 VIA INTERNET BANKING REF 00000003');
    // Letterhead, page footers and the closing totals do not become transactions.
    expect(pdf.lines.some((l) => /page|total|closing|computer generated|marina/i.test(l.description))).toBe(false);
  });
  it('reconciles from the PDF exactly as from the CSV', async () => {
    const pdf = parseBankStatement(pdfToRows(await readPdfText(lib, file('bank-statement-2025.pdf'))).rows);
    const ledger = parseLedger(Papa.parse<string[]>(readFileSync('public/samples/general-ledger-2025.csv', 'utf8'), { skipEmptyLines: true }).data).entries.filter((e) => e.accountCode === '1400');
    const r = reconcile({ bank: pdf.lines, ledger, bankClosing: balanceAt(pdf, '2025-12-31')!, ledgerBalance: N(9_860_000), yearEnd: '2025-12-31' });
    expect(r.matched).toBe(757);
    expect(r.bankOnly).toHaveLength(2);
    expect(r.difference).toBe(0);
  });
  it('asks for the password on a protected statement, and opens with the right one', async () => {
    await expect(readPdfText(lib, file('bank-statement-2025-protected.pdf'))).rejects.toMatchObject({ wrong: false });
    await expect(readPdfText(lib, file('bank-statement-2025-protected.pdf'), 'nope')).rejects.toBeInstanceOf(PdfPasswordError);
    await expect(readPdfText(lib, file('bank-statement-2025-protected.pdf'), 'nope')).rejects.toMatchObject({ wrong: true });
    const pages = await readPdfText(lib, file('bank-statement-2025-protected.pdf'), '1234');
    expect(parseBankStatement(pdfToRows(pages).rows).lines).toHaveLength(759);
  });
  it('rejects a file that is not a PDF', async () => {
    await expect(readPdfText(lib, new TextEncoder().encode('Date,Debit,Credit').buffer as ArrayBuffer)).rejects.toThrow(/could not be opened/);
  });
});

describe('table rebuilt from positioned text', () => {
  // A different layout from the sample: Withdrawals/Deposits headings centred over right-aligned
  // figures, a reference column, words delivered as separate pieces, and narration that runs on.
  const at = (str: string, x: number, y: number, w = str.length * 4): PdfItem => ({ str, x, y, w });
  const right = (str: string, edge: number, y: number) => at(str, edge - str.length * 4, y);
  const page: PdfItem[] = [
    at('FIRST EXAMPLE BANK', 40, 800), at('Statement of account', 40, 788),
    at('Date', 40, 760), at('Reference', 100, 760), at('Transaction', 170, 760), at('Details', 216, 760),
    at('Withdrawals', 340, 760), at('Deposits', 430, 760), at('Balance', 520, 760),
    at('02/01/2025', 40, 745), at('Balance', 170, 745), at('B/F', 200, 745), right('250,000.00', 560, 745),
    at('03/01/2025', 40, 730), at('TRF000123', 100, 730), at('POS', 170, 730), at('PURCHASE', 186, 730), at('SHOPRITE', 222, 730), right('12,500.00', 392, 730), right('237,500.00', 560, 730),
    at('IKEJA CITY MALL 4471', 170, 720),
    at('05/01/2025', 40, 705), at('TRF000124', 100, 705), at('SALARY JAN', 170, 705), right('1,000,000.00', 470, 705), right('1,237,500.00', 560, 705),
    at('Page 1 of 1', 270, 40),
  ];
  it('places amounts under centred headings and joins split words and run-on narration', () => {
    const t = pdfToRows([page]);
    expect(t.rows[0]).toEqual(['Date', 'Reference', 'Transaction Details', 'Withdrawals', 'Deposits', 'Balance']);
    const p = parseBankStatement(t.rows);
    expect(p.opening).toBe(N(250_000));
    expect(p.lines).toEqual([
      { date: '2025-01-03', description: 'POS PURCHASE SHOPRITE IKEJA CITY MALL 4471', amount: -N(12_500), balance: N(237_500) },
      { date: '2025-01-05', description: 'SALARY JAN', amount: N(1_000_000), balance: N(1_237_500) },
    ]);
    expect(p.breaks).toBe(0);
  });
  it('returns no rows when the page has no column headings', () => {
    expect(pdfToRows([[at('Scanned image', 10, 10)]]).rows).toEqual([]);
    expect(pdfToRows([[]]).textItems).toBe(0);
  });
});
