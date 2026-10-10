import { CHART, SECTION_LABEL } from '../engine/chart';
import { STANDARD_NOTES } from '../engine/disclosures';
import { FLAG_LABEL, HIGH_RISK_SCORE } from '../engine/ledger';
import { draftReport, type ReportInput } from '../engine/report';
import { CHECKLIST, CHECKLIST_VERSION } from './checklist';
import { POLICIES, POLICY_VERSION } from './notes';
import { PACKS, PACK_VERSION } from './packs';
import { PROGRAMMES, PROGRAMME_VERSION } from './programmes';
import { COMPONENT_LABEL, CONCLUSIONS, QUALITY_VERSION, STARTER_RISKS } from './quality';
import { STANDARD_REQUESTS } from './requests';

/**
 * Everything in VeritBooks that a qualified technical author must review before a firm relies
 * on it, drawn from the content the software actually uses. `docs/REVIEW-PACK.md` is this text.
 * A test fails if the two differ, so the pack cannot fall behind the product.
 */
export function buildReviewPack(): string {
  const out: string[] = [];
  const p = (...lines: string[]) => out.push(...lines, '');
  const table = (head: string[], rows: string[][]) =>
    p(`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`));
  const signOff = () => p('Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected');

  p('# VeritBooks: technical review pack');
  p(
    'This pack holds every piece of professional content in VeritBooks, and every method the software applies, that needs review by a qualified technical author before a firm relies on it. It is generated from the content the software uses, so what is printed here is what a user sees.',
  );
  p('All of it is starter material. It was written to make the software work end to end. None of it has been reviewed against the standards in force.');

  p('## How to use this pack');
  p(
    '1. Review each section against the standards and laws named in it, in the edition in force for the periods the firm will report on.',
    '2. Mark each item as accepted, changed or rejected. Write changes beside the item, quoting its id.',
    '3. Answer the questions in section 1. They are decisions the software cannot make for itself.',
    '4. Sign each section. Content is released to firms only after its section is signed.',
  );
  p('The standards assumed throughout: the IFRS for SMEs Accounting Standard, second edition (2015), as adopted by the Financial Reporting Council of Nigeria; the Companies and Allied Matters Act 2020; the International Standards on Auditing, ISRE 2400 (Revised) and ISRS 4410 (Revised); ISQM 1.');

  // ---------------------------------------------------------------------
  p('## 1. Questions for the reviewer');
  p(
    '1. **Edition of the Standard.** The third edition of the IFRS for SMEs was issued in 2025. Has the FRC of Nigeria adopted it, and from which periods? The checklist section numbers, the revenue policy and the goodwill treatment follow the second edition.',
    '2. **Scope.** The software refuses public interest entities by asking the user to confirm. Is a confirmation enough, and should any other class of entity be excluded, such as regulated financial institutions and not-for-profit entities?',
    '3. **Audit methodology.** The audit programme is a short generic list. Should the product carry a full ISA methodology, the ISA for Less Complex Entities, or a licensed third-party methodology?',
    '4. **Report wording.** Section 8 prints every report variant. Does each meet ISA 700, 705 and 706, ISRE 2400 and ISRS 4410, and the auditor’s report requirements of CAMA 2020? Are key audit matters, other information and the FRC registration disclosures handled correctly for these entities?',
    '5. **Statement of value added and five-year summary.** These are produced because Nigerian practice expects them. Confirm the legal basis and the required layout.',
    '6. **Materiality.** Defaults are performance materiality at 75% of overall and clearly trivial at 5%. The benchmark and percentage are chosen by the auditor. Are the defaults acceptable, and should the software suggest percentage ranges by benchmark?',
    '7. **Journal testing.** A journal with three or more risk indicators must be concluded on. Is the indicator list in section 10 adequate, and is three the right threshold?',
    '8. **Analytical review.** A movement is significant at performance materiality and 10%. Sign-off is blocked on a review and advisory on an audit. Is that the right treatment?',
    '9. **Consolidation.** Section 11 lists the method and three simplifications. Is each acceptable, and is the goodwill departure for foreign subsidiaries tolerable or must it be fixed before release?',
    '10. **Tax.** No tax rate, levy or allowance is built in. The preparer enters the rate. Should the product carry Nigerian company income tax rates, the tertiary education tax and other levies, and deferred tax computation?',
    '11. **AI assistance.** Section 12 sets out what is sent and the rules the AI works under. Is the use consistent with the ethical code, confidentiality duties and the Nigeria Data Protection Act 2023?',
  );
  signOff();

  // ---------------------------------------------------------------------
  p('## 2. What the software decides and what people decide');
  table(
    ['Matter', 'Who decides', 'How the software enforces it'],
    [
      ['The audit opinion', 'The engagement partner', 'The software never selects it. The report is not drafted until the partner chooses.'],
      ['Signing', 'A partner with an FRC number', 'Only a partner can sign. The database refuses anyone else.'],
      ['Materiality benchmark and percentage', 'The auditor', 'Entered with a written rationale. Required before sign-off on an audit.'],
      ['Conclusion on a tested journal', 'The auditor', 'Recorded by a named person. The software only selects journals for testing.'],
      ['Whether evidence is sufficient', 'The auditor', 'Open client requests and unsigned subsidiaries are advisories, not blocks.'],
      ['Figures in the statements', 'The software, from the trial balance and journals', 'Computed each time. Every figure opens to the accounts behind it.'],
      ['Changes after signing', 'No one', 'A signed file is locked in the database. Nothing in it can be changed.'],
      ['Evaluation of the firm’s quality system', 'The partner with ultimate responsibility', 'Chosen by the partner. A recorded evaluation cannot be changed.'],
    ],
  );
  signOff();

  // ---------------------------------------------------------------------
  p('## 3. Statement lines');
  p(`Every account is mapped to one of ${CHART.length} lines. The statements are built from these lines only. Review whether the set is enough for the entities in scope, and whether any line is missing, such as investment property, biological assets, government grants, and employee benefit obligations.`);
  table(['Code', 'Line', 'Section'], CHART.map((c) => [c.code, c.label, SECTION_LABEL[c.section]]));
  p('Presentation choices to confirm: expenses are analysed by function; the cash flow statement uses the indirect method, derived from the movement between two statements of financial position; there is no statement of other comprehensive income for a single company, which is stated on the face.');
  signOff();

  // ---------------------------------------------------------------------
  p('## 4. Work programmes');
  p(`Version ${PROGRAMME_VERSION}. Every step must be ticked before sign-off. Review for completeness against the standard named, and for wording.`);
  for (const [type, standard] of [
    ['audit', 'International Standards on Auditing'],
    ['review', 'ISRE 2400 (Revised)'],
    ['compilation', 'ISRS 4410 (Revised)'],
  ] as const) {
    p(`### ${type[0].toUpperCase()}${type.slice(1)} programme (${standard})`);
    table(['Id', 'Area', 'Step'], PROGRAMMES[type].map((i) => [i.id, i.area, i.text]));
  }
  signOff();

  // ---------------------------------------------------------------------
  p('## 5. Industry packs');
  p(`Version ${PACK_VERSION}. A pack adds to the general content. It never removes anything.`);
  for (const pack of PACKS) {
    p(`### ${pack.name}`, pack.summary);
    for (const type of ['audit', 'review'] as const) {
      const steps = pack.programme[type] ?? [];
      if (steps.length) {
        p(`Added ${type} steps:`);
        table(['Id', 'Area', 'Step'], steps.map((i) => [i.id, i.area, i.text]));
      }
    }
    p('Added disclosure checklist items:');
    table(['Id', 'Section', 'Item'], pack.checklist.map((i) => [i.id, i.section, i.text]));
    p('Added client requests:');
    table(['Request', 'Detail'], pack.requests.map((r) => [r.title, r.detail]));
  }
  signOff();

  // ---------------------------------------------------------------------
  p('## 6. Disclosure checklist');
  p(
    `Version ${CHECKLIST_VERSION}. ${CHECKLIST.length} items. Each is a plain-language summary of a disclosure area. It is not the text of the Standard and it is not complete. Sign-off is blocked while any applicable item has no answer.`,
    '',
    '"Applies when" names the statement lines that make an item relevant. An item with none always applies. "Covered by the software" means the software marks the item as met from the file itself, without asking the preparer: check that each of these is a sound basis.',
  );
  table(
    ['Id', 'Section', 'Item', 'Applies when', 'Covered by the software'],
    CHECKLIST.map((i) => [i.id, i.section, i.text, i.when?.join(', ') ?? 'Always', i.auto ? AUTO_BASIS[i.auto] : 'No. The preparer answers.']),
  );
  p('Missing sections to consider: Section 9 (consolidated statements), 12 (other financial instruments), 14 and 15 (associates and joint ventures), 16 (investment property), 19 (business combinations and goodwill), 22 (liabilities and equity), 24 (government grants), 26 (share-based payment), 30 (foreign currency), 34 (specialised activities), 35 (transition).');
  signOff();

  // ---------------------------------------------------------------------
  p('## 7. Accounting policies and standard notes');
  p(`Version ${POLICY_VERSION}. A policy prints in note 2 when the company has the line. The preparer edits and confirms each one for the client. An unconfirmed policy prints the wording below.`);
  table(['Line', 'Title', 'Starter wording'], Object.entries(POLICIES).map(([code, x]) => [code, x.title, x.text]));
  p('Standard wording offered for four notes. The preparer confirms it is true for the entity before using it:');
  table(['Note', 'Wording'], Object.entries(STANDARD_NOTES).map(([k, v]) => [k, v]));
  p('Also to review, in the financial statements screen: the report of the directors, the statement of directors’ responsibilities, note 1 (general information) and the basis of preparation paragraph of note 2. And in the consolidation screen: the basis of consolidation, goodwill, associates and foreign subsidiaries notes.');
  signOff();

  // ---------------------------------------------------------------------
  p('## 8. Report wording');
  p('Each variant is printed in full, as drafted for a company called Example Limited with a year end of 31 December 2025. The partner’s basis paragraph for a modified opinion is shown as a placeholder.');
  const base: Omit<ReportInput, 'type' | 'settings'> = { clientName: 'Example Limited', yearEnd: '2025-12-31', hasCashFlow: true };
  const print = (title: string, input: ReportInput) => {
    const r = draftReport(input);
    p(`### ${title}`, `**${r.title}**`, r.addressee);
    for (const s of r.sections) {
      if (s.heading) p(`*${s.heading}*`);
      for (const para of s.paragraphs) p(para);
    }
  };
  print('Audit, unmodified opinion', { ...base, type: 'audit', settings: { opinion: 'unmodified' } });
  for (const opinion of ['qualified', 'adverse', 'disclaimer'] as const) {
    const r = draftReport({ ...base, type: 'audit', settings: { opinion, basis: '[The partner’s description of the matter.]' } });
    p(`### Audit, ${opinion}${opinion === 'disclaimer' ? ' of opinion' : ' opinion'}: the sections that differ`);
    for (const s of r.sections.slice(0, opinion === 'disclaimer' ? 4 : 2)) {
      if (opinion === 'disclaimer' && s.heading.startsWith('Responsibilities of the directors')) continue;
      p(`*${s.heading}*`);
      for (const para of s.paragraphs) p(para);
    }
  }
  print('Audit of a group, unmodified opinion', { ...base, type: 'audit', settings: { opinion: 'unmodified' }, group: true, groupCashFlow: true });
  print('Review', { ...base, type: 'review', settings: {} });
  print('Compilation', { ...base, type: 'compilation', settings: {} });
  p('Not produced by the software: emphasis of matter and other matter paragraphs, a material uncertainty related to going concern section, key audit matters, an other information section, and modified review conclusions. The partner must add these by hand where they apply. Decide whether that is acceptable for release.');
  signOff();

  // ---------------------------------------------------------------------
  p('## 9. Client request list');
  p('A starting list of what the firm asks a client for. The firm tailors it.');
  table(['Request', 'Detail'], STANDARD_REQUESTS.map((r) => [r.title, r.detail]));
  signOff();

  // ---------------------------------------------------------------------
  p('## 10. Methods the software applies');
  p('### Journal testing');
  p(`Every journal in the general ledger is scored against the indicators below, one point each. A journal with ${HIGH_RISK_SCORE} or more must be tested and concluded on before sign-off. The ledger is also agreed to the trial balance account by account, to show the population is complete.`);
  table(['Indicator', 'Shown to the user as'], Object.entries(FLAG_LABEL).map(([k, v]) => [k, v]));
  p(
    '### Bank reconciliation',
    'Each line of a bank statement is matched to the entries on the ledger account it supports. The statement’s running balance is checked row by row for breaks. Items on the statement and not in the ledger must be adjusted or concluded on before sign-off.',
    '',
    '### Materiality',
    'Overall materiality is the chosen percentage of the chosen benchmark: revenue, profit before tax, total assets or equity. Performance materiality defaults to 75% of overall and the clearly trivial threshold to 5%. Unadjusted differences above overall materiality raise an advisory.',
    '',
    '### Analytical review',
    'Each statement line is compared with last year. A movement is significant when it is at least performance materiality, or 1% of revenue where materiality is not set, and at least 10%. Opening retained earnings is excluded. Ratios use year-end balances.',
    '',
    '### Fixed asset schedule and tax reconciliation',
    'Additions are derived: closing cost less opening cost plus disposals entered. The depreciation charge is derived the same way and must agree to the accounts tagged as depreciation. The tax reconciliation starts from profit before tax at a rate the preparer enters, and must be reconciled to the charge with named items.',
  );
  signOff();

  // ---------------------------------------------------------------------
  p('## 11. Consolidation');
  p(
    'Method: line-by-line addition; elimination of the investment against the subsidiary’s net assets at acquisition; goodwill as cost less the group’s share of those net assets, amortised as the preparer enters; non-controlling interests at their share of the subsidiary’s net assets; a bargain purchase taken to reserves; intercompany eliminations entered by the preparer on statement lines.',
    '',
    'Subsidiaries bought or sold in a year are included for the days held. On a sale the parent’s gain is restated to the group’s using net assets on the day of sale. Associates and joint ventures are carried at cost or by the equity method. A foreign subsidiary is translated at the closing rate for assets and liabilities and the average rate for income and expenses, with the difference in other comprehensive income.',
  );
  p('Simplifications and departures to accept or reject:');
  table(
    ['Matter', 'What the software does', 'What the Standard expects'],
    [
      ['Part-year results', 'Takes a share of the full year by days held.', 'The results actually earned in the period of control.'],
      ['Unrealised profit', 'Borne wholly by the owners of the parent.', 'Shared with non-controlling interests where the subsidiary made the sale.'],
      ['Subsidiary’s reserves since acquisition', 'Shown within group retained earnings.', 'Each reserve shown by its nature.'],
      ['Goodwill on a foreign subsidiary', 'Kept at the naira amount at acquisition.', 'Treated as an asset of the foreign operation and retranslated at each closing rate.'],
      ['Consolidated cash flow', 'Left out, with the reason, in a year a subsidiary is bought or sold, or where one is foreign.', 'Required in every case.'],
      ['Change in holding without loss of control, step acquisitions', 'Not supported.', 'Specific treatments apply.'],
    ],
  );
  signOff();

  // ---------------------------------------------------------------------
  p('## 12. AI assistance');
  p(
    'Off for every firm until a partner turns it on. The AI suggests and a person decides. It never selects an opinion, concludes on a test or signs. Its output is labelled, set apart and not saved as the firm’s work. Each request is logged with who made it and when.',
  );
  table(
    ['Feature', 'What is sent', 'What comes back', 'Guard'],
    [
      ['Mapping suggestions', 'Account codes, names and balances.', 'A statement line, confidence and reason for each account.', 'Only existing lines are accepted. The accountant accepts each one.'],
      ['Journal explanation', 'One journal: date, description, poster, accounts, amounts.', 'What it appears to do, why it was flagged, ways to test it.', 'Told not to say the journal is acceptable. Not saved to the file.'],
      ['Questions on a movement', 'Statement lines and ratios for both years.', 'Causes to consider, questions, corroboration.', 'Told never to state a cause as fact. Not saved to the file.'],
      ['Policy draft', 'The starter policy and the account names on that line.', 'Redrafted wording with placeholders for unknown facts.', 'Cannot be confirmed while a placeholder remains.'],
    ],
  );
  p('Client and firm names are not sent. A journal description can still name a person or a company.');
  signOff();

  // ---------------------------------------------------------------------
  p('## 13. Quality management starter content');
  p(`Version ${QUALITY_VERSION}. Example quality risks and responses a firm can load and tailor. ISQM 1 requires each firm to identify its own. Review that none is misleading as an example.`);
  table(['Component', 'Risk', 'What could go wrong', 'Example response'], STARTER_RISKS.map((r) => [COMPONENT_LABEL[r.component], r.title, r.detail, r.response]));
  p('The three conclusions offered for the yearly evaluation:');
  table(['Conclusion', 'Wording'], Object.entries(CONCLUSIONS).map(([k, v]) => [k, v]));
  signOff();

  p('## Overall release decision');
  p('Reviewer: ______________________  Qualification and membership number: ______________________  Date: ____________');
  p('Released for use by firms / Released with the changes marked / Not released');
  return out.join('\n').trimEnd() + '\n';
}

const AUTO_BASIS: Record<string, string> = {
  complete_set: 'Yes, when a prior year is held, so that the cash flow statement is produced.',
  comparatives: 'Yes, when a prior year trial balance is imported.',
  identification: 'Yes, always. The layout of the statements provides it.',
  compliance_statement: 'Yes, always. Stated in note 2.',
  general_information: 'Yes, when the registered office and principal activity are entered.',
  going_concern: 'Yes, when the going concern note has any text.',
  equity_statement: 'Yes, always. The statement is produced.',
  cash_components: 'Yes, always. The cash note lists its accounts.',
  ppe_reconciliation: 'Yes, when the movement schedule agrees to the depreciation charge.',
  tax_reconciliation: 'Yes, when the reconciliation has no unexplained difference.',
  related_parties: 'Yes, when transactions are listed or the preparer confirms there are none.',
  key_management: 'Yes, when directors’ remuneration is entered.',
  subsequent_events: 'Yes, when the note has any text.',
  contingencies: 'Yes, when the note has any text.',
  commitments: 'Yes, when the note has any text.',
  line_breakdown: 'Yes, always. Each line is analysed by account in its note.',
  policies_tailored: 'Yes, when every applicable policy has wording confirmed for the client.',
};
