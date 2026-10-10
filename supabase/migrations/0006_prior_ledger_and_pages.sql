-- VeritBooks: the prior year's general ledger, and evidence that points at an account and a page.
-- Run once, after 0005.

-- Each ledger line belongs to the year under audit or to the year before it.
-- Only the current year is tested and reconciled. The prior year is held so a
-- comparative figure can be followed to its entries.
alter table public.gl_entries add column period text not null default 'current' check (period in ('current', 'prior'));
drop index public.gl_entries_engagement_idx;
create index gl_entries_engagement_idx on public.gl_entries (engagement_id, period, row_no);

-- A file can support one account in the trial balance, and can point at the page that matters.
alter table public.evidence add column page integer check (page is null or page between 1 and 100000);
alter table public.evidence drop constraint evidence_ref_type_check;
alter table public.evidence add constraint evidence_ref_type_check
  check (ref_type in ('general', 'programme', 'journal', 'bank', 'adjustment', 'request', 'account'));
