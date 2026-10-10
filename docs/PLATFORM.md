# VeritBooks: platform definition

Version 0.2, 10 October 2026.

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

One user belongs to one firm. A firm sees only its own data.

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

## Scope of phase 2 (built so far)

Both features apply to audit engagements. They need `supabase/migrations/0002_ledger_and_bank.sql`.

| Area | Behaviour |
| --- | --- |
| General ledger import | CSV or Excel, with a date, an account code and Debit and Credit or one Amount column. Journal number, description and posted-by columns are used when present. Dates are read day first. |
| Completeness | The ledger's movement on every account is agreed to the trial balance. Income and expense accounts are agreed to the balance, balance sheet accounts to the movement from the prior year. A ledger that does not agree is reported as a possibly incomplete journal population. |
| Journal testing | Every journal is tested, not a sample. Indicators: does not balance, posted on a weekend, last five days of the year, dated outside the year, round amount (N1 million and up, in whole N100,000s), at or above performance materiality, no description, adjustment wording, revenue credited with no cash or receivable debit, duplicate of another journal, rarely used account (two postings or fewer), account not in the trial balance. |
| High-risk journals | A journal with three or more indicators must be opened, tested and concluded on (no exception, or exception) with the work recorded. Any other journal can be selected and concluded on. |
| Bank statement import | CSV or Excel, with a date and Debit and Credit (or Withdrawal and Deposit) columns, or one signed Amount column. One statement per bank account, linked to a cash account in the trial balance. |
| Statement integrity | The running balance is recomputed row by row. A break is reported as possible missing pages or an altered statement. |
| Reconciliation | Statement lines are matched one to one to ledger postings on the cash account, on exact amount, from 3 days before to 10 days after the ledger date. The result is a reconciliation at the year end: lodgements not yet credited, payments not yet presented, statement items not in the ledger, and any unexplained difference. Where the statement runs past the year end, outstanding items show the date they cleared. |
| Unbooked items | Audit journals posted to the cash account are set against statement items the client had not booked. |
| Sign-off gates | Blocking: every high-risk journal concluded, and every bank account either reconciled or carrying a written conclusion. Advisory: ledger agrees to the trial balance, journals concluded as exceptions, breaks in a running balance, no ledger or no statement imported. |

Not yet built from phase 2: PDF bank statements, evidence upload with links from figures to source pages, accounting system connections, team invitations.

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

- Disclosures not produced: property, plant and equipment movement schedule, tax reconciliation, related party and directors' disclosures, comparatives for the statement of changes in equity, years three to five of the financial summary.
- Cash flow: purchases and disposals of assets are shown net, and interest and tax paid are derived from balance movements.
- Team: no invitations yet. A firm has the partner who created it.
- Sign-off gates: partner role, FRC numbers, a footing and fully mapped trial balance and balanced journals are enforced in the database. Materiality, programme completion, opinion selection, journal conclusions and bank reconciliation are enforced in the application only.
- Journal testing uses fixed rules. The thresholds are not yet configurable per firm, and Nigerian public holidays are not flagged.
- Bank matching is on exact amount only. One ledger posting covering several bank lines, or the reverse, is left unmatched for the auditor.
- Trial balance import is not a single database transaction.
- No working paper file uploads.

## Roadmap

| Phase | Scope |
| --- | --- |
| 2, remaining | PDF bank statements. Evidence upload with links from figures to source pages. Accounting system connections. Team invitations. |
| 3 | Full IFRS template. Industry packs. Consolidations. Client request portal. Firm-level quality management. |
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
| `audit_log` | Who changed what, and when. |
