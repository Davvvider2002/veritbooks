// The legacy build carries the polyfills older browsers need. The standard build fails on them.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { pdfToRows } from './engine/pdfTable';
import { readPdfText, type PdfLib } from './pdf';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Read a bank statement PDF into table rows. The file is opened in the browser and is not
 * uploaded anywhere. Loaded on demand, so the PDF library is fetched only when a PDF is chosen.
 */
export async function pdfStatementRows(file: File, password?: string): Promise<string[][]> {
  const pages = await readPdfText(pdfjs as unknown as PdfLib, await file.arrayBuffer(), password);
  const table = pdfToRows(pages);
  if (table.textItems < 20) {
    throw new Error(
      'This PDF holds no text, so it is a scan or a photograph. Ask the bank for the electronic statement, or for Excel or CSV.',
    );
  }
  if (table.rows.length === 0) {
    throw new Error(
      'No transaction table was found in this PDF. It needs one line of column headings with a date and Debit and Credit, or Amount. Ask the bank for Excel or CSV instead.',
    );
  }
  return table.rows;
}
