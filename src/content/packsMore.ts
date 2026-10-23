import type { Pack } from './packs';

/**
 * Industry packs beyond trading and manufacturing. Each adds work programme steps for audits and
 * reviews, disclosure checklist items and client requests for one kind of business.
 *
 * STATUS: starter content, version 0.2. The steps show the risks each industry usually carries
 * and how a pack works. They are not a reviewed methodology and must be reviewed by a qualified
 * technical author against the standards adopted in the firm's country before live use.
 * Section numbers refer to the IFRS for SMEs Accounting Standard.
 */

const S8 = 'Section 8: Notes';
const S11 = 'Section 11: Basic financial instruments';
const S13 = 'Section 13: Inventories';
const S16 = 'Section 16: Investment property';
const S18 = 'Section 18: Intangible assets';
const S20 = 'Section 20: Leases';
const S21 = 'Section 21: Provisions and contingencies';
const S23 = 'Section 23: Revenue';
const S24 = 'Section 24: Government grants';
const S27 = 'Section 27: Impairment of assets';
const S33 = 'Section 33: Related party disclosures';
const S34 = 'Section 34: Specialised activities';
const NPO = 'Not-for-profit presentation';

export const MORE_PACKS: Pack[] = [
  {
    id: 'npo',
    name: 'Not-for-profit: NGOs, charities, foundations and faith-based organisations',
    summary: 'Organisations funded by grants and donations, where the risks are that restricted money is spent outside its purpose, income is recognised in the wrong period, and donor conditions are not met.',
    programme: {
      audit: [
        { id: 'np-a-1', area: 'Grants and donations', text: 'Obtain every grant agreement in force in the year. List each grant’s amount, period, conditions, reporting and audit requirements, and any restriction on use.' },
        { id: 'np-a-2', area: 'Grants and donations', text: 'Agree grant receipts to the agreements, bank statements and donor remittance advices, and confirm significant grants directly with the donor.' },
        { id: 'np-a-3', area: 'Grants and donations', text: 'Test income recognition: a grant is income when the organisation is entitled to it; a grant with conditions not yet met is deferred, and amounts that must be returned are a liability.' },
        { id: 'np-a-4', area: 'Restricted funds', text: 'Reconcile each restricted fund: brought forward, received, spent and carried forward, to the fund tags on the Mapping step and to the donor reports.' },
        { id: 'np-a-5', area: 'Restricted funds', text: 'Test a sample of expenditure charged to each restricted fund for eligibility under the grant agreement, the approved budget, and supporting documents.' },
        { id: 'np-a-6', area: 'Restricted funds', text: 'Review shared and indirect costs allocated to grants: the basis, its consistency, and the caps in each agreement.' },
        { id: 'np-a-7', area: 'Restricted funds', text: 'Identify funds in deficit and transfers between funds, and confirm each was authorised and is disclosed.' },
        { id: 'np-a-8', area: 'Expenditure and procurement', text: 'Test procurement for significant purchases against the organisation’s policy and donor rules: quotations, tender records, approvals and conflicts of interest.' },
        { id: 'np-a-9', area: 'Expenditure and procurement', text: 'Test cash advances to staff and implementing partners for retirement within the agreed time, with receipts, and review sub-grants for monitoring and partner audit reports.' },
        { id: 'np-a-10', area: 'Donations', text: 'Assess controls over cash donations, offerings and collections: counting by two people, prompt banking, and reconciliation of collection records to bank.' },
        { id: 'np-a-11', area: 'Donations', text: 'Identify gifts in kind and donated services, and test how they are recognised and measured.' },
        { id: 'np-a-12', area: 'Governance and compliance', text: 'Read the constitution and governing body minutes. Confirm activities are within the objectives, and that the registrations and returns the law requires are up to date.' },
        { id: 'np-a-13', area: 'Governance and compliance', text: 'Confirm the tax-exempt status relied on, and that payroll taxes, pension contributions and withholding taxes on payments were deducted and remitted.' },
        { id: 'np-a-14', area: 'Governance and compliance', text: 'Obtain related party declarations from the governors and senior staff, and test payments to them and to entities they control.' },
      ],
      review: [
        { id: 'np-r-1', area: 'Grants and donations', text: 'Enquire about each significant grant: its conditions, what has been received and spent, and whether any amount may have to be returned.' },
        { id: 'np-r-2', area: 'Restricted funds', text: 'Compare restricted fund balances to donor reports and enquire about funds in deficit and transfers between funds.' },
        { id: 'np-r-3', area: 'Expenditure', text: 'Compare programme, fundraising and administration costs to budget and to last year, and obtain explanations for significant differences.' },
        { id: 'np-r-4', area: 'Governance', text: 'Enquire whether the organisation’s registrations, tax exemption and statutory returns are current.' },
      ],
    },
    checklist: [
      { id: 'np-funds', section: NPO, text: 'Funds are analysed between unrestricted, restricted and endowment funds, with each material restricted fund’s purpose and movement in the year.' },
      { id: 'np-income', section: NPO, text: 'The policy for grants and donations explains when they are recognised, how conditions and restrictions are dealt with, and how gifts in kind are measured.' },
      { id: 'np-expenditure', section: NPO, text: 'Expenditure is analysed between programme and charitable activities, fundraising, and administration and governance, with the basis for allocating shared costs.' },
      { id: 'np-deferred', section: NPO, text: 'Grants received with conditions not yet met, and amounts repayable to donors, are shown as liabilities and explained.' },
      { id: 'np-governors', section: S33, text: 'Payments to governors, and transactions with them and their related parties, are disclosed, including that none were made where that is so.' },
      { id: 'np-going-concern', section: 'Section 3: Financial statement presentation', text: 'Going concern is assessed against funding secured beyond twelve months, and dependence on a few donors is disclosed where significant.' },
    ],
    requests: [
      { title: 'Constitution and registration documents', detail: 'The constitution or trust deed, certificate of registration, and evidence that the statutory returns for the year were filed.' },
      { title: 'Grant agreements and amendments', detail: 'Every grant agreement in force in the year, with budgets, amendments and the donors’ reporting and audit requirements.' },
      { title: 'Donor reports', detail: 'Financial reports submitted to each donor for the year, with the reconciliation to the accounts.' },
      { title: 'Fund ledger', detail: 'Income and expenditure by fund or project, with balances brought and carried forward.' },
      { title: 'Governing body minutes', detail: 'Minutes of the trustees’ or board meetings for the year and up to the date of the audit.' },
      { title: 'Advances and sub-grants', detail: 'Staff and partner advances outstanding at the year end, and sub-grant agreements with partner reports.' },
      { title: 'Tax exemption', detail: 'Evidence of tax-exempt status, and payroll and withholding tax remittance receipts.' },
    ],
  },
  {
    id: 'construction',
    name: 'Construction and engineering contracts',
    summary: 'Contractors who build or install over months, where revenue and profit depend on estimates of progress and costs to complete.',
    programme: {
      audit: [
        { id: 'cn-a-1', area: 'Contracts', text: 'Obtain the contract register: contract value, variations, costs to date, estimated costs to complete, revenue recognised and amounts billed for each contract.' },
        { id: 'cn-a-2', area: 'Contracts', text: 'Agree contract values and approved variations to signed contracts and client instructions. Treat unapproved claims and variations with caution.' },
        { id: 'cn-a-3', area: 'Contracts', text: 'Test the measure of progress, whether costs incurred or surveys of work performed, and agree it to quantity surveyor or engineer certificates.' },
        { id: 'cn-a-4', area: 'Contracts', text: 'Challenge estimated costs to complete against budgets, recent cost overruns and after-date costs. Provide in full for expected losses on onerous contracts.' },
        { id: 'cn-a-5', area: 'Contracts', text: 'Reconcile amounts due from and to customers for contract work, retentions held by clients, and advances received.' },
        { id: 'cn-a-6', area: 'Costs', text: 'Test site costs, subcontractor certificates and materials on site to source documents and cut-off at the year end.' },
        { id: 'cn-a-7', area: 'Plant', text: 'Inspect significant plant and equipment, review its utilisation and impairment, and test plant hire income and costs.' },
        { id: 'cn-a-8', area: 'Contingencies', text: 'Enquire of management and legal advisers about disputes, liquidated damages, defects liability and performance bonds.' },
      ],
      review: [
        { id: 'cn-r-1', area: 'Contracts', text: 'Enquire how progress and costs to complete are estimated, and compare margins on each significant contract to tender and to last year.' },
        { id: 'cn-r-2', area: 'Contracts', text: 'Enquire about loss-making contracts, disputes, claims and liquidated damages.' },
        { id: 'cn-r-3', area: 'Receivables', text: 'Compare retentions and amounts due from customers to last year and enquire about their recovery.' },
      ],
    },
    checklist: [
      { id: 'cn-revenue', section: S23, text: 'The policy explains how revenue from construction contracts is recognised over time and how progress is measured.', when: ['revenue'] },
      { id: 'cn-balances', section: S23, text: 'Contract assets, contract liabilities, retentions and advances from customers are shown or disclosed.', when: ['revenue'] },
      { id: 'cn-losses', section: S21, text: 'Provisions for expected losses on contracts, and contingent liabilities from claims and guarantees, are disclosed.' },
    ],
    requests: [
      { title: 'Contract register', detail: 'Every contract open in the year: value, variations, costs to date, estimated costs to complete, billings and retentions.' },
      { title: 'Valuation certificates', detail: 'Interim certificates from the client’s engineer or quantity surveyor issued before and after the year end.' },
      { title: 'Subcontractor certificates', detail: 'Certificates and invoices from subcontractors for work done up to the year end.' },
      { title: 'Claims and disputes', detail: 'Details of claims made by or against the company, liquidated damages and legal correspondence.' },
      { title: 'Performance bonds and guarantees', detail: 'Bonds, guarantees and advance payment guarantees outstanding at the year end.' },
    ],
  },
  {
    id: 'real_estate',
    name: 'Real estate: property investment and development',
    summary: 'Owners and developers of property, where the risks are valuation, the line between investment property and inventory, and rental income.',
    programme: {
      audit: [
        { id: 're-a-1', area: 'Property', text: 'Obtain the property register and agree title documents (certificates of occupancy, deeds, title deeds) for each property, and check for charges over them.' },
        { id: 're-a-2', area: 'Property', text: 'Classify each property: held to earn rent or for capital appreciation (investment property), held for sale in the ordinary course (inventory), or owner-occupied.' },
        { id: 're-a-3', area: 'Valuation', text: 'Evaluate the valuer’s competence, objectivity and terms, and test the valuation inputs: rents, yields, comparable sales and condition.' },
        { id: 're-a-4', area: 'Development', text: 'For development property, test costs capitalised to source documents, borrowing costs, and net realisable value against current selling prices and costs to complete.' },
        { id: 're-a-5', area: 'Rental income', text: 'Agree rental income to tenancy agreements and the rent roll, test cut-off and rent received in advance, and analyse arrears for recoverability.' },
        { id: 're-a-6', area: 'Sales', text: 'For units sold, test when control passed to the buyer, deposits received, and amounts still due under instalment sales.' },
        { id: 're-a-7', area: 'Service charges', text: 'Review service charge income and costs, and any amounts held for tenants or residents.' },
      ],
      review: [
        { id: 're-r-1', area: 'Valuation', text: 'Enquire how fair values were determined and by whom, and compare them to last year and to recent transactions.' },
        { id: 're-r-2', area: 'Rental income', text: 'Compare rental income to the rent roll and occupancy, and enquire about arrears and vacancies.' },
        { id: 're-r-3', area: 'Development', text: 'Enquire about the status, costs to complete and expected selling prices of developments.' },
      ],
    },
    checklist: [
      { id: 're-ip', section: S16, text: 'Investment property is disclosed with the measurement basis, the methods and significant assumptions used to determine fair value, and whether a qualified independent valuer was used.' },
      { id: 're-ip-rec', section: S16, text: 'A reconciliation of the carrying amount of investment property at the start and end of the year is given.' },
      { id: 're-restrictions', section: S16, text: 'Restrictions on realising property, and contractual obligations to purchase, construct or develop it, are disclosed.' },
      { id: 're-leases', section: S20, text: 'As lessor, future minimum lease payments receivable under operating leases are disclosed by period.' },
    ],
    requests: [
      { title: 'Property register and title documents', detail: 'Every property held, with title documents, cost, additions and any charges or encumbrances.' },
      { title: 'Valuation reports', detail: 'Valuation reports at the year end, with the valuer’s terms of engagement.' },
      { title: 'Rent roll and tenancy agreements', detail: 'Tenants, rents, lease terms, amounts received in advance and arrears at the year end.' },
      { title: 'Development cost reports', detail: 'Costs to date and to complete for each development, with sales and reservations.' },
    ],
  },
  {
    id: 'professional_services',
    name: 'Professional services: consulting, legal, accounting, engineering and agencies',
    summary: 'Firms that sell people’s time, where the risks are unbilled work, fee recoverability, client money and staff costs.',
    programme: {
      audit: [
        { id: 'ps-a-1', area: 'Revenue', text: 'Agree fees to engagement letters and time records, and test cut-off of invoices around the year end.' },
        { id: 'ps-a-2', area: 'Revenue', text: 'Test unbilled work at the year end: time recorded, rates, stage of completion and recoverability, and remove time that will not be billed.' },
        { id: 'ps-a-3', area: 'Receivables', text: 'Analyse fees receivable by age, test after-date receipts, and review disputed and written-off fees.' },
        { id: 'ps-a-4', area: 'Client money', text: 'Identify money held for clients, reconcile client accounts, and confirm it is kept separate from the firm’s own money and not recorded as revenue.' },
        { id: 'ps-a-5', area: 'Staff costs', text: 'Test payroll to staff records and contracts, bonuses and accrued leave, and the remittance of payroll taxes and pension contributions.' },
        { id: 'ps-a-6', area: 'Related parties', text: 'Review drawings, remuneration and transactions with partners, directors and their related parties.' },
        { id: 'ps-a-7', area: 'Contingencies', text: 'Enquire about professional negligence claims, professional indemnity cover and regulatory matters.' },
      ],
      review: [
        { id: 'ps-r-1', area: 'Revenue', text: 'Compare fees and utilisation to last year and enquire about significant changes in clients or rates.' },
        { id: 'ps-r-2', area: 'Revenue', text: 'Enquire how unbilled work is valued and how much of it was billed after the year end.' },
        { id: 'ps-r-3', area: 'Contingencies', text: 'Enquire about claims against the firm and the professional indemnity cover.' },
      ],
    },
    checklist: [
      { id: 'ps-revenue', section: S23, text: 'The policy explains how service revenue is recognised, including work in progress and contract assets for unbilled work.', when: ['revenue'] },
      { id: 'ps-client-money', section: S8, text: 'Money held on behalf of clients is excluded from the firm’s assets and liabilities, or shown separately where it is the firm’s responsibility, and explained.' },
      { id: 'ps-claims', section: S21, text: 'Claims against the firm are provided for or disclosed as contingent liabilities.' },
    ],
    requests: [
      { title: 'Time and billing report', detail: 'Time recorded, billed and unbilled for each client at the year end, with the rates used.' },
      { title: 'Engagement letters', detail: 'Engagement letters for the largest clients by fees.' },
      { title: 'Client account reconciliations', detail: 'Reconciliations of money held for clients at the year end, with bank statements.' },
      { title: 'Claims and indemnity insurance', detail: 'Details of claims against the firm and the professional indemnity insurance policy.' },
    ],
  },
  {
    id: 'hospitality',
    name: 'Hotels, restaurants and hospitality',
    summary: 'Cash-heavy businesses selling rooms, food and drink, where the risks are completeness of revenue, food and beverage stock, and the condition of property.',
    programme: {
      audit: [
        { id: 'hp-a-1', area: 'Revenue', text: 'Reconcile room revenue to the property management system: rooms available, occupancy and average rate, and test a sample of guest folios to payments.' },
        { id: 'hp-a-2', area: 'Revenue', text: 'Reconcile point-of-sale reports for food and beverage to cash, card settlements and bank, and review voids, complimentaries and discounts.' },
        { id: 'hp-a-3', area: 'Revenue', text: 'Test deposits and advance bookings, corporate accounts receivable and agency commissions.' },
        { id: 'hp-a-4', area: 'Inventories', text: 'Attend the food, beverage and consumables count, and compare gross profit percentages to expected margins.' },
        { id: 'hp-a-5', area: 'Property', text: 'Review capital expenditure versus repairs on refurbishment, and assess the property for impairment where occupancy has fallen.' },
        { id: 'hp-a-6', area: 'Taxes and levies', text: 'Test consumption, sales or tourism taxes and levies charged to guests and remitted.' },
        { id: 'hp-a-7', area: 'Staff costs', text: 'Test payroll, casual staff, service charge distributions and tips.' },
      ],
      review: [
        { id: 'hp-r-1', area: 'Revenue', text: 'Compare occupancy, average room rate and food and beverage margins to last year and enquire about changes.' },
        { id: 'hp-r-2', area: 'Inventories', text: 'Enquire how stock is counted and how wastage and breakages are recorded.' },
        { id: 'hp-r-3', area: 'Property', text: 'Enquire about refurbishment spending and any indication that the property is impaired.' },
      ],
    },
    checklist: [
      { id: 'hp-revenue', section: S23, text: 'Revenue is analysed between rooms, food and beverage and other services, and deposits received in advance are shown as liabilities.', when: ['revenue'] },
      { id: 'hp-impairment', section: S27, text: 'Any impairment of the property, and the assumptions used, are disclosed.' },
    ],
    requests: [
      { title: 'Property management system reports', detail: 'Monthly occupancy, average room rate and revenue reports, and the night audit for the last and first days around the year end.' },
      { title: 'Point-of-sale reports', detail: 'Daily sales summaries with card settlement reports for the last month of the year.' },
      { title: 'Stock count sheets', detail: 'Food, beverage and consumables count sheets at the year end.' },
      { title: 'Taxes and levies returns', detail: 'Consumption, sales or tourism tax and levy returns and payment receipts for the year.' },
    ],
  },
  {
    id: 'healthcare',
    name: 'Healthcare: hospitals, clinics, laboratories and pharmacies',
    summary: 'Providers paid by patients, insurers and health schemes, where the risks are billing, claims rejections, drugs inventory and regulatory compliance.',
    programme: {
      audit: [
        { id: 'hc-a-1', area: 'Revenue', text: 'Reconcile patient billing to the hospital information system and cash, and test a sample of patient bills to services and the price list.' },
        { id: 'hc-a-2', area: 'Revenue', text: 'Test claims to insurers, health maintenance organisations and schemes: submission, rejection rates and after-date settlements, and capitation income.' },
        { id: 'hc-a-3', area: 'Receivables', text: 'Analyse receivables by payer and age, and provide for claims likely to be rejected or reduced.' },
        { id: 'hc-a-4', area: 'Inventories', text: 'Attend the drugs and consumables count, check expiry dates and controlled drugs registers, and test cost.' },
        { id: 'hc-a-5', area: 'Equipment', text: 'Inspect significant medical equipment, test additions and leases, and review for impairment and obsolescence.' },
        { id: 'hc-a-6', area: 'Staff costs', text: 'Test payroll and payments to visiting consultants, and the withholding tax deducted from them.' },
        { id: 'hc-a-7', area: 'Compliance', text: 'Confirm the facility’s licences and registrations are current, and enquire about malpractice claims and insurance.' },
      ],
      review: [
        { id: 'hc-r-1', area: 'Revenue', text: 'Compare revenue by service line and payer to last year, and enquire about claim rejection rates.' },
        { id: 'hc-r-2', area: 'Inventories', text: 'Enquire how drugs are counted and how expired stock is identified and written off.' },
        { id: 'hc-r-3', area: 'Contingencies', text: 'Enquire about malpractice claims and the insurance in place.' },
      ],
    },
    checklist: [
      { id: 'hc-revenue', section: S23, text: 'Revenue is analysed between patient services, pharmacy and other income, and the policy explains how insurer and scheme income is measured.', when: ['revenue'] },
      { id: 'hc-inventory', section: S13, text: 'Write-downs of expired or obsolete drugs and consumables are disclosed.', when: ['inventories'] },
      { id: 'hc-claims', section: S21, text: 'Provisions and contingent liabilities for malpractice claims are disclosed.' },
    ],
    requests: [
      { title: 'Billing and claims reports', detail: 'Revenue by service and payer, claims submitted, rejected and settled, and capitation statements.' },
      { title: 'Receivables by payer', detail: 'Amounts due from insurers, schemes, corporates and patients, aged, at the year end.' },
      { title: 'Drugs stock count', detail: 'Drugs and consumables count sheets with expiry dates, and the controlled drugs register.' },
      { title: 'Licences and insurance', detail: 'Facility licences and registrations, and the malpractice insurance policy.' },
    ],
  },
  {
    id: 'education',
    name: 'Education: schools, colleges and training providers',
    summary: 'Institutions paid in advance by term or year, where the risks are fees in advance, scholarships and discounts, and grants.',
    programme: {
      audit: [
        { id: 'ed-a-1', area: 'Fees', text: 'Reconcile tuition fee income to the student register and the approved fee schedule, allowing for scholarships, sibling and staff discounts.' },
        { id: 'ed-a-2', area: 'Fees', text: 'Test fees received in advance for terms after the year end, and recognise income over the period taught.' },
        { id: 'ed-a-3', area: 'Fees', text: 'Analyse fees outstanding by student and age, and provide for those unlikely to be collected, including from students who have left.' },
        { id: 'ed-a-4', area: 'Other income', text: 'Test boarding, transport, uniform, examination and development levy income, and amounts collected on behalf of examining bodies.' },
        { id: 'ed-a-5', area: 'Grants', text: 'Agree grants and endowments to agreements and test that conditions are met before they are recognised as income.' },
        { id: 'ed-a-6', area: 'Staff costs', text: 'Test teaching and non-teaching payroll to staff records and contracts.' },
        { id: 'ed-a-7', area: 'Property', text: 'Review buildings and equipment, capital projects and their funding, and land title.' },
      ],
      review: [
        { id: 'ed-r-1', area: 'Fees', text: 'Compare fee income to student numbers multiplied by fees, and enquire about differences.' },
        { id: 'ed-r-2', area: 'Fees', text: 'Enquire how fees in advance and outstanding fees are dealt with at the year end.' },
        { id: 'ed-r-3', area: 'Grants', text: 'Enquire about grants received and their conditions.' },
      ],
    },
    checklist: [
      { id: 'ed-revenue', section: S23, text: 'The policy explains that tuition is recognised over the period taught, and fees received in advance are shown as liabilities.', when: ['revenue'] },
      { id: 'ed-grants', section: S24, text: 'Grants are disclosed with their nature, the amounts recognised, and conditions not yet met.' },
    ],
    requests: [
      { title: 'Student register and fee schedule', detail: 'Students enrolled each term, with the approved fees and the scholarships and discounts given.' },
      { title: 'Fees received in advance', detail: 'Fees received before the year end for terms that start after it.' },
      { title: 'Outstanding fees', detail: 'Fees owed by each student at the year end, with what has been collected since.' },
      { title: 'Grant and endowment agreements', detail: 'Agreements for grants and endowments received in the year.' },
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture, livestock and agro-processing',
    summary: 'Farms and processors, where the risks are measuring biological assets and produce, seasonal inventories and grants.',
    programme: {
      audit: [
        { id: 'ag-a-1', area: 'Biological assets', text: 'Attend the count of livestock, poultry, fish and standing crops at or near the year end, and record numbers, age and condition.' },
        { id: 'ag-a-2', area: 'Biological assets', text: 'Test how biological assets are measured: fair value less costs to sell where it is readily determinable, otherwise cost less depreciation and impairment, and the market prices used.' },
        { id: 'ag-a-3', area: 'Biological assets', text: 'Reconcile movements in the year: births, purchases, growth, harvest, sales and deaths, with mortality records.' },
        { id: 'ag-a-4', area: 'Produce and inventories', text: 'Test agricultural produce at the point of harvest and its measurement, and inventories of feed, fertiliser, seed and processed goods.' },
        { id: 'ag-a-5', area: 'Revenue', text: 'Test sales to off-takers, commodity contracts and prices, and cut-off of deliveries.' },
        { id: 'ag-a-6', area: 'Grants and land', text: 'Agree government grants and subsidised loans to agreements, and confirm the title or lease of farmland.' },
        { id: 'ag-a-7', area: 'Plant', text: 'Inspect tractors, processing plant and irrigation, and review for impairment.' },
      ],
      review: [
        { id: 'ag-r-1', area: 'Biological assets', text: 'Enquire how livestock and crops are counted and valued, and compare quantities and values to last year.' },
        { id: 'ag-r-2', area: 'Revenue', text: 'Compare yields, prices and margins to last year and enquire about weather, disease and price effects.' },
        { id: 'ag-r-3', area: 'Grants', text: 'Enquire about grants and subsidised loans and their conditions.' },
      ],
    },
    checklist: [
      { id: 'ag-bio', section: S34, text: 'Biological assets are described by class, with the measurement basis, the methods and assumptions used, and a reconciliation of the carrying amount.' },
      { id: 'ag-produce', section: S34, text: 'Agricultural produce harvested is measured at the point of harvest, and the basis is disclosed.' },
      { id: 'ag-grants', section: S24, text: 'Government grants related to agriculture are disclosed with unfulfilled conditions.' },
    ],
    requests: [
      { title: 'Livestock and crop records', detail: 'Herd, flock and pond registers, mortality records and crop plans, with year-end counts.' },
      { title: 'Market prices', detail: 'Evidence of market prices used to value biological assets and produce at the year end.' },
      { title: 'Off-take agreements', detail: 'Sales contracts with off-takers and commodity buyers.' },
      { title: 'Grant and loan agreements', detail: 'Government grant, subsidy and intervention loan agreements.' },
      { title: 'Land documents', detail: 'Title or lease documents for farmland.' },
    ],
  },
  {
    id: 'oil_gas_services',
    name: 'Oil, gas and mining services',
    summary: 'Service companies to exploration and production operators, where the risks are contract billing, foreign currency, local content requirements and equipment.',
    programme: {
      audit: [
        { id: 'og-a-1', area: 'Revenue', text: 'Agree revenue to service contracts, call-off orders and job completion tickets signed by the operator, and test cut-off of work done but not invoiced.' },
        { id: 'og-a-2', area: 'Revenue', text: 'Test billing in foreign currency, the exchange rates used, and amounts withheld by operators.' },
        { id: 'og-a-3', area: 'Receivables', text: 'Confirm significant balances with operators, test after-date receipts, and review disputed invoices.' },
        { id: 'og-a-4', area: 'Equipment', text: 'Inspect specialised equipment and vessels, test utilisation, depreciation and certification, and review for impairment.' },
        { id: 'og-a-5', area: 'Foreign currency', text: 'Test translation of foreign currency balances at the closing rate and exchange gains and losses.' },
        { id: 'og-a-6', area: 'Compliance', text: 'Confirm permits, local content certifications and the levies and withholding taxes deducted by operators.' },
        { id: 'og-a-7', area: 'Provisions', text: 'Review obligations for site restoration, demobilisation and environmental damage.' },
      ],
      review: [
        { id: 'og-r-1', area: 'Revenue', text: 'Compare revenue by contract and day rates to last year, and enquire about contracts won and lost.' },
        { id: 'og-r-2', area: 'Equipment', text: 'Enquire about equipment utilisation and any idle equipment.' },
        { id: 'og-r-3', area: 'Foreign currency', text: 'Enquire how foreign currency balances are translated.' },
      ],
    },
    checklist: [
      { id: 'og-fx', section: 'Section 30: Foreign currency translation', text: 'The functional currency, exchange differences recognised, and the rates used are disclosed.' },
      { id: 'og-provisions', section: S21, text: 'Provisions for restoration and environmental obligations are disclosed with their uncertainties.' },
    ],
    requests: [
      { title: 'Service contracts and call-off orders', detail: 'Contracts with operators and the call-off orders active in the year.' },
      { title: 'Job tickets', detail: 'Signed job completion tickets for work done in the last month of the year.' },
      { title: 'Equipment register', detail: 'Specialised equipment and vessels, with utilisation and certification records.' },
      { title: 'Permits and certificates', detail: 'Operating permits and local content certificates.' },
    ],
  },
  {
    id: 'transport_logistics',
    name: 'Transport, logistics and haulage',
    summary: 'Hauliers, couriers, freight forwarders and passenger transport, where the risks are vehicle fleets, fuel, and income collected by drivers and agents.',
    programme: {
      audit: [
        { id: 'tl-a-1', area: 'Revenue', text: 'Agree revenue to waybills, trip sheets and delivery notes, and test cut-off of trips in progress at the year end.' },
        { id: 'tl-a-2', area: 'Revenue', text: 'Test cash collected by drivers, conductors and agents for prompt banking and reconciliation.' },
        { id: 'tl-a-3', area: 'Freight forwarding', text: 'Distinguish the company’s own revenue from amounts collected for shipping lines, customs and ports, which pass through.' },
        { id: 'tl-a-4', area: 'Fleet', text: 'Inspect a sample of vehicles, agree them to registration documents, and test depreciation, disposals, leases and impairment of idle vehicles.' },
        { id: 'tl-a-5', area: 'Fuel and maintenance', text: 'Analyse fuel cost per kilometre or trip and maintenance by vehicle, and investigate outliers.' },
        { id: 'tl-a-6', area: 'Claims', text: 'Review claims for damaged or lost goods, accidents and insurance recoveries.' },
      ],
      review: [
        { id: 'tl-r-1', area: 'Revenue', text: 'Compare revenue per vehicle or trip and fuel costs to last year, and enquire about differences.' },
        { id: 'tl-r-2', area: 'Fleet', text: 'Enquire about vehicles bought, sold, leased or off the road.' },
        { id: 'tl-r-3', area: 'Claims', text: 'Enquire about claims and accidents in the year.' },
      ],
    },
    checklist: [
      { id: 'tl-revenue', section: S23, text: 'Where the company acts as agent, revenue is the commission or margin, not the gross amount collected, and the policy says so.', when: ['revenue'] },
      { id: 'tl-leases', section: S20, text: 'Vehicles held under leases are disclosed with the lease commitments.' },
    ],
    requests: [
      { title: 'Fleet register', detail: 'Vehicles owned and leased, with registration documents, and those off the road at the year end.' },
      { title: 'Trip sheets and waybills', detail: 'Trip sheets, waybills and delivery notes for the last weeks of the year.' },
      { title: 'Fuel and maintenance records', detail: 'Fuel and maintenance cost by vehicle for the year.' },
      { title: 'Insurance claims', detail: 'Claims made and received for accidents and goods in transit.' },
    ],
  },
  {
    id: 'technology',
    name: 'Technology, software and telecommunications services',
    summary: 'Software, SaaS, internet and telecom service businesses, where the risks are subscription revenue, capitalised development, and customer deposits.',
    programme: {
      audit: [
        { id: 'tc-a-1', area: 'Revenue', text: 'Reconcile subscription and usage revenue to the billing system, and test deferred revenue for periods after the year end.' },
        { id: 'tc-a-2', area: 'Revenue', text: 'For contracts with several elements (licences, set-up, support, hardware), test how the price is allocated and when each part is recognised.' },
        { id: 'tc-a-3', area: 'Revenue', text: 'Test prepaid airtime, data and wallet balances held for customers, and breakage on unused credit.' },
        { id: 'tc-a-4', area: 'Development costs', text: 'Test software development costs: the IFRS for SMEs expenses research and development, so confirm that none has been capitalised.' },
        { id: 'tc-a-5', area: 'Intangibles', text: 'Agree purchased software, licences and spectrum to contracts and test amortisation and impairment.' },
        { id: 'tc-a-6', area: 'IT general controls', text: 'Assess access, change management and data backups over the billing and accounting systems the audit relies on.' },
        { id: 'tc-a-7', area: 'Foreign currency', text: 'Test foreign currency licence fees, cloud hosting and payables at the closing rate.' },
      ],
      review: [
        { id: 'tc-r-1', area: 'Revenue', text: 'Compare recurring revenue, customer numbers and churn to last year and enquire about changes.' },
        { id: 'tc-r-2', area: 'Development costs', text: 'Enquire how development costs are accounted for.' },
        { id: 'tc-r-3', area: 'Revenue', text: 'Enquire how deferred revenue is calculated at the year end.' },
      ],
    },
    checklist: [
      { id: 'tc-revenue', section: S23, text: 'The policy explains how subscriptions, licences, set-up and support are recognised, and deferred revenue is shown as a liability.', when: ['revenue'] },
      { id: 'tc-intangibles', section: S18, text: 'Development expenditure is expensed, and purchased software and licences are amortised and disclosed.', when: ['intangibles'] },
    ],
    requests: [
      { title: 'Billing system reports', detail: 'Revenue, deferred revenue and customer numbers by month, reconciled to the ledger.' },
      { title: 'Customer contracts', detail: 'Contracts for the largest customers, showing the elements sold and their prices.' },
      { title: 'Software and licences register', detail: 'Software, licences and spectrum held, with contracts and terms.' },
      { title: 'System access and change logs', detail: 'User access lists and change logs for the billing and accounting systems.' },
    ],
  },
  {
    id: 'retail_fmcg',
    name: 'Wholesale, retail and FMCG distribution',
    summary: 'Shops, supermarkets, wholesalers and distributors with many small sales, where the risks are cash, stock shrinkage, rebates and returns.',
    programme: {
      audit: [
        { id: 'rt-a-1', area: 'Revenue', text: 'Reconcile point-of-sale and van sales reports to cash, card and transfer settlements and bank, store by store.' },
        { id: 'rt-a-2', area: 'Revenue', text: 'Test returns, credit notes and discounts after the year end for sales that should be reversed.' },
        { id: 'rt-a-3', area: 'Rebates', text: 'Agree supplier rebates and promotional support to agreements, and test that only rebates earned are recognised.' },
        { id: 'rt-a-4', area: 'Inventories', text: 'Attend counts at the main warehouse and a sample of stores, and analyse shrinkage against the records.' },
        { id: 'rt-a-5', area: 'Inventories', text: 'Identify slow-moving, expired and damaged stock and test the write-down.' },
        { id: 'rt-a-6', area: 'Distributors', text: 'Confirm balances with major distributors and customers, and test credit limits and after-date receipts.' },
      ],
      review: [
        { id: 'rt-r-1', area: 'Revenue', text: 'Compare sales and margins by store or channel to last year, and enquire about differences.' },
        { id: 'rt-r-2', area: 'Inventories', text: 'Enquire about counts, shrinkage and how expired stock is written off.' },
        { id: 'rt-r-3', area: 'Rebates', text: 'Enquire how supplier rebates are recognised.' },
      ],
    },
    checklist: [
      { id: 'rt-rebates', section: S13, text: 'The policy explains how supplier rebates and discounts reduce the cost of inventories.', when: ['inventories'] },
      { id: 'rt-returns', section: S23, text: 'Revenue is shown net of returns, discounts and rebates given to customers.', when: ['revenue'] },
    ],
    requests: [
      { title: 'Point-of-sale reports', detail: 'Daily sales by store with settlement reports for the last month of the year.' },
      { title: 'Supplier rebate agreements', detail: 'Rebate and promotional support agreements with suppliers, and the calculations.' },
      { title: 'Store count results', detail: 'Count results by store and warehouse, with shrinkage analysis.' },
      { title: 'Returns after the year end', detail: 'Credit notes and returns in the first month after the year end.' },
    ],
  },
  {
    id: 'cooperatives',
    name: 'Cooperatives, thrift and credit societies',
    summary: 'Member-owned societies that take savings and lend to members, where the risks are members’ balances, loan losses and compliance with the cooperative law.',
    programme: {
      audit: [
        { id: 'cp-a-1', area: 'Members’ savings', text: 'Reconcile members’ savings and share contributions to the members’ ledger, and send balance confirmations to a sample of members.' },
        { id: 'cp-a-2', area: 'Loans to members', text: 'Test loans to the loan register, agreements, guarantors and approvals, and test repayments from payroll deductions or cash.' },
        { id: 'cp-a-3', area: 'Loans to members', text: 'Age loans in arrears, and test the allowance for loans unlikely to be repaid, including loans to officers.' },
        { id: 'cp-a-4', area: 'Income', text: 'Recalculate interest and charges on loans, and test investment income.' },
        { id: 'cp-a-5', area: 'Payroll deductions', text: 'Reconcile deductions remitted by employers to amounts credited to members.' },
        { id: 'cp-a-6', area: 'Governance', text: 'Read the bye-laws and general meeting minutes, and test dividends and patronage refunds declared against them.' },
        { id: 'cp-a-7', area: 'Compliance', text: 'Confirm registration with the cooperative regulator and compliance with its reporting and reserve requirements.' },
      ],
      review: [
        { id: 'cp-r-1', area: 'Loans to members', text: 'Enquire about arrears and loans written off, and compare the allowance to last year.' },
        { id: 'cp-r-2', area: 'Members’ savings', text: 'Compare members’ savings and loans to last year and enquire about changes.' },
        { id: 'cp-r-3', area: 'Governance', text: 'Enquire about decisions of the general meeting on dividends and reserves.' },
      ],
    },
    checklist: [
      { id: 'cp-loans', section: S11, text: 'Loans to members are disclosed with the terms, arrears and the allowance for impairment.', when: ['trade_receivables', 'other_receivables', 'investments'] },
      { id: 'cp-savings', section: S11, text: 'Members’ savings and deposits are classified as liabilities, and share contributions as equity only where the bye-laws allow the society to refuse redemption.' },
      { id: 'cp-officers', section: S33, text: 'Loans and other transactions with committee members and officers are disclosed.' },
    ],
    requests: [
      { title: 'Members’ ledger', detail: 'Savings, shares and loan balances for every member at the year end.' },
      { title: 'Loan register and agreements', detail: 'Loans granted, repaid and in arrears, with agreements and guarantor forms.' },
      { title: 'Employer deduction schedules', detail: 'Payroll deduction schedules from employers and the remittances received.' },
      { title: 'Bye-laws and minutes', detail: 'The bye-laws and minutes of general and committee meetings.' },
    ],
  },
  {
    id: 'media_entertainment',
    name: 'Media, entertainment and events',
    summary: 'Broadcasters, publishers, producers and event organisers, where the risks are advertising revenue, content rights and advance ticket sales.',
    programme: {
      audit: [
        { id: 'me-a-1', area: 'Revenue', text: 'Agree advertising revenue to bookings, transmission or publication logs and invoices, and test agency commissions and discounts.' },
        { id: 'me-a-2', area: 'Revenue', text: 'Test barter transactions, and recognise them only where they can be measured reliably.' },
        { id: 'me-a-3', area: 'Revenue', text: 'Test ticket sales and sponsorship received in advance for events after the year end.' },
        { id: 'me-a-4', area: 'Content', text: 'Agree content rights and productions to contracts, and test amortisation and impairment of content that will not earn its cost.' },
        { id: 'me-a-5', area: 'Royalties', text: 'Test royalties payable to artists and rights holders.' },
        { id: 'me-a-6', area: 'Compliance', text: 'Confirm broadcasting and operating licences are current.' },
      ],
      review: [
        { id: 'me-r-1', area: 'Revenue', text: 'Compare advertising and event revenue to last year and enquire about changes.' },
        { id: 'me-r-2', area: 'Content', text: 'Enquire how content rights are amortised and tested for impairment.' },
      ],
    },
    checklist: [
      { id: 'me-revenue', section: S23, text: 'The policy explains how advertising, sponsorship and ticket revenue are recognised, and income received in advance is shown as a liability.', when: ['revenue'] },
      { id: 'me-content', section: S18, text: 'Content rights are disclosed with the amortisation method and any impairment.', when: ['intangibles'] },
    ],
    requests: [
      { title: 'Advertising bookings and logs', detail: 'Bookings and transmission or publication logs for the last month of the year.' },
      { title: 'Content and rights contracts', detail: 'Contracts for content acquired or produced, with rights periods.' },
      { title: 'Event schedules', detail: 'Events after the year end with tickets sold and sponsorship received.' },
    ],
  },
  {
    id: 'energy',
    name: 'Power, renewable energy and utilities',
    summary: 'Generators, solar installers and pay-as-you-go energy providers, where the risks are metered revenue, long-lived plant and customer financing.',
    programme: {
      audit: [
        { id: 'en-a-1', area: 'Revenue', text: 'Reconcile energy sold to meter readings, the billing system and tariffs, and test unbilled energy at the year end.' },
        { id: 'en-a-2', area: 'Revenue', text: 'For pay-as-you-go and lease-to-own systems, test the split between sale of equipment and financing income, and customer receivables.' },
        { id: 'en-a-3', area: 'Plant', text: 'Test additions to generation, distribution and solar assets, useful lives, and impairment where plant is under-used.' },
        { id: 'en-a-4', area: 'Grants', text: 'Agree results-based financing and grants to agreements, and test that conditions are met before income is recognised.' },
        { id: 'en-a-5', area: 'Provisions', text: 'Review warranty obligations and decommissioning or battery disposal costs.' },
        { id: 'en-a-6', area: 'Compliance', text: 'Confirm licences from the electricity regulator and compliance with tariff orders.' },
      ],
      review: [
        { id: 'en-r-1', area: 'Revenue', text: 'Compare units sold, tariffs and collection rates to last year and enquire about changes.' },
        { id: 'en-r-2', area: 'Plant', text: 'Enquire about plant availability and assets out of use.' },
        { id: 'en-r-3', area: 'Grants', text: 'Enquire about grants and results-based financing received.' },
      ],
    },
    checklist: [
      { id: 'en-revenue', section: S23, text: 'The policy explains how energy sales, equipment sales and financing income are recognised.', when: ['revenue'] },
      { id: 'en-grants', section: S24, text: 'Grants and results-based financing are disclosed with conditions not yet met.' },
      { id: 'en-warranty', section: S21, text: 'Warranty and decommissioning provisions are disclosed.' },
    ],
    requests: [
      { title: 'Meter and billing reports', detail: 'Energy generated, sold and billed by month, with tariff schedules.' },
      { title: 'Customer financing portfolio', detail: 'Pay-as-you-go and lease-to-own contracts with balances and arrears.' },
      { title: 'Grant and financing agreements', detail: 'Grant, results-based financing and concessional loan agreements.' },
      { title: 'Licences', detail: 'Generation, distribution or mini-grid licences.' },
    ],
  },
  {
    id: 'insurance_brokers',
    name: 'Insurance brokers and agents',
    summary: 'Intermediaries paid by commission, where the risks are premiums held for insurers, commission cut-off and regulatory capital.',
    programme: {
      audit: [
        { id: 'ib-a-1', area: 'Premiums held', text: 'Reconcile premiums collected from clients to amounts remitted to insurers, and confirm amounts held for insurers at the year end.' },
        { id: 'ib-a-2', area: 'Commission', text: 'Agree commission to placement slips, debit notes and insurer statements, and test when it is earned.' },
        { id: 'ib-a-3', area: 'Commission', text: 'Provide for commission refundable on policies cancelled after the year end.' },
        { id: 'ib-a-4', area: 'Client money', text: 'Confirm that premium bank accounts are kept separate and are not used for the broker’s own expenses.' },
        { id: 'ib-a-5', area: 'Compliance', text: 'Confirm the licence, professional indemnity cover and any capital or deposit requirements of the insurance regulator.' },
      ],
      review: [
        { id: 'ib-r-1', area: 'Commission', text: 'Compare commission by insurer and class of business to last year and enquire about changes.' },
        { id: 'ib-r-2', area: 'Premiums held', text: 'Enquire how premiums held for insurers are reconciled and remitted.' },
      ],
    },
    checklist: [
      { id: 'ib-revenue', section: S23, text: 'Revenue is commission earned as agent, not gross premiums, and the policy says when it is recognised.', when: ['revenue'] },
      { id: 'ib-fiduciary', section: S8, text: 'Premiums held for insurers are shown as liabilities with the related bank balances, or explained where held in trust.' },
    ],
    requests: [
      { title: 'Premium and commission register', detail: 'Policies placed, premiums collected and remitted, and commission earned, by insurer.' },
      { title: 'Insurer statements', detail: 'Statements of account from insurers at the year end.' },
      { title: 'Premium bank accounts', detail: 'Bank statements and reconciliations for premium accounts.' },
      { title: 'Licence and indemnity cover', detail: 'The broker’s licence and professional indemnity policy.' },
    ],
  },
  {
    id: 'financial_services',
    name: 'Payment services, agency banking and fintech',
    summary: 'Payment, wallet and agency businesses holding customer money in transit, where the risks are customer float, settlement and fraud. Banks and insurers that report under full IFRS are out of scope.',
    programme: {
      audit: [
        { id: 'fn-a-1', area: 'Customer funds', text: 'Reconcile customer wallet and float balances to the platform ledger and to the bank or trust accounts that hold them, daily for the last week of the year.' },
        { id: 'fn-a-2', area: 'Settlement', text: 'Test settlement with switches, card schemes, banks and agents, and investigate unsettled and suspense items at the year end.' },
        { id: 'fn-a-3', area: 'Revenue', text: 'Recalculate fee and commission income from transaction volumes and the fee schedule, and test revenue shares with partners.' },
        { id: 'fn-a-4', area: 'Fraud and chargebacks', text: 'Review chargebacks, disputed and fraudulent transactions, and provide for losses.' },
        { id: 'fn-a-5', area: 'IT general controls', text: 'Assess access, change management and reconciliations over the transaction platform.' },
        { id: 'fn-a-6', area: 'Compliance', text: 'Confirm the licence, minimum capital and the regulator’s returns, and enquire about sanctions.' },
      ],
      review: [
        { id: 'fn-r-1', area: 'Customer funds', text: 'Enquire how customer funds are reconciled and held, and compare balances to last year.' },
        { id: 'fn-r-2', area: 'Revenue', text: 'Compare transaction volumes and fee income to last year.' },
        { id: 'fn-r-3', area: 'Fraud', text: 'Enquire about fraud losses and chargebacks in the year.' },
      ],
    },
    checklist: [
      { id: 'fn-customer-funds', section: S11, text: 'Customer funds and the related liabilities are shown or disclosed, with any restriction on the cash that holds them.' },
      { id: 'fn-revenue', section: S23, text: 'Fee and commission income is recognised as the services are provided, net of amounts that belong to partners.', when: ['revenue'] },
    ],
    requests: [
      { title: 'Platform ledger reports', detail: 'Customer balances, transaction volumes and fees by month, reconciled to the ledger.' },
      { title: 'Settlement reconciliations', detail: 'Settlement reconciliations with switches, schemes and banks at the year end.' },
      { title: 'Customer funds accounts', detail: 'Bank or trust account statements holding customer funds.' },
      { title: 'Licence and regulatory returns', detail: 'The operating licence and returns to the regulator for the year.' },
    ],
  },
];

