/** A piece of text on a PDF page, with its position. y grows up the page, as in the PDF itself. */
export interface PdfItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

interface Token {
  text: string;
  x0: number;
  x1: number;
}

interface Column {
  label: string;
  x0: number;
  x1: number;
  kind: 'date' | 'money' | 'text';
}

const MONEY = /^\(?-?[₦N]?\d{1,3}(,\d{3})*\.\d{2}\)?(\s?(cr|dr)\.?)?$|^\(?-?[₦N]?\d+\.\d{2}\)?(\s?(cr|dr)\.?)?$/i;
// Bank charges columns, such as FNB's accrued charges, are money columns of their own so their figures do not land under Amount.
const MONEY_HEAD = /debit|credit|withdraw|deposit|lodg|amount|balance|money|paid|charges|^fees?$|^dr\.?$|^cr\.?$/i;
const NARRATION = /narration|description|remark|detail|particular|transaction$/i;

/** Group a page's text into lines, top to bottom, and join pieces that sit right beside each other. */
function toLines(items: PdfItem[]): { y: number; tokens: Token[] }[] {
  const sorted = items.filter((i) => i.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; items: PdfItem[] }[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= 2.5) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines.map((l) => {
    const out: Token[] = [];
    for (const it of l.items.sort((a, b) => a.x - b.x)) {
      const prev = out[out.length - 1];
      // Words of one phrase are often separate pieces a space apart.
      if (prev && it.x - prev.x1 <= 3.5 && it.x - prev.x1 >= -1) {
        prev.text += (it.x - prev.x1 > 0.8 ? ' ' : '') + it.str.trim();
        prev.x1 = it.x + it.w;
      } else {
        out.push({ text: it.str.trim(), x0: it.x, x1: it.x + it.w });
      }
    }
    return { y: l.y, tokens: out };
  });
}

/** A run-on narration line sits directly under its row. Anything further down the page is a footer. */
const MAX_LINE_GAP = 16;

function asHeader(line: Token[]): Column[] | null {
  const t = line.map((k) => k.text.toLowerCase());
  const hasDate = t.some((x) => /date/.test(x));
  const out = t.some((x) => /debit|withdraw|money out|paid out|^dr\.?$/.test(x));
  const inn = t.some((x) => /credit|deposit|lodg|money in|paid in|^cr\.?$/.test(x));
  const amount = t.some((x) => /amount/.test(x));
  if (!hasDate || !((out && inn) || amount)) return null;
  return line.map((k) => ({
    label: k.text,
    x0: k.x0,
    x1: k.x1,
    kind: /date/i.test(k.text) ? 'date' : MONEY_HEAD.test(k.text) ? 'money' : 'text',
  }));
}

export interface PdfTable {
  /** Header row first, then one row per transaction, ready for the statement parser. */
  rows: string[][];
  /** Lines of text above the first column headings, such as the account and the statement period. */
  preamble: string[];
  /** Pages on which the column headings were found. */
  pagesWithHeader: number;
  textItems: number;
}

/**
 * Rebuild a bank statement's table from positioned text. Works on any statement whose pages
 * carry one line of column headings naming a date and Debit and Credit (or Amount) columns.
 * Amounts are placed by how they line up with a money heading; other text by where it starts.
 * A line with no date and no amount is treated as the narration running on from the row above.
 */
export function pdfToRows(pages: PdfItem[][]): PdfTable {
  const rows: string[][] = [];
  let columns: Column[] | null = null;
  let narration = -1;
  let pagesWithHeader = 0;
  let textItems = 0;
  const preamble: string[] = [];

  for (const page of pages) {
    textItems += page.length;
    let headerSeen = false;
    let lastRow: string[] | null = null;
    let lastY = 0;
    for (const { y, tokens: line } of toLines(page)) {
      const header = asHeader(line);
      if (header) {
        if (!columns) rows.push(header.map((c) => c.label));
        // A later page whose headings differ in number keeps the first page's columns.
        if (!columns || header.length === columns.length) columns = header;
        narration = columns.findIndex((c) => c.kind === 'text' && NARRATION.test(c.label));
        if (narration < 0) narration = columns.findIndex((c) => c.kind === 'text');
        headerSeen = true;
        pagesWithHeader++;
        lastRow = null;
        continue;
      }
      // Everything above the headings on a page is the bank's letterhead and account details.
      if (!columns && preamble.length < 30) preamble.push(line.map((k) => k.text).join(' '));
      if (!columns || !headerSeen) continue;

      const cells = columns.map(() => '');
      let hasDate = false;
      let hasMoney = false;
      let onlyNarration = true;
      for (const tok of line) {
        let col = -1;
        if (MONEY.test(tok.text)) {
          let best = Infinity;
          columns.forEach((c, i) => {
            if (c.kind !== 'money') return;
            const d = Math.min(
              Math.abs(tok.x1 - c.x1),
              Math.abs((tok.x0 + tok.x1) / 2 - (c.x0 + c.x1) / 2),
              Math.abs(tok.x0 - c.x0),
            );
            if (d < best) {
              best = d;
              col = i;
            }
          });
          if (col >= 0) hasMoney = true;
        }
        if (col < 0) {
          // Text sits in the last non-money column that starts at or before it.
          columns.forEach((c, i) => {
            if (c.kind !== 'money' && c.x0 <= tok.x0 + 6) col = i;
          });
          if (col < 0) col = columns.findIndex((c) => c.kind !== 'money');
          if (columns[col].kind === 'date' && /\d/.test(tok.text)) hasDate = true;
        }
        if (col !== narration) onlyNarration = false;
        cells[col] = cells[col] ? `${cells[col]} ${tok.text}` : tok.text;
      }

      if (hasDate || hasMoney) {
        rows.push(cells);
        lastRow = hasDate ? cells : null; // totals and summary lines take no continuation
        lastY = y;
      } else if (lastRow && narration >= 0 && onlyNarration && lastY - y <= MAX_LINE_GAP) {
        lastRow[narration] = `${lastRow[narration]} ${cells[narration]}`.trim();
        lastY = y;
      }
    }
  }
  return { rows, preamble, pagesWithHeader, textItems };
}
