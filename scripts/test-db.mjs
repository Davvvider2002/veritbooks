// Runs the migration against an in-process Postgres (PGlite) with a stand-in for Supabase's
// auth schema, then checks the security rules. Run with: node scripts/test-db.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  -- Stand-in for Supabase Storage: enough to run the bucket row and the object policies.
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated, anon;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select, insert on storage.objects to anon;
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
const ok = (name, cond) => { console.log(`${cond ? 'pass' : 'FAIL'}  ${name}`); if (!cond) failed++; };
const denied = async (name, fn, match) => {
  try { const r = await fn(); ok(name + ' (expected refusal, got ' + JSON.stringify(r).slice(0, 80) + ')', false); }
  catch (e) { ok(name, match ? match.test(e.message) : true); if (match && !match.test(e.message)) console.log('      ', e.message); }
};

const [f1] = await as(A, `select * from create_firm('Firm One', 'FRC/F/1', 'Lagos', 'Ada Partner', 'FRC/P/1')`);
const [f2] = await as(B, `select * from create_firm('Firm Two', 'FRC/F/2', 'Abuja', 'Bola Partner', '')`);
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
await db.exec(`set role anon`);
await denied('anonymous visitors cannot read anything', () => db.query(`select * from firms`), /permission denied/);
await denied('anonymous visitors cannot create a firm', () => db.query(`select create_firm('x','','','','')`), /permission denied/);

console.log(failed ? `\n${failed} check(s) failed` : '\nAll database checks passed');
process.exit(failed ? 1 : 0);
