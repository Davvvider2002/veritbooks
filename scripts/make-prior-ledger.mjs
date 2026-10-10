// Writes public/samples/general-ledger-2024.csv: a prior year ledger for the sample company.
// It is a monthly summary, not a full ledger: each profit or loss account in the 2024 trial
// balance is posted in twelve months against the bank account, so every one agrees to it.
import { readFileSync, writeFileSync } from 'node:fs';
import Papa from 'papaparse';

const tb = Papa.parse(readFileSync('public/samples/trial-balance-2024.csv', 'utf8'), { skipEmptyLines: true }).data.slice(1);
const kobo = (s) => Math.round(Number(String(s || '0').replace(/,/g, '')) * 100);
const money = (k) => (k / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const out = [['Date', 'Journal No', 'Account Code', 'Account Name', 'Description', 'Debit', 'Credit', 'Posted By']];
let n = 0;
for (const [code, name, debit, credit] of tb) {
  if (Number(code) < 4000) continue; // income and expenses only
  const balance = kobo(debit) - kobo(credit);
  const monthly = Math.trunc(balance / 12 / 100) * 100;
  for (let m = 1; m <= 12; m++) {
    const amount = m === 12 ? balance - monthly * 11 : monthly;
    const date = `${String(new Date(Date.UTC(2024, m, 0)).getUTCDate()).padStart(2, '0')}/${String(m).padStart(2, '0')}/2024`;
    const no = `PY-${String(++n).padStart(5, '0')}`;
    const text = `${name} for month ${m}`;
    const dr = (a) => (a > 0 ? money(a) : '');
    const cr = (a) => (a < 0 ? money(-a) : '');
    out.push([date, no, code, name, text, dr(amount), cr(amount), 'accountant']);
    out.push([date, no, '1400', 'Bank current account', text, dr(-amount), cr(-amount), 'accountant']);
  }
}
writeFileSync('public/samples/general-ledger-2024.csv', Papa.unparse(out) + '\n');
console.log(`${out.length - 1} lines`);
