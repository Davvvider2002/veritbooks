// Runs the migration against an in-process Postgres (PGlite) with a stand-in for Supabase's
// auth schema, then checks the security rules. Run with: node scripts/test-db.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text);
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, created_at timestamptz default now(), last_sign_in_at timestamptz);
  -- Stand-in for Supabase Storage: enough to run the bucket row and the object policies.
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated, anon;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select, insert on storage.objects to anon;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select jsonb_build_object('aal', coalesce(nullif(current_setting('request.jwt.aal', true), ''), 'aal1')) $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`);
await db.exec(readFileSync('supabase/migrations/0001_init.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0002_ledger_and_bank.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0003_team_and_evidence.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0004_disclosures.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0005_client_requests.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0006_prior_ledger_and_pages.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0007_quality_management.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0008_assist.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0009_billing.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0010_admin_and_pay_per.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0011_vat.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0012_public_prices.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0013_branding_and_file_numbers.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0014_admin_two_factor.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0015_two_factor_for_firms.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0016_west_africa.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0017_three_years.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0018_south_africa.sql', 'utf8'));
// The checks written before VAT run at a zero rate. VAT has its own checks at the end.
await db.exec(`update platform_settings set vat_percent = 0; update countries set vat_percent = 0`);

const A = '00000000-0000-0000-0000-00000000000a'; // partner, firm 1
const B = '00000000-0000-0000-0000-00000000000b'; // partner, firm 2
const C = '00000000-0000-0000-0000-00000000000c'; // staff, firm 1
const D = '00000000-0000-0000-0000-00000000000d'; // invited manager, firm 1
const E = '00000000-0000-0000-0000-00000000000e'; // signed up with the invited address but never confirmed it
const F = '00000000-0000-0000-0000-00000000000f'; // an outsider
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values
  ('${A}', 'ada@firm1.ng', now()), ('${B}', 'bola@firm2.ng', now()), ('${C}', 'chidi@firm1.ng', now()),
  ('${D}', 'Dayo@Firm1.ng', now()), ('${E}', 'emeka@firm1.ng', null), ('${F}', 'femi@else.ng', now())`);

let failed = 0;
const as = async (uid, sql, params = []) =>
  db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.sub', '${uid}', true);`);
    return (await tx.query(sql, params)).rows;
  });
// A session that has passed the second factor.
const as2 = async (uid, sql, params = []) =>
  db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.sub', '${uid}', true); select set_config('request.jwt.aal', 'aal2', true);`);
    return (await tx.query(sql, params)).rows;
  });
const ok = (name, cond) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const denied = async (name, fn, match) => {
  try { const r = await fn(); ok(name + ' (expected refusal, got ' + JSON.stringify(r).slice(0, 80) + ')', false); }
  catch (e) { ok(name, match ? match.test(e.message) : true); if (match && !match.test(e.message)) console.log('      ', e.message); }
};

const [f1] = await as(A, `select * from create_firm('Firm One', 'FRC/F/1', 'Lagos', 'Ada Partner', 'FRC/P/1')`);
const [f2] = await as(B, `select * from create_firm('Firm Two', 'FRC/F/2', 'Abuja', 'Bola Partner', '')`);
// The older checks below run on paid firms. The trial and its limits are checked at the end.
await db.exec(`update firms set plan = 'firm', paid_until = now() + interval '1 year'`);
await db.exec(`insert into firm_members (firm_id, user_id, role, full_name) values ('${f1.id}', '${C}', 'staff', 'Chidi Staff')`);
await denied('a user cannot create a second firm', () => as(A, `select create_firm('X','','','','')`), /already belong/);

const [c1] = await as(A, `insert into clients (firm_id, name) values ($1, 'Adunni Foods Limited') returning *`, [f1.id]);
const [e1] = await as(C, `insert into engagements (firm_id, client_id, type, year_end) values ($1, $2, 'audit', '2025-12-31') returning *`, [f1.id, c1.id]);
ok('staff can create an engagement in their firm', !!e1.id);

ok('firm 2 cannot see firm 1 clients', (await as(B, `select * from clients`)).length === 0);
ok('firm 2 cannot see firm 1 engagements', (await as(B, `select * from engagements`)).length === 0);
ok('firm 2 cannot see firm 1 members', (await as(B, `select * from firm_members`)).length === 1);
await denied('firm 2 cannot add a client to firm 1', () => as(B, `insert into clients (firm_id, name) values ($1, 'x') returning id`, [f1.id]), /row-level security/);
await denied('firm 2 cannot add lines to a firm 1 engagement', () => as(B, `insert into tb_lines (engagement_id, code, name, balance) values ($1,'1','x',1)`, [e1.id]), /row-level security/);
await denied('an engagement cannot use another firm\'s client', () => as(B, `insert into engagements (firm_id, client_id, type, year_end) values ($1, $2, 'audit', '2025-12-31')`, [f2.id, c1.id]), /does not belong/);
await denied('members cannot insert themselves into a firm', () => as(B, `insert into firm_members (firm_id, user_id, role) values ($1, $2, 'partner')`, [f1.id, B]), /permission denied|row-level/);
ok('staff cannot promote themselves', (await as(C, `update firm_members set role = 'partner' where user_id = $1 returning *`, [C])).length === 0);

await as(C, `insert into tb_lines (engagement_id, code, name, balance, map_code) values ($1,'1400','Bank',5000,'cash'), ($1,'3000','Share capital',-4000,'share_capital'), ($1,'9999','Suspense',-900,null)`, [e1.id]);
await denied('status cannot be set directly', () => as(A, `update engagements set status = 'locked' where id = $1`, [e1.id]), /sign_engagement/);
await denied('signature fields cannot be forged', () => as(A, `update engagements set signed_by_name = 'Someone' where id = $1`, [e1.id]), /sign_engagement/);
await denied('staff cannot sign', () => as(C, `select sign_engagement($1)`, [e1.id]), /Only an engagement partner/);
await denied('another firm cannot sign', () => as(B, `select sign_engagement($1)`, [e1.id]), /not found/);
await denied('cannot sign a trial balance that does not foot', () => as(A, `select sign_engagement($1)`, [e1.id]), /does not foot/);
await as(C, `update tb_lines set balance = -1000 where engagement_id = $1 and code = '9999'`, [e1.id]);
await denied('cannot sign with unmapped accounts', () => as(A, `select sign_engagement($1)`, [e1.id]), /not mapped/);
await as(C, `update tb_lines set map_code = 'other_payables' where engagement_id = $1 and code = '9999'`, [e1.id]);
const [bad] = await as(C, `insert into adjustments (engagement_id, ref, lines) values ($1, 'AJ1', '[{"lineId":"x","amount":500},{"lineId":"y","amount":-400}]') returning id`, [e1.id]);
await denied('cannot sign with a journal that does not balance', () => as(A, `select sign_engagement($1)`, [e1.id]), /does not balance/);
await as(C, `update adjustments set lines = '[{"lineId":"x","amount":500},{"lineId":"y","amount":-500}]' where id = $1`, [bad.id]);

const [c2] = await as(B, `insert into clients (firm_id, name) values ($1, 'Other Limited') returning *`, [f2.id]);
const [e3] = await as(B, `insert into engagements (firm_id, client_id, type, year_end) values ($1, $2, 'audit', '2025-12-31') returning *`, [f2.id, c2.id]);
await as(B, `insert into tb_lines (engagement_id, code, name, balance, map_code) values ($1,'1','Bank',100,'cash'), ($1,'2','Capital',-100,'share_capital')`, [e3.id]);
await denied('a partner with no FRC number cannot sign', () => as(B, `select sign_engagement($1)`, [e3.id]), /FRC registration number is missing/);

await as(C, `update engagements set disclosures = '{"directors":"A. Balogun"}' where id = $1`, [e1.id]);
ok('disclosure changes are in the audit trail', (await as(A, `select detail from audit_log where engagement_id = $1 and table_name = 'engagements' order by id desc limit 1`, [e1.id]))[0].detail.disclosures.directors === 'A. Balogun');
ok('firm 2 cannot change firm 1 disclosures', (await as(B, `update engagements set disclosures = '{}' where id = $1 returning id`, [e1.id])).length === 0);

// Team invitations.
await denied('staff cannot invite', () => as(C, `insert into firm_invites (firm_id, email, role) values ($1,'x@y.ng','staff')`, [f1.id]), /row-level security/);
await denied('a partner cannot invite into another firm', () => as(B, `insert into firm_invites (firm_id, email, role) values ($1,'x@y.ng','partner')`, [f1.id]), /row-level security/);
const [invD] = await as(A, `insert into firm_invites (firm_id, email, role) values ($1,'dayo@firm1.ng','manager') returning *`, [f1.id]);
const [invE] = await as(A, `insert into firm_invites (firm_id, email, role) values ($1,'emeka@firm1.ng','partner') returning *`, [f1.id]);
ok('staff cannot see invitations', (await as(C, `select * from firm_invites`)).length === 0);
ok('the invited person sees their invitation, matched without regard to case', (await as(D, `select * from my_invites()`)).length === 1);
ok('an outsider sees no invitations', (await as(F, `select * from my_invites()`)).length === 0);
ok('an unconfirmed email sees no invitations', (await as(E, `select * from my_invites()`)).length === 0);
await denied('an unconfirmed email cannot accept', () => as(E, `select accept_invite($1,'Emeka','')`, [invE.id]), /Confirm your email/);
await denied('an outsider cannot accept someone else\'s invitation', () => as(F, `select accept_invite($1,'Femi','')`, [invD.id]), /not available/);
await denied('an existing member cannot accept an invitation', async () => { await db.exec(`update auth.users set email = 'dayo@firm1.ng' where id = '${C}'`); try { return await as(C, `select accept_invite($1,'Chidi','')`, [invD.id]); } finally { await db.exec(`update auth.users set email = 'chidi@firm1.ng' where id = '${C}'`); } }, /already belong/);
await as(D, `select accept_invite($1,'Dayo Manager','FRC/P/4')`, [invD.id]);
ok('accepting joins the firm in the invited role', (await as(D, `select role, full_name from firm_members where user_id = $1`, [D]))[0]?.role === 'manager');
await denied('an invitation cannot be used twice', () => as(D, `select accept_invite($1,'Dayo','')`, [invD.id]), /not available/);
ok('the new member can see the firm\'s engagements', (await as(D, `select * from engagements`)).length === 1);
await as(C, `select update_my_profile('Chidi A. Staff', 'FRC/P/3')`);
ok('a member can update their own name and FRC number, and nothing else', (await as(A, `select full_name, frc_number, role from firm_members where user_id = $1`, [C]))[0].full_name === 'Chidi A. Staff' && (await as(A, `select role from firm_members where user_id = $1`, [C]))[0].role === 'staff');
ok('staff cannot remove a member', (await as(C, `delete from firm_members where user_id = $1 returning *`, [D])).length === 0);
await denied('the last partner cannot be demoted', () => as(A, `update firm_members set role = 'staff' where user_id = $1`, [A]), /at least one partner/);
await denied('the last partner cannot be removed', () => as(A, `delete from firm_members where user_id = $1`, [A]), /at least one partner/);
await denied('a membership cannot be moved to another firm', () => as(A, `update firm_members set firm_id = $2 where user_id = $1`, [D, f2.id]), /cannot be moved|row-level/);
ok('a partner can change a role', (await as(A, `update firm_members set role = 'staff' where user_id = $1 returning *`, [D])).length === 1);

// Evidence files.
const path = (firm, eng, file = 'a.pdf') => `${firm}/${eng}/${file}`;
await as(C, `insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [path(f1.id, e1.id)]);
const [ev] = await as(C, `insert into evidence (engagement_id, path, file_name) values ($1, $2, 'Bank confirmation.pdf') returning *`, [e1.id, path(f1.id, e1.id)]);
ok('a member can read the firm\'s evidence files', (await as(D, `select * from storage.objects`)).length === 1 && (await as(D, `select * from evidence`)).length === 1);
ok('another firm cannot read them', (await as(B, `select * from storage.objects`)).length === 0 && (await as(B, `select * from evidence`)).length === 0);
await denied('another firm cannot upload into this engagement', () => as(B, `insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [path(f1.id, e1.id, 'b.pdf')]), /row-level security/);
await denied('a file cannot be uploaded under a firm that does not own the engagement', () => as(B, `insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [path(f2.id, e1.id, 'b.pdf')]), /row-level security/);
await denied('a malformed object name is refused', () => as(C, `insert into storage.objects (bucket_id, name) values ('evidence', 'loose-file.pdf')`), /row-level security/);
await denied('an evidence row must point inside its own engagement', () => as(C, `insert into evidence (engagement_id, path, file_name) values ($1, $2, 'x')`, [e1.id, path(f2.id, e1.id, 'x.pdf')]), /not stored under this engagement/);
await denied('another firm cannot register evidence on this engagement', () => as(B, `insert into evidence (engagement_id, path, file_name) values ($1, $2, 'x')`, [e1.id, path(f1.id, e1.id, 'y.pdf')]), /row-level security/);
ok('another firm cannot delete the file', (await as(B, `delete from storage.objects returning id`)).length === 0);

// Client requests and the client's upload link.
const { createHash } = await import('node:crypto');
const anon = async (sql, params = []) =>
  db.transaction(async (tx) => {
    await tx.exec(`set local role anon; select set_config('request.jwt.sub', '', true);`);
    return (await tx.query(sql, params)).rows;
  });
const TOKEN = 'Abcdefghijklmnopqrstuvwxyz0123456789-_ABCDE';
const OTHER = 'Zbcdefghijklmnopqrstuvwxyz0123456789-_ABCDE';
const hash = (t) => createHash('sha256').update(t).digest('hex');
const [rq] = await as(C, `insert into client_requests (engagement_id, title, detail) values ($1, 'Bank statements', 'All accounts, January to December') returning *`, [e1.id]);
const [rq2] = await as(C, `insert into client_requests (engagement_id, title) values ($1, 'Fixed asset register') returning *`, [e1.id]);
const [rqOther] = await as(B, `insert into client_requests (engagement_id, title) values ($1, 'Their request') returning *`, [e3.id]);
await as(C, `insert into request_links (engagement_id, token_hash, label, expires_at) values ($1, $2, 'Adunni Foods finance team', now() + interval '30 days')`, [e1.id, hash(TOKEN)]);
ok('firm 2 cannot see firm 1 requests or links', (await as(B, `select * from client_requests where engagement_id = $1`, [e1.id])).length === 0 && (await as(B, `select * from request_links`)).length === 0);
await denied('anonymous visitors cannot read the request tables directly', () => anon(`select * from client_requests`), /permission denied/);
await denied('anonymous visitors cannot read links', () => anon(`select * from request_links`), /permission denied/);
await denied('anonymous visitors cannot read evidence rows', () => anon(`select * from evidence`), /permission denied/);
const [{ v: view }] = await anon(`select portal_view($1) as v`, [TOKEN]);
ok('the link shows the request list, and nothing from another engagement', view.client === 'Adunni Foods Limited' && view.firm === 'Firm One' && view.requests.length === 2 && view.requests[0].title === 'Bank statements' && !JSON.stringify(view).includes('Their request'));
ok('a wrong token shows nothing', (await anon(`select portal_view($1) as v`, [OTHER]))[0].v === null);
ok('a malformed token shows nothing', (await anon(`select portal_view('x') as v`))[0].v === null && (await anon(`select portal_view(null) as v`))[0].v === null);
const up = `${view.folder}/p_${TOKEN}_0001.pdf`;
await anon(`insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [up]);
await denied('upload is refused with a wrong token', () => anon(`insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [`${view.folder}/p_${OTHER}_0001.pdf`]), /row-level security/);
await denied('upload is refused into another engagement', () => anon(`insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [`${f2.id}/${e3.id}/p_${TOKEN}_0001.pdf`]), /row-level security/);
await denied('upload is refused outside the portal naming', () => anon(`insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [`${view.folder}/anything.pdf`]), /row-level security/);
await denied('upload is refused with path tricks in the name', () => anon(`insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [`${view.folder}/p_${TOKEN}_a/../b.pdf`]), /row-level security/);
ok('the client cannot read files back', (await anon(`select * from storage.objects`)).length === 0);
await anon(`select portal_attach($1, $2, $3, 'January statement.pdf', 1200, 'application/pdf')`, [TOKEN, rq.id, up]);
ok('an upload is recorded against its request and marks it received', (await as(C, `select status from client_requests where id = $1`, [rq.id]))[0].status === 'received' && (await as(C, `select file_name, from_client, uploaded_by_name from evidence where request_id = $1`, [rq.id]))[0].uploaded_by_name === 'Adunni Foods finance team');
ok('the client then sees the file name on the list', (await anon(`select portal_view($1) as v`, [TOKEN]))[0].v.requests[0].files[0].name === 'January statement.pdf');
await denied('a file cannot be recorded against another engagement\'s request', () => anon(`select portal_attach($1, $2, $3, 'x.pdf', 1, '')`, [TOKEN, rqOther.id, up]), /not on this list/);
await denied('a file that was never uploaded cannot be recorded', () => anon(`select portal_attach($1, $2, $3, 'x.pdf', 1, '')`, [TOKEN, rq2.id, `${view.folder}/p_${TOKEN}_9999.pdf`]), /was not received/);
await denied('a firm file cannot be claimed through the link', () => anon(`select portal_attach($1, $2, $3, 'x.pdf', 1, '')`, [TOKEN, rq2.id, path(f1.id, e1.id)]), /was not received/);
await denied('recording needs a valid token', () => anon(`select portal_attach($1, $2, $3, 'x.pdf', 1, '')`, [OTHER, rq2.id, up]), /no longer valid/);
await as(C, `update client_requests set status = 'returned', note = 'Pages 3 to 5 are missing' where id = $1`, [rq.id]);
ok('a returned item shows the firm\'s note to the client', (await anon(`select portal_view($1) as v`, [TOKEN]))[0].v.requests[0].note === 'Pages 3 to 5 are missing');
await db.exec(`update request_links set expires_at = now() - interval '1 minute' where token_hash = '${hash(TOKEN)}'`);
ok('an expired link shows nothing', (await anon(`select portal_view($1) as v`, [TOKEN]))[0].v === null);
await denied('an expired link cannot upload', () => anon(`insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [`${view.folder}/p_${TOKEN}_0002.pdf`]), /row-level security/);
await db.exec(`update request_links set expires_at = now() + interval '30 days' where token_hash = '${hash(TOKEN)}'`);
await as(C, `update request_links set revoked_at = now() where token_hash = $1`, [hash(TOKEN)]);
ok('a revoked link shows nothing', (await anon(`select portal_view($1) as v`, [TOKEN]))[0].v === null);
await denied('a revoked link cannot upload or record', () => anon(`select portal_attach($1, $2, $3, 'x.pdf', 1, '')`, [TOKEN, rq2.id, up]), /no longer valid/);
await as(C, `update request_links set revoked_at = null where token_hash = $1`, [hash(TOKEN)]);

// Phase 2: general ledger and bank statements.
await as(C, `insert into gl_entries (engagement_id, entry_no, entry_date, account_code, amount, row_no) values ($1,'JV1','2025-03-01','1400',5000,1), ($1,'JV1','2025-03-01','3000',-5000,2)`, [e1.id]);
const [ba] = await as(C, `insert into bank_accounts (engagement_id, name, account_code, closing) values ($1,'Main account','1400',5000) returning *`, [e1.id]);
await as(C, `insert into bank_lines (bank_account_id, engagement_id, txn_date, amount, balance, row_no) values ($1,$2,'2025-03-02',5000,5000,1)`, [ba.id, e1.id]);
await as(C, `update engagements set testing = '{"journals":{"JV1":{"status":"clear"}}}' where id = $1`, [e1.id]);
ok('firm 2 cannot read firm 1 ledger', (await as(B, `select * from gl_entries`)).length === 0);
ok('firm 2 cannot read firm 1 bank accounts', (await as(B, `select * from bank_accounts`)).length === 0);
ok('firm 2 cannot read firm 1 bank lines', (await as(B, `select * from bank_lines`)).length === 0);
await denied('firm 2 cannot add ledger lines to firm 1', () => as(B, `insert into gl_entries (engagement_id, entry_no, entry_date, account_code, amount, row_no) values ($1,'X','2025-01-01','1',1,1)`, [e1.id]), /row-level security/);
await denied('firm 2 cannot add a bank account to firm 1', () => as(B, `insert into bank_accounts (engagement_id, name, account_code, closing) values ($1,'x','1',0)`, [e1.id]), /row-level security/);
await denied('a bank line cannot point at another engagement\'s account', () => as(B, `insert into bank_lines (bank_account_id, engagement_id, txn_date, amount, row_no) values ($1,$2,'2025-01-01',1,1)`, [ba.id, e3.id]), /does not belong/);
const bulk = await as(A, `select table_name, action, detail from audit_log where engagement_id = $1 and table_name in ('gl_entries','bank_lines','bank_accounts') order by id`, [e1.id]);
ok('imports are logged once with a row count', bulk.length === 3 && bulk[0].table_name === 'gl_entries' && bulk[0].action === 'import' && bulk[0].detail.rows === 2 && bulk[2].detail.rows === 1);

// Firm-level quality management.
const [qr] = await as(A, `insert into quality_items (firm_id, kind, component, title) values ($1, 'risk', 'ethics', 'Independence threats are not identified') returning *`, [f1.id]);
const [qf] = await as(A, `insert into quality_items (firm_id, kind, component, title, severity) values ($1, 'finding', 'performance', 'Review not evidenced on two files', 'deficiency') returning *`, [f1.id]);
ok('staff can read the firm\'s quality register', (await as(C, `select * from quality_items`)).length === 2);
ok('another firm cannot read it', (await as(B, `select * from quality_items`)).length === 0);
await denied('staff cannot add to the register', () => as(C, `insert into quality_items (firm_id, kind, component, title) values ($1, 'risk', 'ethics', 'x')`, [f1.id]), /row-level security/);
await denied('another firm\'s partner cannot add to it', () => as(B, `insert into quality_items (firm_id, kind, component, title) values ($1, 'risk', 'ethics', 'x')`, [f1.id]), /row-level security/);
ok('staff cannot change a record', (await as(C, `update quality_items set status = 'in_place' where id = $1 returning id`, [qr.id])).length === 0);
ok('a partner can record that a response is in place', (await as(A, `update quality_items set status = 'in_place', response = 'Annual declarations' where id = $1 returning status`, [qr.id]))[0].status === 'in_place');
await denied('a risk cannot be marked closed, which is a finding status', () => as(A, `update quality_items set status = 'closed' where id = $1`, [qr.id]), /check constraint/);
await denied('a finding needs a severity', () => as(A, `insert into quality_items (firm_id, kind, component, title) values ($1, 'finding', 'ethics', 'x')`, [f1.id]), /check constraint/);
await denied('a record cannot be moved to another firm', () => as(A, `update quality_items set firm_id = $2 where id = $1`, [qr.id, f2.id]), /cannot be moved|row-level security/);
ok('a finding cannot be removed', (await as(A, `delete from quality_items where id = $1 returning id`, [qf.id])).length === 0);
ok('a finding can be closed', (await as(A, `update quality_items set status = 'closed' where id = $1 returning status`, [qf.id]))[0].status === 'closed');
ok('a risk can be removed', (await as(A, `delete from quality_items where id = $1 returning id`, [qr.id])).length === 1);
await denied('staff cannot record the annual evaluation', () => as(C, `insert into quality_evaluations (firm_id, as_at, conclusion, basis) values ($1, '2025-12-31', 'effective', 'x')`, [f1.id]), /row-level security/);
const [qe] = await as(A, `insert into quality_evaluations (firm_id, as_at, conclusion, basis, concluded_by_name, concluded_by) values ($1, '2025-12-31', 'effective_except', 'One deficiency in review evidence.', 'Someone Else', $2) returning *`, [f1.id, C]);
ok('the evaluation carries the partner\'s own name, whatever was sent', qe.concluded_by_name === 'Ada Partner' && qe.concluded_by === A);
await denied('an evaluation cannot be changed', () => as(A, `update quality_evaluations set conclusion = 'effective' where id = $1`, [qe.id]), /permission denied/);
await denied('an evaluation cannot be removed', () => as(A, `delete from quality_evaluations where id = $1`, [qe.id]), /permission denied/);
await denied('an evaluation needs a basis', () => as(A, `insert into quality_evaluations (firm_id, as_at, conclusion, basis) values ($1, '2025-12-31', 'effective', ' ')`, [f1.id]), /check constraint/);
ok('quality changes are logged against the firm', (await as(A, `select * from audit_log where firm_id = $1 and table_name in ('quality_items','quality_evaluations') and engagement_id is null`, [f1.id])).length === 6);
await denied('anonymous visitors cannot read the register', () => anon(`select * from quality_items`), /permission denied/);

// AI assistance.
ok('AI assistance is off for a new firm', (await as(A, `select ai_enabled from firms where id = $1`, [f1.id]))[0].ai_enabled === false);
ok('staff cannot turn it on', (await as(C, `update firms set ai_enabled = true where id = $1 returning id`, [f1.id])).length === 0);
ok('another firm\'s partner cannot turn it on', (await as(B, `update firms set ai_enabled = true where id = $1 returning id`, [f1.id])).length === 0);
ok('a partner can turn it on', (await as(A, `update firms set ai_enabled = true where id = $1 returning ai_enabled`, [f1.id]))[0].ai_enabled === true);
await denied('a member cannot write to the AI request log', () => as(A, `insert into ai_requests (firm_id, task) values ($1, 'map_accounts')`, [f1.id]), /permission denied/);
await db.query(`insert into ai_requests (firm_id, user_id, task, model, input_chars) values ($1, $2, 'map_accounts', 'm', 120)`, [f1.id, C]);
ok('members can read their firm\'s AI request log', (await as(C, `select * from ai_requests`)).length === 1);
ok('another firm cannot read it', (await as(B, `select * from ai_requests`)).length === 0);
await denied('a member cannot alter the log', () => as(A, `delete from ai_requests`), /permission denied/);
await denied('anonymous visitors cannot read the log', () => anon(`select * from ai_requests`), /permission denied/);

// Prior year ledger, account evidence and page references.
await as(C, `insert into gl_entries (engagement_id, entry_no, entry_date, account_code, amount, row_no, period) values ($1,'PY1','2024-03-01','4000',-900,1,'prior'), ($1,'PY1','2024-03-01','1400',900,2,'prior')`, [e1.id]);
ok('the prior year ledger is held apart from the current year', (await as(C, `select * from gl_entries where engagement_id = $1 and period = 'current'`, [e1.id])).length === 2 && (await as(C, `select * from gl_entries where engagement_id = $1 and period = 'prior'`, [e1.id])).length === 2);
await as(C, `delete from gl_entries where engagement_id = $1 and period = 'prior'`, [e1.id]);
ok('removing the prior year ledger leaves the current year', (await as(C, `select * from gl_entries where engagement_id = $1`, [e1.id])).length === 2);
await denied('a ledger line must belong to the current or the prior year', () => as(C, `insert into gl_entries (engagement_id, entry_no, entry_date, account_code, amount, row_no, period) values ($1,'X','2023-01-01','1',1,9,'older')`, [e1.id]), /check constraint/);
ok('firm 2 cannot read firm 1 prior year ledger', (await as(B, `select * from gl_entries where period = 'prior'`)).length === 0);
await as(C, `insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [path(f1.id, e1.id, 'acct.pdf')]);
const [evp] = await as(C, `insert into evidence (engagement_id, path, file_name, ref_type, ref_id, page) values ($1, $2, 'Title deed.pdf', 'account', '1000', 4) returning *`, [e1.id, path(f1.id, e1.id, 'acct.pdf')]);
ok('a file can support an account and point at a page', evp.ref_type === 'account' && evp.page === 4);
await as(C, `update evidence set page = 7 where id = $1`, [evp.id]);
ok('the page can be changed', (await as(C, `select page from evidence where id = $1`, [evp.id]))[0].page === 7);
await denied('a page number must be 1 or more', () => as(C, `update evidence set page = 0 where id = $1`, [evp.id]), /check constraint/);
await denied('another firm cannot change the page', async () => { const r = await as(B, `update evidence set page = 2 where id = $1 returning id`, [evp.id]); if (r.length === 0) throw new Error('row-level security: no rows'); }, /row-level security/);

const [signed] = await as(A, `select * from sign_engagement($1)`, [e1.id]);
ok('partner signs and locks', signed.status === 'locked' && signed.signed_by === A && signed.signed_by_frc === 'FRC/P/1' && signed.firm_frc === 'FRC/F/1');
await denied('locked: engagement cannot be edited', () => as(A, `update engagements set planning = '{"x":1}' where id = $1`, [e1.id]), /signed and locked/);
await denied('locked: trial balance cannot be edited', () => as(A, `update tb_lines set balance = 1 where engagement_id = $1`, [e1.id]), /signed and locked/);
await denied('locked: lines cannot be added', () => as(A, `insert into tb_lines (engagement_id, code, name, balance) values ($1,'x','x',1)`, [e1.id]), /signed and locked/);
await denied('locked: lines cannot be deleted', () => as(A, `delete from tb_lines where engagement_id = $1`, [e1.id]), /signed and locked/);
await denied('locked: journals cannot be added', () => as(A, `insert into adjustments (engagement_id, ref) values ($1,'AJ2')`, [e1.id]), /signed and locked/);
await denied('locked: ledger cannot be added to', () => as(A, `insert into gl_entries (engagement_id, entry_no, entry_date, account_code, amount, row_no) values ($1,'X','2025-01-01','1',1,3)`, [e1.id]), /signed and locked/);
await denied('locked: ledger cannot be removed', () => as(A, `delete from gl_entries where engagement_id = $1`, [e1.id]), /signed and locked/);
await denied('locked: bank statement cannot be removed', () => as(A, `delete from bank_accounts where engagement_id = $1`, [e1.id]), /signed and locked/);
await denied('locked: bank lines cannot be changed', () => as(A, `update bank_lines set amount = 1 where engagement_id = $1`, [e1.id]), /signed and locked/);
await denied('locked: testing conclusions cannot be changed', () => as(A, `update engagements set testing = '{}' where id = $1`, [e1.id]), /signed and locked/);
await denied('locked: evidence cannot be added', () => as(A, `insert into evidence (engagement_id, path, file_name) values ($1, $2, 'late.pdf')`, [e1.id, path(f1.id, e1.id, 'late.pdf')]), /signed and locked/);
await denied('locked: evidence cannot be removed', () => as(A, `delete from evidence where id = $1`, [ev.id]), /signed and locked/);
await denied('locked: files cannot be uploaded', () => as(A, `insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [path(f1.id, e1.id, 'late.pdf')]), /row-level security/);
ok('locked: files cannot be deleted from storage', (await as(A, `delete from storage.objects returning id`)).length === 0);
ok('locked: files can still be read', (await as(A, `select * from storage.objects`)).length === 3);
await denied('locked: a page reference cannot be changed', () => as(A, `update evidence set page = 9 where id = $1`, [evp.id]), /signed and locked/);
await denied('locked: disclosures cannot be changed', () => as(A, `update engagements set disclosures = '{}' where id = $1`, [e1.id]), /signed and locked/);
ok('locked: the link still shows the list, marked closed', (await anon(`select portal_view($1) as v`, [TOKEN]))[0].v.closed === true);
await denied('locked: the client cannot upload', () => anon(`insert into storage.objects (bucket_id, name) values ('evidence', $1)`, [`${view.folder}/p_${TOKEN}_0003.pdf`]), /row-level security/);
await denied('locked: the client cannot record a file', () => anon(`select portal_attach($1, $2, $3, 'x.pdf', 1, '')`, [TOKEN, rq2.id, up]), /signed and locked/);
await denied('locked: requests cannot be changed', () => as(A, `update client_requests set status = 'accepted' where id = $1`, [rq.id]), /signed and locked/);
await denied('locked: links cannot be created', () => as(A, `insert into request_links (engagement_id, token_hash, label, expires_at) values ($1, $2, 'x', now() + interval '1 day')`, [e1.id, hash(OTHER)]), /signed and locked/);
await denied('locked: engagement cannot be deleted', () => as(A, `delete from engagements where id = $1`, [e1.id]), /signed and locked/);
await denied('locked: cannot be signed twice', () => as(A, `select sign_engagement($1)`, [e1.id]), /signed and locked|already signed/);

const log = await as(A, `select table_name, action, user_id from audit_log where engagement_id = $1 order by id`, [e1.id]);
ok('audit trail records the work', log.length >= 8 && log.some((l) => l.table_name === 'tb_lines' && l.action === 'update' && l.user_id === C) && log.at(-1).table_name === 'engagements');
await denied('audit trail cannot be written by users', () => as(A, `insert into audit_log (firm_id, table_name, action) values ($1,'x','x')`, [f1.id]), /permission denied/);
await denied('audit trail cannot be deleted by users', () => as(A, `delete from audit_log`), /permission denied/);
ok('firm 2 cannot read firm 1 audit trail', (await as(B, `select * from audit_log where firm_id = $1`, [f1.id])).length === 0);
await as(B, `insert into gl_entries (engagement_id, entry_no, entry_date, account_code, amount, row_no) values ($1,'J','2025-01-01','1',1,1)`, [e3.id]);
const [bb] = await as(B, `insert into bank_accounts (engagement_id, name, account_code, closing) values ($1,'Acct','1',0) returning id`, [e3.id]);
await as(B, `insert into bank_lines (bank_account_id, engagement_id, txn_date, amount, row_no) values ($1,$2,'2025-01-01',1,1)`, [bb.id, e3.id]);
ok('removing a bank account removes its lines', (await as(B, `delete from bank_accounts where id = $1 returning id`, [bb.id])).length === 1 && (await as(B, `select * from bank_lines`)).length === 0);
ok('unlocked engagement can be deleted by its partner', (await as(B, `delete from engagements where id = $1 returning id`, [e3.id])).length === 1);



// --- Optional two-factor for firm users, and backup codes ---------------------
await db.exec(`insert into auth.mfa_factors (user_id, status) values ('${B}', 'unverified')`);
ok('an unfinished set-up changes nothing', (await as(B, `select * from engagements`)).length >= 0 && (await as(B, `select * from firms`)).length === 1);
await db.exec(`insert into auth.mfa_factors (user_id, status) values ('${B}', 'verified')`);
ok('once turned on, a password-only session sees nothing of the firm', (await as(B, `select * from firms`)).length === 0 && (await as(B, `select * from clients`)).length === 0 && (await as(B, `select * from firm_members`)).length === 0);
await denied('and cannot pay', () => as(B, `select billing_checkout('{"kind":"plan","plan":"solo"}'::jsonb)`), /authenticator app first/);
await denied('or read billing', () => as(B, `select billing_overview()`), /authenticator app first/);
await denied('or change branding', () => as(B, `select set_firm_branding('{}'::jsonb)`), /authenticator app first/);
const b2 = (sql, params = []) => as2(B, sql, params);
ok('with the code, everything is back', (await b2(`select * from firms`)).length === 1 && (await b2(`select * from firm_members`)).length >= 1);
ok('a colleague without two-factor is unaffected', (await as(A, `select * from firms`)).length === 1);
await denied('backup codes need the second factor', () => as(B, `select create_backup_codes()`), /authenticator app first/);
const [{ c: codes }] = await b2(`select create_backup_codes() as c`);
ok('ten backup codes are made, stored only as hashes', codes.length === 10 && /^[0-9A-F]{4}-[0-9A-F]{4}$/.test(codes[0]) && (await db.query(`select count(*)::int as n from mfa_backup_codes where code_hash = $1`, [codes[0]])).rows[0].n === 0);
ok('ten are left', (await b2(`select backup_codes_left() as n`))[0].n === 10);
await denied('backup codes cannot be read from the browser', () => as(B, `select * from mfa_backup_codes`), /permission denied/);
ok('a wrong code fails', (await as(B, `select use_backup_code('0000-0000') as ok`))[0].ok === false);
ok('a right code works, typed loosely', (await as(B, `select use_backup_code($1) as ok`, [codes[3].toLowerCase().replace('-', ' ')]))[0].ok === true);
ok('and cannot be used twice', (await as(B, `select use_backup_code($1) as ok`, [codes[3]]))[0].ok === false);
ok('the others are retired with it', (await as(B, `select use_backup_code($1) as ok`, [codes[4]]))[0].ok === false);
for (let i = 0; i < 2; i++) await as(B, `select use_backup_code('1111-1111')`);
await denied('wrong guesses are limited', () => as(B, `select use_backup_code($1)`, [codes[5]]), /Too many/);
await db.exec(`update auth.mfa_factors set status = 'unverified' where user_id = '${B}'`);

// --- Branding and file numbers ----------------------------------------------
await as(A, `select set_firm_branding('{"watermark": true, "font": "sans", "footer": "Firm One, Lagos"}'::jsonb)`);
ok('a partner sets the branding', (await as(A, `select branding from firms where id = $1`, [f1.id]))[0].branding.footer === 'Firm One, Lagos');
await db.exec(`update firm_members set role = 'manager' where user_id = '${C}'`);
await as(C, `select set_firm_branding('{"font": "serif"}'::jsonb)`);
ok('a manager can set the branding too', (await as(A, `select branding from firms where id = $1`, [f1.id]))[0].branding.font === 'serif');
await denied('a manager cannot change file numbering', () => as(C, `select set_file_numbering('auto', 'X/{N}', 1)`), /Only a partner/);
await db.exec(`update firm_members set role = 'staff' where user_id = '${C}'`);
await denied('staff cannot change the branding', () => as(C, `select set_firm_branding('{}'::jsonb)`), /partner or manager/);
await denied('a logo must be an image', () => as(A, `select set_firm_branding('{"logo": "javascript:alert(1)"}'::jsonb)`), /must be an image/);
await denied('a client logo must be an image', () => as(A, `update clients set logo = 'hello' where id = $1`, [c1.id]), /check constraint/);
ok('a client logo can be saved with its placement', (await as(A, `update clients set logo = 'data:image/png;base64,AAAA', logo_placement = 'left' where id = $1 returning id`, [c1.id])).length === 1);
await denied('a pattern needs {N}', () => as(A, `select set_file_numbering('auto', 'VB/2025', 1)`), /needs \{N\}/);
await as(A, `select set_file_numbering('auto', 'VB/{YYYY}/{N}', 7)`);
const [fn1] = await as(A, `insert into engagements (firm_id, client_id, type, year_end) values ($1, $2, 'review', '2026-12-31') returning file_no`, [f1.id, c1.id]);
const [fn2] = await as(A, `insert into engagements (firm_id, client_id, type, year_end) values ($1, $2, 'review', '2026-12-31') returning file_no`, [f1.id, c1.id]);
ok('automatic numbers follow the pattern', fn1.file_no === "VB/2026/007" && fn2.file_no === 'VB/2026/008');
const [fn3] = await as(A, `insert into engagements (firm_id, client_id, type, year_end, file_no) values ($1, $2, 'review', '2026-12-31', ' OWN-1 ') returning file_no`, [f1.id, c1.id]);
ok("a number typed by hand is kept", fn3.file_no === 'OWN-1');
await denied('file numbers are unique in the firm', () => as(A, `insert into engagements (firm_id, client_id, type, year_end, file_no) values ($1, $2, 'review', '2026-12-31', 'vb/2026/007')`, [f1.id, c1.id]), /duplicate key/);
await as(A, `select set_file_numbering('manual', '', 1)`);
ok('manual numbering leaves the number blank', (await as(A, `insert into engagements (firm_id, client_id, type, year_end) values ($1, $2, 'review', '2026-12-31') returning file_no`, [f1.id, c1.id]))[0].file_no === '');
ok('a file number can be typed in later', (await as(A, `update engagements set file_no = 'M-12' where firm_id = $1 and file_no = '' and status = 'in_progress' returning id`, [f1.id])).length >= 1);

// --- Trial, plans and payments ---------------------------------------------
const G = '00000000-0000-0000-0000-000000000010';
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${G}', 'gbenga@firm3.ng', now())`);
const [f3] = await as(G, `select * from create_firm('Firm Three', 'FRC/F/3', 'Ibadan', 'Gbenga Partner', 'FRC/P/3')`);
const bill = async (u = G) => (await as(u, `select billing_overview() as b`))[0].b;
let b = await bill();
ok('a new firm starts a 14 day trial', b.state === 'trial' && Math.round((new Date(b.trial_ends_at) - Date.now()) / 86400000) === 14 && b.max_engagements === 3);
ok('founding price is 40% off', b.plans.find((p) => p.code === 'solo').amount_kobo === 10800000 && b.plans.find((p) => p.code === 'solo').founding === true && b.founding_left === 20);
const [c3] = await as(G, `insert into clients (firm_id, name) values ($1, 'Trial Client') returning *`, [f3.id]);
const mk = () => as(G, `insert into engagements (firm_id, client_id, type, year_end) values ($1, $2, 'compilation', '2025-12-31') returning *`, [f3.id, c3.id]);
const [t1] = await mk(); await mk(); await mk();
await denied('trial: a fourth engagement is refused', mk, /allows 3 engagements/);
await as(G, `insert into tb_lines (engagement_id, code, name, balance, map_code) values ($1,'1','Cash',100,'cash'), ($1,'2','Capital',-100,'share_capital')`, [t1.id]);
await denied('trial: a file cannot be signed', () => as(G, `select sign_engagement($1)`, [t1.id]), /once it is paid for/);
await denied('a partner cannot extend the trial', () => as(G, `update firms set trial_ends_at = now() + interval '1 year' where id = $1`, [f3.id]), /cannot be changed here/);
await denied('a partner cannot mark the firm paid', () => as(G, `update firms set paid_until = now() + interval '1 year', plan = 'firm' where id = $1`, [f3.id]), /cannot be changed here/);
ok('a partner can still change firm details', (await as(G, `update firms set address = 'Bodija' where id = $1 returning id`, [f3.id])).length === 1);
await denied('payments cannot be written from the browser', () => as(G, `insert into payments (firm_id, tx_ref, plan, amount_kobo, list_kobo, status) values ($1,'x','firm',1,1,'paid')`, [f3.id]), /permission denied/);
await denied('a payment cannot be confirmed from the browser', () => as(G, `select apply_payment('x','1',1,'NGN')`), /permission denied/);
await denied('staff cannot start a payment', () => as(C, `select billing_start('solo')`), /Only a partner/);
await denied('the trial is not for sale', () => as(G, `select billing_start('trial')`), /not available/);

await db.exec(`update firms set trial_ends_at = now() - interval '1 minute' where id = '${f3.id}'`);
ok('after 14 days the firm is expired', (await bill()).state === 'expired');
ok('expired: everything can still be read', (await as(G, `select * from tb_lines where engagement_id = $1`, [t1.id])).length === 2 && (await as(G, `select * from engagements`)).length === 3);
await denied('expired: the trial balance cannot be changed', () => as(G, `update tb_lines set balance = 1 where engagement_id = $1`, [t1.id]), /read-only/);
await denied('expired: nothing can be deleted', () => as(G, `delete from engagements where id = $1`, [t1.id]), /read-only/);
await denied('expired: planning cannot be changed', () => as(G, `update engagements set planning = '{}' where id = $1`, [t1.id]), /read-only/);
ok('expired: a client can still be added', (await as(G, `insert into clients (firm_id, name) values ($1, 'Late') returning id`, [f3.id])).length === 1);

// Paying for one engagement while the plan is lapsed.
await denied('expired: a new engagement needs a plan or a payment', mk, /pay for one compilation engagement/);
const svc = (sql, params) => db.transaction(async (tx) => { await tx.exec(`set local role service_role`); return (await tx.query(sql, params)).rows; });
await db.exec(`grant usage on schema public to service_role`);
const co = async (u, p) => (await as(u, `select billing_checkout($1::jsonb) as s`, [JSON.stringify(p)]))[0].s;
const one = await co(G, { kind: 'engagement', engagement: t1.id });
ok('one compilation costs 10,000 naira', one.amount_kobo === 1000000 && one.description === 'One compilation engagement');
await denied('the browser cannot mark an engagement paid', () => as(G, `update engagements set pay_per = true where id = $1`, [t1.id]), /cannot be changed here|read-only/);
await svc(`select apply_payment($1,'70',1000000,'NGN')`, [one.tx_ref]);
ok('the paid engagement opens again', (await as(G, `update tb_lines set balance = balance where engagement_id = $1 returning id`, [t1.id])).length === 2);
ok('the others stay read-only', (await as(G, `select id from engagements where pay_per`)).length === 1);
await denied('consolidation needs the add-on', () => as(G, `update engagements set planning = '{"group":{"subsidiaries":[{"engagementId":"x"}]}}' where id = $1`, [t1.id]), /add-on/);
const addon = await co(G, { kind: 'group', engagement: t1.id });
await svc(`select apply_payment($1,'71',2000000,'NGN')`, [addon.tx_ref]);
ok('with the add-on, consolidation is allowed', addon.amount_kobo === 2000000 && (await as(G, `update engagements set planning = '{"group":{"subsidiaries":[{"engagementId":"x"}]}}' where id = $1 returning id`, [t1.id])).length === 1);
await as(G, `update engagements set planning = '{}' where id = $1`, [t1.id]);
const credit = await co(G, { kind: 'engagement', type: 'audit', with_group: true });
ok('an audit with consolidation costs 60,000 naira', credit.amount_kobo === 6000000);
await svc(`select apply_payment($1,'72',6000000,'NGN')`, [credit.tx_ref]);
ok('the payment waits as a credit', (await bill()).credits.length === 1);
await denied('a credit is for its own type', mk, /pay for one compilation/);
const [paidAudit] = await as(G, `insert into engagements (firm_id, client_id, type, year_end, pay_per) values ($1, $2, 'audit', '2025-12-31', false) returning *`, [f3.id, c3.id]);
ok('opening an audit uses the credit', paidAudit.pay_per === true && paidAudit.group_addon === true && (await bill()).credits.length === 0);
ok('receipts are numbered in order', (await bill()).payments.map((y) => y.receipt_no).sort().join() === '1001,1002,1003');
ok('per-engagement payments are not founding places', (await bill()).founding_number === null && (await bill()).plans[0].founding === true);
ok('a paid engagement can be signed with no plan', (await as(G, `select * from sign_engagement($1)`, [t1.id]))[0].status === 'locked');

await denied('the founding price needs the commitment', () => co(G, { kind: 'plan', plan: 'solo' }), /founding firm commitment/);
const start = await co(G, { kind: 'plan', plan: 'solo', founding_agreed: true });
ok('a payment is recorded at the founding price', start.amount_kobo === 10800000 && /founding firm price/.test(start.description) && /^vb-[0-9a-f]{32}$/.test(start.tx_ref));
await denied('an underpayment is refused', () => svc(`select apply_payment($1,'77',10799999,'NGN')`, [start.tx_ref]), /does not match/);
await denied('the wrong currency is refused', () => svc(`select apply_payment($1,'77',10800000,'USD')`, [start.tx_ref]), /does not match/);
await denied('an unknown reference is refused', () => svc(`select apply_payment('vb-nope','77',10800000,'NGN')`), /Unknown payment/);
ok('a confirmed payment activates the plan', (await svc(`select apply_payment($1,'77',10800000,'NGN') as r`, [start.tx_ref]))[0].r === 'paid');
ok('confirming twice changes nothing', (await svc(`select apply_payment($1,'77',10800000,'NGN') as r`, [start.tx_ref]))[0].r === 'already');
b = await bill();
ok('the firm is active for a year on Solo', b.state === 'active' && b.plan === 'solo' && Math.round((new Date(b.paid_until) - Date.now()) / 86400000) >= 365 && b.max_engagements === 15);
ok('it is founding firm number 1, with prices held for two years', b.founding_number === 1 && b.founding_left === 19 && Math.round((new Date(b.price_lock_until) - Date.now()) / 86400000) >= 730);
ok('renewal is at the held list price, not the discount', b.plans.find((p) => p.code === 'solo').amount_kobo === 18000000 && b.plans.find((p) => p.code === 'solo').founding === false);
await db.exec(`update plans set price_kobo = 25000000 where code = 'solo'; update country_plan_prices set price = 25000000 where country = 'NG' and plan = 'solo'`);
ok('a later price rise does not reach a founding firm', (await bill()).plans.find((p) => p.code === 'solo').amount_kobo === 18000000);
ok('other firms see the new price', (await bill(A)).plans.find((p) => p.code === 'solo').list_kobo === 25000000);
await db.exec(`update plans set price_kobo = 18000000 where code = 'solo'`);
ok('paid: work can continue', (await as(G, `update engagements set planning = '{}' where firm_id = $1 and status = 'in_progress' returning id`, [f3.id])).length === 3);
ok('the commitment is recorded', (await db.query(`select founding_agreed_by, founding_agreed_at from firms where id = $1`, [f3.id])).rows[0].founding_agreed_by === 'Gbenga Partner');
ok('payments are in the audit trail', (await as(G, `select * from audit_log where table_name = 'payments'`)).length === 4);
ok('another firm cannot see the payment', (await as(B, `select * from payments`)).length === 0);
ok('nor the credits', (await as(B, `select * from engagement_credits`)).length === 0);
ok('the paid year starts with a full allowance', b.engagements_used === 0);
// Moving plan mid-year.
ok('the same plan is a renewal', b.plans.find((p) => p.code === 'solo').mode === 'renew');
const upq = b.plans.find((p) => p.code === 'practice');
ok('a bigger plan gives credit for the unused year', upq.mode === 'upgrade' && Math.abs(upq.credit_kobo - 10800000) < 20000 && upq.credit_kobo + upq.amount_kobo === 48000000);
await db.exec(`update payments set paid_at = paid_at - interval '6 months', covers_until = covers_until - interval '6 months' where firm_id = '${f3.id}' and kind = 'plan'; update firms set paid_until = paid_until - interval '6 months' where id = '${f3.id}'`);
const half = (await bill()).plans.find((p) => p.code === 'practice');
ok('half way through, half is credited', Math.abs(half.credit_kobo - 5400000) < 40000);
const upPay = await co(G, { kind: 'plan', plan: 'practice' });
await svc(`select apply_payment($1,'78',$2,'NGN')`, [upPay.tx_ref, upPay.amount_kobo]);
b = await bill();
ok('after the upgrade a new year starts today', b.plan === 'practice' && Math.round((new Date(b.paid_until) - Date.now()) / 86400000) >= 365 && b.max_engagements === 50);
ok('the credit is not given twice', b.plans.find((p) => p.code === 'firm').credit_kobo <= 48000000 + 1000);
ok('a smaller plan waits for the last 30 days', b.plans.find((p) => p.code === 'solo').mode === 'later');
await denied('and cannot be bought before then', () => co(G, { kind: 'plan', plan: 'solo' }), /last 30 days/);
await db.exec(`update firms set plan = 'solo' where id = '${f3.id}'`);
b = await bill();
await db.exec(`update firms set founding_number = null where id <> '${f3.id}'; with n as (select id, row_number() over () + 1 as k from firms where id <> '${f3.id}') update firms f set founding_number = n.k from n where n.id = f.id`);
await db.exec(`insert into auth.users (id, email, email_confirmed_at) select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'u' || i || '@x.ng', now() from generate_series(1, 17) i`);
await db.exec(`insert into firms (name, founding_number) select 'Founder ' || i, i + 3 from generate_series(1, 17) i`);
const H = '00000000-0000-0000-0000-000000000011';
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${H}', 'halima@firm4.ng', now())`);
await as(H, `select * from create_firm('Firm Twenty One', '', '', 'Halima', '')`);
b = await bill(H);
ok('the twenty-first firm pays the list price', b.founding_left === 0 && b.plans.every((p) => p.founding === false && p.amount_kobo === p.list_kobo));

// --- Platform admin ---------------------------------------------------------
const Z = '00000000-0000-0000-0000-0000000000ff';
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${Z}', 'owner@veritbooks.ng', now()); insert into platform_admins (user_id) values ('${Z}')`);
await denied('an admin without the second factor sees nothing', () => as(Z, `select admin_overview()`), /Not found/);
await denied('an admin without the second factor can do nothing', () => as(Z, `select admin_act('extend_trial', $1::jsonb)`, [JSON.stringify({ firm: f1.id, days: 5 })]), /Not found/);
ok('the sign-in page learns the second factor is needed', (await as(Z, `select admin_status() as s`))[0].s.aal === 'aal1' && (await as(Z, `select admin_status() as s`))[0].s.admin === true);
ok('an outsider learns only that they are not an admin', JSON.stringify((await as(A, `select admin_status() as s`))[0].s) === '{"admin":false}');
await denied('a partner with a second factor is still not an admin', () => as2(A, `select admin_overview()`), /Not found/);
const act = (u, a, p) => as2(u, `select admin_act($1, $2::jsonb)`, [a, JSON.stringify(p)]);
await denied('a partner cannot open the admin console', () => as2(A, `select admin_overview()`), /Not found/);
await denied('a partner cannot act as admin', () => act(A, 'extend_trial', { firm: f1.id, days: 30 }), /Not found/);
ok('a partner is not an admin', (await as2(A, `select is_platform_admin() as a`))[0].a === false && (await as2(Z, `select is_platform_admin() as a`))[0].a === true);
await denied('admin tables are closed to users', () => as(A, `select * from platform_admins`), /permission denied/);
await denied('nobody can make themselves an admin', () => as(A, `insert into platform_admins (user_id) values ($1)`, [A]), /permission denied/);
let ov = (await as2(Z, `select admin_overview() as o`))[0].o;
ok('the admin sees every firm and sign-up', ov.firms.length >= 4 && ov.users.some((u) => u.email === 'femi@else.ng' && u.firm === null) && ov.firms.find((f) => f.id === f3.id).members[0].email === 'gbenga@firm3.ng');
ok('the admin sees money received', ov.revenue_kobo > 0 && ov.payments.some((y) => y.receipt_no === 1001));
ok('the overview carries no client file data', !/tb_lines|balance|ledger/.test(JSON.stringify(Object.keys(ov.firms[0]))));
await act(Z, 'extend_trial', { firm: f2.id, days: 10 });
await act(Z, 'suspend', { firm: f3.id, reason: 'Chargeback under review' });
ok('a suspended firm is told why', (await bill()).state === 'suspended' && (await bill()).suspended_reason === 'Chargeback under review');
await denied('suspended: nothing can be changed, paid or not', () => as(G, `update engagements set planning = '{"x":1}' where id = $1`, [paidAudit.id]), /suspended/);
await denied('suspended: no payment can be started', () => co(G, { kind: 'plan', plan: 'solo' }), /suspended/);
ok('suspended: files can still be read', (await as(G, `select * from engagements`)).length >= 3);
await act(Z, 'unsuspend', { firm: f3.id });
ok('unsuspended: work continues', (await as(G, `update engagements set planning = '{"x":1}' where id = $1 returning id`, [paidAudit.id])).length === 1);
await act(Z, 'record_payment', { firm: f2.id, plan: 'practice', amount_naira: 480000, reference: 'GTB transfer 12 Oct' });
b = await bill(B);
ok('a bank transfer recorded by the admin activates the plan', b.state === 'active' && b.plan === 'practice' && b.payments[0].source === 'manual' && b.payments[0].receipt_no > 1000);
await act(Z, 'end_plan', { firm: f2.id });
ok('the admin can end a plan', (await bill(B)).state !== 'active');
await act(Z, 'set_plan', { firm: f2.id, plan: 'firm', until: '2099-01-01' });
ok('the admin can give a plan without payment', (await bill(B)).plan === 'firm');
await act(Z, 'grant_credit', { firm: f2.id, type: 'review', with_group: false });
ok('the admin can grant an engagement', (await bill(B)).credits.length === 1);
await act(Z, 'set_engagement_price', { code: 'audit', price_naira: 45000 });
await act(Z, 'set_price', { plan: 'solo', price_naira: 200000, max_users: 4, max_engagements: 20 });
ok('the admin can change prices', (await bill(A)).engagement_prices.find((x) => x.code === 'audit').price_kobo === 4500000 && (await bill(A)).plans[0].list_kobo === 20000000 && (await bill(A)).plans[0].max_users === 4);
await act(Z, 'settings', { seller_name: 'VeritBooks Limited', seller_address: 'Lagos', tax_id: 'TIN 1', support_email: 'help@veritbooks.ng' });
ok('receipts carry the seller details', (await bill(A)).seller.name === 'VeritBooks Limited');
await denied('an admin must have a confirmed account', () => act(Z, 'add_admin', { email: 'emeka@firm1.ng' }), /confirmed account/);
await act(Z, 'add_admin', { email: 'ADA@firm1.ng' });
ok('an admin can add another', (await as2(A, `select is_platform_admin() as a`))[0].a === true);
await denied('an admin cannot remove themselves', () => act(Z, 'remove_admin', { user: Z }), /yourself/);
await act(Z, 'remove_admin', { user: A });
ok('and remove one', (await as2(A, `select is_platform_admin() as a`))[0].a === false);
ov = (await as2(Z, `select admin_overview() as o`))[0].o;
ok('every admin action is logged', ov.log.length === 12 && ov.log.every((l) => l.admin === 'owner@veritbooks.ng') && ov.log.some((l) => l.action === 'suspend' && l.firm === 'Firm Three'));
// Reminders
await db.exec(`update firms set trial_ends_at = now() + interval '2 days', paid_until = null where id = '${f1.id}'`);
let due = (await svc(`select billing_due_notices() as d`))[0].d;
const n1 = due.find((d) => d.firm === f1.id);
ok('a firm two days from the end of its trial is due a reminder, to its partners', n1 && n1.kind === 'trial_ending' && n1.to.join() === 'ada@firm1.ng');
await svc(`select billing_notice_sent($1, $2, $3)`, [n1.firm, n1.kind, n1.key]);
ok('a reminder is not sent twice', !(await svc(`select billing_due_notices() as d`))[0].d.some((d) => d.firm === f1.id));
await denied('reminders cannot be read from the browser', () => as(A, `select billing_due_notices()`), /permission denied/);
ok('the scheduler token is checked', (await svc(`select cron_ok('nope') as k`))[0].k === false && (await svc(`select cron_ok((select token from private.cron_token)) as k`).catch(() => [{ k: 'x' }]))[0].k !== false);
ok('a receipt can be built for an email', (await svc(`select payment_receipt($1) as r`, [one.tx_ref]))[0].r.to === 'gbenga@firm3.ng');
await db.exec(`update firms set plan = 'firm', paid_until = now() + interval '1 year' where id = '${f1.id}'`);

// --- VAT --------------------------------------------------------------------
await act(Z, 'settings', { seller_name: 'VeritBooks Limited', seller_address: 'Lagos', tax_id: 'TIN 1', support_email: 'help@veritbooks.ng', vat_percent: 7.5 });
ok('the admin sets the VAT rate', (await bill(A)).vat_percent === 7.5);
await denied('the VAT rate must be sensible', () => act(Z, 'settings', { vat_percent: 90 }), /between 0 and 50/);
await denied('a partner cannot set the VAT rate', () => act(A, 'settings', { vat_percent: 0 }), /Not found/);
await act(Z, 'set_engagement_price', { code: 'audit', price_naira: 40000 });
const vq = await co(G, { kind: 'engagement', type: 'audit' });
ok('VAT is added on top of the price', vq.net_kobo === 4000000 && vq.vat_kobo === 300000 && vq.amount_kobo === 4300000);
await denied('paying the price without the VAT is refused', () => svc(`select apply_payment($1,'90',4000000,'NGN')`, [vq.tx_ref]), /does not match/);
await svc(`select apply_payment($1,'90',4300000,'NGN')`, [vq.tx_ref]);
const vp = (await bill()).payments[0];
ok('the receipt carries the VAT', vp.vat_kobo === 300000 && vp.amount_kobo === 4300000 && (await svc(`select payment_receipt($1) as r`, [vq.tx_ref]))[0].r.vat_kobo === 300000);
await act(Z, 'record_payment', { firm: f2.id, plan: 'firm', amount_naira: 1290000, reference: 'Transfer incl. VAT' });
ok('a recorded transfer is treated as VAT inclusive', (await bill(B)).payments[0].vat_kobo === 9000000);
ov = (await as2(Z, `select admin_overview() as o`))[0].o;
ok('the admin sees VAT collected', ov.vat_kobo === 9300000 && ov.settings.vat_percent === 7.5);
await denied('the unwrapped functions are closed', () => as(G, `select billing_checkout_net('{"kind":"engagement","type":"audit"}'::jsonb)`), /permission denied/);
await db.exec(`set role anon`);
const pub = (await db.query(`select public_prices() as p`)).rows[0].p;
ok('a visitor can read the price list and nothing else', pub.plans.length === 3 && pub.engagement_prices.length === 4 && pub.currency === 'NGN' && !JSON.stringify(pub).includes('Firm One'));
await denied('anonymous visitors cannot read anything', () => db.query(`select * from firms`), /permission denied/);
await denied('anonymous visitors cannot create a firm', () => db.query(`select create_firm('x','','','','')`), /permission denied/);

// --- West Africa: a firm's country sets its prices, currency and tax --------
await db.exec(`reset role`);
const pubGh = (await db.query(`select public_prices('gh') as p`)).rows[0].p;
ok('each country has its own price list, in its own currency', pubGh.currency === 'GHS' && pubGh.plans.find((p) => p.code === 'solo').price_kobo === 150000 && pubGh.countries.length === 6);
ok('Sierra Leone, Liberia and The Gambia are charged in US dollars', (await db.query(`select public_prices('LR') as p`)).rows[0].p.currency === 'USD');
const GH1 = '00000000-0000-0000-0000-000000000021';
const LR1 = '00000000-0000-0000-0000-000000000022';
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${GH1}', 'kofi@accra.gh', now()), ('${LR1}', 'musu@monrovia.lr', now())`);
await denied('a firm must choose a country that is offered', () => as(GH1, `select create_firm('Accra Partners','','Accra','Kofi','', 'FR')`), /Choose the country/);
const [fg] = await as(GH1, `select * from create_firm('Accra Partners', '', 'Accra', 'Kofi Mensah', '', 'gh')`);
ok('a Ghanaian firm is recorded as Ghanaian', fg.country === 'GH');
await db.exec(`delete from payments where status = 'pending'`); // places held by earlier checks' unfinished payments
await db.exec(`update firms set founding_number = null, price_lock_until = null, locked_prices = null`); // earlier checks filled every place
let bg = (await as(GH1, `select billing_overview() as b`))[0].b;
ok('it is quoted in cedis, founding price included', bg.currency === 'GHS' && bg.plans.find((p) => p.code === 'solo').amount_kobo === 90000 && bg.engagement_prices.find((x) => x.code === 'audit').price_kobo === 35000);
await denied('a partner cannot change the country directly', () => as(GH1, `update firms set country = 'NG' where id = $1`, [fg.id]), /Firm settings/);
await as(GH1, `select set_firm_country('LR')`);
bg = (await as(GH1, `select billing_overview() as b`))[0].b;
ok('before paying, a partner can change the country, and the prices follow', bg.country === 'LR' && bg.currency === 'USD' && bg.plans.find((p) => p.code === 'solo').list_kobo === 9900);
await as(GH1, `select set_firm_country('GH')`);
await act(Z, 'country_settings', { country: 'GH', vat_percent: 20, tax_label: 'VAT and levies' });
const gq = await co(GH1, { kind: 'engagement', type: 'audit' });
ok('the country tax rate and currency are on the payment', gq.net_kobo === 35000 && gq.vat_kobo === 7000 && gq.amount_kobo === 42000 && gq.currency === 'GHS' && gq.tax_label === 'VAT and levies');
await denied('a cedi payment cannot be settled in naira', () => svc(`select apply_payment($1,'g1',42000,'NGN')`, [gq.tx_ref]), /does not match/);
ok('a cedi payment settles in cedis', (await svc(`select apply_payment($1,'g1',42000,'GHS') as r`, [gq.tx_ref]))[0].r === 'paid');
ok('the receipt names the currency and the tax', (await svc(`select payment_receipt($1) as r`, [gq.tx_ref]))[0].r.currency === 'GHS' && (await svc(`select payment_receipt($1) as r`, [gq.tx_ref]))[0].r.tax_label === 'VAT and levies');
await denied('after paying, the partner cannot change the country', () => as(GH1, `select set_firm_country('NG')`), /contact VeritBooks support/);
ok('and the overview says so', (await as(GH1, `select billing_overview() as b`))[0].b.can_change_country === false);
const gp = await co(GH1, { kind: 'plan', plan: 'solo', founding_agreed: true });
await svc(`select apply_payment($1,'g2',$2,'GHS')`, [gp.tx_ref, gp.amount_kobo]);
const fgRow = (await db.query(`select * from firms where id = $1`, [fg.id])).rows[0];
ok('a Ghanaian founding firm keeps its prices in cedis', fgRow.founding_number !== null && fgRow.locked_prices.solo === 150000);
await act(Z, 'country_price', { country: 'GH', plan: 'practice', price: 4500 });
await act(Z, 'country_engagement_price', { country: 'GH', code: 'review', price: 250 });
const pubGh2 = (await db.query(`select public_prices('GH') as p`)).rows[0].p;
ok('the admin sets prices for one country without touching another', pubGh2.plans.find((p) => p.code === 'practice').price_kobo === 450000 && pubGh2.engagement_prices.find((x) => x.code === 'review').price_kobo === 25000 && (await db.query(`select public_prices('NG') as p`)).rows[0].p.plans.find((p) => p.code === 'practice').price_kobo === 48000000);
await denied('a partner cannot set country prices', () => act(GH1, 'country_price', { country: 'GH', plan: 'solo', price: 1 }), /Not found/);
await denied('Nigeria cannot be closed', () => act(Z, 'country_settings', { country: 'NG', vat_percent: 7.5, tax_label: 'VAT', enabled: false }), /cannot be closed/);
await act(Z, 'country_settings', { country: 'GM', vat_percent: 0, tax_label: 'VAT', enabled: false });
ok('a country can be closed to new firms', (await db.query(`select public_prices('GM') as p`)).rows[0].p === null && (await db.query(`select public_prices('NG') as p`)).rows[0].p.countries.length === 5);
const [fl] = await as(LR1, `select * from create_firm('Monrovia CPAs', '', 'Monrovia', 'Musu Kollie', '', 'LR')`);
await act(Z, 'record_payment', { firm: fl.id, plan: 'solo', amount_naira: 99, reference: 'Wire' });
ok('a recorded payment takes the firm currency', (await as(LR1, `select billing_overview() as b`))[0].b.payments[0].currency === 'USD');
ov = (await as2(Z, `select admin_overview() as o`))[0].o;
ok('the admin sees revenue for each currency, and each firm country', ov.revenue.some((r) => r.currency === 'GHS' && r.total_kobo > 0) && ov.revenue.some((r) => r.currency === 'USD' && r.total_kobo === 9900) && ov.firms.find((f) => f.id === fg.id).country === 'GH' && ov.countries.length === 6);
await act(Z, 'set_country', { firm: fl.id, country: 'SL' });
ok('the admin can move a firm to another country', (await db.query(`select country from firms where id = $1`, [fl.id])).rows[0].country === 'SL');
await act(Z, 'plan_limits', { plan: 'solo', max_users: 5, max_engagements: 25 });
ok('the admin sets plan allowances once, for every country', (await db.query(`select public_prices('GH') as p`)).rows[0].p.plans.find((p) => p.code === 'solo').max_users === 5);
// Signing names the licence of the firm's country.
const [cg] = await as(GH1, `insert into clients (firm_id, name) values ($1, 'Kumasi Traders') returning *`, [fg.id]);
const [eg] = await as(GH1, `insert into engagements (firm_id, client_id, type, year_end, currency) values ($1, $2, 'audit', '2025-12-31', 'GHS') returning *`, [fg.id, cg.id]);
ok('an engagement records its currency', eg.currency === 'GHS');
await denied('an engagement currency must be one we know', () => as(GH1, `insert into engagements (firm_id, client_id, type, year_end, currency) values ($1, $2, 'audit', '2024-12-31', 'XYZ')`, [fg.id, cg.id]), /check/);
const [tl] = await as(GH1, `insert into tb_lines (engagement_id, code, name, balance, prior_balance, prior2_balance) values ($1, '1400', 'Bank', 100, 80, 60) returning *`, [eg.id]);
ok('an account holds a third year', Number(tl.prior2_balance) === 60);
await denied('a Ghanaian partner is asked for an ICAG licence', () => as(GH1, `select sign_engagement($1)`, [eg.id]), /ICAG practising licence number is missing/);

// --- South Africa: rand prices, collected in rand or converted ----------------
const ZA1 = '00000000-0000-0000-0000-000000000031';
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${ZA1}', 'thandi@joburg.za', now())`);
ok('South Africa is priced in rand', (await db.query(`select public_prices('ZA') as p`)).rows[0].p.plans.find((p) => p.code === 'solo').price_kobo === 350000);
const [fz] = await as(ZA1, `select * from create_firm('Nkosi Inc', '', 'Johannesburg', 'Thandi Nkosi', '', 'ZA')`);
const zq = await co(ZA1, { kind: 'engagement', type: 'audit' });
ok('by default a rand price is charged in rand', zq.currency === 'ZAR' && zq.amount_kobo === 95000 && zq.fx_rate === 1);
ok('a rand payment settles in rand', (await svc(`select apply_payment($1,'z1',95000,'ZAR') as r`, [zq.tx_ref]))[0].r === 'paid');
await denied('a converted charge needs a rate', () => act(Z, 'country_charge', { country: 'ZA', charge_currency: 'USD' }), /exchange rate/);
await denied('only the platform owner sets the collection currency', () => act(ZA1, 'country_charge', { country: 'ZA', charge_currency: 'USD', rate: 0.055 }), /Not found/);
await act(Z, 'country_charge', { country: 'ZA', charge_currency: 'USD', rate: 0.055 });
await act(Z, 'country_settings', { country: 'ZA', vat_percent: 15, tax_label: 'VAT' });
const zu = await co(ZA1, { kind: 'engagement', type: 'review' });
ok('converted: charged in dollars, quoted in rand, tax included', zu.currency === 'USD' && zu.quoted_currency === 'ZAR' && zu.quoted_kobo === 69000 && zu.amount_kobo === Math.round(60000 * 0.055) + Math.round(9000 * 0.055));
await denied('a converted payment cannot be settled in rand', () => svc(`select apply_payment($1,'z2',69000,'ZAR')`, [zu.tx_ref]), /does not match/);
ok('it settles in dollars', (await svc(`select apply_payment($1,'z2',$2,'USD') as r`, [zu.tx_ref, zu.amount_kobo]))[0].r === 'paid');
const zr = (await svc(`select payment_receipt($1) as r`, [zu.tx_ref]))[0].r;
ok('the receipt shows both currencies and the rate', zr.currency === 'USD' && zr.quoted_currency === 'ZAR' && zr.quoted_kobo === 69000 && Number(zr.fx_rate) === 0.055);
const zb = (await as(ZA1, `select billing_overview() as b`))[0].b;
ok('the firm sees prices in rand and is told it pays in dollars', zb.currency === 'ZAR' && zb.charge_currency === 'USD' && Number(zb.charge_rate) === 0.055 && zb.plans.find((p) => p.code === 'solo').list_kobo === 350000);
await act(Z, 'country_charge', { country: 'ZA', charge_currency: 'NGN', rate: 85 });
ok('the platform owner can collect in naira instead', (await co(ZA1, { kind: 'engagement', type: 'compilation' })).currency === 'NGN');
await act(Z, 'country_charge', { country: 'ZA', charge_currency: 'ZAR' });
ok('and back to rand', (await co(ZA1, { kind: 'engagement', type: 'compilation' })).currency === 'ZAR');
ov = (await as2(Z, `select admin_overview() as o`))[0].o;
ok('the console shows each country’s collection currency', ov.countries.find((c) => c.code === 'ZA').charge_currency === 'ZAR' && ov.countries.length === 6);
const [cz] = await as(ZA1, `insert into clients (firm_id, name) values ($1, 'Soweto Traders (Pty) Ltd') returning *`, [fz.id]);
const [ez] = await as(ZA1, `insert into engagements (firm_id, client_id, type, year_end, currency) values ($1, $2, 'compilation', '2025-02-28', 'ZAR') returning *`, [fz.id, cz.id]);
ok('an engagement can be presented in rand', ez.currency === 'ZAR');

// --- Channel partners ---------------------------------------------------------
await db.exec(readFileSync('supabase/migrations/0019_partners.sql', 'utf8'));
const p_P1 = '00000000-0000-0000-0000-000000000041'; // the partner
const p_R1 = '00000000-0000-0000-0000-000000000042'; // a firm the partner refers
const p_R2 = '00000000-0000-0000-0000-000000000043'; // a firm on the partner's own email domain
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values
  ('${p_P1}', 'lindiwe@growthagency.co.za', now()), ('${p_R1}', 'owner@capefirm.co.za', now()), ('${p_R2}', 'sam@growthagency.co.za', now())`);

const p_pact = (a, p) => as2(Z, `select admin_partner_act($1, $2::jsonb) as r`, [a, JSON.stringify(p)]);
ok('anyone can read the programme terms', (await anon(`select partner_programme() as p`))[0].p.percent == 20 && (await anon(`select partner_programme() as p`))[0].p.hold_days === 45);
await denied('applying needs the terms accepted', () => as(p_P1, `select partner_apply($1::jsonb)`, [JSON.stringify({ name: 'Lindiwe Dube' })]), /terms/);
await as(p_P1, `select partner_apply($1::jsonb)`, [JSON.stringify({ name: 'Lindiwe Dube', company: 'Growth Agency', country: 'ZA', accept_terms: true, promotion: 'Webinars for SAIPA members' })]);
let p_me = (await as(p_P1, `select partner_me() as m`))[0].m;
const p_code = p_me.partner.code;
ok('an application waits for approval, with a code made from the name', p_me.partner.status === 'pending' && /^LINDIWE\d{2,3}$/.test(p_code) && Number(p_me.partner.commission_percent) === 20);
ok('a pending partner’s link does not count', (await anon(`select partner_click($1, '', '/', 'ZA') as c`, [p_code]))[0].c === false);
await denied('a partner cannot approve themselves', () => as2(p_P1, `select admin_partner_act('status', $1::jsonb)`, [JSON.stringify({ id: p_me.partner.id, status: 'active' })]), /Not found/);
await denied('partner tables are closed to users', () => as(p_P1, `select * from partners`), /permission denied/);
await p_pact('status', { id: p_me.partner.id, status: 'active' });
ok('an active partner’s link counts a visit', (await anon(`select partner_click($1, 'linkedin', '/', 'ZA') as c`, [p_code.toLowerCase()]))[0].c === true);
ok('a code shows the partner’s name to a firm', (await anon(`select partner_lookup($1) as l`, [p_code]))[0].l.name === 'Growth Agency');
const [p_fr1] = await as(p_R1, `select * from create_firm('Cape Audit Inc', '', 'Cape Town', 'Owner Cape', '', 'ZA')`);
ok('a new firm takes the referral', (await as(p_R1, `select claim_referral($1, 'linkedin') as r`, [p_code]))[0].r.name === 'Growth Agency');
await denied('only once', () => as(p_R1, `select claim_referral($1, '')`, [p_code]), /already/);
await denied('a firm cannot change its own referral', () => as(p_R1, `update firms set referred_by = null where id = $1 returning id`, [p_fr1.id]), /referral|permission/);
const [p_fp] = await as(p_P1, `select * from create_firm('Growth Agency Practice', '', 'Durban', 'Lindiwe Dube', '', 'ZA')`);
await denied('a partner cannot refer their own firm', () => as(p_P1, `select claim_referral($1, '')`, [p_code]), /own firm/);
const [p_fr2] = await as(p_R2, `select * from create_firm('Sam and Co', '', 'Pretoria', 'Sam', '', 'ZA')`);
await as(p_R2, `select claim_referral($1, '')`, [p_code]);
ok('a referral from the partner’s own email domain is held for review', (await db.query(`select referral_review from firms where id = $1`, [p_fr2.id])).rows[0].referral_review !== null);
await db.exec(`update firms set plan = 'trial' where id in ('${p_fr1.id}', '${p_fr2.id}')`);
const p_q1 = await co(p_R1, { kind: 'engagement', type: 'audit' });
await svc(`select apply_payment($1, 'p1', $2, $3)`, [p_q1.tx_ref, p_q1.amount_kobo, p_q1.currency]);
p_me = (await as(p_P1, `select partner_me() as m`))[0].m;
const p_c1 = p_me.commissions[0];
ok('a payment by the referred firm earns 20% of what it paid, net of VAT', p_c1 && p_c1.currency === p_q1.currency && p_c1.amount_kobo === Math.floor((p_q1.amount_kobo - (p_q1.vat_kobo ?? 0)) * 0.2) && p_c1.status === 'pending');
ok('the commission is held for 45 days', p_me.balances[p_c1.currency].held === p_c1.amount_kobo && p_me.balances[p_c1.currency].available === 0);
ok('the partner sees the firm, its source and the click', p_me.referrals.some((r) => r.firm === 'Cape Audit Inc' && r.campaign === 'linkedin') && p_me.clicks.total === 1 && p_me.clicks.campaigns[0].campaign === 'linkedin');
const p_q2 = await co(p_R2, { kind: 'engagement', type: 'review' });
await svc(`select apply_payment($1, 'p2', $2, $3)`, [p_q2.tx_ref, p_q2.amount_kobo, p_q2.currency]);
let p_ap = (await as2(Z, `select admin_partners() as a`))[0].a;
const p_held = p_ap.commissions.find((c) => c.firm === 'Sam and Co');
ok('a held referral earns a commission awaiting review', p_held.status === 'review');
await p_pact('commission_approve', { id: p_held.id });
await denied('nothing can be paid out while the commission is held', () => as(p_P1, `select partner_request_payout($1)`, [p_c1.currency]), /Nothing is available/);
await db.exec(`update partner_commissions set available_at = now() - interval '1 day'`);
await denied('a payout needs bank details', () => as(p_P1, `select partner_request_payout($1)`, [p_c1.currency]), /payout details/);
await as(p_P1, `select partner_update($1::jsonb)`, [JSON.stringify({ payout_details: { bank: 'FNB', account_name: 'Growth Agency', account_number: '62000000001', branch_code: '250655' } })]);
await denied('a partner cannot change their own commission', () => as(p_P1, `update partners set commission_percent = 90`), /permission denied/);
await p_pact('settings', { min_payout: { [p_c1.currency]: 5000000 } });
await denied('below the minimum, the partner cannot ask for a payout', () => as(p_P1, `select partner_request_payout($1)`, [p_c1.currency]), /least/);
await p_pact('settings', { min_payout: { [p_c1.currency]: 100 } });
await as(p_P1, `select partner_request_payout($1)`, [p_c1.currency]);
p_ap = (await as2(Z, `select admin_partners() as a`))[0].a;
const p_po = p_ap.payouts[0];
ok('the payout request carries both commissions and the bank details', p_po.status === 'requested' && p_po.amount_kobo === p_ap.commissions.filter((c) => c.status === 'requested').reduce((a, c) => a + c.amount_kobo, 0) && p_po.payout_details.bank === 'FNB');
await denied('a payout is marked paid only with a reference', () => p_pact('payout_paid', { id: p_po.id }), /reference/);
await p_pact('payout_paid', { id: p_po.id, reference: 'EFT 2026-11-30 0001' });
p_me = (await as(p_P1, `select partner_me() as m`))[0].m;
ok('once paid, the partner sees it paid', p_me.payouts[0].status === 'paid' && p_me.balances[p_c1.currency].paid === p_po.amount_kobo && p_me.commissions.every((c) => c.status === 'paid'));
await denied('a paid commission cannot be voided', () => p_pact('commission_void', { id: p_c1.id, reason: 'Refund' }), /not yet in a payout/);
await p_pact('update', { id: p_me.partner.id, months: 1 });
await db.exec(`update firms set referred_at = now() - interval '2 months' where id = '${p_fr1.id}'`);
const p_q3 = await co(p_R1, { kind: 'engagement', type: 'compilation' });
await svc(`select apply_payment($1, 'p3', $2, $3)`, [p_q3.tx_ref, p_q3.amount_kobo, p_q3.currency]);
ok('after the commission period, payments earn nothing', (await as(p_P1, `select partner_me() as m`))[0].m.commissions.length === 2);
await p_pact('update', { id: p_me.partner.id, months: '' });
await p_pact('status', { id: p_me.partner.id, status: 'suspended' });
const p_q4 = await co(p_R1, { kind: 'engagement', type: 'compilation' });
await svc(`select apply_payment($1, 'p4', $2, $3)`, [p_q4.tx_ref, p_q4.amount_kobo, p_q4.currency]);
ok('a suspended partner earns nothing, and their link stops counting', (await as(p_P1, `select partner_me() as m`))[0].m.commissions.length === 2 && (await anon(`select partner_click($1, '', '/', '') as c`, [p_code]))[0].c === false);
const p_made = (await p_pact('create', { email: 'Kwame@Accra.gh', name: 'Kwame Mensah', country: 'GH', percent: 25, code: 'KWAME' }))[0].r;
ok('the platform owner can set a partner up, with their own code and rate', p_made.code === 'KWAME');
await denied('codes are unique', () => p_pact('create', { email: 'other@x.gh', name: 'Other', code: 'kwame' }), /already uses/);
const p_K = '00000000-0000-0000-0000-000000000044';
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${p_K}', 'kwame@accra.gh', now())`);
ok('the invited partner sees the invitation', (await as(p_K, `select partner_me() as m`))[0].m.invited === true);
await as(p_K, `select partner_apply($1::jsonb)`, [JSON.stringify({ name: 'Kwame Mensah', accept_terms: true })]);
p_me = (await as(p_K, `select partner_me() as m`))[0].m;
ok('and takes it up by accepting the terms, already active at 25%', p_me.partner.status === 'active' && Number(p_me.partner.commission_percent) === 25 && p_me.partner.code === 'KWAME');
ok('every partner action is logged', (await as2(Z, `select admin_overview() as o`))[0].o.log.some((l) => l.action === 'partner_payout_paid'));
void p_fp;

// --- An invited colleague joins; they do not set up a firm of their own -------
await db.exec(readFileSync('supabase/migrations/0020_invite_details.sql', 'utf8'));
const IV = '00000000-0000-0000-0000-000000000051';
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${IV}', 'ifeoma@firm1.ng', now())`);
const [invI] = await as(A, `insert into firm_invites (firm_id, email, role) values ($1, 'ifeoma@firm1.ng', 'staff') returning *`, [f1.id]);
const det = (await as(IV, `select * from my_invite_details()`))[0];
ok('the invitation carries the firm’s details and who sent it', det && det.firm_name === 'Firm One' && det.address === 'Lagos' && det.country === 'NG' && det.role === 'staff' && det.invited_by === 'Ada Partner');
ok('nobody else sees those details', (await as(F, `select * from my_invite_details()`)).length === 0);
await denied('someone invited cannot set up a firm of their own', () => as(IV, `select * from create_firm('My Own Firm', '', 'Lagos', 'Ifeoma', '')`), /invited to join Firm One/);
await as(IV, `select accept_invite($1, 'Ifeoma Staff', '')`, [invI.id]);
ok('they join the inviting firm', (await as(IV, `select role from firm_members where user_id = $1`, [IV]))[0]?.role === 'staff');

// --- 0021: five years, and signing without licence numbers -------------------
await db.exec(readFileSync('supabase/migrations/0021_five_years_optional_licence.sql', 'utf8'));
const [t5] = await as(GH1, `insert into tb_lines (engagement_id, code, name, balance, prior_balance, prior2_balance, prior3_balance, prior4_balance) values ($1, '1410', 'Petty cash', 5, 4, 3, 2, 1) returning *`, [eg.id]);
ok('an account holds five years', Number(t5.prior3_balance) === 2 && Number(t5.prior4_balance) === 1);
await denied('a partner with no licence number reaches the other checks', () => as(GH1, `select sign_engagement($1)`, [eg.id]), /does not foot/);
const why = await as(B, `select sign_engagement($1)`, [e3.id]).then(() => '', (e) => e.message);
ok('signing no longer asks for an FRC number', !/number is missing|licence number/.test(why));

// --- 0022: a partner reopens a signed file (ISA 230, ISA 560) ---------------------
await db.exec(readFileSync('supabase/migrations/0022_reopen_signed.sql', 'utf8'));
const st0 = (await db.query(`select status, signed_by_name, signed_at from engagements where id = $1`, [e1.id])).rows[0];
ok('the file is signed before it is reopened', st0.status === 'locked');
await denied('staff cannot reopen a signed file', () => as(C, `select reopen_engagement($1, 'documentation', 'Review notes answered after assembly of the file', 'None, the opinion stands')`, [e1.id]), /Only an engagement partner/);
await denied('another firm cannot reopen it', () => as(B, `select reopen_engagement($1, 'documentation', 'Review notes answered after assembly of the file', 'None')`, [e1.id]), /not found/);
await denied('a reason is required', () => as(A, `select reopen_engagement($1, 'documentation', 'too short', 'None, the opinion stands')`, [e1.id]), /specific reason/);
await denied('the effect is required', () => as(A, `select reopen_engagement($1, 'documentation', 'Review notes answered after assembly of the file', '')`, [e1.id]), /effect/);
await denied('the kind must be one the standards recognise', () => as(A, `select reopen_engagement($1, 'whim', 'Review notes answered after assembly of the file', 'None, the opinion stands')`, [e1.id]), /Choose why/);
await denied('nobody writes the history directly', () => as(A, `insert into engagement_amendments (engagement_id, kind, reason, effect) values ($1, 'documentation', 'A reason long enough to pass', 'None at all')`, [e1.id]), /permission denied/);
const [ro] = await as(A, `select * from reopen_engagement($1, 'subsequent_before_issue', 'Debtor went into liquidation on 20 February, before the statements were issued', 'Statements to be amended and a new report signed')`, [e1.id]);
ok('the partner reopens it and it returns to work in progress', ro.status === 'in_progress' && ro.signed_by === null && ro.signed_at === null);
const am = await as(C, `select * from engagement_amendments where engagement_id = $1`, [e1.id]);
ok('the reopening is recorded with the previous signature, for the team to read', am.length === 1 && am[0].previous_signed_by_name === st0.signed_by_name && am[0].reopened_by_name !== '' && am[0].resigned_at === null && am[0].kind === 'subsequent_before_issue');
ok('another firm cannot read it', (await as(B, `select * from engagement_amendments`)).length === 0);
await as(A, `update engagements set disclosures = '{"subsequentEvents":"Debtor liquidation"}' where id = $1`, [e1.id]);
ok('the reopened file can be changed', (await db.query(`select disclosures from engagements where id = $1`, [e1.id])).rows[0].disclosures.subsequentEvents === 'Debtor liquidation');
await denied('it still cannot be marked signed by hand', () => as(A, `update engagements set status = 'locked' where id = $1`, [e1.id]), /sign_engagement/);
const [rs] = await as(A, `select * from sign_engagement($1)`, [e1.id]);
const am2 = (await as(A, `select * from engagement_amendments where engagement_id = $1`, [e1.id]))[0];
ok('signing again locks it and closes the reopening', rs.status === 'locked' && am2.resigned_at !== null && am2.resigned_by_name === rs.signed_by_name);
await denied('locked again: no changes', () => as(A, `update engagements set planning = '{}' where id = $1`, [e1.id]), /signed and locked/);
await denied('an unsigned file cannot be reopened', () => as(GH1, `select reopen_engagement($1, 'documentation', 'Review notes answered after assembly of the file', 'None at all')`, [eg.id]), /nothing to reopen/);

// --- 0023: journal integrity and merged saves ----------------------------------------
await db.exec(readFileSync('supabase/migrations/0023_integrity.sql', 'utf8'));
const [ga] = await as(GH1, `select id from tb_lines where engagement_id = $1 limit 2`, [eg.id]).then((r) => (r.length >= 2 ? [r] : [null]));
let gl1, gl2;
if (ga) [gl1, gl2] = ga.map((r) => r.id);
else {
  [{ id: gl1 }] = await as(GH1, `insert into tb_lines (engagement_id, code, name, balance) values ($1, '9001', 'Cash', 100) returning id`, [eg.id]);
  [{ id: gl2 }] = await as(GH1, `insert into tb_lines (engagement_id, code, name, balance) values ($1, '9002', 'Capital', -100) returning id`, [eg.id]);
}
const jl = (a, b) => JSON.stringify([{ lineId: gl1, amount: a }, { lineId: gl2, amount: b }]);
await as(GH1, `insert into adjustments (engagement_id, ref, lines) values ($1, 'AJ1', $2)`, [eg.id, jl(500, -500)]);
await denied('a journal reference is used once on a file', () => as(GH1, `insert into adjustments (engagement_id, ref, lines) values ($1, ' aj1 ', $2)`, [eg.id, jl(5, -5)]), /adjustments_ref_idx|duplicate key/);
await denied('a journal must balance', () => as(GH1, `insert into adjustments (engagement_id, ref, lines) values ($1, 'AJ2', $2)`, [eg.id, jl(500, -400)]), /does not balance/);
await denied('a journal needs two lines', () => as(GH1, `insert into adjustments (engagement_id, ref, lines) values ($1, 'AJ3', $2)`, [eg.id, JSON.stringify([{ lineId: gl1, amount: 0 }])]), /two lines/);
await denied('a journal posts only to accounts of its own file', () => as(GH1, `insert into adjustments (engagement_id, ref, lines) values ($1, 'AJ4', $2)`, [eg.id, JSON.stringify([{ lineId: gl1, amount: 5 }, { lineId: '00000000-0000-0000-0000-0000000000ff', amount: -5 }])]), /not in this file/);
await as(GH1, `update engagements set programme = '{"a":{"done":true,"by":"Kofi"}}' where id = $1`, [eg.id]);
await as(GH1, `select merge_engagement($1, 'programme', '{"b":{"done":true,"by":"Ama"}}')`, [eg.id]);
await as(GH1, `select merge_engagement($1, 'programme', '{"a":{"done":true,"by":"Kofi","reviewedBy":"Partner"}}')`, [eg.id]);
const pg2 = (await db.query(`select programme from engagements where id = $1`, [eg.id])).rows[0].programme;
ok('two people signing off different steps both keep their sign-off', pg2.a.reviewedBy === 'Partner' && pg2.b.by === 'Ama');
await as(GH1, `select merge_engagement($1, 'programme', '{}', array['b'])`, [eg.id]);
ok('a key can be removed', !('b' in (await db.query(`select programme from engagements where id = $1`, [eg.id])).rows[0].programme));
await denied('only the working paper columns can be merged', () => as(GH1, `select merge_engagement($1, 'status', '{}')`, [eg.id]), /cannot be merged/);
await denied('another firm cannot merge into the file', () => as(B, `select merge_engagement($1, 'programme', '{"x":1}')`, [eg.id]), /not found/);
await denied('a signed file cannot be merged into', () => as(A, `select merge_engagement($1, 'planning', '{"x":1}')`, [e1.id]), /signed and locked/);

console.log(failed ? `\n${failed} check(s) failed` : '\nAll database checks passed');
process.exit(failed ? 1 : 0);
