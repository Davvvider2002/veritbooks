import type { Row, Statements } from './statements';
import type { EngagementType, Kobo } from './types';

/**
 * The CIPC annual financial statements filing: one XHTML file in Inline XBRL 1.1, against the
 * IFRS for SMEs entry point of the CIPC XBRL taxonomy (2024, which extends the IFRS Accounting
 * Taxonomy of 27 March 2024).
 *
 * Sources, checked October 2026:
 * - CIPC XBRL taxonomy page: https://www.cipc.co.za/?page_id=4400
 * - CIPC XBRL Taxonomy 2024 Architecture (23 August 2024): namespaces under
 *   https://xbrl.cipc.co.za/taxonomy/, element names as the CamelCase of the English label, the
 *   mandatory elements, and that nil facts carry an English footnote.
 * - CIPC XBRL FAQ: iXBRL 1.1 in a single XHTML file; primary statements fact-tagged and
 *   block-tagged; notes and reports block-tagged.
 *
 * What is not settled here: the taxonomy package could not be loaded to check each element
 * name, the entry point's file name and the enumeration values. Element names follow CIPC's
 * naming rule from the label, and every name sits in CONCEPTS below so it can be corrected in
 * one place. The file must pass CIPC's validation (a test upload on the e-services portal, or
 * Arelle with the taxonomy package) before it is first filed.
 */

export const IXBRL_DRAFT_NOTE =
  'Draft for validation. Element names follow CIPC’s naming rule and have not been checked against the 2024 taxonomy package. Validate the file with CIPC before the first filing.';

export interface CipcDetails {
  customerCode?: string;
  /** Private company, public company, personal liability company, state-owned company, non-profit company. */
  companyType?: string;
  /** The person CIPC names as responsible for the company's compliance. */
  complianceName?: string;
  /** The person responsible for the financial accountability of the company. */
  designatedName?: string;
  designatedPhone?: string;
  email?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  postalSame?: boolean;
  principalPlace?: string;
  /** The most individuals with a beneficial interest in the company's securities during the year. */
  beneficialHolders?: number;
  /** Liabilities to third parties. Blank uses total liabilities. */
  thirdPartyLiabilities?: Kobo;
  /** Turnover for the public interest score. Blank uses revenue. */
  turnover?: Kobo;
  approvalDate?: string;
  publicationDate?: string;
  authorisedDirector?: string;
  preparerName?: string;
  preparerDesignation?: string;
  /** "The company has no holding company." or the names of the holding and ultimate holding companies. */
  holdingCompany?: string;
  /** The schemaRef of the entry point. Blank uses ENTRY_POINT. */
  entryPoint?: string;
  /** Whether the statements were independently compiled, rather than compiled internally. */
  independentlyCompiled?: boolean;
}

export const COMPANY_TYPES = ['Private company', 'Public company', 'Personal liability company', 'State-owned company', 'Non-profit company'];

/* ------------------------------------------------------------------------------------------------
 * Public interest score, regulation 26(2) of the Companies Regulations, 2011
 * ---------------------------------------------------------------------------------------------- */

const MILLION = 1_000_000_00;

export interface PublicInterestScore {
  employees: number;
  liabilities: number;
  turnover: number;
  holders: number;
  total: number;
  /** What the score means for the company's statements, in a sentence. */
  meaning: string;
}

export function publicInterestScore(
  input: { employees?: number; thirdPartyLiabilities: Kobo; turnover: Kobo; beneficialHolders?: number; companyType?: string; independentlyCompiled?: boolean },
): PublicInterestScore {
  const employees = Math.max(0, Math.round(input.employees ?? 0));
  // One point for every R1 million, or portion of it.
  const liabilities = Math.max(0, Math.ceil(input.thirdPartyLiabilities / MILLION));
  const turnover = Math.max(0, Math.ceil(input.turnover / MILLION));
  const holders = Math.max(0, Math.round(input.beneficialHolders ?? 0));
  const total = employees + liabilities + turnover + holders;
  let meaning: string;
  if (input.companyType === 'Public company' || input.companyType === 'State-owned company') meaning = 'A public or state-owned company must be audited and files its statements with CIPC in iXBRL.';
  else if (total >= 350) meaning = 'A score of 350 or more requires an audit, and the statements are filed with CIPC in iXBRL.';
  else if (total >= 100)
    meaning = input.independentlyCompiled
      ? 'A score of 100 to 349 with independently compiled statements requires an independent review, unless the company chooses an audit.'
      : 'A score of 100 to 349 with internally compiled statements requires an audit, and the statements are filed with CIPC in iXBRL.';
  else meaning = 'A score below 100 requires an independent review, unless every shareholder is also a director, or the company chooses an audit.';
  return { employees, liabilities, turnover, holders, total, meaning };
}

/* ------------------------------------------------------------------------------------------------
 * Concepts
 * ---------------------------------------------------------------------------------------------- */

export const IFRS_DATE = '2024-03-27';
export const NAMESPACES: Record<string, string> = {
  'ifrs-full': `https://xbrl.ifrs.org/taxonomy/${IFRS_DATE}/ifrs-full`,
  cipc: 'https://xbrl.cipc.co.za/taxonomy',
  'cipc-ca': 'https://xbrl.cipc.co.za/taxonomy/ca',
};
/** The entry point as CIPC names its files. Replace with the exact file from the 2024 taxonomy package. */
export const ENTRY_POINT = 'https://xbrl.cipc.co.za/taxonomy/2024-09-30/cipc_ifrs_for_smes_entry_point_2024-09-30.xsd';

/** The statement line each chart line is tagged with. */
export const CHART_CONCEPT: Record<string, string> = {
  ppe: 'ifrs-full:PropertyPlantAndEquipment',
  intangibles: 'ifrs-full:IntangibleAssetsOtherThanGoodwill',
  investments: 'ifrs-full:OtherNoncurrentFinancialAssets',
  deferred_tax_asset: 'ifrs-full:DeferredTaxAssets',
  inventories: 'ifrs-full:Inventories',
  trade_receivables: 'ifrs-full:CurrentTradeReceivables',
  other_receivables: 'ifrs-full:OtherCurrentReceivables',
  cash: 'ifrs-full:CashAndCashEquivalents',
  share_capital: 'ifrs-full:IssuedCapital',
  share_premium: 'ifrs-full:SharePremium',
  other_reserves: 'ifrs-full:OtherReserves',
  retained_earnings: 'ifrs-full:RetainedEarnings',
  borrowings_nc: 'ifrs-full:LongtermBorrowings',
  deferred_tax_liability: 'ifrs-full:DeferredTaxLiabilities',
  provisions: 'ifrs-full:NoncurrentProvisions',
  trade_payables: 'ifrs-full:TradeAndOtherCurrentPayablesToTradeSuppliers',
  other_payables: 'ifrs-full:OtherCurrentPayables',
  borrowings_c: 'ifrs-full:ShorttermBorrowings',
  current_tax_payable: 'ifrs-full:CurrentTaxLiabilitiesCurrent',
  revenue: 'ifrs-full:Revenue',
  other_income: 'ifrs-full:OtherIncome',
  finance_income: 'ifrs-full:FinanceIncome',
  cost_of_sales: 'ifrs-full:CostOfSales',
  distribution_costs: 'ifrs-full:DistributionCosts',
  admin_expenses: 'ifrs-full:AdministrativeExpense',
  other_expenses: 'ifrs-full:OtherExpenseByFunction',
  finance_costs: 'ifrs-full:FinanceCosts',
  income_tax_expense: 'ifrs-full:IncomeTaxExpenseContinuingOperations',
  dividends: 'ifrs-full:DividendsRecognisedAsDistributionsToOwnersOfParent',
};

/** Totals and cash flow lines, by the label the statements give them. invert: the concept counts an outflow as positive. */
export const LABEL_CONCEPT: Record<string, { concept: string; invert?: boolean }> = {
  'Total non-current assets': { concept: 'ifrs-full:NoncurrentAssets' },
  'Total current assets': { concept: 'ifrs-full:CurrentAssets' },
  'Total assets': { concept: 'ifrs-full:Assets' },
  'Total equity': { concept: 'ifrs-full:Equity' },
  'Total non-current liabilities': { concept: 'ifrs-full:NoncurrentLiabilities' },
  'Total current liabilities': { concept: 'ifrs-full:CurrentLiabilities' },
  'Total liabilities': { concept: 'ifrs-full:Liabilities' },
  'Total equity and liabilities': { concept: 'ifrs-full:EquityAndLiabilities' },
  'Gross profit': { concept: 'ifrs-full:GrossProfit' },
  'Operating profit': { concept: 'ifrs-full:ProfitLossFromOperatingActivities' },
  'Profit before tax': { concept: 'ifrs-full:ProfitLossBeforeTax' },
  'Profit for the year': { concept: 'ifrs-full:ProfitLoss' },
  'Depreciation and amortisation': { concept: 'ifrs-full:AdjustmentsForDepreciationAndAmortisationExpense' },
  'Finance costs': { concept: 'ifrs-full:AdjustmentsForFinanceCosts' },
  'Change in inventories': { concept: 'ifrs-full:AdjustmentsForDecreaseIncreaseInInventories' },
  'Change in trade receivables': { concept: 'ifrs-full:AdjustmentsForDecreaseIncreaseInTradeAccountReceivable' },
  'Change in other receivables and prepayments': { concept: 'ifrs-full:AdjustmentsForDecreaseIncreaseInOtherOperatingReceivables' },
  'Change in trade payables': { concept: 'ifrs-full:AdjustmentsForIncreaseDecreaseInTradeAccountPayable' },
  'Change in other payables and accruals': { concept: 'ifrs-full:AdjustmentsForIncreaseDecreaseInOtherOperatingPayables' },
  'Change in provisions': { concept: 'ifrs-full:AdjustmentsForProvisions' },
  'Cash generated from operations': { concept: 'ifrs-full:CashFlowsFromUsedInOperations' },
  'Income tax paid': { concept: 'ifrs-full:IncomeTaxesPaidRefundClassifiedAsOperatingActivities', invert: true },
  'Net cash from operating activities': { concept: 'ifrs-full:CashFlowsFromUsedInOperatingActivities' },
  'Net cash used in investing activities': { concept: 'ifrs-full:CashFlowsFromUsedInInvestingActivities' },
  'Proceeds from issue of shares': { concept: 'ifrs-full:ProceedsFromIssuingShares' },
  'Finance costs paid': { concept: 'ifrs-full:InterestPaidClassifiedAsFinancingActivities', invert: true },
  'Dividends paid': { concept: 'ifrs-full:DividendsPaidClassifiedAsFinancingActivities', invert: true },
  'Net cash from financing activities': { concept: 'ifrs-full:CashFlowsFromUsedInFinancingActivities' },
  'Net change in cash and cash equivalents': { concept: 'ifrs-full:IncreaseDecreaseInCashAndCashEquivalents' },
  'Cash and cash equivalents at start of year': { concept: 'ifrs-full:CashAndCashEquivalents' },
  'Cash and cash equivalents at end of year': { concept: 'ifrs-full:CashAndCashEquivalents' },
};

/* ------------------------------------------------------------------------------------------------
 * The document
 * ---------------------------------------------------------------------------------------------- */

export interface IxbrlInput {
  entityName: string;
  registrationNumber: string;
  yearEnd: string;
  /** The first day of the year. */
  yearStart: string;
  /** Currency code, such as ZAR. */
  currency: string;
  currencyName: string;
  type: EngagementType;
  st: Statements;
  details: CipcDetails;
  employees?: number;
  directors: string[];
  principalActivity: string;
  /** XHTML fragments of the pages that are block-tagged, as they print. */
  blocks: {
    directorsReport: string;
    responsibilities: string;
    report?: string;
    policies: string;
    notes: string;
    equity?: string;
  };
  software: { name: string; version: string };
}

export interface IxbrlResult {
  xhtml: string;
  /** The number of tagged facts. */
  facts: number;
  /** Mandatory items still blank. The file is produced, but CIPC will reject it until they are filled in. */
  missing: string[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const priorEnd = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;
/** A year end of 29 February moves to 28 February in a year without one. */
const validDate = (iso: string) => (Number.isNaN(Date.parse(iso + 'T00:00:00Z')) || new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) !== iso ? `${iso.slice(0, 8)}28` : iso);
const whole = (k: Kobo) => Math.round(Math.abs(k) / 100).toLocaleString('en-US');

export function buildIxbrl(input: IxbrlInput): IxbrlResult {
  const { st, details: d } = input;
  const missing: string[] = [];
  const need = (label: string, v: unknown) => {
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) missing.push(label);
  };
  need('Customer code', d.customerCode);
  need('Registration number of company', input.registrationNumber);
  need('Type of company', d.companyType);
  need('Name of designated person responsible for compliance', d.complianceName);
  need('Name of designated person responsible for financial accountability', d.designatedName);
  need('Telephone number of that person', d.designatedPhone);
  need('Email address of company', d.email);
  need('Business address: street', d.street);
  need('Business address: city', d.city);
  need('Business address: postal code', d.postalCode);
  need('Principal place of business', d.principalPlace);
  need('Average number of employees', input.employees);
  need('Individuals with a beneficial interest', d.beneficialHolders);
  need('Date of approval of the annual financial statements', d.approvalDate);
  need('Date of publication of the financial statements', d.publicationDate);
  need('Director authorised to approve the statements', d.authorisedDirector);
  need('Name of the person who prepared the statements', d.preparerName);
  need('Professional designation of that person', d.preparerDesignation);
  need('Principal activity', input.principalActivity);
  if (!st.prior) missing.push('Prior year figures, for the statement of cash flows and the change in equity');

  const end = input.yearEnd;
  const pEnd = validDate(priorEnd(end));
  const pStart = validDate(priorEnd(input.yearStart));
  const ctx = {
    CY: { start: input.yearStart, end },
    PY: { start: pStart, end: pEnd },
  };
  const scheme = 'http://www.cipc.co.za';
  const regNo = input.registrationNumber.trim() || 'UNKNOWN';
  const unit = input.currency;

  let n = 0;
  const id = () => `f${++n}`;
  const footnotes: { fact: string; text: string }[] = [];
  /** A monetary fact as it is shown: the brackets stay outside the tag. */
  const money = (concept: string, natural: Kobo, context: string, shown: Kobo = natural, nilNote?: string): string => {
    const fid = id();
    if (natural === 0 && nilNote) footnotes.push({ fact: fid, text: nilNote });
    const tag =
      natural === 0
        ? `<ix:nonFraction name="${concept}" id="${fid}" contextRef="${context}" unitRef="${unit}" decimals="0" format="ixt:fixed-zero">–</ix:nonFraction>`
        : `<ix:nonFraction name="${concept}" id="${fid}" contextRef="${context}" unitRef="${unit}" decimals="0" format="ixt:num-dot-decimal"${natural < 0 ? ' sign="-"' : ''}>${whole(natural)}</ix:nonFraction>`;
    return shown < 0 ? `(${tag})` : tag;
  };
  const hidden: string[] = [];
  const text = (concept: string, value: string | undefined | null, context = 'CY') => {
    if (value === undefined || value === null || value === '') return;
    hidden.push(`<ix:nonNumeric name="${concept}" id="${id()}" contextRef="${context}">${esc(value)}</ix:nonNumeric>`);
  };
  const count = (concept: string, value: number | undefined) => {
    if (value === undefined) return;
    hidden.push(`<ix:nonFraction name="${concept}" id="${id()}" contextRef="CY" unitRef="pure" decimals="0">${Math.round(value)}</ix:nonFraction>`);
  };
  const hiddenMoney = (concept: string, value: Kobo, context: string, nilNote?: string) => hidden.push(money(concept, value, context, value, nilNote).replace(/^\(|\)$/g, ''));

  // Statement tables, each figure tagged where a concept is known.
  const table = (rows: Row[], kind: 'instant' | 'duration', withPrior: boolean) => {
    const cy = kind === 'instant' ? 'CY_I' : 'CY';
    const py = kind === 'instant' ? 'PY_I' : 'PY';
    const body = rows
      .map((r) => {
        if (r.style === 'heading') return `<tr class="heading"><td colspan="${withPrior ? 3 : 2}">${esc(r.label)}</td></tr>`;
        if (r.style === 'check') return '';
        const byLabel = LABEL_CONCEPT[r.label];
        const concept = (r.code && CHART_CONCEPT[r.code]) || byLabel?.concept;
        const cell = (v: Kobo | null, context: string | null) => {
          if (v === null) return '';
          if (!concept || !context) return v === 0 ? '–' : v < 0 ? `(${whole(v)})` : whole(v);
          // The fact carries the concept's own sign; the row shows the statement's.
          const natural = r.negated ? -v : byLabel?.invert && !r.code ? -v : v;
          return money(concept, natural, context, v);
        };
        // The cash flow's opening cash is last year's closing balance.
        const curCtx = r.label === 'Cash and cash equivalents at start of year' ? 'PY_I' : r.label === 'Cash and cash equivalents at end of year' ? 'CY_I' : cy;
        // The comparative year's opening cash is two years back, which has no context of its own: it is shown, not tagged.
        const priorCtx = r.label === 'Cash and cash equivalents at start of year' ? null : r.label === 'Cash and cash equivalents at end of year' ? 'PY_I' : py;
        return `<tr class="${r.style}"><td>${esc(r.label)}</td><td class="num">${cell(r.cur, curCtx)}</td>${withPrior ? `<td class="num">${cell(r.prior, priorCtx)}</td>` : ''}</tr>`;
      })
      .join('\n');
    const year = end.slice(0, 4);
    const head = `<tr><th></th><th class="num">${year}<br/>${esc(unit)}</th>${withPrior ? `<th class="num">${Number(year) - 1}<br/>${esc(unit)}</th>` : ''}</tr>`;
    return `<table class="fs"><thead>${head}</thead><tbody>\n${body}\n</tbody></table>`;
  };

  const withPrior = !!st.prior;
  const sections: string[] = [];
  const section = (title: string, inner: string) => sections.push(`<div class="page"><h2>${esc(title)}</h2>\n${inner}\n</div>`);
  const block = (concept: string, html: string) => `<ix:nonNumeric name="${concept}" id="${id()}" contextRef="CY" escape="true">${html}</ix:nonNumeric>`;

  sections.push(
    `<div class="page cover"><h1>${esc(input.entityName)}</h1><p>Registration number ${esc(input.registrationNumber)}</p><p>Annual financial statements for the year ended ${esc(end)}</p></div>`,
  );
  section("Report of the directors", block('cipc:DisclosureOfDirectorsReportExplanatory', input.blocks.directorsReport));
  section("Statement of directors' responsibilities", block('cipc:DisclosureOfDirectorsResponsibilityExplanatory', input.blocks.responsibilities));
  if (input.blocks.report) section(input.type === 'audit' ? "Independent auditor's report" : input.type === 'review' ? "Independent reviewer's report" : "Accountant's compilation report", block('cipc:DisclosureOfIndependentAuditorsReportExplanatory', input.blocks.report));
  section('Statement of financial position', table(st.position, 'instant', withPrior));
  section(
    'Statement of profit or loss and other comprehensive income',
    `${table(st.income, 'duration', withPrior)}
<table class="fs"><tbody>
<tr class="line"><td>Other comprehensive income</td><td class="num">${money('ifrs-full:OtherComprehensiveIncome', 0, 'CY')}</td>${withPrior ? `<td class="num">${money('ifrs-full:OtherComprehensiveIncome', 0, 'PY')}</td>` : ''}</tr>
<tr class="total"><td>Total comprehensive income for the year</td><td class="num">${money('ifrs-full:ComprehensiveIncome', st.cur.profit, 'CY')}</td>${withPrior ? `<td class="num">${money('ifrs-full:ComprehensiveIncome', st.prior!.profit, 'PY')}</td>` : ''}</tr>
</tbody></table>`,
  );
  if (input.blocks.equity) section('Statement of changes in equity', input.blocks.equity);
  if (st.cashFlow) section('Statement of cash flows', table(st.cashFlow, 'duration', withPrior && st.cashFlow.some((r) => r.style !== 'heading' && r.prior !== null)));
  section(
    'Notes to the financial statements',
    `${block('ifrs-full:DisclosureOfMaterialAccountingPolicyInformationExplanatory', input.blocks.policies)}\n${block('ifrs-full:DisclosureOfNotesAndOtherExplanatoryInformationExplanatory', input.blocks.notes)}`,
  );

  // Facts that are not printed as figures on the statements.
  // An empty list is not valid XHTML, so the block is left out until the directors are named.
  if (input.directors.length === 0) missing.push('Names of the directors');
  const directorsHtml = `<ul>${input.directors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  if (input.directors.length) hidden.push(`<ix:nonNumeric name="cipc:DisclosureOfDirectorsExplanatory" id="${id()}" contextRef="CY" escape="true">${directorsHtml}</ix:nonNumeric>`);
  const holding = d.holdingCompany?.trim() || 'The company has no holding company.';
  hidden.push(`<ix:nonNumeric name="cipc:DisclosureOfHoldingCompanyAndUltimateHoldingCompanyExplanatory" id="${id()}" contextRef="CY" escape="true"><p>${esc(holding)}</p></ix:nonNumeric>`);
  text('ifrs-full:NameOfReportingEntityOrOtherMeansOfIdentification', input.entityName);
  text('cipc-ca:FullRegisteredNameOfCompany', input.entityName);
  text('cipc-ca:RegistrationNumberOfCompany', input.registrationNumber);
  text('cipc-ca:CustomerCode', d.customerCode);
  text('cipc-ca:TypeOfCompany', d.companyType);
  text('ifrs-full:DateOfEndOfReportingPeriod2013', end);
  text('ifrs-full:PeriodCoveredByFinancialStatements', `${input.yearStart} to ${end}`);
  text('ifrs-full:DescriptionOfPresentationCurrency', input.currencyName);
  text('ifrs-full:LevelOfRoundingUsedInFinancialStatements', 'Units');
  text('ifrs-full:DescriptionOfNatureOfFinancialStatements', 'Separate');
  text('ifrs-full:DescriptionOfNatureOfEntitysOperationsAndPrincipalActivities', input.principalActivity);
  text('ifrs-full:PrincipalPlaceOfBusiness', d.principalPlace);
  text('cipc-ca:EmailAddressOfCompany', d.email);
  text('cipc-ca:BusinessAddressStreetName', d.street);
  text('cipc-ca:BusinessAddressCity', d.city);
  text('cipc-ca:BusinessAddressPostalCode', d.postalCode);
  text('cipc-ca:BusinessAddressCountry', d.country || 'South Africa');
  text('cipc-ca:PostalAddressSameAsBusinessAddress', String(d.postalSame ?? true));
  text('cipc-ca:NameOfDesignatedPersonResponsibleForCompliance', d.complianceName);
  text('cipc-ca:NameOfDesignatedPersonResponsibleForFinancialAccountabilityOfCompany', d.designatedName);
  text('cipc-ca:TelephoneNumberOfDesignatedPersonResponsibleForFinancialAccountabilityOfCompany', d.designatedPhone);
  text('cipc-ca:AnnualFinancialStatementsAudited', String(input.type === 'audit'));
  text('cipc-ca:AnnualFinancialStatementsIndependentlyCompiledAndReportedOn', String(!!d.independentlyCompiled));
  text('cipc:TypeOfAssurance', input.type === 'audit' ? 'Audited' : input.type === 'review' ? 'Independently reviewed' : 'Compiled');
  text('cipc:SoftwareName', input.software.name);
  text('cipc:SoftwareVersion', input.software.version);
  text('cipc:DateOfApprovalOfAnnualFinancialStatements', d.approvalDate);
  text('cipc:DateOfPublicationOfFinancialStatements', d.publicationDate);
  text('cipc:NameOfDirectorAuthorisedToApproveAnnualFinancialStatements', d.authorisedDirector);
  if (d.authorisedDirector) text('cipc:DeclarationOfSignatureByAuthorisedDirector', `The annual financial statements were approved by the board and signed on its behalf by ${d.authorisedDirector}.`);
  text('cipc:DeclarationOfDirectorsReportPresence', 'true');
  text('cipc:DeclarationOfAuditorsReportPresence', String(input.type === 'audit'));
  text('cipc:NameOfIndividualResponsibleForPreparationOfFinancialStatements', d.preparerName);
  text('cipc:ProfessionalDesignationOfIndividualResponsibleForPreparationOfFinancialStatements', d.preparerDesignation);

  const thirdParty = d.thirdPartyLiabilities ?? st.cur.totalLiabilities;
  const turnover = d.turnover ?? st.cur.v.revenue;
  const pis = publicInterestScore({ employees: input.employees, thirdPartyLiabilities: thirdParty, turnover, beneficialHolders: d.beneficialHolders, companyType: d.companyType, independentlyCompiled: d.independentlyCompiled });
  count('cipc-ca:AverageNumberOfEmployees', input.employees);
  count('cipc-ca:MaximumNumberOfIndividualsWithBeneficialInterestInSecuritiesOfCompanyOrMembersInCaseOfNonprofitCompany', d.beneficialHolders);
  count('cipc-ca:PublicInterestScore', pis.total);
  hiddenMoney('cipc-ca:ThirdPartyLiabilities', thirdParty, 'CY_I', 'The company had no liabilities to third parties at the end of the year.');
  hiddenMoney('cipc-ca:Turnover', turnover, 'CY', 'The company had no turnover in the year.');
  // Revenue and liabilities are printed on the statements; a nil figure there needs the same note.
  if (st.prior) hiddenMoney('ifrs-full:ChangesInEquity', st.cur.totalEquity - st.prior.totalEquity, 'CY');

  // Nil facts on the statements that CIPC warns on.
  const nilNotes: Record<string, string> = {
    'ifrs-full:Revenue': 'The company had no revenue in the year.',
    'ifrs-full:Liabilities': 'The company had no liabilities at the end of the year.',
  };
  let doc = sections.join('\n');
  doc = doc.replace(/<ix:nonFraction name="(ifrs-full:Revenue|ifrs-full:Liabilities)" id="(f\d+)" contextRef="(CY|CY_I)"[^>]*format="ixt:fixed-zero"/g, (m, concept: string, fid: string) => {
    footnotes.push({ fact: fid, text: nilNotes[concept] });
    return m;
  });

  const context = (cid: string, start: string | null, endDate: string) =>
    `<xbrli:context id="${cid}"><xbrli:entity><xbrli:identifier scheme="${scheme}">${esc(regNo)}</xbrli:identifier></xbrli:entity><xbrli:period>${
      start ? `<xbrli:startDate>${start}</xbrli:startDate><xbrli:endDate>${endDate}</xbrli:endDate>` : `<xbrli:instant>${endDate}</xbrli:instant>`
    }</xbrli:period></xbrli:context>`;
  const contexts = [
    context('CY', ctx.CY.start, ctx.CY.end),
    context('CY_I', null, ctx.CY.end),
    context('PY', ctx.PY.start, ctx.PY.end),
    context('PY_I', null, ctx.PY.end),
  ];

  const footnoteHtml = footnotes.map((f, i) => `<p><ix:footnote id="fn${i + 1}" xml:lang="en">${esc(f.text)}</ix:footnote></p>`).join('\n');
  const relationships = footnotes.map((f, i) => `<ix:relationship fromRefs="${f.fact}" toRefs="fn${i + 1}"/>`).join('\n');
  const entry = d.entryPoint?.trim() || ENTRY_POINT;

  const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${esc(IXBRL_DRAFT_NOTE)} -->
<html xmlns="http://www.w3.org/1999/xhtml"
  xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"
  xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2020-02-12"
  xmlns:xbrli="http://www.xbrl.org/2003/instance"
  xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
  xmlns:ifrs-full="${NAMESPACES['ifrs-full']}"
  xmlns:cipc="${NAMESPACES.cipc}"
  xmlns:cipc-ca="${NAMESPACES['cipc-ca']}"
  xml:lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>${esc(input.entityName)}: annual financial statements for the year ended ${esc(end)}</title>
<style type="text/css">
body{font-family:Georgia,serif;color:#111;max-width:820px;margin:0 auto;padding:24px}
.page{page-break-after:always;margin-bottom:48px}
h1{font-size:24px}h2{font-size:18px;border-bottom:1px solid #999;padding-bottom:4px}
table.fs{width:100%;border-collapse:collapse;margin:8px 0}
table.fs td,table.fs th{padding:3px 6px;vertical-align:top}
.num{text-align:right;white-space:nowrap}
tr.heading td{font-weight:bold;padding-top:10px}
tr.subtotal td{border-top:1px solid #999}
tr.total td{border-top:1px solid #111;border-bottom:3px double #111;font-weight:bold}
</style>
</head>
<body>
<div style="display:none">
<ix:header>
<ix:hidden>
${hidden.join('\n')}
</ix:hidden>
<ix:references>
<link:schemaRef xlink:type="simple" xlink:href="${esc(entry)}"/>
</ix:references>
<ix:resources>
${contexts.join('\n')}
<xbrli:unit id="${unit}"><xbrli:measure>iso4217:${unit}</xbrli:measure></xbrli:unit>
<xbrli:unit id="pure"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit>
${relationships}
</ix:resources>
</ix:header>
</div>
${doc}
${footnoteHtml ? `<div class="page"><h2>Footnotes</h2>\n${footnoteHtml}\n</div>` : ''}
</body>
</html>
`;
  return { xhtml, facts: n, missing };
}
