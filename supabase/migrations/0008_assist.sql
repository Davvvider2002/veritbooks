-- VeritBooks: AI assistance. Off for every firm until a partner turns it on.
-- Run once, after 0007. It only adds a column and a table.

alter table public.firms add column ai_enabled boolean not null default false;

-- One row for every request sent to the AI service: who asked, for what, and how much was sent.
-- The content itself is not kept here. Rows are written by the assist function, never by the browser.
create table public.ai_requests (
  id bigint generated always as identity primary key,
  firm_id uuid not null references public.firms (id) on delete cascade,
  engagement_id uuid references public.engagements (id) on delete set null,
  user_id uuid references auth.users (id),
  task text not null,
  model text not null default '',
  input_chars integer not null default 0,
  output_chars integer not null default 0,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index ai_requests_firm_idx on public.ai_requests (firm_id, created_at);

alter table public.ai_requests enable row level security;
create policy ai_requests_select on public.ai_requests for select to authenticated
  using (private.is_member(firm_id));
revoke all on public.ai_requests from anon, authenticated;
grant select on public.ai_requests to authenticated;
