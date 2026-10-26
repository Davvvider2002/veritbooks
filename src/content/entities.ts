import type { CountryCode, Jurisdiction } from './jurisdictions';
import type { Planning } from '../engine/types';

/**
 * Not-for-profit legal forms, by country, and what each one changes in the report: who governs
 * the entity, who the auditor's report is addressed to, and whether the companies law's
 * confirmations apply.
 *
 * Sources, checked October 2026:
 * - Nigeria: Companies and Allied Matters Act 2020, Part F (incorporated trustees, from section
 *   823), and companies limited by guarantee under Part B. https://cof.org/country-notes/nonprofit-law-nigeria
 * - Ghana: companies limited by guarantee under the Companies Act, 2019 (Act 992); exemption of
 *   charitable income under section 97 of the Income Tax Act, 2015 (Act 896), and audited
 *   statements filed with the Ghana Revenue Authority and the Registrar.
 *   https://www.mondaq.com/withholding-tax/1753156/taxation-for-not-for-profitsngos-in-ghana
 * - South Africa: non-profit companies under the Companies Act 71 of 2008, audit or review set by
 *   the public interest score; NPO Act 71 of 1997 reporting to the NPO Directorate.
 * - Framework: the IFRS for SMEs, presented for a not-for-profit (income and expenditure, funds
 *   in place of equity, restricted funds by grant), in the way the International Non-Profit
 *   Accounting Guidance (INPAG) developed by CIPFA and Humentum sets out. https://cipfa.org/policy-and-guidance/standards/international-financial-reporting-for-non-profit-organisations
 *
 * Starter wording. The engagement partner checks it against the law in force before issue.
 */
export interface LegalForm {
  id: string;
  label: string;
  /** Who governs: printed in the report, the responsibilities statement and the governing body's report. */
  governors: 'trustees' | 'directors' | 'board';
  /** The law the form exists under, as written in a sentence. Null where none is cited. */
  law: string | null;
  /** The companies law's confirmations apply to this form. */
  companyConfirmations: boolean;
}

const COMMON: LegalForm[] = [
  { id: 'guarantee', label: 'Company limited by guarantee', governors: 'directors', law: null, companyConfirmations: true },
  { id: 'ngo', label: 'Registered NGO or charity, not a company', governors: 'board', law: null, companyConfirmations: false },
  { id: 'trust', label: 'Charitable trust', governors: 'trustees', law: null, companyConfirmations: false },
];

export const LEGAL_FORMS: Record<CountryCode, LegalForm[]> = {
  NG: [
    { id: 'trustees', label: 'Incorporated trustees (CAMA 2020, Part F)', governors: 'trustees', law: 'Part F of the Companies and Allied Matters Act 2020', companyConfirmations: false },
    { id: 'guarantee', label: 'Company limited by guarantee (CAMA 2020)', governors: 'directors', law: 'the Companies and Allied Matters Act 2020', companyConfirmations: true },
  ],
  GH: [
    { id: 'guarantee', label: 'Company limited by guarantee (Act 992)', governors: 'directors', law: 'the Companies Act, 2019 (Act 992)', companyConfirmations: true },
    COMMON[1],
    COMMON[2],
  ],
  SL: COMMON,
  LR: COMMON,
  GM: COMMON,
  ZA: [
    { id: 'npc', label: 'Non-profit company (Companies Act 71 of 2008)', governors: 'directors', law: 'the Companies Act 71 of 2008', companyConfirmations: true },
    { id: 'trust', label: 'Trust (Trust Property Control Act)', governors: 'trustees', law: null, companyConfirmations: false },
    { id: 'association', label: 'Voluntary association', governors: 'board', law: null, companyConfirmations: false },
  ],
  // Canada: reports are addressed to the members, and Canadian reports carry no statutory confirmations.
  CA: [
    { id: 'cnca', label: 'Not-for-profit corporation (Canada Not-for-profit Corporations Act)', governors: 'directors', law: 'the Canada Not-for-profit Corporations Act', companyConfirmations: false },
    { id: 'onca', label: 'Not-for-profit corporation (Ontario Not-for-Profit Corporations Act, 2010)', governors: 'directors', law: 'the Not-for-Profit Corporations Act, 2010 (Ontario)', companyConfirmations: false },
    { id: 'society', label: 'Society (provincial Societies Act)', governors: 'directors', law: 'the provincial Societies Act', companyConfirmations: false },
    { id: 'unincorporated', label: 'Unincorporated association or charitable trust', governors: 'board', law: null, companyConfirmations: false },
  ],
};

export const isNpo = (planning: Planning) => planning.entity === 'npo';

/** The legal form of a not-for-profit engagement, the first for the country when none is chosen. */
export function legalFormOf(planning: Planning, country: CountryCode): LegalForm | null {
  if (!isNpo(planning)) return null;
  const forms = LEGAL_FORMS[country] ?? COMMON;
  return forms.find((f) => f.id === planning.legalForm) ?? forms[0];
}

/** Who governs, in the words the report uses. Directors for a company. */
export function governorsOf(planning: Planning, country: CountryCode): { plural: string; Plural: string; possessive: string } {
  const g = legalFormOf(planning, country)?.governors ?? 'directors';
  if (g === 'trustees') return { plural: 'trustees', Plural: 'Trustees', possessive: 'trustees’' };
  if (g === 'board') return { plural: 'board members', Plural: 'Board members', possessive: 'board members’' };
  return { plural: 'directors', Plural: 'Directors', possessive: 'directors’' };
}

/**
 * The country's settings as they apply to a not-for-profit of this legal form: the law it is
 * constituted under takes the place of the companies law, the companies law's confirmations
 * apply only to companies, and the Nigerian statement of value added, five-year summary and
 * officers' licence numbers are for companies.
 */
export function npoJurisdiction(j: Jurisdiction, form: LegalForm): Jurisdiction {
  const law = form.law ?? (form.companyConfirmations ? j.companiesAct : null);
  return {
    ...j,
    companiesAct: law,
    statutoryConfirmations: j.statutoryConfirmations && form.companyConfirmations && !!law,
    framework: law === j.companiesAct ? j.framework : undefined,
    officerNumbers: false,
    nationalStatements: false,
  };
}

/** The legal form in a sentence: "constituted as incorporated trustees", "as a company limited by guarantee". */
export function formPhrase(form: LegalForm): string {
  const base = form.label.replace(/ \(.*\)$/, '').replace(/, not a company$/, '');
  const lower = base[0].toLowerCase() + base.slice(1);
  if (form.id === 'trustees') return 'incorporated trustees';
  return `${/^[aeiou]/i.test(lower) ? 'an' : 'a'} ${lower}`;
}
