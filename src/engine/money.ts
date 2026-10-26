import type { Kobo } from './types';

/** Amounts are held in the minor unit of the engagement's currency: kobo, pesewas, cents. */
export const toKobo = (naira: number): Kobo => Math.round(naira * 100);

/**
 * The symbol of the currency on screen. The workspace sets it from the engagement before its
 * steps draw, so every column heading and amount label follows the engagement's currency.
 */
let current = '₦';
export const cur = (): string => current;
export const setCur = (symbol: string): void => {
  current = symbol;
};

/**
 * Parse a cell from a trial balance into kobo. Returns null when the cell holds no number.
 * Accepts 1,234.50  (1,234.50)  -1234.5  1234.50 Cr  ₦1,234  GH₵1,234  US$1,234  and plain numbers.
 */
export function parseAmount(raw: unknown): Kobo | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? toKobo(raw) : null;
  let s = String(raw).trim();
  if (s === '' || s === '-' || s === '–') return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/cr\.?$/i.test(s)) {
    negative = !negative;
    s = s.replace(/cr\.?$/i, '');
  } else if (/dr\.?$/i.test(s)) {
    s = s.replace(/dr\.?$/i, '');
  }
  // A trailing minus, as SAP, Pastel and some bank exports write a negative: 1,000.00-
  if (/\d-$/.test(s)) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  s = s.replace(/GH[₵¢]|GHS|SLE|LRD|GMD|USD|ZAR|CAD|US\$|C\$|L\$|NGN|R(?=\s*\d)|Le(?=\s*\d)|D(?=\s*\d)|N(?=\s*\d)|[₦$]/gi, '').trim();
  // A decimal comma, as South African and European exports write amounts: 1 234,56 or 1.234,56.
  // A comma is read as the decimal point only when one or two digits follow it at the end and no
  // other comma appears, so 1,234 and 1,234,567 stay thousands.
  if (/^-?\d{1,3}([ .  ']\d{3})*,\d{1,2}$/.test(s) || /^-?\d+,\d{1,2}$/.test(s)) {
    s = s.replace(/[ .  ']/g, '').replace(',', '.');
  } else {
    s = s.replace(/[,\s  ']/g, '');
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.$/.test(s)) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return toKobo(negative ? -n : n);
}

/** Format kobo as whole naira, negatives in brackets, zero as a dash. */
export function fmt(k: Kobo | null | undefined, opts: { zero?: string } = {}): string {
  if (k === null || k === undefined) return '';
  const naira = Math.round(k / 100);
  if (naira === 0) return opts.zero ?? '–';
  const body = Math.abs(naira).toLocaleString('en-NG');
  return naira < 0 ? `(${body})` : body;
}

/** Format kobo with two decimals, for ledgers and journals. */
export function fmt2(k: Kobo): string {
  const body = (Math.abs(k) / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return k < 0 ? `(${body})` : body;
}
