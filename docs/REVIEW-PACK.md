# VeritBooks: technical review pack

This pack holds every piece of professional content in VeritBooks, and every method the software applies, that needs review by a qualified technical author before a firm relies on it. It is generated from the content the software uses, so what is printed here is what a user sees.

All of it is starter material. It was written to make the software work end to end. None of it has been reviewed against the standards in force.

## How to use this pack

1. Review each section against the standards and laws named in it, in the edition in force for the periods the firm will report on.
2. Mark each item as accepted, changed or rejected. Write changes beside the item, quoting its id.
3. Answer the questions in section 1. They are decisions the software cannot make for itself.
4. Sign each section. Content is released to firms only after its section is signed.

The standards assumed throughout: the IFRS for SMEs Accounting Standard, second edition (2015), as adopted by the Financial Reporting Council of Nigeria; the Companies and Allied Matters Act 2020; the International Standards on Auditing, ISRE 2400 (Revised) and ISRS 4410 (Revised); ISQM 1.

## 1. Questions for the reviewer

1. **Edition of the Standard.** The third edition of the IFRS for SMEs was issued in 2025. Has the FRC of Nigeria adopted it, and from which periods? The checklist section numbers, the revenue policy and the goodwill treatment follow the second edition.
2. **Scope.** The software refuses public interest entities by asking the user to confirm. Is a confirmation enough, and should any other class of entity be excluded, such as regulated financial institutions and not-for-profit entities?
3. **Audit methodology.** The audit programme is a short generic list. Should the product carry a full ISA methodology, the ISA for Less Complex Entities, or a licensed third-party methodology?
4. **Report wording.** Section 8 prints every report variant. Does each meet ISA 700, 705 and 706, ISRE 2400 and ISRS 4410, and the auditor’s report requirements of CAMA 2020? Is the Other information section right for what these entities publish, are key audit matters rightly left out for entities that are not listed, and are the FRC registration disclosures handled correctly?
5. **Statement of value added and five-year summary.** These are produced because Nigerian practice expects them. Confirm the legal basis and the required layout.
6. **Materiality.** Defaults are performance materiality at 75% of overall and clearly trivial at 5%. The benchmark and percentage are chosen by the auditor. Are the defaults acceptable, and should the software suggest percentage ranges by benchmark?
7. **Journal testing.** A journal with three or more risk indicators must be concluded on. Is the indicator list in section 10 adequate, and is three the right threshold?
8. **Analytical review.** A movement is significant at performance materiality and 10%. Sign-off is blocked on a review and advisory on an audit. Is that the right treatment?
9. **Consolidation.** Section 11 lists the method and three simplifications. Is each acceptable, and is the goodwill departure for foreign subsidiaries tolerable or must it be fixed before release?
10. **Tax.** No tax rate, levy or allowance is built in. The preparer enters the rate. Should the product carry Nigerian company income tax rates, the tertiary education tax and other levies, and deferred tax computation?
11. **AI assistance.** Section 12 sets out what is sent and the rules the AI works under. Is the use consistent with the ethical code, confidentiality duties and the Nigeria Data Protection Act 2023?

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 2. What the software decides and what people decide

| Matter | Who decides | How the software enforces it |
| --- | --- | --- |
| The audit opinion | The engagement partner | The software never selects it. The report is not drafted until the partner chooses. |
| Signing | A partner with an FRC number | Only a partner can sign. The database refuses anyone else. |
| Materiality benchmark and percentage | The auditor | Entered with a written rationale. Required before sign-off on an audit. |
| Conclusion on a tested journal | The auditor | Recorded by a named person. The software only selects journals for testing. |
| Whether evidence is sufficient | The auditor | Open client requests and unsigned subsidiaries are advisories, not blocks. |
| Figures in the statements | The software, from the trial balance and journals | Computed each time. Every figure opens to the accounts behind it. |
| Changes after signing | No one | A signed file is locked in the database. Nothing in it can be changed. |
| Evaluation of the firm’s quality system | The partner with ultimate responsibility | Chosen by the partner. A recorded evaluation cannot be changed. |

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 3. Statement lines

Every account is mapped to one of 35 lines. The statements are built from these lines only. Review whether the set is enough for the entities in scope, and whether any line is missing, such as investment property, biological assets, government grants, and employee benefit obligations.

| Code | Line | Section |
| --- | --- | --- |
| ppe | Property, plant and equipment | Non-current assets |
| intangibles | Intangible assets | Non-current assets |
| investments | Investments | Non-current assets |
| deferred_tax_asset | Deferred tax asset | Non-current assets |
| inventories | Inventories | Current assets |
| trade_receivables | Trade receivables | Current assets |
| other_receivables | Other receivables and prepayments | Current assets |
| cash | Cash and cash equivalents | Current assets |
| share_capital | Share capital | Equity |
| share_premium | Share premium | Equity |
| other_reserves | Other reserves | Equity |
| retained_earnings | Retained earnings | Equity |
| restricted_funds | Restricted funds | Equity |
| endowment_funds | Endowment funds | Equity |
| borrowings_nc | Borrowings | Non-current liabilities |
| deferred_tax_liability | Deferred tax liability | Non-current liabilities |
| provisions | Provisions | Non-current liabilities |
| trade_payables | Trade payables | Current liabilities |
| other_payables | Other payables and accruals | Current liabilities |
| borrowings_c | Borrowings and bank overdrafts | Current liabilities |
| current_tax_payable | Current tax payable | Current liabilities |
| revenue | Revenue | Income |
| other_income | Other income | Income |
| grant_income | Grants | Income |
| donations | Donations and gifts | Income |
| finance_income | Finance income | Income |
| cost_of_sales | Cost of sales | Expenses |
| distribution_costs | Selling and distribution costs | Expenses |
| admin_expenses | Administrative expenses | Expenses |
| other_expenses | Other operating expenses | Expenses |
| programme_expenses | Programme and charitable activities | Expenses |
| fundraising_costs | Fundraising costs | Expenses |
| finance_costs | Finance costs | Expenses |
| income_tax_expense | Income tax expense | Expenses |
| dividends | Dividends declared | Distributions |

Presentation choices to confirm: expenses are analysed by function; the cash flow statement uses the indirect method, derived from the movement between two statements of financial position; there is no statement of other comprehensive income for a single company, which is stated on the face.

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 4. Work programmes

Version 0.1-starter. Every step must be ticked before sign-off. Review for completeness against the standard named, and for wording.

### Audit programme (International Standards on Auditing)

| Id | Area | Step |
| --- | --- | --- |
| a-acc-1 | Acceptance | Confirm independence and ethical requirements for the firm and the team. |
| a-acc-2 | Acceptance | Agree the engagement letter with those charged with governance. |
| a-acc-3 | Acceptance | Confirm the entity is not a public interest entity and that this methodology is appropriate for it. |
| a-pln-1 | Planning | Document the understanding of the entity, its environment and its system of internal control. |
| a-pln-2 | Planning | Set overall materiality, performance materiality and the clearly trivial threshold. |
| a-pln-3 | Planning | Identify and assess risks of material misstatement, including fraud and management override. |
| a-pln-4 | Planning | Agree opening balances to the prior year signed financial statements. |
| a-cash-1 | Cash and bank | Obtain bank confirmations and agree them to the bank reconciliations. |
| a-cash-2 | Cash and bank | Test reconciling items to after-date bank statements. |
| a-rec-1 | Receivables | Test the receivables listing to the ledger and to after-date receipts or confirmations. |
| a-rec-2 | Receivables | Assess the allowance for impairment of receivables. |
| a-inv-1 | Inventories | Attend the inventory count, or perform alternative procedures, and test cost against net realisable value. |
| a-ppe-1 | Property, plant and equipment | Vouch additions and disposals, test ownership and recompute depreciation. |
| a-pay-1 | Payables | Test payables to supplier statements and search for unrecorded liabilities. |
| a-tax-1 | Taxation | Recompute the income tax charge and agree balances to assessments and remittances. |
| a-eq-1 | Equity | Agree share capital to the company records at the Corporate Affairs Commission. |
| a-rev-1 | Revenue | Test revenue for occurrence, accuracy and cut-off. |
| a-exp-1 | Expenses | Test expenses and payroll to supporting documents, and test cut-off. |
| a-jnl-1 | Journals | Test journal entries and other adjustments for evidence of management override. |
| a-cmp-1 | Completion | Evaluate going concern and events after the reporting date. |
| a-cmp-2 | Completion | Evaluate misstatements and conclude on the schedule of unadjusted differences. |
| a-cmp-3 | Completion | Review the financial statements against the disclosure requirements of the framework and the companies law of the client’s country. |
| a-cmp-4 | Completion | Obtain the signed letter of representation and the directors’ approval of the financial statements. |
| a-cmp-5 | Completion | Complete the engagement partner review of the file. |

### Review programme (ISRE 2400 (Revised))

| Id | Area | Step |
| --- | --- | --- |
| r-acc-1 | Acceptance | Confirm independence and ethical requirements, and agree the engagement letter. |
| r-pln-1 | Planning | Document the understanding of the entity and determine materiality. |
| r-enq-1 | Procedures | Make enquiries of management on each material item, estimates, related parties and unusual transactions. |
| r-ana-1 | Procedures | Perform analytical procedures on each material item and investigate unexpected relationships. |
| r-add-1 | Procedures | Perform additional procedures where a matter suggests the statements may be materially misstated. |
| r-cmp-1 | Completion | Evaluate going concern and events after the reporting date. |
| r-cmp-2 | Completion | Obtain written representations and complete the partner review. |

### Compilation programme (ISRS 4410 (Revised))

| Id | Area | Step |
| --- | --- | --- |
| c-acc-1 | Acceptance | Confirm ethical requirements and agree the engagement letter. |
| c-und-1 | Understanding | Document the understanding of the business, its records and the reporting framework. |
| c-cmp-1 | Compilation | Compile the statements from the records, and discuss significant judgments with management. |
| c-cmp-2 | Compilation | Read the compiled statements and raise anything that appears incomplete or misleading. |
| c-cmp-3 | Completion | Obtain management’s acknowledgment of responsibility for the statements. |

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 5. Industry packs

Version 0.2-starter. A pack adds to the general content. It never removes anything.

### Trading and manufacturing
Companies that buy, make and sell goods, where inventories and cost of sales carry most of the risk.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| tm-a-inv-1 | Inventories and production | Review the client’s count instructions before the count, and evaluate whether they will give a reliable result. |
| tm-a-inv-2 | Inventories and production | At the count, make test counts in both directions, from the floor to the sheets and from the sheets to the floor, and record them. |
| tm-a-inv-3 | Inventories and production | Record the last goods received and despatch note numbers at the count, and test purchases and sales cut-off against them. |
| tm-a-inv-4 | Inventories and production | Trace the test counts to the final inventory listing, and test the listing for arithmetic and for items added after the count. |
| tm-a-inv-5 | Inventories and production | Test the cost of raw materials and goods for resale to supplier invoices, including freight, import duty and clearing charges. |
| tm-a-inv-6 | Inventories and production | For manufactured goods, test the build-up of cost: materials, labour and production overheads, absorbed on normal capacity. |
| tm-a-inv-7 | Inventories and production | Test work in progress for stage of completion and the cost attached to it. |
| tm-a-inv-8 | Inventories and production | Compare cost to selling price less costs to sell, using after-date sales, and identify slow-moving, damaged and expired items. |
| tm-a-inv-9 | Inventories and production | Identify inventories held by third parties or on consignment, and goods in transit, and confirm who owns them at the year end. |
| tm-a-inv-10 | Inventories and production | Analyse gross margin by product line and by month, and investigate movements that the business does not explain. |
| tm-a-inv-11 | Inventories and production | Agree import documentation to purchases for significant imports, and test the exchange rate used to record them. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| tm-r-inv-1 | Inventories and production | Enquire how the year-end count was carried out, who supervised it, and how differences from the records were dealt with. |
| tm-r-inv-2 | Inventories and production | Enquire how cost is determined, including overheads in manufactured goods, and whether the method is the same as last year. |
| tm-r-inv-3 | Inventories and production | Enquire about slow-moving, damaged and expired inventories and how they have been written down. |
| tm-r-inv-4 | Inventories and production | Compare gross margin and inventory days to last year, and obtain explanations for significant changes. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| tm-s13-classes | Section 13: Inventories | Inventories are analysed between raw materials, work in progress, finished goods and goods for resale, as they apply. |
| tm-s13-overheads | Section 13: Inventories | The policy explains how production overheads are included in the cost of manufactured goods. |
| tm-s13-writedown | Section 13: Inventories | The amount of any write-down of inventories to selling price less costs to sell is disclosed, with any reversal. |
| tm-s13-third-party | Section 13: Inventories | Inventories held by third parties, held on consignment or in transit are dealt with consistently, and the treatment is clear from the notes. |

Added client requests:

| Request | Detail |
| --- | --- |
| Inventory count instructions | The written instructions given to the count teams, with the date, locations and names of supervisors. |
| Last goods received and despatch notes | The last five of each before the count and the first five after it, at every location. |
| Product costing records | Bills of materials, labour rates and the overhead absorption calculation for manufactured goods. |
| Slow-moving and damaged inventory report | Items with no movement in six months, and items damaged, expired or written down in the year. |
| Import documentation | For significant imports: import permits or forms (Form M in Nigeria), bills of lading, customs duty assessments and clearing agents’ invoices. |
| Inventories held elsewhere | A list of goods held by third parties, on consignment or in transit at the year end, with confirmations. |

### Not-for-profit: NGOs, charities, foundations and faith-based organisations
Organisations funded by grants and donations, where the risks are that restricted money is spent outside its purpose, income is recognised in the wrong period, and donor conditions are not met.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| np-a-1 | Grants and donations | Obtain every grant agreement in force in the year. List each grant’s amount, period, conditions, reporting and audit requirements, and any restriction on use. |
| np-a-2 | Grants and donations | Agree grant receipts to the agreements, bank statements and donor remittance advices, and confirm significant grants directly with the donor. |
| np-a-3 | Grants and donations | Test income recognition: a grant is income when the organisation is entitled to it; a grant with conditions not yet met is deferred, and amounts that must be returned are a liability. |
| np-a-4 | Restricted funds | Reconcile each restricted fund: brought forward, received, spent and carried forward, to the fund tags on the Mapping step and to the donor reports. |
| np-a-5 | Restricted funds | Test a sample of expenditure charged to each restricted fund for eligibility under the grant agreement, the approved budget, and supporting documents. |
| np-a-6 | Restricted funds | Review shared and indirect costs allocated to grants: the basis, its consistency, and the caps in each agreement. |
| np-a-7 | Restricted funds | Identify funds in deficit and transfers between funds, and confirm each was authorised and is disclosed. |
| np-a-8 | Expenditure and procurement | Test procurement for significant purchases against the organisation’s policy and donor rules: quotations, tender records, approvals and conflicts of interest. |
| np-a-9 | Expenditure and procurement | Test cash advances to staff and implementing partners for retirement within the agreed time, with receipts, and review sub-grants for monitoring and partner audit reports. |
| np-a-10 | Donations | Assess controls over cash donations, offerings and collections: counting by two people, prompt banking, and reconciliation of collection records to bank. |
| np-a-11 | Donations | Identify gifts in kind and donated services, and test how they are recognised and measured. |
| np-a-12 | Governance and compliance | Read the constitution and governing body minutes. Confirm activities are within the objectives, and that the registrations and returns the law requires are up to date. |
| np-a-13 | Governance and compliance | Confirm the tax-exempt status relied on, and that payroll taxes, pension contributions and withholding taxes on payments were deducted and remitted. |
| np-a-14 | Governance and compliance | Obtain related party declarations from the governors and senior staff, and test payments to them and to entities they control. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| np-r-1 | Grants and donations | Enquire about each significant grant: its conditions, what has been received and spent, and whether any amount may have to be returned. |
| np-r-2 | Restricted funds | Compare restricted fund balances to donor reports and enquire about funds in deficit and transfers between funds. |
| np-r-3 | Expenditure | Compare programme, fundraising and administration costs to budget and to last year, and obtain explanations for significant differences. |
| np-r-4 | Governance | Enquire whether the organisation’s registrations, tax exemption and statutory returns are current. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| np-funds | Not-for-profit presentation | Funds are analysed between unrestricted, restricted and endowment funds, with each material restricted fund’s purpose and movement in the year. |
| np-income | Not-for-profit presentation | The policy for grants and donations explains when they are recognised, how conditions and restrictions are dealt with, and how gifts in kind are measured. |
| np-expenditure | Not-for-profit presentation | Expenditure is analysed between programme and charitable activities, fundraising, and administration and governance, with the basis for allocating shared costs. |
| np-deferred | Not-for-profit presentation | Grants received with conditions not yet met, and amounts repayable to donors, are shown as liabilities and explained. |
| np-governors | Section 33: Related party disclosures | Payments to governors, and transactions with them and their related parties, are disclosed, including that none were made where that is so. |
| np-going-concern | Section 3: Financial statement presentation | Going concern is assessed against funding secured beyond twelve months, and dependence on a few donors is disclosed where significant. |

Added client requests:

| Request | Detail |
| --- | --- |
| Constitution and registration documents | The constitution or trust deed, certificate of registration, and evidence that the statutory returns for the year were filed. |
| Grant agreements and amendments | Every grant agreement in force in the year, with budgets, amendments and the donors’ reporting and audit requirements. |
| Donor reports | Financial reports submitted to each donor for the year, with the reconciliation to the accounts. |
| Fund ledger | Income and expenditure by fund or project, with balances brought and carried forward. |
| Governing body minutes | Minutes of the trustees’ or board meetings for the year and up to the date of the audit. |
| Advances and sub-grants | Staff and partner advances outstanding at the year end, and sub-grant agreements with partner reports. |
| Tax exemption | Evidence of tax-exempt status, and payroll and withholding tax remittance receipts. |

### Construction and engineering contracts
Contractors who build or install over months, where revenue and profit depend on estimates of progress and costs to complete.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| cn-a-1 | Contracts | Obtain the contract register: contract value, variations, costs to date, estimated costs to complete, revenue recognised and amounts billed for each contract. |
| cn-a-2 | Contracts | Agree contract values and approved variations to signed contracts and client instructions. Treat unapproved claims and variations with caution. |
| cn-a-3 | Contracts | Test the measure of progress, whether costs incurred or surveys of work performed, and agree it to quantity surveyor or engineer certificates. |
| cn-a-4 | Contracts | Challenge estimated costs to complete against budgets, recent cost overruns and after-date costs. Provide in full for expected losses on onerous contracts. |
| cn-a-5 | Contracts | Reconcile amounts due from and to customers for contract work, retentions held by clients, and advances received. |
| cn-a-6 | Costs | Test site costs, subcontractor certificates and materials on site to source documents and cut-off at the year end. |
| cn-a-7 | Plant | Inspect significant plant and equipment, review its utilisation and impairment, and test plant hire income and costs. |
| cn-a-8 | Contingencies | Enquire of management and legal advisers about disputes, liquidated damages, defects liability and performance bonds. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| cn-r-1 | Contracts | Enquire how progress and costs to complete are estimated, and compare margins on each significant contract to tender and to last year. |
| cn-r-2 | Contracts | Enquire about loss-making contracts, disputes, claims and liquidated damages. |
| cn-r-3 | Receivables | Compare retentions and amounts due from customers to last year and enquire about their recovery. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| cn-revenue | Section 23: Revenue | The policy explains how revenue from construction contracts is recognised over time and how progress is measured. |
| cn-balances | Section 23: Revenue | Contract assets, contract liabilities, retentions and advances from customers are shown or disclosed. |
| cn-losses | Section 21: Provisions and contingencies | Provisions for expected losses on contracts, and contingent liabilities from claims and guarantees, are disclosed. |

Added client requests:

| Request | Detail |
| --- | --- |
| Contract register | Every contract open in the year: value, variations, costs to date, estimated costs to complete, billings and retentions. |
| Valuation certificates | Interim certificates from the client’s engineer or quantity surveyor issued before and after the year end. |
| Subcontractor certificates | Certificates and invoices from subcontractors for work done up to the year end. |
| Claims and disputes | Details of claims made by or against the company, liquidated damages and legal correspondence. |
| Performance bonds and guarantees | Bonds, guarantees and advance payment guarantees outstanding at the year end. |

### Real estate: property investment and development
Owners and developers of property, where the risks are valuation, the line between investment property and inventory, and rental income.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| re-a-1 | Property | Obtain the property register and agree title documents (certificates of occupancy, deeds, title deeds) for each property, and check for charges over them. |
| re-a-2 | Property | Classify each property: held to earn rent or for capital appreciation (investment property), held for sale in the ordinary course (inventory), or owner-occupied. |
| re-a-3 | Valuation | Evaluate the valuer’s competence, objectivity and terms, and test the valuation inputs: rents, yields, comparable sales and condition. |
| re-a-4 | Development | For development property, test costs capitalised to source documents, borrowing costs, and net realisable value against current selling prices and costs to complete. |
| re-a-5 | Rental income | Agree rental income to tenancy agreements and the rent roll, test cut-off and rent received in advance, and analyse arrears for recoverability. |
| re-a-6 | Sales | For units sold, test when control passed to the buyer, deposits received, and amounts still due under instalment sales. |
| re-a-7 | Service charges | Review service charge income and costs, and any amounts held for tenants or residents. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| re-r-1 | Valuation | Enquire how fair values were determined and by whom, and compare them to last year and to recent transactions. |
| re-r-2 | Rental income | Compare rental income to the rent roll and occupancy, and enquire about arrears and vacancies. |
| re-r-3 | Development | Enquire about the status, costs to complete and expected selling prices of developments. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| re-ip | Section 16: Investment property | Investment property is disclosed with the measurement basis, the methods and significant assumptions used to determine fair value, and whether a qualified independent valuer was used. |
| re-ip-rec | Section 16: Investment property | A reconciliation of the carrying amount of investment property at the start and end of the year is given. |
| re-restrictions | Section 16: Investment property | Restrictions on realising property, and contractual obligations to purchase, construct or develop it, are disclosed. |
| re-leases | Section 20: Leases | As lessor, future minimum lease payments receivable under operating leases are disclosed by period. |

Added client requests:

| Request | Detail |
| --- | --- |
| Property register and title documents | Every property held, with title documents, cost, additions and any charges or encumbrances. |
| Valuation reports | Valuation reports at the year end, with the valuer’s terms of engagement. |
| Rent roll and tenancy agreements | Tenants, rents, lease terms, amounts received in advance and arrears at the year end. |
| Development cost reports | Costs to date and to complete for each development, with sales and reservations. |

### Professional services: consulting, legal, accounting, engineering and agencies
Firms that sell people’s time, where the risks are unbilled work, fee recoverability, client money and staff costs.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| ps-a-1 | Revenue | Agree fees to engagement letters and time records, and test cut-off of invoices around the year end. |
| ps-a-2 | Revenue | Test unbilled work at the year end: time recorded, rates, stage of completion and recoverability, and remove time that will not be billed. |
| ps-a-3 | Receivables | Analyse fees receivable by age, test after-date receipts, and review disputed and written-off fees. |
| ps-a-4 | Client money | Identify money held for clients, reconcile client accounts, and confirm it is kept separate from the firm’s own money and not recorded as revenue. |
| ps-a-5 | Staff costs | Test payroll to staff records and contracts, bonuses and accrued leave, and the remittance of payroll taxes and pension contributions. |
| ps-a-6 | Related parties | Review drawings, remuneration and transactions with partners, directors and their related parties. |
| ps-a-7 | Contingencies | Enquire about professional negligence claims, professional indemnity cover and regulatory matters. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| ps-r-1 | Revenue | Compare fees and utilisation to last year and enquire about significant changes in clients or rates. |
| ps-r-2 | Revenue | Enquire how unbilled work is valued and how much of it was billed after the year end. |
| ps-r-3 | Contingencies | Enquire about claims against the firm and the professional indemnity cover. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| ps-revenue | Section 23: Revenue | The policy explains how service revenue is recognised, including work in progress and contract assets for unbilled work. |
| ps-client-money | Section 8: Notes | Money held on behalf of clients is excluded from the firm’s assets and liabilities, or shown separately where it is the firm’s responsibility, and explained. |
| ps-claims | Section 21: Provisions and contingencies | Claims against the firm are provided for or disclosed as contingent liabilities. |

Added client requests:

| Request | Detail |
| --- | --- |
| Time and billing report | Time recorded, billed and unbilled for each client at the year end, with the rates used. |
| Engagement letters | Engagement letters for the largest clients by fees. |
| Client account reconciliations | Reconciliations of money held for clients at the year end, with bank statements. |
| Claims and indemnity insurance | Details of claims against the firm and the professional indemnity insurance policy. |

### Hotels, restaurants and hospitality
Cash-heavy businesses selling rooms, food and drink, where the risks are completeness of revenue, food and beverage stock, and the condition of property.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| hp-a-1 | Revenue | Reconcile room revenue to the property management system: rooms available, occupancy and average rate, and test a sample of guest folios to payments. |
| hp-a-2 | Revenue | Reconcile point-of-sale reports for food and beverage to cash, card settlements and bank, and review voids, complimentaries and discounts. |
| hp-a-3 | Revenue | Test deposits and advance bookings, corporate accounts receivable and agency commissions. |
| hp-a-4 | Inventories | Attend the food, beverage and consumables count, and compare gross profit percentages to expected margins. |
| hp-a-5 | Property | Review capital expenditure versus repairs on refurbishment, and assess the property for impairment where occupancy has fallen. |
| hp-a-6 | Taxes and levies | Test consumption, sales or tourism taxes and levies charged to guests and remitted. |
| hp-a-7 | Staff costs | Test payroll, casual staff, service charge distributions and tips. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| hp-r-1 | Revenue | Compare occupancy, average room rate and food and beverage margins to last year and enquire about changes. |
| hp-r-2 | Inventories | Enquire how stock is counted and how wastage and breakages are recorded. |
| hp-r-3 | Property | Enquire about refurbishment spending and any indication that the property is impaired. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| hp-revenue | Section 23: Revenue | Revenue is analysed between rooms, food and beverage and other services, and deposits received in advance are shown as liabilities. |
| hp-impairment | Section 27: Impairment of assets | Any impairment of the property, and the assumptions used, are disclosed. |

Added client requests:

| Request | Detail |
| --- | --- |
| Property management system reports | Monthly occupancy, average room rate and revenue reports, and the night audit for the last and first days around the year end. |
| Point-of-sale reports | Daily sales summaries with card settlement reports for the last month of the year. |
| Stock count sheets | Food, beverage and consumables count sheets at the year end. |
| Taxes and levies returns | Consumption, sales or tourism tax and levy returns and payment receipts for the year. |

### Healthcare: hospitals, clinics, laboratories and pharmacies
Providers paid by patients, insurers and health schemes, where the risks are billing, claims rejections, drugs inventory and regulatory compliance.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| hc-a-1 | Revenue | Reconcile patient billing to the hospital information system and cash, and test a sample of patient bills to services and the price list. |
| hc-a-2 | Revenue | Test claims to insurers, health maintenance organisations and schemes: submission, rejection rates and after-date settlements, and capitation income. |
| hc-a-3 | Receivables | Analyse receivables by payer and age, and provide for claims likely to be rejected or reduced. |
| hc-a-4 | Inventories | Attend the drugs and consumables count, check expiry dates and controlled drugs registers, and test cost. |
| hc-a-5 | Equipment | Inspect significant medical equipment, test additions and leases, and review for impairment and obsolescence. |
| hc-a-6 | Staff costs | Test payroll and payments to visiting consultants, and the withholding tax deducted from them. |
| hc-a-7 | Compliance | Confirm the facility’s licences and registrations are current, and enquire about malpractice claims and insurance. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| hc-r-1 | Revenue | Compare revenue by service line and payer to last year, and enquire about claim rejection rates. |
| hc-r-2 | Inventories | Enquire how drugs are counted and how expired stock is identified and written off. |
| hc-r-3 | Contingencies | Enquire about malpractice claims and the insurance in place. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| hc-revenue | Section 23: Revenue | Revenue is analysed between patient services, pharmacy and other income, and the policy explains how insurer and scheme income is measured. |
| hc-inventory | Section 13: Inventories | Write-downs of expired or obsolete drugs and consumables are disclosed. |
| hc-claims | Section 21: Provisions and contingencies | Provisions and contingent liabilities for malpractice claims are disclosed. |

Added client requests:

| Request | Detail |
| --- | --- |
| Billing and claims reports | Revenue by service and payer, claims submitted, rejected and settled, and capitation statements. |
| Receivables by payer | Amounts due from insurers, schemes, corporates and patients, aged, at the year end. |
| Drugs stock count | Drugs and consumables count sheets with expiry dates, and the controlled drugs register. |
| Licences and insurance | Facility licences and registrations, and the malpractice insurance policy. |

### Education: schools, colleges and training providers
Institutions paid in advance by term or year, where the risks are fees in advance, scholarships and discounts, and grants.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| ed-a-1 | Fees | Reconcile tuition fee income to the student register and the approved fee schedule, allowing for scholarships, sibling and staff discounts. |
| ed-a-2 | Fees | Test fees received in advance for terms after the year end, and recognise income over the period taught. |
| ed-a-3 | Fees | Analyse fees outstanding by student and age, and provide for those unlikely to be collected, including from students who have left. |
| ed-a-4 | Other income | Test boarding, transport, uniform, examination and development levy income, and amounts collected on behalf of examining bodies. |
| ed-a-5 | Grants | Agree grants and endowments to agreements and test that conditions are met before they are recognised as income. |
| ed-a-6 | Staff costs | Test teaching and non-teaching payroll to staff records and contracts. |
| ed-a-7 | Property | Review buildings and equipment, capital projects and their funding, and land title. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| ed-r-1 | Fees | Compare fee income to student numbers multiplied by fees, and enquire about differences. |
| ed-r-2 | Fees | Enquire how fees in advance and outstanding fees are dealt with at the year end. |
| ed-r-3 | Grants | Enquire about grants received and their conditions. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| ed-revenue | Section 23: Revenue | The policy explains that tuition is recognised over the period taught, and fees received in advance are shown as liabilities. |
| ed-grants | Section 24: Government grants | Grants are disclosed with their nature, the amounts recognised, and conditions not yet met. |

Added client requests:

| Request | Detail |
| --- | --- |
| Student register and fee schedule | Students enrolled each term, with the approved fees and the scholarships and discounts given. |
| Fees received in advance | Fees received before the year end for terms that start after it. |
| Outstanding fees | Fees owed by each student at the year end, with what has been collected since. |
| Grant and endowment agreements | Agreements for grants and endowments received in the year. |

### Agriculture, livestock and agro-processing
Farms and processors, where the risks are measuring biological assets and produce, seasonal inventories and grants.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| ag-a-1 | Biological assets | Attend the count of livestock, poultry, fish and standing crops at or near the year end, and record numbers, age and condition. |
| ag-a-2 | Biological assets | Test how biological assets are measured: fair value less costs to sell where it is readily determinable, otherwise cost less depreciation and impairment, and the market prices used. |
| ag-a-3 | Biological assets | Reconcile movements in the year: births, purchases, growth, harvest, sales and deaths, with mortality records. |
| ag-a-4 | Produce and inventories | Test agricultural produce at the point of harvest and its measurement, and inventories of feed, fertiliser, seed and processed goods. |
| ag-a-5 | Revenue | Test sales to off-takers, commodity contracts and prices, and cut-off of deliveries. |
| ag-a-6 | Grants and land | Agree government grants and subsidised loans to agreements, and confirm the title or lease of farmland. |
| ag-a-7 | Plant | Inspect tractors, processing plant and irrigation, and review for impairment. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| ag-r-1 | Biological assets | Enquire how livestock and crops are counted and valued, and compare quantities and values to last year. |
| ag-r-2 | Revenue | Compare yields, prices and margins to last year and enquire about weather, disease and price effects. |
| ag-r-3 | Grants | Enquire about grants and subsidised loans and their conditions. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| ag-bio | Section 34: Specialised activities | Biological assets are described by class, with the measurement basis, the methods and assumptions used, and a reconciliation of the carrying amount. |
| ag-produce | Section 34: Specialised activities | Agricultural produce harvested is measured at the point of harvest, and the basis is disclosed. |
| ag-grants | Section 24: Government grants | Government grants related to agriculture are disclosed with unfulfilled conditions. |

Added client requests:

| Request | Detail |
| --- | --- |
| Livestock and crop records | Herd, flock and pond registers, mortality records and crop plans, with year-end counts. |
| Market prices | Evidence of market prices used to value biological assets and produce at the year end. |
| Off-take agreements | Sales contracts with off-takers and commodity buyers. |
| Grant and loan agreements | Government grant, subsidy and intervention loan agreements. |
| Land documents | Title or lease documents for farmland. |

### Oil, gas and mining services
Service companies to exploration and production operators, where the risks are contract billing, foreign currency, local content requirements and equipment.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| og-a-1 | Revenue | Agree revenue to service contracts, call-off orders and job completion tickets signed by the operator, and test cut-off of work done but not invoiced. |
| og-a-2 | Revenue | Test billing in foreign currency, the exchange rates used, and amounts withheld by operators. |
| og-a-3 | Receivables | Confirm significant balances with operators, test after-date receipts, and review disputed invoices. |
| og-a-4 | Equipment | Inspect specialised equipment and vessels, test utilisation, depreciation and certification, and review for impairment. |
| og-a-5 | Foreign currency | Test translation of foreign currency balances at the closing rate and exchange gains and losses. |
| og-a-6 | Compliance | Confirm permits, local content certifications and the levies and withholding taxes deducted by operators. |
| og-a-7 | Provisions | Review obligations for site restoration, demobilisation and environmental damage. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| og-r-1 | Revenue | Compare revenue by contract and day rates to last year, and enquire about contracts won and lost. |
| og-r-2 | Equipment | Enquire about equipment utilisation and any idle equipment. |
| og-r-3 | Foreign currency | Enquire how foreign currency balances are translated. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| og-fx | Section 30: Foreign currency translation | The functional currency, exchange differences recognised, and the rates used are disclosed. |
| og-provisions | Section 21: Provisions and contingencies | Provisions for restoration and environmental obligations are disclosed with their uncertainties. |

Added client requests:

| Request | Detail |
| --- | --- |
| Service contracts and call-off orders | Contracts with operators and the call-off orders active in the year. |
| Job tickets | Signed job completion tickets for work done in the last month of the year. |
| Equipment register | Specialised equipment and vessels, with utilisation and certification records. |
| Permits and certificates | Operating permits and local content certificates. |

### Transport, logistics and haulage
Hauliers, couriers, freight forwarders and passenger transport, where the risks are vehicle fleets, fuel, and income collected by drivers and agents.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| tl-a-1 | Revenue | Agree revenue to waybills, trip sheets and delivery notes, and test cut-off of trips in progress at the year end. |
| tl-a-2 | Revenue | Test cash collected by drivers, conductors and agents for prompt banking and reconciliation. |
| tl-a-3 | Freight forwarding | Distinguish the company’s own revenue from amounts collected for shipping lines, customs and ports, which pass through. |
| tl-a-4 | Fleet | Inspect a sample of vehicles, agree them to registration documents, and test depreciation, disposals, leases and impairment of idle vehicles. |
| tl-a-5 | Fuel and maintenance | Analyse fuel cost per kilometre or trip and maintenance by vehicle, and investigate outliers. |
| tl-a-6 | Claims | Review claims for damaged or lost goods, accidents and insurance recoveries. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| tl-r-1 | Revenue | Compare revenue per vehicle or trip and fuel costs to last year, and enquire about differences. |
| tl-r-2 | Fleet | Enquire about vehicles bought, sold, leased or off the road. |
| tl-r-3 | Claims | Enquire about claims and accidents in the year. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| tl-revenue | Section 23: Revenue | Where the company acts as agent, revenue is the commission or margin, not the gross amount collected, and the policy says so. |
| tl-leases | Section 20: Leases | Vehicles held under leases are disclosed with the lease commitments. |

Added client requests:

| Request | Detail |
| --- | --- |
| Fleet register | Vehicles owned and leased, with registration documents, and those off the road at the year end. |
| Trip sheets and waybills | Trip sheets, waybills and delivery notes for the last weeks of the year. |
| Fuel and maintenance records | Fuel and maintenance cost by vehicle for the year. |
| Insurance claims | Claims made and received for accidents and goods in transit. |

### Technology, software and telecommunications services
Software, SaaS, internet and telecom service businesses, where the risks are subscription revenue, capitalised development, and customer deposits.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| tc-a-1 | Revenue | Reconcile subscription and usage revenue to the billing system, and test deferred revenue for periods after the year end. |
| tc-a-2 | Revenue | For contracts with several elements (licences, set-up, support, hardware), test how the price is allocated and when each part is recognised. |
| tc-a-3 | Revenue | Test prepaid airtime, data and wallet balances held for customers, and breakage on unused credit. |
| tc-a-4 | Development costs | Test software development costs: the IFRS for SMEs expenses research and development, so confirm that none has been capitalised. |
| tc-a-5 | Intangibles | Agree purchased software, licences and spectrum to contracts and test amortisation and impairment. |
| tc-a-6 | IT general controls | Assess access, change management and data backups over the billing and accounting systems the audit relies on. |
| tc-a-7 | Foreign currency | Test foreign currency licence fees, cloud hosting and payables at the closing rate. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| tc-r-1 | Revenue | Compare recurring revenue, customer numbers and churn to last year and enquire about changes. |
| tc-r-2 | Development costs | Enquire how development costs are accounted for. |
| tc-r-3 | Revenue | Enquire how deferred revenue is calculated at the year end. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| tc-revenue | Section 23: Revenue | The policy explains how subscriptions, licences, set-up and support are recognised, and deferred revenue is shown as a liability. |
| tc-intangibles | Section 18: Intangible assets | Development expenditure is expensed, and purchased software and licences are amortised and disclosed. |

Added client requests:

| Request | Detail |
| --- | --- |
| Billing system reports | Revenue, deferred revenue and customer numbers by month, reconciled to the ledger. |
| Customer contracts | Contracts for the largest customers, showing the elements sold and their prices. |
| Software and licences register | Software, licences and spectrum held, with contracts and terms. |
| System access and change logs | User access lists and change logs for the billing and accounting systems. |

### Wholesale, retail and FMCG distribution
Shops, supermarkets, wholesalers and distributors with many small sales, where the risks are cash, stock shrinkage, rebates and returns.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| rt-a-1 | Revenue | Reconcile point-of-sale and van sales reports to cash, card and transfer settlements and bank, store by store. |
| rt-a-2 | Revenue | Test returns, credit notes and discounts after the year end for sales that should be reversed. |
| rt-a-3 | Rebates | Agree supplier rebates and promotional support to agreements, and test that only rebates earned are recognised. |
| rt-a-4 | Inventories | Attend counts at the main warehouse and a sample of stores, and analyse shrinkage against the records. |
| rt-a-5 | Inventories | Identify slow-moving, expired and damaged stock and test the write-down. |
| rt-a-6 | Distributors | Confirm balances with major distributors and customers, and test credit limits and after-date receipts. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| rt-r-1 | Revenue | Compare sales and margins by store or channel to last year, and enquire about differences. |
| rt-r-2 | Inventories | Enquire about counts, shrinkage and how expired stock is written off. |
| rt-r-3 | Rebates | Enquire how supplier rebates are recognised. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| rt-rebates | Section 13: Inventories | The policy explains how supplier rebates and discounts reduce the cost of inventories. |
| rt-returns | Section 23: Revenue | Revenue is shown net of returns, discounts and rebates given to customers. |

Added client requests:

| Request | Detail |
| --- | --- |
| Point-of-sale reports | Daily sales by store with settlement reports for the last month of the year. |
| Supplier rebate agreements | Rebate and promotional support agreements with suppliers, and the calculations. |
| Store count results | Count results by store and warehouse, with shrinkage analysis. |
| Returns after the year end | Credit notes and returns in the first month after the year end. |

### Cooperatives, thrift and credit societies
Member-owned societies that take savings and lend to members, where the risks are members’ balances, loan losses and compliance with the cooperative law.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| cp-a-1 | Members’ savings | Reconcile members’ savings and share contributions to the members’ ledger, and send balance confirmations to a sample of members. |
| cp-a-2 | Loans to members | Test loans to the loan register, agreements, guarantors and approvals, and test repayments from payroll deductions or cash. |
| cp-a-3 | Loans to members | Age loans in arrears, and test the allowance for loans unlikely to be repaid, including loans to officers. |
| cp-a-4 | Income | Recalculate interest and charges on loans, and test investment income. |
| cp-a-5 | Payroll deductions | Reconcile deductions remitted by employers to amounts credited to members. |
| cp-a-6 | Governance | Read the bye-laws and general meeting minutes, and test dividends and patronage refunds declared against them. |
| cp-a-7 | Compliance | Confirm registration with the cooperative regulator and compliance with its reporting and reserve requirements. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| cp-r-1 | Loans to members | Enquire about arrears and loans written off, and compare the allowance to last year. |
| cp-r-2 | Members’ savings | Compare members’ savings and loans to last year and enquire about changes. |
| cp-r-3 | Governance | Enquire about decisions of the general meeting on dividends and reserves. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| cp-loans | Section 11: Basic financial instruments | Loans to members are disclosed with the terms, arrears and the allowance for impairment. |
| cp-savings | Section 11: Basic financial instruments | Members’ savings and deposits are classified as liabilities, and share contributions as equity only where the bye-laws allow the society to refuse redemption. |
| cp-officers | Section 33: Related party disclosures | Loans and other transactions with committee members and officers are disclosed. |

Added client requests:

| Request | Detail |
| --- | --- |
| Members’ ledger | Savings, shares and loan balances for every member at the year end. |
| Loan register and agreements | Loans granted, repaid and in arrears, with agreements and guarantor forms. |
| Employer deduction schedules | Payroll deduction schedules from employers and the remittances received. |
| Bye-laws and minutes | The bye-laws and minutes of general and committee meetings. |

### Media, entertainment and events
Broadcasters, publishers, producers and event organisers, where the risks are advertising revenue, content rights and advance ticket sales.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| me-a-1 | Revenue | Agree advertising revenue to bookings, transmission or publication logs and invoices, and test agency commissions and discounts. |
| me-a-2 | Revenue | Test barter transactions, and recognise them only where they can be measured reliably. |
| me-a-3 | Revenue | Test ticket sales and sponsorship received in advance for events after the year end. |
| me-a-4 | Content | Agree content rights and productions to contracts, and test amortisation and impairment of content that will not earn its cost. |
| me-a-5 | Royalties | Test royalties payable to artists and rights holders. |
| me-a-6 | Compliance | Confirm broadcasting and operating licences are current. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| me-r-1 | Revenue | Compare advertising and event revenue to last year and enquire about changes. |
| me-r-2 | Content | Enquire how content rights are amortised and tested for impairment. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| me-revenue | Section 23: Revenue | The policy explains how advertising, sponsorship and ticket revenue are recognised, and income received in advance is shown as a liability. |
| me-content | Section 18: Intangible assets | Content rights are disclosed with the amortisation method and any impairment. |

Added client requests:

| Request | Detail |
| --- | --- |
| Advertising bookings and logs | Bookings and transmission or publication logs for the last month of the year. |
| Content and rights contracts | Contracts for content acquired or produced, with rights periods. |
| Event schedules | Events after the year end with tickets sold and sponsorship received. |

### Power, renewable energy and utilities
Generators, solar installers and pay-as-you-go energy providers, where the risks are metered revenue, long-lived plant and customer financing.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| en-a-1 | Revenue | Reconcile energy sold to meter readings, the billing system and tariffs, and test unbilled energy at the year end. |
| en-a-2 | Revenue | For pay-as-you-go and lease-to-own systems, test the split between sale of equipment and financing income, and customer receivables. |
| en-a-3 | Plant | Test additions to generation, distribution and solar assets, useful lives, and impairment where plant is under-used. |
| en-a-4 | Grants | Agree results-based financing and grants to agreements, and test that conditions are met before income is recognised. |
| en-a-5 | Provisions | Review warranty obligations and decommissioning or battery disposal costs. |
| en-a-6 | Compliance | Confirm licences from the electricity regulator and compliance with tariff orders. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| en-r-1 | Revenue | Compare units sold, tariffs and collection rates to last year and enquire about changes. |
| en-r-2 | Plant | Enquire about plant availability and assets out of use. |
| en-r-3 | Grants | Enquire about grants and results-based financing received. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| en-revenue | Section 23: Revenue | The policy explains how energy sales, equipment sales and financing income are recognised. |
| en-grants | Section 24: Government grants | Grants and results-based financing are disclosed with conditions not yet met. |
| en-warranty | Section 21: Provisions and contingencies | Warranty and decommissioning provisions are disclosed. |

Added client requests:

| Request | Detail |
| --- | --- |
| Meter and billing reports | Energy generated, sold and billed by month, with tariff schedules. |
| Customer financing portfolio | Pay-as-you-go and lease-to-own contracts with balances and arrears. |
| Grant and financing agreements | Grant, results-based financing and concessional loan agreements. |
| Licences | Generation, distribution or mini-grid licences. |

### Insurance brokers and agents
Intermediaries paid by commission, where the risks are premiums held for insurers, commission cut-off and regulatory capital.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| ib-a-1 | Premiums held | Reconcile premiums collected from clients to amounts remitted to insurers, and confirm amounts held for insurers at the year end. |
| ib-a-2 | Commission | Agree commission to placement slips, debit notes and insurer statements, and test when it is earned. |
| ib-a-3 | Commission | Provide for commission refundable on policies cancelled after the year end. |
| ib-a-4 | Client money | Confirm that premium bank accounts are kept separate and are not used for the broker’s own expenses. |
| ib-a-5 | Compliance | Confirm the licence, professional indemnity cover and any capital or deposit requirements of the insurance regulator. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| ib-r-1 | Commission | Compare commission by insurer and class of business to last year and enquire about changes. |
| ib-r-2 | Premiums held | Enquire how premiums held for insurers are reconciled and remitted. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| ib-revenue | Section 23: Revenue | Revenue is commission earned as agent, not gross premiums, and the policy says when it is recognised. |
| ib-fiduciary | Section 8: Notes | Premiums held for insurers are shown as liabilities with the related bank balances, or explained where held in trust. |

Added client requests:

| Request | Detail |
| --- | --- |
| Premium and commission register | Policies placed, premiums collected and remitted, and commission earned, by insurer. |
| Insurer statements | Statements of account from insurers at the year end. |
| Premium bank accounts | Bank statements and reconciliations for premium accounts. |
| Licence and indemnity cover | The broker’s licence and professional indemnity policy. |

### Payment services, agency banking and fintech
Payment, wallet and agency businesses holding customer money in transit, where the risks are customer float, settlement and fraud. Banks and insurers that report under full IFRS are out of scope.

Added audit steps:

| Id | Area | Step |
| --- | --- | --- |
| fn-a-1 | Customer funds | Reconcile customer wallet and float balances to the platform ledger and to the bank or trust accounts that hold them, daily for the last week of the year. |
| fn-a-2 | Settlement | Test settlement with switches, card schemes, banks and agents, and investigate unsettled and suspense items at the year end. |
| fn-a-3 | Revenue | Recalculate fee and commission income from transaction volumes and the fee schedule, and test revenue shares with partners. |
| fn-a-4 | Fraud and chargebacks | Review chargebacks, disputed and fraudulent transactions, and provide for losses. |
| fn-a-5 | IT general controls | Assess access, change management and reconciliations over the transaction platform. |
| fn-a-6 | Compliance | Confirm the licence, minimum capital and the regulator’s returns, and enquire about sanctions. |

Added review steps:

| Id | Area | Step |
| --- | --- | --- |
| fn-r-1 | Customer funds | Enquire how customer funds are reconciled and held, and compare balances to last year. |
| fn-r-2 | Revenue | Compare transaction volumes and fee income to last year. |
| fn-r-3 | Fraud | Enquire about fraud losses and chargebacks in the year. |

Added disclosure checklist items:

| Id | Section | Item |
| --- | --- | --- |
| fn-customer-funds | Section 11: Basic financial instruments | Customer funds and the related liabilities are shown or disclosed, with any restriction on the cash that holds them. |
| fn-revenue | Section 23: Revenue | Fee and commission income is recognised as the services are provided, net of amounts that belong to partners. |

Added client requests:

| Request | Detail |
| --- | --- |
| Platform ledger reports | Customer balances, transaction volumes and fees by month, reconciled to the ledger. |
| Settlement reconciliations | Settlement reconciliations with switches, schemes and banks at the year end. |
| Customer funds accounts | Bank or trust account statements holding customer funds. |
| Licence and regulatory returns | The operating licence and returns to the regulator for the year. |

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 6. Disclosure checklist

Version 0.1-starter. 49 items. Each is a plain-language summary of a disclosure area. It is not the text of the Standard and it is not complete. Sign-off is blocked while any applicable item has no answer.

"Applies when" names the statement lines that make an item relevant. An item with none always applies. "Covered by the software" means the software marks the item as met from the file itself, without asking the preparer: check that each of these is a sound basis.

| Id | Section | Item | Applies when | Covered by the software |
| --- | --- | --- | --- | --- |
| s3-set | Section 3: Financial statement presentation | A complete set of financial statements is presented: financial position, comprehensive income, changes in equity, cash flows and notes. | Always | Yes, when a prior year is held, so that the cash flow statement is produced. |
| s3-compliance | Section 3: Financial statement presentation | The notes state, explicitly and without reservation, that the financial statements comply with the IFRS for SMEs. | Always | Yes, always. Stated in note 2. |
| s3-going-concern | Section 3: Financial statement presentation | Management’s going concern assessment is reflected, and any material uncertainty is disclosed. | Always | Yes, when the going concern note has any text. |
| s3-comparatives | Section 3: Financial statement presentation | Comparative information is given for all amounts, and for narrative where it is relevant. | Always | Yes, when a prior year trial balance is imported. |
| s3-identification | Section 3: Financial statement presentation | Each statement names the entity, the period or date, the presentation currency and the level of rounding. | Always | Yes, always. The layout of the statements provides it. |
| s3-general | Section 3: Financial statement presentation | The notes give the entity’s domicile, legal form, registered office address and the nature of its operations and principal activities. | Always | Yes, when the registered office and principal activity are entered. |
| s3-consistency | Section 3: Financial statement presentation | Presentation and classification are the same as last year, or the change and its reason are disclosed and comparatives reclassified. | Always | No. The preparer answers. |
| s4-current | Section 4: Statement of financial position | Current and non-current assets and liabilities are shown as separate classifications. | Always | Yes, always. The layout of the statements provides it. |
| s4-subclasses | Section 4: Statement of financial position | The line items are broken down further, on the face or in the notes, in a way that suits the entity’s operations. | Always | Yes, always. Each line is analysed by account in its note. |
| s4-share-capital | Section 4: Statement of financial position | For each class of share capital: shares authorised, issued and fully paid, par value, a reconciliation of shares outstanding, and the rights and restrictions attached. | share_capital, share_premium | No. The preparer answers. |
| s4-reserves | Section 4: Statement of financial position | Each reserve within equity is described. | other_reserves | No. The preparer answers. |
| s5-expenses | Section 5: Statement of comprehensive income | Expenses are analysed by nature or by function, whichever is reliable and more relevant. | Always | Yes, always. The layout of the statements provides it. |
| s5-material-items | Section 5: Statement of comprehensive income | The nature and amount of material items of income and expense are disclosed separately. | Always | No. The preparer answers. |
| s6-statement | Section 6: Statement of changes in equity | Changes in equity show, for each component, a reconciliation of opening to closing amounts, with profit, dividends and transactions with owners shown separately. | Always | Yes, always. The statement is produced. |
| s6-dividends | Section 6: Statement of changes in equity | Dividends declared and paid in the period are disclosed, with the amount for each share where relevant. | dividends | No. The preparer answers. |
| s7-components | Section 7: Statement of cash flows | The components of cash and cash equivalents are given and reconciled to the statement of financial position. | Always | Yes, always. The cash note lists its accounts. |
| s7-restricted | Section 7: Statement of cash flows | Significant cash balances that are not available for use by the entity are disclosed, with an explanation. | cash | No. The preparer answers. |
| s7-non-cash | Section 7: Statement of cash flows | Investing and financing transactions that did not use cash are excluded from the statement and disclosed elsewhere. | Always | No. The preparer answers. |
| s8-policies | Section 8: Notes | The significant accounting policies are disclosed and have been tailored to this entity: the measurement bases and the other policies needed to understand the statements. | Always | Yes, when every applicable policy has wording confirmed for the client. |
| s8-judgements | Section 8: Notes | The judgements management made in applying the accounting policies that most affect the amounts recognised are disclosed. | Always | No. The preparer answers. |
| s8-estimates | Section 8: Notes | The key assumptions about the future and other main sources of estimation uncertainty are disclosed, with the assets and liabilities affected. | Always | No. The preparer answers. |
| s10-changes | Section 10: Accounting policies, estimates and errors | Any change in accounting policy, change in estimate or correction of a prior period error is disclosed, with its nature and effect. | Always | No. The preparer answers. |
| s11-policies | Section 11: Basic financial instruments | The measurement bases used for financial instruments are disclosed, and the carrying amounts are given by category. | trade_receivables, other_receivables, investments, trade_payables, other_payables, borrowings_nc, borrowings_c | No. The preparer answers. |
| s11-borrowings | Section 11: Basic financial instruments | For borrowings: the terms and conditions, interest rate, maturity, repayment schedule and any restrictions. | borrowings_nc, borrowings_c | No. The preparer answers. |
| s11-security | Section 11: Basic financial instruments | The carrying amount of assets pledged as security, and the terms of the pledge, are disclosed. | borrowings_nc, borrowings_c | No. The preparer answers. |
| s11-defaults | Section 11: Basic financial instruments | Any default or breach on loans payable during the period that was not remedied by the reporting date is disclosed. | borrowings_nc, borrowings_c | No. The preparer answers. |
| s11-impairment | Section 11: Basic financial instruments | Impairment losses on receivables, and the income, expense, gains and losses on financial instruments, are disclosed. | trade_receivables, other_receivables, investments | No. The preparer answers. |
| s13-policy | Section 13: Inventories | The policy for measuring inventories, including the cost formula, is disclosed, with the carrying amount by classification. | inventories | No. The preparer answers. |
| s13-expense | Section 13: Inventories | The amount of inventories recognised as an expense, any write-downs or reversals, and inventories pledged as security are disclosed. | inventories | No. The preparer answers. |
| s17-bases | Section 17: Property, plant and equipment | For each class: the measurement basis, the depreciation method and the useful lives or rates. | ppe | No. The preparer answers. |
| s17-reconciliation | Section 17: Property, plant and equipment | For each class: cost and accumulated depreciation at the start and end of the period, with additions, disposals and depreciation reconciled. | ppe | Yes, when the movement schedule agrees to the depreciation charge. |
| s17-pledged | Section 17: Property, plant and equipment | Property pledged as security, restrictions on title, and contractual commitments to acquire property, plant and equipment are disclosed. | ppe | No. The preparer answers. |
| s18-intangibles | Section 18: Intangible assets | For each class: useful lives or amortisation rates, the method, a reconciliation of the carrying amount, and where amortisation is charged. | intangibles | No. The preparer answers. |
| s20-leases | Section 20: Leases | Lease payments recognised as an expense, and the total of future minimum lease payments by period, are disclosed, with a general description of significant leasing arrangements. | Always | No. The preparer answers. |
| s21-provisions | Section 21: Provisions and contingencies | For each class of provision: a reconciliation of the movement, the nature of the obligation, and the expected timing and uncertainties. | provisions | No. The preparer answers. |
| s21-contingent | Section 21: Provisions and contingencies | Contingent liabilities are described, with an estimate of their financial effect, unless the possibility of an outflow is remote. | Always | Yes, when the note has any text. |
| s21-commitments | Section 21: Provisions and contingencies | Capital commitments at the reporting date are disclosed. | Always | Yes, when the note has any text. |
| s23-revenue | Section 23: Revenue | The policy for recognising revenue is disclosed, with the amount of each category of revenue: goods, services, interest, and any others. | revenue, other_income, finance_income | No. The preparer answers. |
| s25-borrowing-costs | Section 25: Borrowing costs | Finance costs for the period are disclosed, covering total interest expense on liabilities not at fair value through profit or loss. | finance_costs | No. The preparer answers. |
| s27-impairment | Section 27: Impairment of assets | Impairment losses and reversals recognised in the period are disclosed by class of asset, with the line item in which they are included. | Always | No. The preparer answers. |
| s28-benefits | Section 28: Employee benefits | The amount recognised as an expense for defined contribution plans, including the statutory pension scheme, is disclosed, with any other long-term or termination benefits. | Always | No. The preparer answers. |
| s29-components | Section 29: Income tax | The major components of the tax expense are disclosed separately: current tax, adjustments for prior periods, and deferred tax. | income_tax_expense, current_tax_payable, deferred_tax_asset, deferred_tax_liability | No. The preparer answers. |
| s29-reconciliation | Section 29: Income tax | The difference between the tax expense and accounting profit multiplied by the applicable tax rate is explained. | income_tax_expense | Yes, when the reconciliation has no unexplained difference. |
| s29-deferred | Section 29: Income tax | For each type of temporary difference and unused tax loss: the deferred tax balance and its movement, and any amounts not recognised. | deferred_tax_asset, deferred_tax_liability | No. The preparer answers. |
| s32-authorisation | Section 32: Events after the end of the reporting period | The date the financial statements were authorised for issue, and who gave the authorisation, are disclosed. | Always | No. The preparer answers. |
| s32-events | Section 32: Events after the end of the reporting period | Each material non-adjusting event after the reporting date is described, with an estimate of its financial effect. | Always | Yes, when the note has any text. |
| s33-control | Section 33: Related party disclosures | Any parent and ultimate controlling party is named, whether or not there were transactions with them. | Always | No. The preparer answers. |
| s33-key-management | Section 33: Related party disclosures | Key management personnel compensation is disclosed in total. | Always | Yes, when directors’ remuneration is entered. |
| s33-transactions | Section 33: Related party disclosures | For related party transactions: the relationship, the amounts, outstanding balances with their terms, and any provision for doubtful amounts. | Always | Yes, when transactions are listed or the preparer confirms there are none. |

Missing sections to consider: Section 9 (consolidated statements), 12 (other financial instruments), 14 and 15 (associates and joint ventures), 16 (investment property), 19 (business combinations and goodwill), 22 (liabilities and equity), 24 (government grants), 26 (share-based payment), 30 (foreign currency), 34 (specialised activities), 35 (transition).

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 7. Accounting policies and standard notes

Version 0.1-starter. A policy prints in note 2 when the company has the line. The preparer edits and confirms each one for the client. An unconfirmed policy prints the wording below.

| Line | Title | Starter wording |
| --- | --- | --- |
| revenue | Revenue | Revenue is measured at the fair value of the consideration received or receivable, net of value added tax, discounts and returns. Revenue from the sale of goods is recognised when the significant risks and rewards of ownership pass to the buyer. Revenue from services is recognised by reference to the stage of completion. |
| ppe | Property, plant and equipment | Property, plant and equipment is stated at cost less accumulated depreciation and accumulated impairment losses. Depreciation is charged on a straight-line basis over the estimated useful lives of the assets. Land is not depreciated. |
| intangibles | Intangible assets | Intangible assets are stated at cost less accumulated amortisation and accumulated impairment losses, and are amortised on a straight-line basis over their estimated useful lives. |
| inventories | Inventories | Inventories are stated at the lower of cost and estimated selling price less costs to complete and sell. |
| trade_receivables | Trade and other receivables | Receivables are recognised at the transaction price. At each reporting date their carrying amounts are reviewed for objective evidence of impairment, and any impairment loss is recognised in profit or loss. |
| cash | Cash and cash equivalents | Cash and cash equivalents comprise cash in hand and demand deposits with banks. |
| trade_payables | Trade and other payables | Payables are obligations on normal credit terms and are recognised at the transaction price. |
| borrowings_nc | Borrowings | Borrowings are recognised initially at the transaction price and subsequently at amortised cost using the effective interest method. Interest expense is recognised in profit or loss as finance costs. |
| income_tax_expense | Income tax | Income tax expense comprises current and deferred tax. Current tax is the expected tax payable on the taxable profit for the year under the tax laws enacted at the reporting date. Deferred tax is recognised on temporary differences between the carrying amounts of assets and liabilities and their tax bases. |
| provisions | Provisions | A provision is recognised when the company has a present obligation as a result of a past event, it is probable that an outflow of economic benefits will be required to settle it, and the amount can be estimated reliably. |

Standard wording offered for four notes. The preparer confirms it is true for the entity before using it:

| Note | Wording |
| --- | --- |
| goingConcern | The directors have assessed the company’s ability to continue as a going concern and have no reason to believe it will not remain in operation for at least twelve months from the date these financial statements were approved. The financial statements are prepared on the going concern basis. |
| subsequentEvents | There were no events after the reporting date that require adjustment to, or disclosure in, these financial statements. |
| contingencies | The company had no contingent liabilities at the reporting date. |
| commitments | The company had no capital commitments at the reporting date. |

Also to review, in the financial statements screen: the report of the directors, the statement of directors’ responsibilities, note 1 (general information) and the basis of preparation paragraph of note 2. And in the consolidation screen: the basis of consolidation, goodwill, associates and foreign subsidiaries notes.

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 8. Report wording

Each variant is printed in full, as drafted for a company called Example Limited with a year end of 31 December 2025. The partner’s basis paragraph for a modified opinion is shown as a placeholder.

### Audit, unmodified opinion
**Independent auditor’s report**
To the members of Example Limited

*Opinion*

We have audited the financial statements of Example Limited, which comprise the statement of financial position as at 31 December 2025, the statement of profit or loss, the statement of changes in equity and the statement of cash flows for the year then ended, and the notes to the financial statements, including a summary of significant accounting policies.

In our opinion, the accompanying financial statements give a true and fair view of the financial position of Example Limited as at 31 December 2025, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011.

*Basis for opinion*

We conducted our audit in accordance with International Standards on Auditing. Our responsibilities under those standards are described in the Auditor’s responsibilities section of our report. We are independent of the company in accordance with the ethical requirements relevant to our audit of the financial statements in Nigeria, and we have fulfilled our other ethical responsibilities in accordance with those requirements.

We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.

*Other information*

The directors are responsible for the other information. The other information comprises the report of the directors, the statement of directors’ responsibilities, the statement of value added and the financial summary, which we obtained before the date of this report. It does not include the financial statements and our auditor’s report on them.

Our opinion on the financial statements does not cover the other information and we do not express any form of assurance conclusion on it.

In connection with our audit of the financial statements, our responsibility is to read the other information and, in doing so, consider whether it is materially inconsistent with the financial statements or our knowledge obtained in the audit, or otherwise appears to be materially misstated. If, based on the work we have performed, we conclude that there is a material misstatement of the other information, we are required to report that fact.

We have nothing to report in this regard.

*Responsibilities of the directors for the financial statements*

The directors are responsible for the preparation of financial statements that give a true and fair view in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011, and for such internal control as they determine is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.

In preparing the financial statements, the directors are responsible for assessing the company’s ability to continue as a going concern, disclosing matters related to going concern where applicable, and using the going concern basis of accounting unless they intend to liquidate the company or to cease operations, or have no realistic alternative but to do so.

*Auditor’s responsibilities for the audit of the financial statements*

Our objectives are to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor’s report that includes our opinion. Reasonable assurance is a high level of assurance, but it is not a guarantee that an audit conducted in accordance with International Standards on Auditing will always detect a material misstatement when it exists.

Misstatements can arise from fraud or error. They are considered material if, individually or in aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these financial statements.

As part of an audit we exercise professional judgment and maintain professional scepticism throughout. We identify and assess the risks of material misstatement, design and perform procedures responsive to those risks, obtain an understanding of internal control relevant to the audit, evaluate the accounting policies used and the estimates made by the directors, conclude on the appropriateness of the going concern basis, and evaluate the overall presentation of the financial statements. We communicate with the directors regarding the planned scope and timing of the audit and significant audit findings.

*Report on other legal and regulatory requirements*

In accordance with the requirements of the Companies and Allied Matters Act 2020, we confirm that:

(i) we have obtained all the information and explanations which, to the best of our knowledge and belief, were necessary for the purpose of our audit;

(ii) in our opinion, proper books of account have been kept by the company, so far as appears from our examination of those books; and

(iii) the company’s statement of financial position and statement of profit or loss are in agreement with the books of account.

### Audit, qualified opinion: the sections that differ

*Qualified opinion*

We have audited the financial statements of Example Limited, which comprise the statement of financial position as at 31 December 2025, the statement of profit or loss, the statement of changes in equity and the statement of cash flows for the year then ended, and the notes to the financial statements, including a summary of significant accounting policies.

In our opinion, except for the effects of the matter described in the Basis for qualified opinion section of our report, the accompanying financial statements give a true and fair view of the financial position of Example Limited as at 31 December 2025, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011.

*Basis for qualified opinion*

[The partner’s description of the matter.]

We conducted our audit in accordance with International Standards on Auditing. Our responsibilities under those standards are described in the Auditor’s responsibilities section of our report. We are independent of the company in accordance with the ethical requirements relevant to our audit of the financial statements in Nigeria, and we have fulfilled our other ethical responsibilities in accordance with those requirements.

We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our qualified opinion.

### Audit, adverse opinion: the sections that differ

*Adverse opinion*

We have audited the financial statements of Example Limited, which comprise the statement of financial position as at 31 December 2025, the statement of profit or loss, the statement of changes in equity and the statement of cash flows for the year then ended, and the notes to the financial statements, including a summary of significant accounting policies.

In our opinion, because of the significance of the matter described in the Basis for adverse opinion section of our report, the accompanying financial statements do not give a true and fair view of the financial position of Example Limited as at 31 December 2025, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011.

*Basis for adverse opinion*

[The partner’s description of the matter.]

We conducted our audit in accordance with International Standards on Auditing. Our responsibilities under those standards are described in the Auditor’s responsibilities section of our report. We are independent of the company in accordance with the ethical requirements relevant to our audit of the financial statements in Nigeria, and we have fulfilled our other ethical responsibilities in accordance with those requirements.

We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our adverse opinion.

### Audit, disclaimer of opinion: the sections that differ

*Disclaimer of opinion*

We were engaged to audit the financial statements of Example Limited, which comprise the statement of financial position as at 31 December 2025, the statement of profit or loss, the statement of changes in equity and the statement of cash flows for the year then ended, and the notes to the financial statements, including a summary of significant accounting policies.

We do not express an opinion on the accompanying financial statements. Because of the significance of the matter described in the Basis for disclaimer of opinion section of our report, we have not been able to obtain sufficient appropriate audit evidence to provide a basis for an audit opinion.

*Basis for disclaimer of opinion*

[The partner’s description of the matter.]

*Auditor’s responsibilities for the audit of the financial statements*

Our responsibility is to conduct an audit of the company’s financial statements in accordance with International Standards on Auditing and to issue an auditor’s report. However, because of the matter described in the Basis for disclaimer of opinion section, we were not able to obtain sufficient appropriate audit evidence to provide a basis for an audit opinion.

We are independent of the company in accordance with the ethical requirements relevant to our audit of the financial statements in Nigeria, and we have fulfilled our other ethical responsibilities in accordance with those requirements.

### Audit of a group, unmodified opinion
**Independent auditor’s report**
To the members of Example Limited

*Opinion*

We have audited the consolidated and separate financial statements of Example Limited (the Company) and its subsidiaries (together, the Group), which comprise the consolidated and separate statements of financial position as at 31 December 2025, the consolidated and separate statements of profit or loss, the consolidated statement of changes in equity and the consolidated statement of cash flows, the separate statement of changes in equity and the separate statement of cash flows for the year then ended, and the notes to the consolidated and separate financial statements, including a summary of significant accounting policies.

In our opinion, the accompanying consolidated and separate financial statements give a true and fair view of the consolidated and separate financial position of the Group and the Company as at 31 December 2025, and their consolidated and separate financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011.

*Basis for opinion*

We conducted our audit in accordance with International Standards on Auditing. Our responsibilities under those standards are described in the Auditor’s responsibilities section of our report. We are independent of the Group and the Company in accordance with the ethical requirements relevant to our audit of the consolidated and separate financial statements in Nigeria, and we have fulfilled our other ethical responsibilities in accordance with those requirements.

We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.

*Other information*

The directors are responsible for the other information. The other information comprises the report of the directors, the statement of directors’ responsibilities, the statement of value added and the financial summary, which we obtained before the date of this report. It does not include the consolidated and separate financial statements and our auditor’s report on them.

Our opinion on the consolidated and separate financial statements does not cover the other information and we do not express any form of assurance conclusion on it.

In connection with our audit of the consolidated and separate financial statements, our responsibility is to read the other information and, in doing so, consider whether it is materially inconsistent with the consolidated and separate financial statements or our knowledge obtained in the audit, or otherwise appears to be materially misstated. If, based on the work we have performed, we conclude that there is a material misstatement of the other information, we are required to report that fact.

We have nothing to report in this regard.

*Responsibilities of the directors for the consolidated and separate financial statements*

The directors are responsible for the preparation of consolidated and separate financial statements that give a true and fair view in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011, and for such internal control as they determine is necessary to enable the preparation of consolidated and separate financial statements that are free from material misstatement, whether due to fraud or error.

In preparing the consolidated and separate financial statements, the directors are responsible for assessing the Group’s and the Company’s ability to continue as a going concern, disclosing matters related to going concern where applicable, and using the going concern basis of accounting unless they intend to liquidate the Group and the Company or to cease operations, or have no realistic alternative but to do so.

*Auditor’s responsibilities for the audit of the consolidated and separate financial statements*

Our objectives are to obtain reasonable assurance about whether the consolidated and separate financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor’s report that includes our opinion. Reasonable assurance is a high level of assurance, but it is not a guarantee that an audit conducted in accordance with International Standards on Auditing will always detect a material misstatement when it exists.

Misstatements can arise from fraud or error. They are considered material if, individually or in aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these consolidated and separate financial statements.

As part of an audit we exercise professional judgment and maintain professional scepticism throughout. We identify and assess the risks of material misstatement, design and perform procedures responsive to those risks, obtain an understanding of internal control relevant to the audit, evaluate the accounting policies used and the estimates made by the directors, conclude on the appropriateness of the going concern basis, and evaluate the overall presentation of the consolidated and separate financial statements. We communicate with the directors regarding the planned scope and timing of the audit and significant audit findings.

We plan and perform the group audit to obtain sufficient appropriate audit evidence regarding the financial information of the entities or business units within the Group, as a basis for forming an opinion on the consolidated financial statements. We are responsible for the direction, supervision and review of the audit work performed for the purposes of the group audit. We remain solely responsible for our audit opinion.

*Report on other legal and regulatory requirements*

In accordance with the requirements of the Companies and Allied Matters Act 2020, we confirm that:

(i) we have obtained all the information and explanations which, to the best of our knowledge and belief, were necessary for the purpose of our audit;

(ii) in our opinion, proper books of account have been kept by the Group and the Company, so far as appears from our examination of those books; and

(iii) the Group’s and the Company’s statement of financial position and statement of profit or loss are in agreement with the books of account.

### Audit, unmodified opinion, with every paragraph the partner can add
**Independent auditor’s report**
To the members of Example Limited

*Opinion*

We have audited the financial statements of Example Limited, which comprise the statement of financial position as at 31 December 2025, the statement of profit or loss, the statement of changes in equity and the statement of cash flows for the year then ended, and the notes to the financial statements, including a summary of significant accounting policies.

In our opinion, the accompanying financial statements give a true and fair view of the financial position of Example Limited as at 31 December 2025, and its financial performance and cash flows for the year then ended in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011.

*Basis for opinion*

We conducted our audit in accordance with International Standards on Auditing. Our responsibilities under those standards are described in the Auditor’s responsibilities section of our report. We are independent of the company in accordance with the ethical requirements relevant to our audit of the financial statements in Nigeria, and we have fulfilled our other ethical responsibilities in accordance with those requirements.

We believe that the audit evidence we have obtained is sufficient and appropriate to provide a basis for our opinion.

*Material uncertainty related to going concern*

[The partner’s paragraph on the material uncertainty.]

Our opinion is not modified in respect of this matter.

*Emphasis of matter*

[The partner’s emphasis of matter.]

Our opinion is not modified in respect of this matter.

*Other matter*

[The partner’s other matter.]

*Other information*

The directors are responsible for the other information. The other information comprises the report of the directors, the statement of directors’ responsibilities, the statement of value added and the financial summary, which we obtained before the date of this report. It does not include the financial statements and our auditor’s report on them.

Our opinion on the financial statements does not cover the other information and we do not express any form of assurance conclusion on it.

In connection with our audit of the financial statements, our responsibility is to read the other information and, in doing so, consider whether it is materially inconsistent with the financial statements or our knowledge obtained in the audit, or otherwise appears to be materially misstated. If, based on the work we have performed, we conclude that there is a material misstatement of the other information, we are required to report that fact.

[The partner’s description of a material misstatement of the other information.]

*Responsibilities of the directors for the financial statements*

The directors are responsible for the preparation of financial statements that give a true and fair view in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011, and for such internal control as they determine is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.

In preparing the financial statements, the directors are responsible for assessing the company’s ability to continue as a going concern, disclosing matters related to going concern where applicable, and using the going concern basis of accounting unless they intend to liquidate the company or to cease operations, or have no realistic alternative but to do so.

*Auditor’s responsibilities for the audit of the financial statements*

Our objectives are to obtain reasonable assurance about whether the financial statements as a whole are free from material misstatement, whether due to fraud or error, and to issue an auditor’s report that includes our opinion. Reasonable assurance is a high level of assurance, but it is not a guarantee that an audit conducted in accordance with International Standards on Auditing will always detect a material misstatement when it exists.

Misstatements can arise from fraud or error. They are considered material if, individually or in aggregate, they could reasonably be expected to influence the economic decisions of users taken on the basis of these financial statements.

As part of an audit we exercise professional judgment and maintain professional scepticism throughout. We identify and assess the risks of material misstatement, design and perform procedures responsive to those risks, obtain an understanding of internal control relevant to the audit, evaluate the accounting policies used and the estimates made by the directors, conclude on the appropriateness of the going concern basis, and evaluate the overall presentation of the financial statements. We communicate with the directors regarding the planned scope and timing of the audit and significant audit findings.

*Report on other legal and regulatory requirements*

In accordance with the requirements of the Companies and Allied Matters Act 2020, we confirm that:

(i) we have obtained all the information and explanations which, to the best of our knowledge and belief, were necessary for the purpose of our audit;

(ii) in our opinion, proper books of account have been kept by the company, so far as appears from our examination of those books; and

(iii) the company’s statement of financial position and statement of profit or loss are in agreement with the books of account.

### Review
**Independent practitioner’s review report**
To the members of Example Limited

We have reviewed the accompanying financial statements of Example Limited, which comprise the statement of financial position as at 31 December 2025, the statement of profit or loss, the statement of changes in equity and the statement of cash flows for the year then ended, and the notes to the financial statements, including a summary of significant accounting policies.

*Directors’ responsibility*

The directors are responsible for the preparation and fair presentation of these financial statements in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011, and for such internal control as they determine is necessary to enable the preparation of financial statements that are free from material misstatement, whether due to fraud or error.

*Practitioner’s responsibility*

Our responsibility is to express a conclusion on the financial statements. We conducted our review in accordance with International Standard on Review Engagements 2400 (Revised). That standard requires us to conclude whether anything has come to our attention that causes us to believe the statements are not prepared, in all material respects, in accordance with the framework, and to comply with relevant ethical requirements.

A review is a limited assurance engagement. It consists mainly of enquiries of management and others, and analytical procedures. The procedures are substantially less than those performed in an audit, and we do not express an audit opinion.

*Conclusion*

Based on our review, nothing has come to our attention that causes us to believe that these financial statements do not present fairly, in all material respects, the financial position of Example Limited as at 31 December 2025, and its financial performance and cash flows for the year then ended, in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011.

### Review, qualified conclusion: the sections that differ

*Basis for qualified conclusion*

[The practitioner’s description of the matter.]

*Qualified conclusion*

Based on our review, except for the effects of the matter described in the Basis for qualified conclusion paragraph, nothing has come to our attention that causes us to believe that these financial statements do not present fairly, in all material respects, the financial position of Example Limited as at 31 December 2025, and its financial performance and cash flows for the year then ended, in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011.

### Review, adverse conclusion: the sections that differ

*Basis for adverse conclusion*

[The practitioner’s description of the matter.]

*Adverse conclusion*

Based on our review, due to the significance of the matter described in the Basis for adverse conclusion paragraph, these financial statements do not present fairly, in all material respects, the financial position of Example Limited as at 31 December 2025, and its financial performance and cash flows for the year then ended, in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011.

### Review, disclaimer of conclusion: the sections that differ

*Basis for disclaimer of conclusion*

[The practitioner’s description of the matter.]

*Disclaimer of conclusion*

Due to the significance of the matter described in the Basis for disclaimer of conclusion paragraph, we were unable to obtain sufficient appropriate evidence to form a conclusion on the accompanying financial statements. Accordingly, we do not express a conclusion on these financial statements.

### Compilation
**Practitioner’s compilation report**
To the directors of Example Limited

We have compiled the accompanying financial statements of Example Limited from information the directors provided. They comprise the statement of financial position as at 31 December 2025, the statement of profit or loss, the statement of changes in equity and the statement of cash flows for the year then ended, and the notes to the financial statements, including a summary of significant accounting policies.

We performed this engagement in accordance with International Standard on Related Services 4410 (Revised), Compilation Engagements. We applied our expertise in accounting and financial reporting to assist the directors in preparing and presenting these statements, and we complied with relevant ethical requirements.

These financial statements and the accuracy and completeness of the information used to compile them are the responsibility of the directors.

A compilation is not an assurance engagement. We are not required to verify the accuracy or completeness of the information provided to us. Accordingly, we do not express an audit opinion or a review conclusion on whether these financial statements are prepared in accordance with the IFRS for SMEs Accounting Standard, the Companies and Allied Matters Act 2020 and the Financial Reporting Council of Nigeria Act 2011.

The partner writes the going concern, emphasis of matter and other matter paragraphs. The software supplies the heading and the closing sentence. The Other information section is always included in an audit report, except in a disclaimer of opinion. A material uncertainty section is left out of an adverse opinion.

Not produced by the software: key audit matters, and a qualified or adverse opinion on the grounds that a going concern uncertainty is not adequately disclosed, which the partner words in the basis paragraph. Decide whether that is acceptable for release.

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 9. Client request list

A starting list of what the firm asks a client for. The firm tailors it.

| Request | Detail |
| --- | --- |
| Bank statements | Every account, for the full year and the month after the year end, from the bank as PDF or Excel. |
| Bank reconciliations | For every account at the year end, with the list of outstanding items. |
| General ledger and trial balance | Exported from the accounting system for the full year, before closing entries. |
| Receivables listing | Aged, by customer, agreeing to the trial balance at the year end. |
| Payables listing | Aged, by supplier, agreeing to the trial balance, with supplier statements for the largest balances. |
| Inventory count sheets and valuation | The year-end count records and the costed listing. |
| Fixed asset register | With invoices for additions and details of any disposals in the year. |
| Payroll records | Monthly payroll summaries, PAYE and pension remittance evidence. |
| Tax returns and assessments | Company income tax, VAT and withholding tax filings for the year, with payment receipts and any assessments. |
| Loan and lease agreements | Signed agreements, repayment schedules and lender statements at the year end. |
| Minutes of board and members’ meetings | For the year and up to the date of approval of the accounts. |
| Statutory records | Certificate of incorporation, memorandum and articles, and the latest annual return filed at the Corporate Affairs Commission. |
| Related party details | A list of directors’ other businesses and any transactions with them in the year. |
| Prior year signed financial statements | With the prior auditor’s report and management letter, if any. |

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 10. Methods the software applies

### Journal testing

Every journal in the general ledger is scored against the indicators below, one point each. A journal with 3 or more must be tested and concluded on before sign-off. The ledger is also agreed to the trial balance account by account, to show the population is complete.

| Indicator | Shown to the user as |
| --- | --- |
| unbalanced | Does not balance |
| weekend | Posted on a weekend |
| period_end | Last five days of the year |
| outside_period | Dated outside the year |
| round | Round amount |
| large | At or above performance materiality |
| no_description | No description |
| keyword | Adjustment wording |
| revenue_pair | Revenue with no cash or receivable |
| duplicate | Duplicate of another journal |
| rare_account | Rarely used account |
| unknown_account | Account not in the trial balance |

### Bank reconciliation
Each line of a bank statement is matched to the entries on the ledger account it supports. The statement’s running balance is checked row by row for breaks. Items on the statement and not in the ledger must be adjusted or concluded on before sign-off.

### Materiality
Overall materiality is the chosen percentage of the chosen benchmark: revenue, profit before tax, total assets or equity. Performance materiality defaults to 75% of overall and the clearly trivial threshold to 5%. Unadjusted differences above overall materiality raise an advisory.

### Analytical review
Each statement line is compared with last year. A movement is significant when it is at least performance materiality, or 1% of revenue where materiality is not set, and at least 10%. Opening retained earnings is excluded. Ratios use year-end balances.

### Fixed asset schedule and tax reconciliation
Additions are derived: closing cost less opening cost plus disposals entered. The depreciation charge is derived the same way and must agree to the accounts tagged as depreciation. The tax reconciliation starts from profit before tax at a rate the preparer enters, and must be reconciled to the charge with named items.

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 11. Consolidation

Method: line-by-line addition; elimination of the investment against the subsidiary’s net assets at acquisition; goodwill as cost less the group’s share of those net assets, amortised as the preparer enters; non-controlling interests at their share of the subsidiary’s net assets; a bargain purchase taken to reserves; intercompany eliminations entered by the preparer on statement lines.

Subsidiaries bought or sold in a year are included for the days held. On a sale the parent’s gain is restated to the group’s using net assets on the day of sale. Associates and joint ventures are carried at cost or by the equity method. A foreign subsidiary is translated at the closing rate for assets and liabilities and the average rate for income and expenses, with the difference in other comprehensive income.

Simplifications and departures to accept or reject:

| Matter | What the software does | What the Standard expects |
| --- | --- | --- |
| Part-year results | Takes a share of the full year by days held. | The results actually earned in the period of control. |
| Unrealised profit | Borne wholly by the owners of the parent. | Shared with non-controlling interests where the subsidiary made the sale. |
| Subsidiary’s reserves since acquisition | Shown within group retained earnings. | Each reserve shown by its nature. |
| Goodwill on a foreign subsidiary | Kept at the naira amount at acquisition. | Treated as an asset of the foreign operation and retranslated at each closing rate. |
| Consolidated cash flow | Left out, with the reason, in a year a subsidiary is bought or sold, or where one is foreign. | Required in every case. |
| Change in holding without loss of control, step acquisitions | Not supported. | Specific treatments apply. |

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 12. AI assistance

Off for every firm until a partner turns it on. The AI suggests and a person decides. It never selects an opinion, concludes on a test or signs. Its output is labelled, set apart and not saved as the firm’s work. Each request is logged with who made it and when.

| Feature | What is sent | What comes back | Guard |
| --- | --- | --- | --- |
| Mapping suggestions | Account codes, names and balances. | A statement line, confidence and reason for each account. | Only existing lines are accepted. The accountant accepts each one. |
| Journal explanation | One journal: date, description, poster, accounts, amounts. | What it appears to do, why it was flagged, ways to test it. | Told not to say the journal is acceptable. Not saved to the file. |
| Questions on a movement | Statement lines and ratios for both years. | Causes to consider, questions, corroboration. | Told never to state a cause as fact. Not saved to the file. |
| Policy draft | The starter policy and the account names on that line. | Redrafted wording with placeholders for unknown facts. | Cannot be confirmed while a placeholder remains. |

Client and firm names are not sent. A journal description can still name a person or a company.

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## 13. Quality management starter content

Version 0.1-starter. Example quality risks and responses a firm can load and tailor. ISQM 1 requires each firm to identify its own. Review that none is misleading as an example.

| Component | Risk | What could go wrong | Example response |
| --- | --- | --- | --- |
| Governance and leadership | Commercial pressure outweighs quality | Fee targets or client relationships lead partners to accept shortcuts. | Partner appraisal weighs quality results ahead of fees. Quality is a standing item at partner meetings. |
| Governance and leadership | Responsibility for quality is unclear | No named person is accountable for the system or for parts of it. | The managing partner holds ultimate responsibility. Operational responsibility for each component is assigned by name and recorded here. |
| Relevant ethical requirements | Threats to independence are not identified | A team member holds an interest in, or has a relationship with, a client and it is not known. | Annual independence declarations from all staff. A confirmation from each team member on every engagement, recorded in the file before sign-off. |
| Relevant ethical requirements | Long association with a client | The same partner signs for many years and familiarity weakens scepticism. | Years of service by partner are tracked for each client. Rotation or a safeguard is considered after an agreed number of years. |
| Relevant ethical requirements | Non-audit services impair independence | The firm prepares the accounts or gives tax advice to a client it also audits. | Each non-audit service is approved by the engagement partner with the threats and safeguards documented. |
| Acceptance and continuance | A client is accepted without understanding its integrity | The firm takes on a client whose owners or business expose it to undue risk. | Acceptance checks on owners and directors, with partner approval, before an engagement letter is issued. |
| Acceptance and continuance | The firm lacks the competence or time for an engagement | Work is accepted in a sector or of a size the firm cannot properly staff. | Acceptance and continuance record the skills, time and any specialist needed, and who will provide them. |
| Acceptance and continuance | A public interest entity is audited under the wrong methodology | A listed or regulated entity is taken through a file designed for smaller companies. | Every engagement confirms the entity is not a public interest entity before it is opened. |
| Engagement performance | Work is not reviewed before the report is signed | The partner signs without evidence of supervision and review. | The file cannot be signed until every programme step is complete and the partner has confirmed their review. |
| Engagement performance | Difficult or contentious matters are not consulted on | A judgement is taken by one person without challenge. | A consultation policy names the matters that must be discussed with a second partner or an external reviewer, and how the conclusion is recorded. |
| Engagement performance | Files are changed after the report date | Documentation is added or altered once the report is issued. | Files lock at signing and cannot be changed. Every change before then is recorded in the audit trail. |
| Resources | Staff lack current technical knowledge | Changes in standards, tax or company law are missed. | A training plan each year, with attendance recorded. Institute continuing education requirements are tracked. |
| Resources | Technology or methodology content is out of date | Programmes, checklists or report wording no longer reflect the standards in force. | Content is versioned and reviewed when standards change. Starter content is replaced by reviewed content before use. |
| Information and communication | Quality matters are not communicated to staff | Findings and changes to policy do not reach the people doing the work. | The register and findings are visible to all staff. Changes are briefed at staff meetings and recorded. |
| Monitoring and remediation | Completed engagements are not inspected | No one looks back at finished files, so repeated weaknesses go unseen. | At least one completed file for each partner is inspected on a cycle, by someone not involved in it. Findings are logged here with a root cause and an action. |
| Monitoring and remediation | Deficiencies are identified but not fixed | Actions are agreed and then left. | Each finding has an owner and a due date. Overdue actions are reviewed by the managing partner each quarter. |

The three conclusions offered for the yearly evaluation:

| Conclusion | Wording |
| --- | --- |
| effective | The system gives reasonable assurance that its objectives are being achieved. |
| effective_except | Except for the deficiencies identified, which are severe but not pervasive, the system gives reasonable assurance that its objectives are being achieved. |
| not_effective | The system does not give reasonable assurance that its objectives are being achieved. |

Reviewer: ______________________  Date: ____________  Accepted / Accepted with changes / Rejected

## Overall release decision

Reviewer: ______________________  Qualification and membership number: ______________________  Date: ____________

Released for use by firms / Released with the changes marked / Not released
