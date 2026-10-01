-- wx_coopgames / SnowRunner shared-state core
-- REVIEW STATUS: MANUAL REVIEW REQUIRED
-- DO NOT wire this file to automatic deployment before it has been fully reviewed.
--
-- Scope:
--   * private.coop_profiles
--   * private.game_states
--   * SnowRunner/shared-profile RPCs used by the mini-program
--   * minimal indexes / RLS / grants required by the current design
--
-- Explicitly OUT OF SCOPE:
--   * ALL Armored Warfare tables, views, triggers, functions and indexes
--   * AW protection triggers currently attached to private.coop_profiles
--   * AW fleet-plan data
--
-- Source of truth used to build this file:
--   Current Supabase project wx_coopgame, inspected on 2026-10-01.
--
-- Idempotency goal:
--   Re-running this file should not fail merely because the intended SnowRunner
--   objects already exist. Existing user data is never deleted or truncated.
--
-- Important:
--   This script is intentionally additive. It does NOT silently coerce existing
--   columns to different types or delete unexpected objects. If an existing
--   object conflicts with the expected shape, review/verification SQL should
--   surface that mismatch instead of this file destructively "fixing" it.

begin;

-- ---------------------------------------------------------------------------
-- 0. Required schemas / extension
-- ---------------------------------------------------------------------------

create schema if not exists private;
create schema if not exists extensions;

-- Supabase normally provides pgcrypto in the extensions schema.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. private.coop_profiles
-- ---------------------------------------------------------------------------

create table if not exists private.coop_profiles (
  id uuid primary key default gen_random_uuid(),
  invite_code_hash text not null unique,
  schema_version integer not null default 1 check (schema_version > 0),
  profile_data jsonb not null default
    '{"users":{"A":"用户A名称","B":"用户B名称"},"settings":{}}'::jsonb,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the table already existed in a partial bootstrap, add only missing columns.
alter table private.coop_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists invite_code_hash text,
  add column if not exists schema_version integer default 1,
  add column if not exists profile_data jsonb default
    '{"users":{"A":"用户A名称","B":"用户B名称"},"settings":{}}'::jsonb,
  add column if not exists version bigint default 1,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.coop_profiles'::regclass
      and contype = 'p'
  ) then
    alter table private.coop_profiles
      add constraint coop_profiles_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.coop_profiles'::regclass
      and conname = 'coop_profiles_invite_code_hash_key'
  ) then
    alter table private.coop_profiles
      add constraint coop_profiles_invite_code_hash_key unique (invite_code_hash);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.coop_profiles'::regclass
      and conname = 'coop_profiles_schema_version_check'
  ) then
    alter table private.coop_profiles
      add constraint coop_profiles_schema_version_check
      check (schema_version > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.coop_profiles'::regclass
      and conname = 'coop_profiles_version_check'
  ) then
    alter table private.coop_profiles
      add constraint coop_profiles_version_check
      check (version > 0);
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. private.game_states
-- ---------------------------------------------------------------------------

create table if not exists private.game_states (
  profile_id uuid not null
    references private.coop_profiles(id) on delete cascade,
  game_key text not null
    check (game_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  state_schema_version integer not null default 1
    check (state_schema_version > 0),
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 1
    check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, game_key)
);

alter table private.game_states
  add column if not exists profile_id uuid,
  add column if not exists game_key text,
  add column if not exists state_schema_version integer default 1,
  add column if not exists state jsonb default '{}'::jsonb,
  add column if not exists version bigint default 1,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.game_states'::regclass
      and contype = 'p'
  ) then
    alter table private.game_states
      add constraint game_states_pkey primary key (profile_id, game_key);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.game_states'::regclass
      and conname = 'game_states_profile_id_fkey'
  ) then
    alter table private.game_states
      add constraint game_states_profile_id_fkey
      foreign key (profile_id)
      references private.coop_profiles(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.game_states'::regclass
      and conname = 'game_states_game_key_check'
  ) then
    alter table private.game_states
      add constraint game_states_game_key_check
      check (game_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.game_states'::regclass
      and conname = 'game_states_state_schema_version_check'
  ) then
    alter table private.game_states
      add constraint game_states_state_schema_version_check
      check (state_schema_version > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.game_states'::regclass
      and conname = 'game_states_version_check'
  ) then
    alter table private.game_states
      add constraint game_states_version_check
      check (version > 0);
  end if;
end
$$;

create index if not exists game_states_profile_updated_idx
  on private.game_states (profile_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 3. RLS / direct-table access
-- ---------------------------------------------------------------------------

alter table private.coop_profiles enable row level security;
alter table private.game_states enable row level security;

-- Current design intentionally exposes no direct table policies.
-- Mini-program access goes through vetted SECURITY DEFINER RPC functions.
revoke all on table private.coop_profiles from public, anon, authenticated;
revoke all on table private.game_states from public, anon, authenticated;

-- Current project grants private-schema USAGE, but no direct table privileges.
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC: create_coop_profile
-- ---------------------------------------------------------------------------

create or replace function public.create_coop_profile(
  p_profile_data jsonb default
    '{"users":{"A":"用户A名称","B":"用户B名称"},"settings":{}}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'private', 'extensions'
as $function$
declare
  v_code text;
  v_hash text;
  v_row private.coop_profiles;
begin
  loop
    v_code := upper(substr(encode(extensions.gen_random_bytes(16), 'hex'), 1, 20));
    v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

    exit when not exists (
      select 1
      from private.coop_profiles
      where invite_code_hash = v_hash
    );
  end loop;

  insert into private.coop_profiles (invite_code_hash, profile_data)
  values (
    v_hash,
    coalesce(
      p_profile_data,
      '{"users":{"A":"用户A名称","B":"用户B名称"},"settings":{}}'::jsonb
    )
  )
  returning * into v_row;

  return jsonb_build_object(
    'profileId', v_row.id,
    'inviteCode', v_code,
    'schemaVersion', v_row.schema_version,
    'profileData', v_row.profile_data,
    'version', v_row.version,
    'updatedAt', v_row.updated_at
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPC: open_coop_profile
-- ---------------------------------------------------------------------------

create or replace function public.open_coop_profile(
  p_invite_code text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'private', 'extensions'
as $function$
declare
  v_code text;
  v_hash text;
  v_row private.coop_profiles;
  v_games jsonb;
begin
  v_code := upper(
    regexp_replace(coalesce(p_invite_code, ''), '[^A-F0-9]', '', 'g')
  );

  if length(v_code) <> 20 then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

  select *
  into v_row
  from private.coop_profiles
  where invite_code_hash = v_hash;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'gameKey', gs.game_key,
        'stateSchemaVersion', gs.state_schema_version,
        'version', gs.version,
        'updatedAt', gs.updated_at
      )
      order by gs.game_key
    ),
    '[]'::jsonb
  )
  into v_games
  from private.game_states gs
  where gs.profile_id = v_row.id;

  return jsonb_build_object(
    'profileId', v_row.id,
    'schemaVersion', v_row.schema_version,
    'profileData', v_row.profile_data,
    'version', v_row.version,
    'updatedAt', v_row.updated_at,
    'games', v_games
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RPC: patch_coop_profile
-- ---------------------------------------------------------------------------

create or replace function public.patch_coop_profile(
  p_profile_id uuid,
  p_invite_code text,
  p_path text[],
  p_value jsonb default null,
  p_delete boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'private', 'extensions'
as $function$
declare
  v_code text;
  v_hash text;
  v_row private.coop_profiles;
begin
  if p_path is null or array_length(p_path, 1) is null then
    raise exception 'INVALID_PATH';
  end if;

  v_code := upper(
    regexp_replace(coalesce(p_invite_code, ''), '[^A-F0-9]', '', 'g')
  );

  if length(v_code) <> 20 then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

  select *
  into v_row
  from private.coop_profiles
  where id = p_profile_id
    and invite_code_hash = v_hash
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND_OR_BAD_CODE';
  end if;

  if p_delete then
    v_row.profile_data := v_row.profile_data #- p_path;
  else
    v_row.profile_data := jsonb_set(
      v_row.profile_data,
      p_path,
      coalesce(p_value, 'null'::jsonb),
      true
    );
  end if;

  update private.coop_profiles
  set profile_data = v_row.profile_data,
      version = version + 1,
      updated_at = now()
  where id = p_profile_id
  returning * into v_row;

  return jsonb_build_object(
    'profileId', v_row.id,
    'schemaVersion', v_row.schema_version,
    'profileData', v_row.profile_data,
    'version', v_row.version,
    'updatedAt', v_row.updated_at
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. RPC: get_game_state
-- ---------------------------------------------------------------------------

create or replace function public.get_game_state(
  p_profile_id uuid,
  p_invite_code text,
  p_game_key text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'private', 'extensions'
as $function$
declare
  v_code text;
  v_hash text;
  v_profile private.coop_profiles;
  v_game private.game_states;
begin
  if p_game_key is null
     or p_game_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise exception 'INVALID_GAME_KEY';
  end if;

  v_code := upper(
    regexp_replace(coalesce(p_invite_code, ''), '[^A-F0-9]', '', 'g')
  );

  if length(v_code) <> 20 then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

  select *
  into v_profile
  from private.coop_profiles
  where id = p_profile_id
    and invite_code_hash = v_hash;

  if not found then
    raise exception 'PROFILE_NOT_FOUND_OR_BAD_CODE';
  end if;

  select *
  into v_game
  from private.game_states
  where profile_id = p_profile_id
    and game_key = p_game_key;

  if not found then
    return jsonb_build_object(
      'profileId', p_profile_id,
      'gameKey', p_game_key,
      'exists', false,
      'stateSchemaVersion', 1,
      'state', '{}'::jsonb,
      'version', 0,
      'updatedAt', null
    );
  end if;

  return jsonb_build_object(
    'profileId', v_game.profile_id,
    'gameKey', v_game.game_key,
    'exists', true,
    'stateSchemaVersion', v_game.state_schema_version,
    'state', v_game.state,
    'version', v_game.version,
    'updatedAt', v_game.updated_at
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 8. RPC: put_game_state
-- ---------------------------------------------------------------------------

create or replace function public.put_game_state(
  p_profile_id uuid,
  p_invite_code text,
  p_game_key text,
  p_state jsonb,
  p_state_schema_version integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'private', 'extensions'
as $function$
declare
  v_code text;
  v_hash text;
  v_profile private.coop_profiles;
  v_game private.game_states;
begin
  if p_game_key is null
     or p_game_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise exception 'INVALID_GAME_KEY';
  end if;

  if p_state_schema_version is null
     or p_state_schema_version < 1 then
    raise exception 'INVALID_SCHEMA_VERSION';
  end if;

  v_code := upper(
    regexp_replace(coalesce(p_invite_code, ''), '[^A-F0-9]', '', 'g')
  );

  if length(v_code) <> 20 then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

  select *
  into v_profile
  from private.coop_profiles
  where id = p_profile_id
    and invite_code_hash = v_hash;

  if not found then
    raise exception 'PROFILE_NOT_FOUND_OR_BAD_CODE';
  end if;

  insert into private.game_states (
    profile_id,
    game_key,
    state_schema_version,
    state
  )
  values (
    p_profile_id,
    p_game_key,
    p_state_schema_version,
    coalesce(p_state, '{}'::jsonb)
  )
  on conflict (profile_id, game_key)
  do update set
    state_schema_version = excluded.state_schema_version,
    state = excluded.state,
    version = private.game_states.version + 1,
    updated_at = now()
  returning * into v_game;

  return jsonb_build_object(
    'profileId', v_game.profile_id,
    'gameKey', v_game.game_key,
    'stateSchemaVersion', v_game.state_schema_version,
    'state', v_game.state,
    'version', v_game.version,
    'updatedAt', v_game.updated_at
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 9. RPC: patch_game_state
-- ---------------------------------------------------------------------------

create or replace function public.patch_game_state(
  p_profile_id uuid,
  p_invite_code text,
  p_game_key text,
  p_path text[],
  p_value jsonb default null,
  p_delete boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'private', 'extensions'
as $function$
declare
  v_code text;
  v_hash text;
  v_profile private.coop_profiles;
  v_game private.game_states;
begin
  if p_game_key is null
     or p_game_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then
    raise exception 'INVALID_GAME_KEY';
  end if;

  if p_path is null or array_length(p_path, 1) is null then
    raise exception 'INVALID_PATH';
  end if;

  v_code := upper(
    regexp_replace(coalesce(p_invite_code, ''), '[^A-F0-9]', '', 'g')
  );

  if length(v_code) <> 20 then
    raise exception 'INVALID_INVITE_CODE';
  end if;

  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

  select *
  into v_profile
  from private.coop_profiles
  where id = p_profile_id
    and invite_code_hash = v_hash;

  if not found then
    raise exception 'PROFILE_NOT_FOUND_OR_BAD_CODE';
  end if;

  insert into private.game_states (
    profile_id,
    game_key,
    state_schema_version,
    state
  )
  values (
    p_profile_id,
    p_game_key,
    1,
    '{}'::jsonb
  )
  on conflict (profile_id, game_key) do nothing;

  select *
  into v_game
  from private.game_states
  where profile_id = p_profile_id
    and game_key = p_game_key
  for update;

  if p_delete then
    v_game.state := v_game.state #- p_path;
  else
    v_game.state := jsonb_set(
      v_game.state,
      p_path,
      coalesce(p_value, 'null'::jsonb),
      true
    );
  end if;

  update private.game_states
  set state = v_game.state,
      version = version + 1,
      updated_at = now()
  where profile_id = p_profile_id
    and game_key = p_game_key
  returning * into v_game;

  return jsonb_build_object(
    'profileId', v_game.profile_id,
    'gameKey', v_game.game_key,
    'stateSchemaVersion', v_game.state_schema_version,
    'version', v_game.version,
    'updatedAt', v_game.updated_at
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 10. Function privileges
-- ---------------------------------------------------------------------------

revoke all on function public.create_coop_profile(jsonb) from public;
revoke all on function public.open_coop_profile(text) from public;
revoke all on function public.patch_coop_profile(uuid,text,text[],jsonb,boolean) from public;
revoke all on function public.get_game_state(uuid,text,text) from public;
revoke all on function public.put_game_state(uuid,text,text,jsonb,integer) from public;
revoke all on function public.patch_game_state(uuid,text,text,text[],jsonb,boolean) from public;

grant execute on function public.create_coop_profile(jsonb) to anon, service_role;
grant execute on function public.open_coop_profile(text) to anon, service_role;
grant execute on function public.patch_coop_profile(uuid,text,text[],jsonb,boolean) to anon, service_role;
grant execute on function public.get_game_state(uuid,text,text) to anon, service_role;
grant execute on function public.put_game_state(uuid,text,text,jsonb,integer) to anon, service_role;
grant execute on function public.patch_game_state(uuid,text,text,text[],jsonb,boolean) to anon, service_role;

commit;

-- End of review-only SnowRunner bootstrap.
