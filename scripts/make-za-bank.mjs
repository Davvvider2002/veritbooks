// Writes the South African sample bank statement as CSV, laid out the way South African
// online banking exports transaction history: a few lines about the account, then
// Date, Amount, Balance, Description with yyyy/mm/dd dates and one signed amount column.
// The transactions are those of the general sample statement, so the reconciliation works
// against the same ledger. Run: node scripts/make-za-bank.mjs, then python3 scripts/make-za-bank-pdf.py
import { readFileSync, writeFileSync } from 'node:fs';

const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const split = (line) => line.match(/("([^"]*)"|[^,]*)(,|$)/g).slice(0, -1).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''));
const num = (s) => (s ? Number(s.replace(/,/g, '')) : 0);

/** Narrations as South African banks print them. */
export function saNarration(n) {
  const r = [
    [/^CUSTOMER RECEIPT (RCT-\d+)/, (m) => `MAGTAPE CREDIT CUSTOMER ${m[1]}`],
    [/^SUPPLIER PAYMENT CHQ (\d+)/, (m) => `INTERNET PMT TO SUPPLIER ${m[1]}`],
    [/^ELECTRICITY AND DIESEL/, () => 'DEBIT ORDER CITY POWER AND FUEL'],
    [/^ELECTRICITY BILL (\w+)/, (m) => `DEBIT ORDER CITY POWER ${m[1]}`],
    [/^VAT REMITTED/, () => 'SARS VAT201 PAYMENT'],
    [/^VAT COLLECTED/, () => 'MAGTAPE CREDIT VAT ON SALES'],
    [/^PAYE REMITTANCE/, () => 'SARS EMP201 PAYE UIF SDL'],
    [/^EMPLOYER PENSION/, () => 'DEBIT ORDER PENSION FUND'],
    [/^SALARIES FOR MONTH (\d+)/, (m) => `PAYROLL SALARIES MONTH ${m[1]}`],
    [/^TERM LOAN INTEREST/, () => 'LOAN INTEREST 4471-001'],
    [/^TERM LOAN PRINCIPAL/, () => 'LOAN REPAYMENT 4471-001'],
    [/^BANK CHARGES/, () => '#SERVICE FEES'],
    [/^SMS ALERT CHARGES/, () => '#NOTIFIC FEE SMS'],
    [/^NIP TRANSFER FROM OKEKE STORES/, () => 'MAGTAPE CREDIT NAMAQUA STORES'],
    [/^COMPANY INCOME TAX PAID/, () => 'SARS PROVISIONAL TAX IRP6'],
    [/^INTEREST ON CALL DEPOSIT/, () => 'CREDIT INTEREST'],
    [/^DIVIDEND PAID/, () => 'INTERNET PMT TO SHAREHOLDERS DIVIDEND'],
    [/^PETTY CASH FLOAT/, () => 'ATM CASH WITHDRAWAL PETTY CASH'],
  ];
  for (const [re, f] of r) {
    const m = re.exec(n);
    if (m) return f(m);
  }
  return `INTERNET PMT TO ${n}`;
}

const lines = readFileSync('public/samples/bank-statement-2025.csv', 'utf8').trim().split(/\r?\n/).map(split);
const head = lines.findIndex((r) => r[0] === 'Trans Date');
const data = lines.slice(head + 1).filter((r) => r[0] && r[2] !== 'OPENING BALANCE');
const iso = (d) => `${d.slice(7, 11)}/${MON[d.slice(3, 6)]}/${d.slice(0, 2)}`;
const out = [
  'ACCOUNT TRANSACTION HISTORY',
  'Name:,ADUNNI FOODS (PTY) LTD',
  'Account:,62000044471 Business Cheque Account',
  'Bank:,Sample Bank South Africa (test data)',
  'Statement period:,01 January 2025 to 31 December 2025',
  '',
  'Date,Amount,Balance,Description',
  ...data.map((r) => {
    const amount = num(r[4]) - num(r[3]);
    return [iso(r[0]), amount.toFixed(2), num(r[5]).toFixed(2), saNarration(r[2])].join(',');
  }),
];
writeFileSync('public/samples/za-bank-statement-2025.csv', out.join('\r\n') + '\r\n');
console.log('rows', data.length);
