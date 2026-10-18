/**
 * The countries VeritBooks serves, and what changes from one to the next: the companies law,
 * who licenses auditors, how the framework is adopted, the currency, and the extra statements
 * local practice expects. English-speaking West Africa only. French-speaking West Africa runs
 * on SYSCOHADA and is a separate product.
 *
 * Sources, checked October 2026:
 * - Nigeria: Companies and Allied Matters Act 2020; Financial Reporting Council of Nigeria Act 2011.
 * - Ghana: Companies Act, 2019 (Act 992); Institute of Chartered Accountants, Ghana Act, 2020
 *   (Act 1058). ICAG adopted the IFRS for SMEs in 2010 and licenses auditors to sign.
 *   https://www.ifac.org/about-ifac/membership/profile/ghana
 * - Sierra Leone: Companies Act 2009 (amended 2014); ICASL issues practising certificates.
 *   IFRS for SMEs adopted from 1 January 2010 (CSAAG BPR2/2009).
 *   https://ifac.org/about-ifac/membership/profile/sierra-leone
 * - Liberia: LICPA Act 2011; LICPA Regulation 1 (2015) requires full IFRS or the IFRS for SMEs
 *   and adopts the ISAs. https://ifrs.org/use-around-the-world/use-of-ifrs-standards-by-jurisdiction/view-jurisdiction/liberia
 * - The Gambia: Companies Act, 2013; Financial Reporting Act 2013, which established GICA.
 * - South Africa: Companies Act 71 of 2008; registered auditors under the Auditing Profession Act
 *   and the IRBA Code. Report wording follows IRBA's SAAPS 3 illustrative reports.
 *   https://www.irba.co.za/upload/SAAPS%203%20(Revised%20May%202019%20Updated)(1).pdf
 *   https://www.cliffedekkerhofmeyr.com/guides/africa-corporate/gambia/entity-setup/what-is-the-legislation-that-governs-companies-in-your-jurisdiction.html
 *
 * Every phrase here is starter wording for the engagement partner, who must check it against
 * the law in force before issue, as with the rest of the report.
 */

export type CountryCode = 'NG' | 'GH' | 'SL' | 'LR' | 'GM' | 'ZA';
export type CurrencyCode = 'NGN' | 'GHS' | 'SLE' | 'LRD' | 'GMD' | 'ZAR' | 'USD';

export interface Currency {
  code: CurrencyCode;
  symbol: string;
  /** In a sentence: "presented in Ghanaian cedis". */
  name: string;
}

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian naira' },
  GHS: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian cedis' },
  SLE: { code: 'SLE', symbol: 'Le', name: 'Sierra Leonean leones' },
  LRD: { code: 'LRD', symbol: 'L$', name: 'Liberian dollars' },
  GMD: { code: 'GMD', symbol: 'D', name: 'Gambian dalasis' },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African rand' },
  USD: { code: 'USD', symbol: 'US$', name: 'United States dollars' },
};

export interface Jurisdiction {
  code: CountryCode;
  name: string;
  /** "incorporated and domiciled in Ghana": the country as it reads after "in". */
  inName: string;
  /** The companies law, as written in a sentence. Null where the report should not cite one. */
  companiesAct: string | null;
  /** Other laws the framework sentence cites beside the companies law. */
  otherLaws: string[];
  /** Who adopted the IFRS for SMEs, for the basis of preparation. Null where it is used as issued. */
  adoptedBy: string | null;
  /** The body that licenses auditors, short. */
  regulator: string;
  /** The number a firm and its partners hold to sign: "FRC registration number". */
  licenceLabel: string;
  /** The same, short, for column headings and signature blocks: "FRC number". */
  licenceShort: string;
  /** The chief executive and finance officer sign the statements with their own licence numbers. Nigeria only. */
  officerNumbers: boolean;
  /** Local practice expects a statement of value added and a five-year financial summary. */
  nationalStatements: boolean;
  /** The auditor's report carries the confirmations the companies law asks for. */
  statutoryConfirmations: boolean;
  /** The label for a company's registration number. */
  companyNumberLabel: string;
  /** Report currencies offered for an engagement, the usual one first. */
  currencies: CurrencyCode[];
  /** The data protection law named where AI assistance is explained. */
  dataLaw: string;
  /** The framework sentence, where local reports word it their own way. */
  framework?: string;
  /** The independence sentence of an audit report, where a local code is named. */
  independence?: string;
  /** Printed under the signing partner's name, such as "Registered Auditor". */
  signerTitle?: string;
}

export const JURISDICTIONS: Record<CountryCode, Jurisdiction> = {
  NG: {
    code: 'NG',
    name: 'Nigeria',
    inName: 'Nigeria',
    companiesAct: 'the Companies and Allied Matters Act 2020',
    otherLaws: ['the Financial Reporting Council of Nigeria Act 2011'],
    adoptedBy: 'the Financial Reporting Council of Nigeria',
    regulator: 'FRC',
    licenceLabel: 'FRC registration number',
    licenceShort: 'FRC number',
    officerNumbers: true,
    nationalStatements: true,
    statutoryConfirmations: true,
    companyNumberLabel: 'RC',
    currencies: ['NGN', 'USD'],
    dataLaw: 'the Nigeria Data Protection Act 2023',
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    inName: 'Ghana',
    companiesAct: 'the Companies Act, 2019 (Act 992)',
    otherLaws: [],
    adoptedBy: 'the Institute of Chartered Accountants, Ghana',
    regulator: 'ICAG',
    licenceLabel: 'ICAG practising licence number',
    licenceShort: 'ICAG licence',
    officerNumbers: false,
    nationalStatements: false,
    statutoryConfirmations: true,
    companyNumberLabel: 'Registration No.',
    currencies: ['GHS', 'USD'],
    dataLaw: 'the Data Protection Act, 2012 (Act 843)',
  },
  SL: {
    code: 'SL',
    name: 'Sierra Leone',
    inName: 'Sierra Leone',
    companiesAct: 'the Companies Act 2009',
    otherLaws: [],
    adoptedBy: 'the Institute of Chartered Accountants of Sierra Leone',
    regulator: 'ICASL',
    licenceLabel: 'ICASL practising certificate number',
    licenceShort: 'ICASL certificate',
    officerNumbers: false,
    nationalStatements: false,
    statutoryConfirmations: true,
    companyNumberLabel: 'Registration No.',
    currencies: ['SLE', 'USD'],
    dataLaw: 'the data protection law of Sierra Leone',
  },
  LR: {
    code: 'LR',
    name: 'Liberia',
    inName: 'Liberia',
    companiesAct: null,
    otherLaws: [],
    adoptedBy: 'the Liberian Institute of Certified Public Accountants',
    regulator: 'LICPA',
    licenceLabel: 'LICPA licence number',
    licenceShort: 'LICPA licence',
    officerNumbers: false,
    nationalStatements: false,
    statutoryConfirmations: false,
    companyNumberLabel: 'Registration No.',
    currencies: ['USD', 'LRD'],
    dataLaw: 'the data protection law of Liberia',
  },
  GM: {
    code: 'GM',
    name: 'The Gambia',
    inName: 'The Gambia',
    companiesAct: 'the Companies Act, 2013',
    otherLaws: ['the Financial Reporting Act 2013'],
    adoptedBy: null,
    regulator: 'GICA',
    licenceLabel: 'GICA practising certificate number',
    licenceShort: 'GICA certificate',
    officerNumbers: false,
    nationalStatements: false,
    statutoryConfirmations: true,
    companyNumberLabel: 'Registration No.',
    currencies: ['GMD', 'USD'],
    dataLaw: 'the data protection law of The Gambia',
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    inName: 'South Africa',
    companiesAct: 'the Companies Act of South Africa',
    otherLaws: [],
    adoptedBy: null,
    regulator: 'IRBA',
    licenceLabel: 'IRBA registration number',
    licenceShort: 'IRBA number',
    officerNumbers: false,
    nationalStatements: false,
    statutoryConfirmations: false,
    companyNumberLabel: 'Registration No.',
    currencies: ['ZAR', 'USD'],
    dataLaw: 'the Protection of Personal Information Act, 2013 (POPIA)',
    // As in IRBA's illustrative reports (SAAPS 3, revised May 2019).
    framework: 'the IFRS for SMEs Accounting Standard and the requirements of the Companies Act of South Africa',
    independence:
      'We are independent of the company in accordance with the Independent Regulatory Board for Auditors’ Code of Professional Conduct for Registered Auditors (IRBA Code) and other independence requirements applicable to performing audits of financial statements in South Africa. We have fulfilled our other ethical responsibilities in accordance with the IRBA Code and in accordance with other ethical requirements applicable to performing audits in South Africa.',
    signerTitle: 'Registered Auditor',
  },
};

export const COUNTRY_CODES = Object.keys(JURISDICTIONS) as CountryCode[];

export const jurisdictionOf = (code: string | null | undefined): Jurisdiction =>
  JURISDICTIONS[(code ?? 'NG') as CountryCode] ?? JURISDICTIONS.NG;

export const currencyOf = (code: string | null | undefined): Currency => CURRENCIES[(code ?? 'NGN') as CurrencyCode] ?? CURRENCIES.NGN;

/** "a, b and c" */
const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** The framework, as the report and the directors' pages name it. */
export function frameworkText(j: Jurisdiction): string {
  if (j.framework) return j.framework;
  if (!j.companiesAct) return `the IFRS for SMEs Accounting Standard${j.adoptedBy ? `, as adopted by ${j.adoptedBy}` : ''}`;
  return and(['the IFRS for SMEs Accounting Standard', j.companiesAct, ...j.otherLaws]);
}

/** The laws a company keeps its books under, for the statement of directors' responsibilities. */
export function booksLaw(j: Jurisdiction): string | null {
  const laws = [j.companiesAct, ...j.otherLaws].filter((x): x is string => !!x);
  return laws.length ? and(laws) : null;
}

/** First letter up, for the start of a sentence. */
export const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The country picked on the landing page, or in a link such as /signup?country=GH. Nigeria otherwise. */
export function chosenCountry(): CountryCode {
  let code = '';
  try {
    code = (new URLSearchParams(window.location.search).get('country') ?? sessionStorage.getItem('veritbooks.country') ?? '').toUpperCase();
  } catch {
    // Storage unavailable: fall back to Nigeria.
  }
  return (COUNTRY_CODES as string[]).includes(code) ? (code as CountryCode) : 'NG';
}

