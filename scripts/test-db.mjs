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
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`);
await db.exec(readFileSync('supabase/migrations/0001_init.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0002_ledger_and_bank.sql', 'utf8'));
await db.exec(readFileSync('supabase/migrations/0003_team_and_evidence.sql', 'utf8'));

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
ok('locked: files can still be read', (await as(A, `select * from storage.objects`)).length === 1);
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
