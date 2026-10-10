# VeritBooks: platform definition

Version 0.6, 10 October 2026.

## What it is

VeritBooks is an engagement file for Nigerian accounting firms. A firm imports a client's trial balance, maps the accounts, plans and documents the work, and the software drafts the financial statements and the practitioner's report. An engagement partner registered with the Financial Reporting Council of Nigeria (FRC) signs, and the file locks.

## What it is not

VeritBooks does not issue an audit opinion. The opinion is the engagement partner's judgment, based on evidence that goes beyond a trial balance and bank statements. The software selects nothing on the partner's behalf, marks every output as a draft until it is signed, and refuses to sign unless the signer is a partner with an FRC number.

## Who uses it

| Role | Can do |
| --- | --- |
| Partner | Everything staff can do, plus change firm details, select the opinion, delete an unsigned engagement, and sign. |
| Manager | Prepare and review. Same data rights as staff in this version. |
| Staff | Create clients and engagements, import, map, plan, complete programme steps, post journals. |

One user belongs to one firm. A firm sees only its own data. Partners invite colleagues and set their roles.

## Scope of phase 1 (built)

| Area | Behaviour |
| --- | --- |
| Entity | Private companies that are not public interest entities, reporting under the IFRS for SMEs Accounting Standard. One sector template: general trading and services. |
| Engagement types | Audit, review, compilation. |
| Import | Trial balance from CSV or Excel (.xlsx), with Debit and Credit columns or one Balance column. Title rows, heading rows and total rows are skipped. Current and prior year. |
| Validation | Trial balance foots in both years. Every account mapped. Trial balance is before closing entries. Opening retained earnings agree to the prior year closing figure. |
| Mapping | Each account maps to one of 29 statement lines. Suggestions come from account names. Confirmed mappings are remembered per client and reused next year. Expense accounts carry a nature tag: staff, depreciation or bought-in. |
| Planning | Materiality from a chosen benchmark and percentage, performance materiality, clearly trivial threshold, written rationale. Audit and review only. |
| Work programme | Checklist per engagement type, held as versioned content. Each step records who completed it, when, and a working paper reference. |
| Journals | Balanced adjusting journals. Posted journals flow into the statements. Proposed journals are totalled as unadjusted differences and compared with materiality. |
| Statements | Statement of financial position, statement of profit or loss and other comprehensive income, statement of changes in equity, statement of cash flows (indirect method), notes with a breakdown per line, statement of value added, two-year financial summary. Print or save as PDF. |
| Report | Draft auditor's report (unmodified, qualified, adverse, disclaimer), review report or compilation report. |
| Sign-off | A gate list blocks signing until it is clear. Signing stamps the partner's name and FRC number and the firm's FRC number, and locks the file. |
| Audit trail | Every change to an engagement, its trial balance and its journals, written by database triggers. |

## Disclosures and directors' pages

These need `supabase/migrations/0004_disclosures.sql`.

| Area | Behaviour |
| --- | --- |
| Disclosures step | The preparer enters what the trial balance cannot supply: directors, secretary, registered office, directors' remuneration, employee numbers, fixed asset disposals, the tax rate and reconciling items, related parties, earlier years, and notes on going concern, events after the reporting date, contingent liabilities and commitments. |
| Fixed asset schedule | One row per ledger account, cost and accumulated depreciation. Opening and closing come from the two trial balances. Additions and the charge are what explains the movement after disposals. The charge must agree to depreciation in profit or loss. |
| Tax reconciliation | Profit before tax at the rate the preparer enters, plus reconciling items, to the charge. No rate is assumed. The effective rate is shown. |
| Statements | Report of the directors, statement of directors' responsibilities, prior year statement of changes in equity, the fixed asset schedule, the tax reconciliation, notes on employees and directors, related parties, contingencies and commitments, events after the reporting date and going concern, and a five-year financial summary. |
| Gate | Sign-off is blocked while any disclosure item is open. Nothing prints as a confirmed "none" unless the preparer has confirmed it. |

## Scope of phase 2 (built so far)

Both features apply to audit engagements. They need `supabase/migrations/0002_ledger_and_bank.sql`.

| Area | Behaviour |
| --- | --- |
| General ledger import | CSV or Excel, with a date, an account code and Debit and Credit or one Amount column. Journal number, description and posted-by columns are used when present. Dates are read day first. |
| Completeness | The ledger's movement on every account is agreed to the trial balance. Income and expense accounts are agreed to the balance, balance sheet accounts to the movement from the prior year. A ledger that does not agree is reported as a possibly incomplete journal population. |
| Journal testing | Every journal is tested, not a sample. Indicators: does not balance, posted on a weekend, last five days of the year, dated outside the year, round amount (N1 million and up, in whole N100,000s), at or above performance materiality, no description, adjustment wording, revenue credited with no cash or receivable debit, duplicate of another journal, rarely used account (two postings or fewer), account not in the trial balance. |
| High-risk journals | A journal with three or more indicators must be opened, tested and concluded on (no exception, or exception) with the work recorded. Any other journal can be selected and concluded on. |
| Bank statement import | PDF, Excel or CSV, with a date and Debit and Credit (or Withdrawal and Deposit) columns, or one signed Amount column. One statement per bank account, linked to a cash account in the trial balance. |
| PDF statements | The bank's electronic PDF is read in the browser and never uploaded. The table is rebuilt from the position of the text under one line of column headings, so no bank-specific template is needed. Wrapped narrations are rejoined. Password-protected statements prompt for the password. The running balance check then confirms every amount was read correctly. Scanned statements are refused. |
| Statement integrity | The running balance is recomputed row by row. A break is reported as possible missing pages or an altered statement. |
| Reconciliation | Statement lines are matched one to one to ledger postings on the cash account, on exact amount, from 3 days before to 10 days after the ledger date. The result is a reconciliation at the year end: lodgements not yet credited, payments not yet presented, statement items not in the ledger, and any unexplained difference. Where the statement runs past the year end, outstanding items show the date they cleared. |
| Unbooked items | Audit journals posted to the cash account are set against statement items the client had not booked. |
| Sign-off gates | Blocking: every high-risk journal concluded, and every bank account either reconciled or carrying a written conclusion. Advisory: ledger agrees to the trial balance, journals concluded as exceptions, breaks in a running balance, no ledger or no statement imported. |

### Imports from accounting packages

| Area | Behaviour |
| --- | --- |
| Export guides | The import screens ask where the client keeps its books and show the export steps for Sage 50, QuickBooks Desktop, Tally, QuickBooks Online, Zoho Books, Xero, or Excel. |
| Package layouts | The parsers read the files as exported, without tidying: title rows above the header, an account printed once above its transactions, a transaction whose date and number appear only on its first line, opening and closing balance rows, subtotal and total rows, and accounts printed as "1000 · Bank". |
| Account matching | Ledger postings are matched to the trial balance by account number, and by name where the package prints no number, including "Parent:Child" sub-accounts. Accounts that cannot be matched are listed before import. |
| Date order | Numeric dates are read day first or month first, worked out from the file where it allows and chosen by the user where it does not. Rows whose dates cannot be read are counted and reported. |

### Team and evidence

These need `supabase/migrations/0003_team_and_evidence.sql`.

| Area | Behaviour |
| --- | --- |
| Invitations | A partner invites a colleague by email and role. No email is sent. The colleague creates an account with that address, confirms it, and is offered a place in the firm. An unconfirmed address cannot claim an invitation. |
| Team management | Partners change roles and remove members. A firm always keeps at least one partner. Every member can keep their own name and FRC number up to date. |
| Evidence files | Any file up to 25 MB, attached to the engagement and linked to a work programme step, a high-risk journal, a bank account, an adjusting journal, or the file in general. Counts show beside the item each file supports. |
| Evidence security | Files sit in a private storage bucket, readable only by members of the engagement's firm. Once the engagement is signed, files cannot be added or removed. Every upload and removal is in the audit trail. |

Not yet built from phase 2: accounting system connections.

### Client requests and upload links

These need `supabase/migrations/0005_client_requests.sql`.

- A list of what the firm needs from the client, per engagement, with a due date and a status: waiting, received, accepted, returned. A starter list of 14 standard requests can be added in one click and then tailored.
- An upload link per named person at the client. The client needs no account. The link shows the request list and the names of files already sent, and accepts files against each item. It cannot open, download or remove anything.
- The link carries a 256-bit random token. Only its SHA-256 hash is stored, so the link is shown once and cannot be recovered. Links expire in 7, 14 or 30 days, can be withdrawn, and stop accepting files when the engagement is signed.
- Client files land in Evidence against the request, marked as from the client and with the name on the link. The firm accepts each item or returns it with a reason, which the client sees.
- Sign-off shows an advisory while any request is not accepted. It does not block signing: the partner judges whether the evidence is sufficient.
- Limits: 25 MB a file, 300 client files per engagement. Files are not scanned for malware. Treat them as you would an email attachment.

### From a figure to its source

The prior year ledger, files against an account and page references need `supabase/migrations/0006_prior_ledger_and_pages.sql`. Everything else works without it.

- Every underlined figure in the financial statements opens to show what it is made of. This covers the statement of financial position, profit or loss, changes in equity for both years, cash flows, value added, the notes, the property, plant and equipment schedule and the tax reconciliation.
- A figure made of other figures opens to them: a subtotal to its lines, a cash flow movement to the closing and opening balances, profit to revenue and each cost. Each of those opens in turn, down to the accounts.
- At the accounts: the trial balance figure, the audit journals posted, and the amount carried in the statements. Each account opens to its audit journals, the bank statement and whether it reconciles, the client's ledger entries (by date or largest first), whether the ledger agrees to the trial balance, the test result on any high-risk journal, and the files attached.
- Last year's ledger can be imported on the Journal testing step. A comparative figure then opens to its entries too. It is held for reference only: it is not risk tested and plays no part in sign-off. Income and expense accounts are agreed to last year's trial balance. Balance sheet accounts cannot be, because their opening balances are not held.
- A file can be attached to an account in the trial balance, from the figure itself. Any file can carry a page number. A PDF with a page opens in the browser at that page. Other file types keep the page as a reference and download as before.
- Every part adds up to the figure above it, in both years, because the trail is computed from the same inputs as the statements. Tests check this for every figure that opens.
- Not traced: the five-year financial summary's earlier years, which are typed in, and the movement columns of the property schedule. Bank statement lines do not carry the page of the PDF they were read from.

## Phase 3 (in progress)

### Disclosure checklist

No database update is needed. Answers are kept with the engagement's disclosures.

- A checklist of what the financial statements must disclose under the IFRS for SMEs, grouped by section of the Standard. It holds 49 items in this version.
- It is tailored to the entity. An item tied to a statement line appears only when that line has a balance in either year, so a company with no intangible assets is not asked about them.
- Items the file itself shows are marked as covered, with the basis: comparatives, the fixed asset reconciliation, the tax reconciliation, related parties, going concern and others. The preparer is not asked to tick what the software can see.
- The preparer answers the rest: disclosed, with where; or does not apply, with a reason. A reason is required. Each answer records who gave it and when.
- Sign-off is blocked while any item has no answer.
- The checklist is starter content, version 0.1. It summarises disclosure areas in plain language. It is not the text of the Standard and is not complete. Section numbers follow the second edition (2015). It needs review against the edition in force, FRC Nigeria rules and CAMA 2020 by a qualified technical author.

### Industry packs

No database update is needed. The choice is kept with the engagement's planning.

- A pack adds to the general content for one kind of business: work programme steps, disclosure checklist items and client requests. It never removes anything. It is chosen on the Work programme step and can be changed at any time without losing answers.
- First pack: trading and manufacturing. It adds 11 audit steps or 4 review steps on inventories and production, 4 checklist items on inventories, and 6 client requests. A compilation gets no extra steps, because no assurance work is done.
- Pack steps count towards sign-off like any other step.
- Pack content is starter material, version 0.1, and needs the same technical review as the rest.
- Not in a pack yet: sector-specific statement lines and mapping, and sector regulators' reporting rules.

### Firm-level quality management

Needs `supabase/migrations/0007_quality_management.sql`. Independence confirmations need no update.

- A Quality page for the firm, built around ISQM 1. Everyone in the firm can read it. Partners maintain it.
- Quality risks and responses, by component: governance and leadership, relevant ethical requirements, acceptance and continuance, engagement performance, resources, information and communication, monitoring and remediation. Each has an owner, a review date and a status. A response cannot be marked as in place until it is written down.
- A starter set of 16 risks with example responses can be added in one click and tailored.
- Monitoring findings and remediation: what was found, its root cause, severity, the action, an owner and a due date. Overdue actions are flagged. A finding is closed when the action is done. It cannot be removed.
- The yearly evaluation by the partner with ultimate responsibility: one of the three conclusions in the standard, with a basis. The partner chooses the conclusion; the software does not. The name is taken from the firm's records. A recorded evaluation cannot be changed or removed. The page shows when the next one is due.
- An engagement monitor: programme progress, independence confirmations and status for every engagement.
- Independence on each engagement: every team member confirms they are independent of the client, with any threats and safeguards. The person signing cannot sign without confirming. Anyone who completed work without confirming is listed as an advisory.
- Changes to the register and evaluations are written to the audit log against the firm.
- This records a firm's system. It does not design one, and it is not evidence that a system operates. The starter risks are examples, version 0.1.
- Not built: engagement quality reviews by a second partner, annual staff declarations, training and CPD records, client acceptance forms, file inspection programmes.

### Consolidations

No database update is needed. The group is kept with the parent engagement's planning.

- A Consolidation step on the parent's engagement. Each subsidiary has its own engagement in the same firm, with its own trial balance, mapping and audit journals. The parent's file reads the subsidiary's figures live, so a change in the subsidiary flows through.
- For each subsidiary the preparer enters the percentage held, the cost of the investment, the subsidiary's net assets at acquisition, and goodwill amortised to date and in each year.
- The engine adds the statements line by line, removes the investment, recognises goodwill and its amortisation, measures non-controlling interests at their share of net assets, and takes a bargain purchase to reserves.
- Intercompany eliminations are entered on statement lines, per year, and must balance.
- Output: a working that shows each company, the adjustments and the group side by side; the consolidated statement of financial position; and the consolidated statement of profit or loss, with profit split between owners and non-controlling interests. Comparatives appear when every company holds a prior year.
- Sign-off is blocked if the consolidation does not balance or an elimination is one-sided. A subsidiary whose own file is not yet signed is an advisory.
- Sample files: `group-parent-2025.csv`, `group-subsidiary-2025.csv` and their 2024 pairs in `public/samples`.
- Assumptions: every subsidiary is held for the whole of both years at the same percentage, with the same year end. Unrealised profit is borne wholly by the owners of the parent. Subsidiaries' reserves since acquisition are shown within group retained earnings.
- Not built: consolidated cash flow, changes in equity and notes; group audit report wording; acquisitions and disposals during the year; associates and joint ventures; foreign subsidiaries; sub-groups.

Also fixed: dividends received were mapped as dividends paid. They now map to other income.

## Rules the software enforces

1. Numbers are computed, never generated. Every figure in a statement is a sum of mapped account balances. No language model produces or alters a figure.
2. Amounts are stored as whole kobo, so there is no rounding drift.
3. The statement of financial position must balance and the cash flow must reconcile to the movement in cash, or the difference is shown on the face of the draft.
4. Only a partner with an FRC number, in a firm with an FRC number, can sign. The database enforces this, not only the screen.
5. A signed file cannot be edited or deleted by anyone, including the partner who signed it.
6. Users cannot write to or delete from the audit trail.

## Nigerian content

| Requirement | Where it appears |
| --- | --- |
| FRC registration numbers for the firm, the partner, the chief executive and the chief financial officer | Captured at firm and engagement level, printed on the statements and the report, required for sign-off. |
| Statement of value added and financial summary | Generated from the mapped balances. |
| Companies and Allied Matters Act 2020 | Referenced in the basis of preparation and in the report on other legal requirements. |
| Framework selection | Public interest entities are turned away at engagement creation, because they need full IFRS. |

## Content status

The work programmes, accounting policy wording and report wording are starter content, version 0.1. They exist to make the software work end to end. They are not a methodology and have not been reviewed by a qualified technical author. They must be replaced or reviewed before any live engagement. Content lives in `src/content` and `src/engine/report.ts`, separate from the calculation code, so a standards change is a content release.

## Known gaps in phase 1

- Disclosures not produced: deferred tax workings, a detailed directors' interests table, financial instruments and leases notes, and segment or industry-specific notes. The prior year statement of changes in equity assumes share capital and other reserves did not move in that year. The tax reconciliation and notes carry no prior year comparatives.
- Cash flow: purchases and disposals of assets are shown net, and interest and tax paid are derived from balance movements.
- Team: invitations are not emailed. Managers and staff have the same data rights; only the partner role is distinct.
- Sign-off gates: partner role, FRC numbers, a footing and fully mapped trial balance and balanced journals are enforced in the database. Materiality, programme completion, opinion selection, journal conclusions and bank reconciliation are enforced in the application only.
- Journal testing uses fixed rules. The thresholds are not yet configurable per firm, and Nigerian public holidays are not flagged.
- Package imports: the Sage 50, QuickBooks Desktop and Tally layouts were tested on files modelled on each package's exports, not on real exports. Tally has had the least testing. No direct connection to any accounting system exists yet.
- PDF statements: the reader was built and tested on a statement drawn to resemble a Nigerian bank e-statement, and on a second synthetic layout, not on real statements from each bank. Column headings split over two lines, and statements with no balance column, are the likeliest to need work. Scans are not read.
- Bank matching is on exact amount only. One ledger posting covering several bank lines, or the reverse, is left unmatched for the auditor.
- Trial balance import is not a single database transaction.
- Evidence files are not scanned for viruses and are not previewed in the app.

## Roadmap

| Phase | Scope |
| --- | --- |
| 2, remaining | Accounting system connections (on hold). |
| 3 | Full IFRS template. Industry packs. Consolidations. Firm-level quality management. |
| 4 | AI assistance for risk suggestions, disclosure review and expense testing, inside the file and under partner review. |

## Architecture

| Layer | Choice |
| --- | --- |
| Front end | React and TypeScript, built with Vite, hosted on Netlify. |
| Engine | Pure TypeScript in `src/engine`, with no dependency on the screen or the database. Covered by unit tests. |
| Database and sign-in | Supabase (Postgres). Row level security on every table. Sign-off and firm creation run as database functions. |
| Source control | GitHub. Netlify builds from the main branch. |

### Data model

| Table | Holds |
| --- | --- |
| `firms` | Name, FRC number, address. |
| `firm_members` | User, role, full name, FRC number. |
| `clients` | Company name, RC number, sector. |
| `client_account_maps` | Remembered mapping per client and account code. |
| `engagements` | Type, year end, status, planning, programme state, report settings, signature. |
| `tb_lines` | Account code and name, current and prior balance, mapping, nature. |
| `adjustments` | Journal reference, description, posted flag, lines. |
| `gl_entries` | The client's general ledger: journal number, date, account, description, amount, posted by. |
| `bank_accounts` | One row per statement: name, ledger account, opening and year-end balance, balance breaks. |
| `bank_lines` | Statement transactions: date, narration, amount, running balance. |
| `firm_invites` | Email, role, and whether the invitation was accepted. |
| `evidence` | One row per attached file: name, size, what it supports, who added it. The file is in the `evidence` storage bucket. |
| `audit_log` | Who changed what, and when. |
