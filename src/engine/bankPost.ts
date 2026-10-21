// Posting statement items that are not in the ledger, from the bank reconciliation.
//
// A charge, a receipt or interest the bank recorded and the client did not is set against the
// account the auditor chooses, line by line, without going to the Journals step. Each item
// becomes one posted journal: the bank account and the chosen account, for the item's amount.
import type { BankLine } from './bank';
import type { Adjustment, JournalLine, TbLine } from './types';

/** How a journal made here describes its item, so the item shows as posted and is not posted twice. */
export const bankItemDescription = (b: Pick<BankLine, 'date' | 'description'>) => `Bank reconciliation: ${b.description.trim()} (${b.date})`;

/** The journal already posted for this item, if any. */
export function postedFor(b: BankLine, bankLineId: string, adjustments: Adjustment[]): Adjustment | undefined {
  const desc = bankItemDescription(b);
  return adjustments.find((a) => a.description === desc && a.lines.some((j) => j.lineId === bankLineId && j.amount === b.amount));
}

/** The next free reference in the BR series: BR1, BR2 and so on. */
export function nextBankRef(adjustments: Adjustment[], taken: Set<string> = new Set()): string {
  const used = new Set([...adjustments.map((a) => a.ref.trim().toUpperCase()), ...[...taken].map((t) => t.toUpperCase())]);
  let n = 1;
  while (used.has(`BR${n}`)) n++;
  return `BR${n}`;
}

/** The two lines of the journal: money in debits the bank and credits the account chosen; money out the reverse. */
export function bankItemLines(b: BankLine, bankLineId: string, accountLineId: string): JournalLine[] {
  return [
    { lineId: bankLineId, amount: b.amount },
    { lineId: accountLineId, amount: -b.amount },
  ];
}

/**
 * A first guess at the account, from the narration: bank charges and fees, interest, transfers in
 * from customers. Null when nothing fits; the auditor always chooses.
 */
export function suggestAccount(b: BankLine, lines: TbLine[], bankLineId: string): string | null {
  const text = b.description.toLowerCase();
  const others = lines.filter((l) => l.id !== bankLineId);
  const byName = (re: RegExp) => others.find((l) => re.test(l.name.toLowerCase()))?.id ?? null;
  const byMap = (code: string) => others.find((l) => l.mapCode === code)?.id ?? null;
  if (b.amount < 0 && /charge|commission|\bsms\b|alert|stamp duty|\bfee|cot\b|maintenance|vat on/.test(text)) return byName(/bank charge|bank fee|charges/) ?? byMap('finance_costs');
  if (/interest/.test(text)) return b.amount > 0 ? (byName(/interest (income|received)|finance income/) ?? byMap('finance_income')) : (byName(/interest/) ?? byMap('finance_costs'));
  if (b.amount > 0 && /transfer from|trf from|nip|lodg|deposit|receipt|cheque|chq|cash dep/.test(text)) return byMap('trade_receivables');
  if (b.amount < 0 && /transfer to|trf to|payment to/.test(text)) return byMap('trade_payables');
  return null;
}
