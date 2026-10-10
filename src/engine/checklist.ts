import type { AutoKey, ChecklistItem } from '../content/checklist';
import { ppeSchedule, taxReconciliation } from './disclosures';
import type { Statements } from './statements';
import type { Adjustment, ChecklistAnswer, Disclosures, TbLine } from './types';

export type ChecklistState = 'covered' | 'disclosed' | 'na' | 'open';

export interface ChecklistResult {
  item: ChecklistItem;
  state: ChecklistState;
  /** Why the software treats the item as covered, or what would let it. */
  basis?: string;
  answer?: ChecklistAnswer;
}

export interface ChecklistInput {
  statements: Statements;
  lines: TbLine[];
  adjustments: Adjustment[];
  disclosures: Disclosures;
  principalActivity?: string;
  /** The statement lines that carry an accounting policy note for this entity. */
  policyCodes?: string[];
}

/** What the software can confirm from the file itself. Returns [covered, the basis or what is missing]. */
function auto(key: AutoKey, g: ChecklistInput): [boolean, string] {
  const { statements: st, disclosures: d } = g;
  const text = (v: string | undefined, has: string, missing: string): [boolean, string] => (v?.trim() ? [true, has] : [false, missing]);
  switch (key) {
    case 'complete_set':
      return st.cashFlow
        ? [true, 'All five statements are produced.']
        : [false, 'The statement of cash flows needs the prior year trial balance.'];
    case 'comparatives':
      return st.hasPrior ? [true, 'Prior year figures are presented throughout.'] : [false, 'Import the prior year trial balance.'];
    case 'identification':
      return [true, 'The layout of the statements provides this.'];
    case 'compliance_statement':
      return [true, 'Stated in note 2.'];
    case 'equity_statement':
      return [true, 'Produced for both years where a prior year is held.'];
    case 'line_breakdown':
      return [true, 'Each line on the face is analysed by account in its note.'];
    case 'cash_components':
      return [true, 'The note to cash and cash equivalents lists its accounts.'];
    case 'general_information':
      return d.registeredOffice?.trim() && g.principalActivity?.trim()
        ? [true, 'Given in note 1 and the directors’ report.']
        : [false, 'Enter the registered office in Disclosures and the principal activity in Report.'];
    case 'going_concern':
      return text(d.goingConcern, 'The going concern note is completed.', 'Complete the going concern note in Disclosures.');
    case 'subsequent_events':
      return text(d.subsequentEvents, 'The note on events after the reporting date is completed.', 'Complete the note in Disclosures.');
    case 'contingencies':
      return text(d.contingencies, 'The contingent liabilities note is completed.', 'Complete the note in Disclosures.');
    case 'commitments':
      return text(d.commitments, 'The capital commitments note is completed.', 'Complete the note in Disclosures.');
    case 'key_management':
      return d.directorsRemuneration === undefined || d.directorsRemuneration === null
        ? [false, 'Enter the directors’ remuneration in Disclosures.']
        : [true, 'Directors’ remuneration is disclosed in the related party note.'];
    case 'related_parties':
      return d.noRelatedParties || (d.relatedParties ?? []).some((r) => r.name.trim())
        ? [true, d.noRelatedParties ? 'The preparer confirmed there are no transactions to disclose.' : 'Transactions are listed in the related party note.']
        : [false, 'List the transactions in Disclosures, or confirm there are none.'];
    case 'policies_tailored': {
      const codes = g.policyCodes ?? [];
      const open = codes.filter((c) => !d.policies?.[c]?.text.trim());
      if (codes.length === 0) return [false, 'No accounting policy notes apply yet.'];
      return open.length === 0
        ? [true, `All ${codes.length} accounting policies have wording confirmed for this client.`]
        : [false, `${open.length} of ${codes.length} accounting policies still carry the starter wording. Confirm them in Accounting policies.`];
    }
    case 'ppe_reconciliation': {
      const s = st.hasPrior ? ppeSchedule(g.lines, g.adjustments, st.cur, d.ppeDisposals) : null;
      if (!s) return [false, 'The movement schedule needs the prior year trial balance.'];
      return s.chargeDifference === 0 ? [true, 'The movement schedule is produced and agrees to the depreciation charge.'] : [false, 'The movement schedule does not agree to the depreciation charge.'];
    }
    case 'tax_reconciliation': {
      const t = taxReconciliation(st.cur, d);
      if (!t) return [false, 'Enter the tax rate in Disclosures.'];
      return t.difference === 0 ? [true, 'The tax reconciliation is produced with no unexplained difference.'] : [false, 'The tax reconciliation has an unexplained difference.'];
    }
  }
}

/**
 * The checklist for one engagement: the items that apply to this entity's figures, and where each stands.
 * An item the software can confirm is covered without an answer. If it cannot, the preparer may still
 * answer it, because the disclosure may have been made another way.
 */
export function buildChecklist(items: ChecklistItem[], g: ChecklistInput): ChecklistResult[] {
  const { cur, prior } = g.statements;
  const has = (code: string) => (cur.v[code] ?? 0) !== 0 || (prior?.v[code] ?? 0) !== 0;
  const out: ChecklistResult[] = [];
  for (const item of items) {
    if (item.when && !item.when.some(has)) continue;
    const answer = g.disclosures.checklist?.[item.id];
    const [covered, basis] = item.auto ? auto(item.auto, g) : [false, undefined];
    if (covered) out.push({ item, state: 'covered', basis });
    else if (answer && (answer.status === 'disclosed' || answer.note.trim())) out.push({ item, state: answer.status, basis, answer });
    else out.push({ item, state: 'open', basis, answer });
  }
  return out;
}

export const checklistOpen = (results: ChecklistResult[]) => results.filter((r) => r.state === 'open');
