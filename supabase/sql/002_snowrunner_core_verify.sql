-- wx_coopgames / SnowRunner core verification
-- READ-ONLY REVIEW SCRIPT
-- This file performs no DDL/DML changes.

-- 1. Expected tables and columns
select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'private'
  and table_name in ('coop_profiles', 'game_states')
order by table_name, ordinal_position;

-- 2. Constraints
select
  n.nspname as schema_name,
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'private'
  and c.relname in ('coop_profiles', 'game_states')
order by c.relname, con.conname;

-- 3. Indexes
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'private'
  and tablename in ('coop_profiles', 'game_states')
order by tablename, indexname;

-- 4. RLS state
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'private'
  and c.relname in ('coop_profiles', 'game_states')
  and c.relkind = 'r'
order by c.relname;

-- 5. Policies.
-- Expected current SnowRunner baseline: none on these two private tables.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'private'
  and tablename in ('coop_profiles', 'game_states')
order by tablename, policyname;

-- 6. Direct table privileges.
-- Expected: anon/authenticated should NOT have direct table access.
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'private'
  and table_name in ('coop_profiles', 'game_states')
order by table_name, grantee, privilege_type;

-- 7. Expected public RPC function definitions
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  p.prosecdef as security_definer,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_coop_profile',
    'open_coop_profile',
    'patch_coop_profile',
    'get_game_state',
    'put_game_state',
    'patch_game_state'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 8. Function EXECUTE grants
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name in (
    'create_coop_profile',
    'open_coop_profile',
    'patch_coop_profile',
    'get_game_state',
    'put_game_state',
    'patch_game_state'
  )
order by routine_name, grantee;

-- 9. Important contamination check:
-- SnowRunner baseline must not require AW objects.
-- Any returned row deserves manual review before deployment.
select
  n.nspname as schema_name,
  c.relname as object_name,
  c.relkind as object_kind
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where (
    n.nspname = 'private'
    and c.relname in ('coop_profiles', 'game_states')
  )
  and exists (
    select 1
    from pg_trigger t
    where t.tgrelid = c.oid
      and not t.tgisinternal
      and t.tgname like 'aw_%'
  )
order by object_name;

-- 10. Row counts only; no row contents are exposed.
select 'private.coop_profiles' as relation, count(*) as row_count
from private.coop_profiles
union all
select 'private.game_states', count(*)
from private.game_states;
