/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS harness resolves optional test tools through NODE_PATH. */
// Isolated PostgreSQL tests. Requires @electric-sql/pglite (via NODE_PATH or local install).
// No network requests, live accounts, or live database credentials are used.
const { PGlite } = require('@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  let checks = 0;
  const ids = Object.fromEntries(['super', 'admin', 'user', 'other', 'developer'].map(key => [key, randomUUID()]));
  const conversation = randomUUID();
  const guide = randomUUID();
  const migration = name => readFileSync(join(__dirname, '..', 'supabase', 'migrations', name), 'utf8');
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth, public to authenticated, anon;
    create table public.app_administrators(user_id uuid primary key references auth.users(id));
    alter table public.app_administrators enable row level security;
    create function public.is_app_administrator() returns boolean language sql stable security definer set search_path = '' as $$
      select exists(select 1 from public.app_administrators where user_id = auth.uid())
    $$;
    create table public.ai_generation_developers(user_id uuid primary key references auth.users(id));
    create table public.ai_generation_attempts(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), created_at timestamptz default now());
    create table public.tutor_generation_attempts(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), created_at timestamptz default now());
    create table public.study_sets(id uuid primary key, user_id uuid, material_type text);
    create table public.tutor_conversations(id uuid primary key, user_id uuid, study_set_id uuid);
  `);
  for (const name of [
    '202610060003_add_admin_roles.sql',
    '202610060004_add_admin_management_foundation.sql',
    '202610060008_add_user_generation_allowances.sql',
    '202610060009_add_set_user_generation_allowance.sql',
    '202610080001_enforce_user_generation_allowances.sql',
  ]) await db.exec(migration(name));

  for (const id of Object.values(ids)) await db.query('insert into auth.users values ($1)', [id]);
  await db.query("insert into public.app_administrators values ($1, 'super_admin'), ($2, 'admin')", [ids.super, ids.admin]);
  await db.query('insert into public.ai_generation_developers values ($1)', [ids.developer]);
  await db.query("insert into public.study_sets values ($1, $2, 'study_guide')", [guide, ids.user]);
  await db.query('insert into public.tutor_conversations values ($1, $2, $3)', [conversation, ids.user, guide]);

  async function as(user, sql, params = [], role = 'authenticated') {
    await db.exec('begin');
    try {
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
      await db.exec(`set local role ${role}`);
      const result = await db.query(sql, params);
      await db.exec('commit');
      return result.rows;
    } catch (error) { await db.exec('rollback'); throw error; }
  }
  function equal(actual, expected) { assert.deepEqual(actual, expected); checks++; }
  async function rejects(run, pattern) { await assert.rejects(run, pattern); checks++; }
  const usage = async (actor, target) => (await as(actor, 'select public.get_admin_user_usage($1) as result', [target]))[0].result;
  const save = (actor, target, mode, m, t, reason = 'Testing allowance', request = randomUUID()) => as(actor,
    'select public.set_user_generation_allowance($1,$2,$3,$4,$5,$6) as result', [target, mode, m, t, reason, request]);
  const reserve = async user => (await as(user, 'select public.reserve_ai_generation() as result'))[0].result;
  const tutor = async user => (await as(user, 'select public.reserve_tutor_generation($1) as result', [conversation]))[0].result;
  const age = table => db.exec(`update public.${table} set created_at = now() - interval '2 minutes'`);

  equal((await usage(ids.super, ids.user)).materials.limit, 5);
  equal((await usage(ids.super, ids.user)).tutor.limit, 20);
  equal((await usage(ids.super, ids.user)).canEdit, true);
  equal((await usage(ids.admin, ids.user)).canEdit, false);
  equal((await usage(ids.super, ids.super)).canEdit, false);
  equal((await usage(ids.super, ids.developer)).canEdit, false);
  equal(await usage(ids.super, randomUUID()), null);
  await rejects(() => usage(ids.user, ids.other), /Administrator access/);
  await rejects(() => as(null, 'select public.get_admin_user_usage($1)', [ids.user], 'anon'), /permission denied/);
  await rejects(() => as(ids.super, 'select * from public.effective_generation_allowance($1)', [ids.user]), /permission denied/);
  await rejects(() => as(ids.user, "insert into public.user_generation_allowances(user_id,mode) values ($1,'unlimited')", [ids.user]), /permission denied/);
  equal((await as(ids.user, 'select * from public.user_generation_allowances')).length, 0);
  await rejects(() => save(ids.user, ids.other, 'unlimited', null, null), /Super Admin access/);
  await rejects(() => save(ids.admin, ids.user, 'unlimited', null, null), /Super Admin access/);
  await rejects(() => save(ids.super, ids.super, 'unlimited', null, null), /protected/);
  await rejects(() => save(ids.super, ids.developer, 'custom', 2, 3), /managed separately/);
  await rejects(() => save(ids.super, ids.user, 'custom', null, 3), /whole numbers/);
  await rejects(() => save(ids.super, ids.user, 'custom', 1001, 3), /whole numbers/);
  await rejects(() => save(ids.super, ids.user, 'custom', 0, 3), /whole numbers/);
  await rejects(() => save(ids.super, ids.user, 'default', 2, null), /only allowed/);
  await rejects(() => save(ids.super, ids.user, 'unlimited', null, null, ' '), /reason/);
  await rejects(() => save(ids.super, randomUUID(), 'unlimited', null, null), /unavailable/);

  const request = randomUUID();
  equal((await save(ids.super, ids.user, 'custom', 2, 3, 'Testing allowance', request))[0].result.duplicate, false);
  equal((await save(ids.super, ids.user, 'custom', 2, 3, 'Testing allowance', request))[0].result.duplicate, true);
  equal(Number((await db.query('select count(*) as n from public.admin_activity_log')).rows[0].n), 1);
  for (const [target, mode, m, t, reason] of [
    [ids.other, 'custom', 2, 3, 'Testing allowance'],
    [ids.user, 'custom', 3, 3, 'Testing allowance'],
    [ids.user, 'custom', 2, 3, 'Different reason'],
  ]) await rejects(() => save(ids.super, target, mode, m, t, reason, request), /different change/);
  const custom = await usage(ids.super, ids.user);
  equal([custom.mode, custom.materials.limit, custom.tutor.limit], ['custom', 2, 3]);
  equal(await reserve(ids.user), 'allowed');
  equal(await reserve(ids.user), 'cooldown');
  await age('ai_generation_attempts');
  equal(await reserve(ids.user), 'allowed');
  await age('ai_generation_attempts');
  equal(await reserve(ids.user), 'user_limit');
  equal((await usage(ids.super, ids.user)).materials.remaining, 0);
  equal(await tutor(ids.other), 'unavailable');
  equal(await tutor(ids.user), 'allowed');
  equal(await tutor(ids.user), 'cooldown');
  await age('tutor_generation_attempts');
  equal(await tutor(ids.user), 'allowed');
  await age('tutor_generation_attempts');
  equal(await tutor(ids.user), 'allowed');
  await age('tutor_generation_attempts');
  equal(await tutor(ids.user), 'user_limit');

  await save(ids.super, ids.user, 'unlimited', null, null);
  equal(await reserve(ids.user), 'allowed');
  equal(await reserve(ids.user), 'cooldown');
  equal(await tutor(ids.user), 'allowed');
  equal(await tutor(ids.user), 'cooldown');
  equal((await usage(ids.super, ids.user)).materials.remaining, null);
  await age('ai_generation_attempts'); await age('tutor_generation_attempts');
  await db.query("insert into public.ai_generation_attempts(user_id,created_at) select $1, now()-interval '2 minutes' from generate_series(1,50)", [ids.other]);
  await db.query("insert into public.tutor_generation_attempts(user_id,created_at) select $1, now()-interval '2 minutes' from generate_series(1,200)", [ids.other]);
  equal(await reserve(ids.user), 'app_limit');
  equal(await tutor(ids.user), 'app_limit');
  equal(await reserve(ids.developer), 'allowed');
  equal(await reserve(ids.developer), 'allowed');
  equal((await usage(ids.super, ids.developer)).source, 'developer');
  await save(ids.super, ids.user, 'default', null, null);
  equal((await usage(ids.super, ids.user)).materials.limit, 5);
  equal((await usage(ids.super, ids.user)).materials.attempts24h, 3);
  // Replaying an earlier successful request returns its receipt; it does not restore old settings.
  await save(ids.super, ids.user, 'custom', 2, 3, 'Testing allowance', request);
  equal((await usage(ids.super, ids.user)).mode, 'default');
  const logs = await as(ids.admin, 'select * from public.admin_activity_log order by created_at');
  equal(logs.length, 3);
  equal(logs[0].details.after, { mode: 'custom', materialLimit: 2, tutorLimit: 3 });
  equal((await as(ids.user, 'select * from public.admin_activity_log')).length, 0);
  await rejects(() => as(ids.super, 'delete from public.admin_activity_log'), /permission denied/);
  // A failed audit write must also roll back the allowance change.
  await db.exec("create function public.reject_test_audit() returns trigger language plpgsql as $$ begin raise exception 'test audit failure'; end $$; create trigger test_audit before insert on public.admin_activity_log for each row execute function public.reject_test_audit();");
  await rejects(() => save(ids.super, ids.user, 'custom', 8, 9), /test audit failure/);
  equal((await usage(ids.super, ids.user)).mode, 'default');
  await db.exec('drop trigger test_audit on public.admin_activity_log');
  await db.exec("update public.ai_generation_attempts set created_at=now()-interval '25 hours'; update public.tutor_generation_attempts set created_at=now()-interval '25 hours'");
  equal((await usage(ids.super, ids.user)).materials.attempts24h, 0);
  equal((await usage(ids.super, ids.user)).materials.nextAttemptExpiresAt, null);
  equal(await reserve(ids.user), 'allowed');
  await db.query("update public.app_administrators set role='admin' where user_id=$1", [ids.super]);
  await rejects(() => save(ids.super, ids.user, 'custom', 2, 3), /Super Admin access/);
  console.log(`Passed ${checks} isolated database assertions.`);
  await db.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
