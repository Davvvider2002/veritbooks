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

Every account is mapped to one of 29 lines. The statements are built from these lines only. Review whether the set is enough for the entities in scope, and whether any line is missing, such as investment property, biological assets, government grants, and employee benefit obligations.

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
| borrowings_nc | Borrowings | Non-current liabilities |
| deferred_tax_liability | Deferred tax liability | Non-current liabilities |
| provisions | Provisions | Non-current liabilities |
| trade_payables | Trade payables | Current liabilities |
| other_payables | Other payables and accruals | Current liabilities |
| borrowings_c | Borrowings and bank overdrafts | Current liabilities |
| current_tax_payable | Current tax payable | Current liabilities |
| revenue | Revenue | Income |
| other_income | Other income | Income |
| finance_income | Finance income | Income |
| cost_of_sales | Cost of sales | Expenses |
| distribution_costs | Selling and distribution costs | Expenses |
| admin_expenses | Administrative expenses | Expenses |
| other_expenses | Other operating expenses | Expenses |
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

Version 0.1-starter. A pack adds to the general content. It never removes anything.

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
| Import documentation | For significant imports: Form M, bills of lading, customs duty assessments and clearing agents’ invoices. |
| Inventories held elsewhere | A list of goods held by third parties, on consignment or in transit at the year end, with confirmations. |

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
