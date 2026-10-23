/* eslint-disable @typescript-eslint/no-require-imports -- Optional standalone database test tool. */
// Runs against an isolated PostgreSQL database, never live Supabase accounts.
const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');

async function main() {
  const database = new PGlite();
  let checks = 0;
  const owner = randomUUID();
  const admin = randomUUID();
  const secondAdmin = randomUUID();
  const student = randomUUID();
  const otherStudent = randomUUID();

  await database.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to authenticated, anon;
    create table public.app_administrators(user_id uuid primary key references auth.users(id));
    create function public.is_app_administrator() returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists(select 1 from public.app_administrators where user_id = auth.uid())
    $$;
  `);

  const migrations = [
    '202610060003_add_admin_roles.sql',
    '202610060004_add_admin_management_foundation.sql',
  ];
  for (const filename of migrations) {
    await database.exec(readFileSync(join(__dirname, '..', 'supabase', 'migrations', filename), 'utf8'));
  }
  // Only the audit columns from migration 009 are needed by this isolated test.
  await database.exec(`
    alter table public.admin_activity_log add column request_id uuid, add column details jsonb;
    create unique index admin_activity_log_request_idx
      on public.admin_activity_log(actor_id, request_id) where request_id is not null;
  `);
  for (const filename of [
    '202610080002_add_account_suspensions.sql',
    '202610080003_add_account_suspension_actions.sql',
  ]) {
    await database.exec(readFileSync(join(__dirname, '..', 'supabase', 'migrations', filename), 'utf8'));
  }
  for (const id of [owner, admin, secondAdmin, student, otherStudent]) {
    await database.query('insert into auth.users values ($1)', [id]);
  }
  await database.query(
    "insert into public.app_administrators values ($1, 'super_admin'), ($2, 'admin'), ($3, 'admin')",
    [owner, admin, secondAdmin],
  );

  async function asUser(userId, query, parameters = [], anonymous = false) {
    await database.exec('begin');
    try {
      await database.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      if (anonymous) {
        await database.exec('set local role anon');
      } else {
        await database.exec('set local role authenticated');
      }
      const result = await database.query(query, parameters);
      await database.exec('commit');
      return result.rows;
    } catch (error) {
      await database.exec('rollback');
      throw error;
    }
  }

  function save(actor, target, suspended, reason = 'Account review', requestId = randomUUID()) {
    return asUser(actor, 'select public.set_account_suspension($1,$2,$3,$4) as result',
      [target, suspended, reason, requestId]);
  }
  async function isSuspended(userId) {
    const rows = await asUser(userId, 'select public.is_current_account_suspended() as result');
    return rows[0].result;
  }
  function equal(actual, expected) {
    assert.deepEqual(actual, expected);
    checks += 1;
  }
  async function rejects(operation, message) {
    await assert.rejects(operation, message);
    checks += 1;
  }

  await rejects(() => save(student, otherStudent, true), /Administrator access/);
  await rejects(() => save(admin, owner, true), /protected/);
  await rejects(() => save(owner, owner, true), /protected/);
  await rejects(() => save(admin, admin, true), /own account/);
  await rejects(() => save(admin, secondAdmin, true), /other admins/);
  await rejects(() => save(owner, randomUUID(), true), /unavailable/);
  await rejects(() => save(owner, null, true), /target account/);
  await rejects(() => save(owner, student, null), /Choose whether/);
  await rejects(() => save(owner, student, true, ' '), /reason/);
  await rejects(() => save(owner, student, true, 'x'.repeat(1001)), /reason/);
  await rejects(() => save(owner, student, true, 'Review', null), /request ID/);
  await rejects(() => asUser('', 'select public.set_account_suspension($1,true,$2,$3)',
    [student, 'Review', randomUUID()], true), /permission denied/);
  await rejects(() => asUser('', 'select public.set_account_suspension($1,true,$2,$3)',
    [student, 'Review', randomUUID()]), /Please log in/);
  await rejects(() => asUser(owner, 'select public.require_admin_management_permission($1,$2)',
    [student, 'ban_user']), /permission denied/);
  await rejects(() => asUser(student, 'insert into public.account_suspensions(user_id,reason) values ($1,$2)',
    [otherStudent, 'Review']), /permission denied/);

  const banRequest = randomUUID();
  equal((await save(admin, student, true, ' Review ', banRequest))[0].result.duplicate, false);
  equal(await isSuspended(student), true);
  equal(await isSuspended(otherStudent), false);
  equal((await asUser(student, 'select * from public.account_suspensions')).length, 0);
  equal((await asUser(owner, 'select * from public.account_suspensions')).length, 1);
  equal((await save(admin, student, true, 'Review', banRequest))[0].result.duplicate, true);
  await rejects(() => save(admin, student, true), /already suspended/);
  await rejects(() => save(admin, otherStudent, true, 'Review', banRequest), /different change/);
  await rejects(() => save(admin, student, false, 'Review', banRequest), /different change/);
  await rejects(() => save(admin, student, true, 'Different reason', banRequest), /different change/);
  await save(admin, student, false, 'Issue resolved');
  equal(await isSuspended(student), false);
  await save(admin, student, true, 'Review', banRequest);
  equal(await isSuspended(student), false);
  await rejects(() => save(admin, student, false), /not suspended/);
  const history = await asUser(owner, 'select * from public.admin_activity_log order by created_at');
  equal(history.length, 2);
  equal(history[1].details.before.reason, 'Review');
  equal(history[1].details.after.suspended, false);
  equal((await asUser(student, 'select * from public.admin_activity_log')).length, 0);
  await rejects(() => asUser(admin, 'delete from public.account_suspensions'), /permission denied/);

  await save(owner, admin, true);
  await rejects(() => save(admin, student, true), /Suspended administrators/);
  await save(owner, admin, false);

  // A log failure must roll back both ban and unban, preserving the prior state.
  await database.exec(`
    create function public.reject_test_audit() returns trigger language plpgsql as $$
    begin raise exception 'test audit failure'; end $$;
    create trigger test_audit before insert on public.admin_activity_log
      for each row execute function public.reject_test_audit();
  `);
  await rejects(() => save(admin, student, true), /test audit failure/);
  equal(await isSuspended(student), false);
  await database.query('insert into public.account_suspensions(user_id,reason) values ($1,$2)', [student, 'Earlier ban']);
  await rejects(() => save(admin, student, false), /test audit failure/);
  equal(await isSuspended(student), true);

  await database.close();
  console.log(`${checks} account suspension assertions passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
