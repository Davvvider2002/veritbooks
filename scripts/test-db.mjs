// Runs the migration against an in-process Postgres (PGlite) with a stand-in for Supabase's
// auth schema, then checks the security rules. Run with: node scripts/test-db.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`);
await db.exec(readFileSync('supabase/migrations/0001_init.sql', 'utf8'));

const A = '00000000-0000-0000-0000-00000000000a'; // partner, firm 1
const B = '00000000-0000-0000-0000-00000000000b'; // partner, firm 2
const C = '00000000-0000-0000-0000-00000000000c'; // staff, firm 1
await db.exec(`insert into auth.users values ('${A}'), ('${B}'), ('${C}')`);

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

const [signed] = await as(A, `select * from sign_engagement($1)`, [e1.id]);
ok('partner signs and locks', signed.status === 'locked' && signed.signed_by === A && signed.signed_by_frc === 'FRC/P/1' && signed.firm_frc === 'FRC/F/1');
await denied('locked: engagement cannot be edited', () => as(A, `update engagements set planning = '{"x":1}' where id = $1`, [e1.id]), /signed and locked/);
await denied('locked: trial balance cannot be edited', () => as(A, `update tb_lines set balance = 1 where engagement_id = $1`, [e1.id]), /signed and locked/);
await denied('locked: lines cannot be added', () => as(A, `insert into tb_lines (engagement_id, code, name, balance) values ($1,'x','x',1)`, [e1.id]), /signed and locked/);
await denied('locked: lines cannot be deleted', () => as(A, `delete from tb_lines where engagement_id = $1`, [e1.id]), /signed and locked/);
await denied('locked: journals cannot be added', () => as(A, `insert into adjustments (engagement_id, ref) values ($1,'AJ2')`, [e1.id]), /signed and locked/);
await denied('locked: engagement cannot be deleted', () => as(A, `delete from engagements where id = $1`, [e1.id]), /signed and locked/);
await denied('locked: cannot be signed twice', () => as(A, `select sign_engagement($1)`, [e1.id]), /signed and locked|already signed/);

const log = await as(A, `select table_name, action, user_id from audit_log where engagement_id = $1 order by id`, [e1.id]);
ok('audit trail records the work', log.length >= 8 && log.some((l) => l.table_name === 'tb_lines' && l.action === 'update' && l.user_id === C) && log.at(-1).table_name === 'engagements');
await denied('audit trail cannot be written by users', () => as(A, `insert into audit_log (firm_id, table_name, action) values ($1,'x','x')`, [f1.id]), /permission denied/);
await denied('audit trail cannot be deleted by users', () => as(A, `delete from audit_log`), /permission denied/);
ok('firm 2 cannot read firm 1 audit trail', (await as(B, `select * from audit_log where firm_id = $1`, [f1.id])).length === 0);
ok('unlocked engagement can be deleted by its partner', (await as(B, `delete from engagements where id = $1 returning id`, [e3.id])).length === 1);
await db.exec(`set role anon`);
await denied('anonymous visitors cannot read anything', () => db.query(`select * from firms`), /permission denied/);
await denied('anonymous visitors cannot create a firm', () => db.query(`select create_firm('x','','','','')`), /permission denied/);

console.log(failed ? `\n${failed} check(s) failed` : '\nAll database checks passed');
process.exit(failed ? 1 : 0);
