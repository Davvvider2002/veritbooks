// Generates the sample general ledger and bank statement for Adunni Foods Limited (2025).
// The ledger's movements agree exactly to the sample trial balances. A few journals are
// planted on purpose so the journal tests have something to find, and two items appear on
// the bank statement only. Run with: node scripts/make-samples.mjs
import { writeFileSync } from 'node:fs';

let seed = 20251231;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const N = (naira) => Math.round(naira * 100);
const iso = (d) => d.toISOString().slice(0, 10);
const day = (m, d) => new Date(Date.UTC(2025, m - 1, d));
const isWeekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
const businessDay = (from = 1, to = 12) => {
  for (;;) {
    const m = from + Math.floor(rnd() * (to - from + 1));
    const d = day(m, 1 + Math.floor(rnd() * 28));
    if (!isWeekend(d)) return d;
  }
};
const monthEnd = (m) => new Date(Date.UTC(2025, m, 0));
/** Split a kobo total into n uneven parts that sum exactly. */
function split(total, n) {
  const w = Array.from({ length: n }, () => 0.5 + rnd());
  const sum = w.reduce((a, b) => a + b, 0);
  const parts = w.map((x) => Math.floor(((total * x) / sum) / 100) * 100 + Math.floor(rnd() * 100));
  parts[n - 1] += total - parts.reduce((a, b) => a + b, 0);
  return parts;
}

const NAMES = {
  1010: 'Motor vehicles', 1020: 'Office equipment', 1090: 'Accumulated depreciation', 1200: 'Inventories',
  1300: 'Trade debtors', 1310: 'Allowance for doubtful debts', 1350: 'Prepaid rent', 1400: 'Bank current account',
  1410: 'Petty cash', 2000: 'Trade creditors', 2100: 'Accrued expenses', 2110: 'VAT payable', 2120: 'PAYE payable',
  2200: 'Company income tax payable', 2300: 'Term loan', 3200: 'Dividends paid', 4000: 'Sales', 4100: 'Interest income',
  5000: 'Cost of sales', 6000: 'Salaries and wages', 6010: 'Pension contribution expense', 6100: 'Depreciation',
  6200: 'Rent and rates', 6210: 'Electricity and diesel', 6220: 'Audit and professional fees', 6230: 'Bank charges',
  6300: 'Advertising and promotion', 6400: 'Interest expense on loan', 7000: 'Company income tax',
};

const journals = []; // { date, desc, user, lines: [[code, amount]] }
const post = (date, desc, user, lines) => journals.push({ date, desc, user, lines });
const simple = (dr, cr, total, n, desc, user, dates) =>
  split(N(total), n).forEach((a, i) => post(dates(i), typeof desc === 'function' ? desc(i) : desc, user, [[dr, a], [cr, -a]]));

const M = 1_000_000;
// Sales and receipts. 243.0m invoiced in the ordinary way; 5.0m and 0.9m are the planted journals below.
simple(1300, 4000, 243.0 * M, 520, (i) => `Sales invoice INV-${String(1001 + i)}`, 'sales.clerk', () => businessDay());
simple(1400, 1300, 242.55 * M, 410, (i) => `Customer receipt RCT-${String(5001 + i)}`, 'cashier', () => businessDay());
post(day(12, 19), 'Provision for credit notes', 'fin.controller', [[4000, N(0.3 * M)], [1310, -N(0.3 * M)]]);
// Purchases, cost of sales, supplier payments.
simple(1200, 2000, 164.8 * M, 260, (i) => `Supplier invoice PINV-${String(3001 + i)}`, 'ap.clerk', () => businessDay());
split(N(161.3 * M), 12).forEach((a, i) => post(monthEnd(i + 1), 'Cost of goods sold for the month', 'fin.controller', [[5000, a], [1200, -a]]));
simple(2000, 1400, 162.3 * M, 180, (i) => `Supplier payment CHQ ${String(700101 + i)}`, 'cashier', () => businessDay());
// Payroll: gross, PAYE withheld, net paid. Then PAYE and pension remitted.
const gross = split(N(28.4 * M), 12), paye = split(N(3.0 * M), 12);
gross.forEach((g, i) => post(day(i + 1, 25), `Salaries for month ${i + 1}`, 'payroll', [[6000, g], [2120, -paye[i]], [1400, -(g - paye[i])]]));
simple(2120, 1400, 2.88 * M, 12, 'PAYE remittance to LIRS', 'cashier', (i) => day(i + 1, 10));
simple(6010, 1400, 2.27 * M, 12, 'Employer pension remittance', 'cashier', (i) => day(i + 1, 27));
split(N(5.3 * M), 12).forEach((a, i) => post(monthEnd(i + 1), 'Depreciation for the month', 'fin.controller', [[6100, a], [1090, -a]]));
// Rent paid in advance and released monthly.
simple(1350, 1400, 5.2 * M, 2, 'Rent paid in advance', 'cashier', (i) => day(i === 0 ? 1 : 7, 2));
split(N(4.8 * M), 12).forEach((a, i) => post(monthEnd(i + 1), 'Rent released from prepayment', 'fin.controller', [[6200, a], [1350, -a]]));
// Electricity: 5.625m ordinary plus the planted duplicate pair of 412,500 each.
simple(6210, 1400, 5.625 * M, 36, 'Electricity and diesel', 'cashier', () => businessDay());
// Professional fees accrued then part paid.
simple(6220, 2100, 2.5 * M, 4, 'Professional fees accrued', 'fin.controller', (i) => monthEnd((i + 1) * 3));
simple(2100, 1400, 2.05 * M, 3, 'Professional fees paid', 'cashier', () => businessDay(2, 11));
// Bank charges: one of them has no description.
split(N(0.38 * M), 12).forEach((a, i) => post(monthEnd(i + 1), i === 6 ? '' : 'Bank charges', 'cashier', [[6230, a], [1400, -a]]));
simple(6300, 1400, 3.0 * M, 24, 'Advertising and promotion', 'cashier', () => businessDay());
simple(6400, 1400, 3.6 * M, 12, 'Term loan interest', 'cashier', (i) => day(i + 1, 15));
simple(2300, 1400, 5.0 * M, 4, 'Term loan principal repayment', 'cashier', (i) => day((i + 1) * 3, 16));
post(day(12, 31), 'Income tax charge for the year', 'fin.controller', [[7000, N(6.9 * M)], [2200, -N(6.9 * M)]]);
simple(2200, 1400, 6.1 * M, 2, 'Company income tax paid', 'cashier', (i) => day(i === 0 ? 6 : 9, 18));
simple(3200, 1400, 3.0 * M, 1, 'Dividend paid', 'cashier', () => day(7, 18));
simple(1400, 4100, 0.42 * M, 4, 'Interest on call deposit', 'cashier', (i) => monthEnd((i + 1) * 3));
simple(1400, 2110, 4.0 * M, 12, 'VAT collected', 'cashier', (i) => day(i + 1, 20));
simple(2110, 1400, 3.63 * M, 12, 'VAT remitted to FIRS', 'cashier', (i) => day(i + 1, 21));
simple(1010, 1400, 6.5 * M, 2, 'Purchase of delivery van', 'cashier', (i) => day(i === 0 ? 3 : 10, 12));
simple(1020, 1400, 1.1 * M, 3, 'Purchase of office equipment', 'cashier', () => businessDay(2, 11));
simple(1410, 1400, 0.04 * M, 1, 'Petty cash float increase', 'cashier', () => day(5, 6));

// Planted journals.
post(day(12, 28), 'Manual adjustment per MD', 'admin', [[1300, N(5 * M)], [4000, -N(5 * M)]]); // Sunday, round, year end
post(day(8, 15), 'Barter arrangement', 'fin.controller', [[6300, N(0.9 * M)], [4000, -N(0.9 * M)]]); // revenue with no receivable
post(day(6, 10), 'Electricity bill June', 'cashier', [[6210, N(412_500)], [1400, -N(412_500)]]); // duplicate pair
post(day(6, 10), 'Electricity bill June', 'cashier', [[6210, N(412_500)], [1400, -N(412_500)]]);

journals.sort((a, b) => a.date - b.date);
const money = (k) => (k / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const dmy = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

const gl = ['Date,Journal No,Account Code,Account Name,Description,Debit,Credit,Posted By'];
const bankLedger = [];
journals.forEach((j, i) => {
  const no = `JV-${String(i + 1).padStart(5, '0')}`;
  for (const [code, amount] of j.lines) {
    gl.push([dmy(j.date), no, code, q(NAMES[code]), q(j.desc), amount > 0 ? q(money(amount)) : '', amount < 0 ? q(money(-amount)) : '', j.user].join(','));
    if (code === 1400) bankLedger.push({ date: j.date, desc: j.desc || 'Charges', amount });
  }
});
writeFileSync('public/samples/general-ledger-2025.csv', gl.join('\n') + '\n');

// Bank statement: ledger items clear zero to a few days later. Items clearing after the year end are outstanding.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const bankDate = (d) => `${String(d.getUTCDate()).padStart(2, '0')}-${MON[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
const items = [];
for (const b of bankLedger) {
  const lag = /CHQ/.test(b.desc) ? Math.floor(rnd() * 5) : Math.floor(rnd() * 3);
  const d = new Date(b.date.getTime() + lag * 86400000);
  if (d.getUTCFullYear() > 2025) continue;
  items.push({ date: d, desc: b.desc.toUpperCase(), amount: b.amount });
}
items.push({ date: day(12, 29), desc: 'NIP TRANSFER FROM OKEKE STORES', amount: N(250_000) });
items.push({ date: day(12, 30), desc: 'SMS ALERT CHARGES', amount: -N(15_000) });
items.sort((a, b) => a.date - b.date);
let balance = N(1_790_000);
const st = [
  'Sample Bank Plc,,,,,',
  'Account name: ADUNNI FOODS LIMITED,,,,,',
  'Statement period: 01-Jan-2025 to 31-Dec-2025,,,,,',
  ',,,,,',
  'Trans Date,Value Date,Narration,Debit,Credit,Balance',
  `01-Jan-2025,01-Jan-2025,OPENING BALANCE,,,${q(money(balance))}`,
];
for (const it of items) {
  balance += it.amount;
  st.push([bankDate(it.date), bankDate(it.date), q(it.desc), it.amount < 0 ? q(money(-it.amount)) : '', it.amount > 0 ? q(money(it.amount)) : '', q(money(balance))].join(','));
}
writeFileSync('public/samples/bank-statement-2025.csv', st.join('\n') + '\n');
const ledgerTotal = bankLedger.reduce((a, b) => a + b.amount, 0);
console.log(`journals ${journals.length}, ledger lines ${gl.length - 1}, bank ledger movement ${money(ledgerTotal)}, statement lines ${items.length}, statement closing ${money(balance)}`);
