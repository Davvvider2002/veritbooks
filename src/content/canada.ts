/**
 * Canada, outside Quebec: where a firm practises, the statute a client is incorporated under,
 * and the line a firm signs with. Quebec is left out of this release: it needs French reports,
 * a French interface and Law 25 privacy work.
 *
 * Sources, checked October 2026:
 * - Canada Business Corporations Act, s. 163 (no auditor for a non-distributing corporation,
 *   with every shareholder's consent). https://laws-lois.justice.gc.ca/eng/acts/C-44/section-163.html
 * - Canada Not-for-profit Corporations Act audit and review levels, as summarised by Torkin Manes.
 *   https://www.torkin.com/insights/publication/does-being-a-federal-not-for-profit-corporation-mandate-audited-financial-statements-
 * - Ontario Not-for-Profit Corporations Act, 2010 levels. https://ontario.ca/page/rules-not-profit-and-charitable-corporations
 * - Public accounting licensing: CPA Ontario (Public Accounting Act, 2004) and CPABC.
 *   https://www.cpaontario.ca/members/regulations-guidance/regulatory-publications/when-is-pal-required-in-ontario
 *   https://www.bccpa.ca/member-practice-regulation/public-practice/practitioners-licensing/
 *
 * Starter content. A Canadian CPA must confirm each statute name and exemption before live use.
 */

export interface Province {
  code: string;
  name: string;
  /** The line under the firm's name on a signed report. */
  designation: string;
  /** The body that licenses public accountants there. */
  regulator: string;
}

export const PROVINCES: Province[] = [
  { code: 'ON', name: 'Ontario', designation: 'Chartered Professional Accountants, Licensed Public Accountants', regulator: 'CPA Ontario' },
  { code: 'BC', name: 'British Columbia', designation: 'Chartered Professional Accountants', regulator: 'CPABC' },
  { code: 'AB', name: 'Alberta', designation: 'Chartered Professional Accountants', regulator: 'CPA Alberta' },
  { code: 'SK', name: 'Saskatchewan', designation: 'Chartered Professional Accountants', regulator: 'CPA Saskatchewan' },
  { code: 'MB', name: 'Manitoba', designation: 'Chartered Professional Accountants', regulator: 'CPA Manitoba' },
  { code: 'NS', name: 'Nova Scotia', designation: 'Chartered Professional Accountants', regulator: 'CPA Nova Scotia' },
  { code: 'NB', name: 'New Brunswick', designation: 'Chartered Professional Accountants', regulator: 'CPA New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador', designation: 'Chartered Professional Accountants', regulator: 'CPA Newfoundland and Labrador' },
  { code: 'PE', name: 'Prince Edward Island', designation: 'Chartered Professional Accountants', regulator: 'CPA Prince Edward Island' },
  { code: 'YT', name: 'Yukon', designation: 'Chartered Professional Accountants', regulator: 'CPA Yukon' },
  { code: 'NT', name: 'Northwest Territories', designation: 'Chartered Professional Accountants', regulator: 'CPA Northwest Territories and Nunavut' },
  { code: 'NU', name: 'Nunavut', designation: 'Chartered Professional Accountants', regulator: 'CPA Northwest Territories and Nunavut' },
];

export const provinceOf = (code: string | undefined): Province | null => PROVINCES.find((p) => p.code === code) ?? null;

export interface Statute {
  id: string;
  /** As written in a sentence: "the Canada Business Corporations Act". */
  name: string;
  /** For a select. */
  label: string;
  kind: 'company' | 'npo';
  /** Where the client may dispense with an audit, in a sentence. */
  exemption?: string;
}

export const STATUTES: Statute[] = [
  {
    id: 'cbca',
    name: 'the Canada Business Corporations Act',
    label: 'Canada Business Corporations Act (federal)',
    kind: 'company',
    exemption:
      'A corporation that is not a distributing corporation may resolve not to appoint an auditor, with the consent of every shareholder, including those with no vote, until the next annual meeting (section 163).',
  },
  { id: 'on', name: 'the Business Corporations Act (Ontario)', label: 'Business Corporations Act (Ontario)', kind: 'company', exemption: 'A corporation that is not an offering corporation may be exempted from the audit requirements for a year with the written consent of every shareholder (section 148).' },
  { id: 'bc', name: 'the Business Corporations Act (British Columbia)', label: 'Business Corporations Act (British Columbia)', kind: 'company' },
  { id: 'ab', name: 'the Business Corporations Act (Alberta)', label: 'Business Corporations Act (Alberta)', kind: 'company' },
  { id: 'sk', name: 'The Business Corporations Act, 2021 (Saskatchewan)', label: 'The Business Corporations Act, 2021 (Saskatchewan)', kind: 'company' },
  { id: 'mb', name: 'The Corporations Act (Manitoba)', label: 'The Corporations Act (Manitoba)', kind: 'company' },
  { id: 'ns', name: 'the Companies Act (Nova Scotia)', label: 'Companies Act (Nova Scotia)', kind: 'company' },
  { id: 'nb', name: 'the Business Corporations Act (New Brunswick)', label: 'Business Corporations Act (New Brunswick)', kind: 'company' },
  { id: 'nl', name: 'the Corporations Act (Newfoundland and Labrador)', label: 'Corporations Act (Newfoundland and Labrador)', kind: 'company' },
  { id: 'pe', name: 'the Business Corporations Act (Prince Edward Island)', label: 'Business Corporations Act (Prince Edward Island)', kind: 'company' },
  { id: 'territory', name: 'the business corporations act of the territory', label: 'A territorial business corporations act', kind: 'company' },
  { id: 'cnca', name: 'the Canada Not-for-profit Corporations Act', label: 'Canada Not-for-profit Corporations Act (federal)', kind: 'npo' },
  { id: 'onca', name: 'the Not-for-Profit Corporations Act, 2010 (Ontario)', label: 'Not-for-Profit Corporations Act, 2010 (Ontario)', kind: 'npo' },
  { id: 'society', name: 'the provincial Societies Act', label: 'Societies Act (British Columbia, Alberta or another province)', kind: 'npo' },
  { id: 'unincorporated', name: '', label: 'Unincorporated association or charitable trust', kind: 'npo' },
];

export const statuteOf = (id: string | undefined): Statute | null => STATUTES.find((s) => s.id === id) ?? null;

export type CanadaEngagement = 'audit' | 'review' | 'none';

/**
 * What a not-for-profit corporation's statute asks for, from its revenue. Levels can be waived
 * or raised by the members' resolutions the statute names, which the engagement records.
 */
export function npoRequirement(statute: string | undefined, soliciting: boolean, revenue: number): { need: CanadaEngagement; text: string } | null {
  const r = revenue / 100;
  if (statute === 'cnca') {
    if (soliciting) {
      if (r > 250_000) return { need: 'audit', text: 'A soliciting corporation with revenue over $250,000 must be audited.' };
      if (r > 50_000) return { need: 'audit', text: 'A soliciting corporation with revenue over $50,000 and up to $250,000 is audited, or reviewed if the members pass a special resolution for the year.' };
      return { need: 'review', text: 'A soliciting corporation with revenue of $50,000 or less needs a review engagement, unless every member agrees to waive it, or the members require an audit.' };
    }
    if (r > 1_000_000) return { need: 'audit', text: 'A non-soliciting corporation with revenue over $1 million must be audited.' };
    return { need: 'review', text: 'A non-soliciting corporation with revenue of $1 million or less needs a review engagement, unless every member agrees to waive it, or the members require an audit.' };
  }
  if (statute === 'onca') {
    if (soliciting) {
      if (r >= 500_000) return { need: 'audit', text: 'A public benefit corporation with revenue of $500,000 or more must be audited.' };
      if (r > 100_000) return { need: 'review', text: 'A public benefit corporation with revenue over $100,000 and under $500,000 needs at least a review engagement.' };
      return { need: 'none', text: 'A public benefit corporation with revenue of $100,000 or less may waive both the audit and the review by extraordinary resolution.' };
    }
    if (r > 500_000) return { need: 'review', text: 'A corporation that is not a public benefit corporation, with revenue over $500,000, needs at least a review engagement.' };
    return { need: 'none', text: 'A corporation that is not a public benefit corporation, with revenue of $500,000 or less, may waive both the audit and the review by extraordinary resolution.' };
  }
  return null;
}

/**
 * The basis of accounting for a compilation under CSRS 4200. Compiled statements need not
 * follow ASPE; when they do not, a note says how they were prepared.
 */
export type CompilationBasis = 'aspe' | 'cash-accruals' | 'cash' | 'tax' | 'other';

export const COMPILATION_BASES: { id: CompilationBasis; label: string }[] = [
  { id: 'cash-accruals', label: 'Historical cost, cash basis with selected accruals' },
  { id: 'cash', label: 'Cash basis' },
  { id: 'tax', label: 'Income tax basis' },
  { id: 'aspe', label: 'Canadian accounting standards for private enterprises (only if fully complied with)' },
  { id: 'other', label: 'Another basis, described below' },
];

/** Note 1 of compiled statements: the basis of accounting, in words. */
export function basisNote(basis: CompilationBasis | undefined, client: string, accruals: string, other: string, npo: boolean): string {
  const fs = 'the balance sheet and the statements of income and retained earnings'.replace('income and retained earnings', npo ? 'operations and changes in net assets' : 'income and retained earnings');
  switch (basis ?? 'cash-accruals') {
    case 'aspe':
      return `The financial information has been prepared in accordance with Canadian accounting standards for ${npo ? 'not-for-profit organizations' : 'private enterprises'}.`;
    case 'cash':
      return `The basis of accounting applied in the preparation of ${fs} of ${client} is the cash basis: revenue is recorded when received and expenses when paid. Assets other than cash, and liabilities, are not recorded.`;
    case 'tax':
      return `The basis of accounting applied in the preparation of ${fs} of ${client} is the basis used to determine income for income tax purposes.`;
    case 'other':
      return other.trim() || '[Describe the basis of accounting agreed with management.]';
    default:
      return `The basis of accounting applied in the preparation of ${fs} of ${client} is the historical cost basis and reflects cash transactions with the addition of ${accruals.trim() || '[list the accruals, for example accounts receivable, accounts payable and accrued liabilities, and amortization of capital assets]'}.`;
  }
}
