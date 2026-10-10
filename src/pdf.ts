import type { PdfItem } from './engine/pdfTable';

/** The parts of pdf.js this file uses. Passed in so the browser and the tests can each bring their own build. */
export interface PdfLib {
  getDocument(src: { data: Uint8Array; password?: string }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
    }>;
  };
}

export class PdfPasswordError extends Error {
  constructor(public readonly wrong: boolean) {
    super(wrong ? 'That password did not open the statement.' : 'This statement is password protected.');
  }
}

/** Every piece of text in the PDF with its position, page by page. Nothing is uploaded: the file is read in the browser. */
export async function readPdfText(lib: PdfLib, data: ArrayBuffer, password?: string): Promise<PdfItem[][]> {
  let doc;
  try {
    doc = await lib.getDocument({ data: new Uint8Array(data), password }).promise;
  } catch (e) {
    const err = e as { name?: string; code?: number };
    if (err?.name === 'PasswordException') throw new PdfPasswordError(err.code === 2 || !!password);
    throw new Error('This file could not be opened as a PDF.');
  }
  const pages: PdfItem[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    const items: PdfItem[] = [];
    for (const raw of content.items) {
      const it = raw as { str?: string; transform?: number[]; width?: number };
      if (typeof it.str !== 'string' || !it.transform) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0 });
    }
    pages.push(items);
  }
  return pages;
}
