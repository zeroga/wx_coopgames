-- Additive, idempotent schema. No old tables, profiles or public vehicle data changed.
-- Codes are bearer credentials, generated only on the server. Team reads omit member codes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists private.aw_member_saves (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  name text not null check (length(name) between 1 and 60),
  payload jsonb not null default '{"assets":{},"tokens":{},"routes":{},"confirmedRewards":{},"confirmedRequirements":{}}',
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
create table if not exists private.aw_team_saves (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  name text not null check (length(name) between 1 and 60),
  payload jsonb not null default '{"roles":[],"assignments":{},"dependencies":[],"legacyAudit":[]}',
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
create table if not exists private.aw_team_members (
  team_id uuid not null references private.aw_team_saves(id) on delete cascade,
  member_id uuid not null references private.aw_member_saves(id) on delete restrict,
  active boolean not null default true,
  sort_order integer not null default 0,
  primary key (team_id,member_id)
);
create index if not exists aw_team_members_member_idx on private.aw_team_members(member_id,team_id);
alter table private.aw_member_saves enable row level security;
alter table private.aw_team_saves enable row level security;
alter table private.aw_team_members enable row level security;
revoke all on private.aw_member_saves,private.aw_team_saves,private.aw_team_members from public,anon,authenticated;

-- SECURITY DEFINER is intentional: this existing application uses code-based access
-- without user authentication. Direct table access is denied. Every non-create action
-- verifies the appropriate hashed bearer code; member writes require a member code.
-- The private implementation is not directly executable by API roles.
create or replace function private.aw_archive_impl(p_action text,p_code text,p_payload jsonb,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(btrim(coalesce(p_code,'')));
  v_hash text;
  m private.aw_member_saves;
  t private.aw_team_saves;
  v_member_code text;
  v_data jsonb;
  v_members jsonb;
  v_name text;
  v_id uuid;
  v_item jsonb;
  v_count integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 1048576 then
    raise exception 'INVALID_PAYLOAD';
  end if;
  if p_action in ('create_member','create_team') then
    v_name := btrim(coalesce(p_payload->>'name',''));
    if length(v_name) not between 1 and 60 then raise exception 'INVALID_NAME'; end if;
    v_code := 'AW-' || case when p_action='create_member' then 'M-' else 'T-' end || upper(encode(extensions.gen_random_bytes(16),'hex'));
    v_hash := encode(extensions.digest(v_code,'sha256'),'hex');
    if p_action='create_member' then
      -- Validate via the same put path before accepting imported member contents.
      insert into private.aw_member_saves(code_hash,name) values(v_hash,v_name) returning * into m;
      if p_payload ? 'data' then
        perform private.aw_archive_impl('put_member',v_code,p_payload,m.version);
        select * into m from private.aw_member_saves where id=m.id;
      end if;
      return jsonb_build_object('id',m.id,'code',v_code,'name',m.name,'data',m.payload,'version',m.version);
    end if;
    insert into private.aw_team_saves(code_hash,name) values(v_hash,v_name) returning * into t;
    return jsonb_build_object('id',t.id,'code',v_code,'name',t.name,'data',t.payload,'members','[]'::jsonb,'version',t.version);
  end if;
  if v_code !~ '^AW-[TM]-[A-F0-9]{32}$' then raise exception 'INVALID_AW_CODE'; end if;
  v_hash := encode(extensions.digest(v_code,'sha256'),'hex');
  if p_action in ('open_member','put_member') then
    if v_code !~ '^AW-M-' then raise exception 'MEMBER_CODE_REQUIRED'; end if;
    select * into m from private.aw_member_saves where code_hash=v_hash for update;
    if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
    if p_action='put_member' then
      if p_expected_version is distinct from m.version then raise exception 'AW_VERSION_CONFLICT'; end if;
      v_name := btrim(coalesce(p_payload->>'name',''));
      v_data := p_payload->'data';
      if length(v_name) not between 1 and 60 or jsonb_typeof(v_data) is distinct from 'object' then raise exception 'INVALID_MEMBER_DATA'; end if;
      if (v_data - array['assets','tokens','routes','confirmedRewards','confirmedRequirements']) <> '{}'::jsonb then raise exception 'INVALID_MEMBER_FIELDS'; end if;
      if jsonb_typeof(v_data->'assets') is distinct from 'object' or jsonb_typeof(v_data->'tokens') is distinct from 'object'
        or jsonb_typeof(v_data->'routes') is distinct from 'object' or jsonb_typeof(v_data->'confirmedRewards') is distinct from 'object'
        or jsonb_typeof(v_data->'confirmedRequirements') is distinct from 'object' then raise exception 'INVALID_MEMBER_FIELDS'; end if;
      for v_item in select value from jsonb_each(v_data->'assets') loop
        if v_item->>'status' is null or v_item->>'status' not in ('owned','planned') or jsonb_typeof(v_item) <> 'object' then raise exception 'INVALID_ASSET'; end if;
      end loop;
      for v_item in select value from jsonb_each(v_data->'tokens') loop
        if jsonb_typeof(v_item) <> 'number' or v_item::text !~ '^[0-9]+$' or (v_item::text)::numeric > 9007199254740991 then raise exception 'INVALID_TOKEN'; end if;
      end loop;
      update private.aw_member_saves set name=v_name,payload=v_data,version=version+1,updated_at=now() where id=m.id returning * into m;
    end if;
    return jsonb_build_object('id',m.id,'name',m.name,'data',m.payload,'version',m.version,'updatedAt',m.updated_at);
  end if;
  if p_action not in ('open_team','put_team','link_member','unlink_member') then raise exception 'INVALID_ACTION'; end if;
  if v_code !~ '^AW-T-' then raise exception 'TEAM_CODE_REQUIRED'; end if;
  select * into t from private.aw_team_saves where code_hash=v_hash for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if p_action <> 'open_team' and p_expected_version is distinct from t.version then raise exception 'AW_VERSION_CONFLICT'; end if;
  if p_action='link_member' then
    v_member_code := upper(btrim(coalesce(p_payload->>'memberCode','')));
    if v_member_code !~ '^AW-M-[A-F0-9]{32}$' then raise exception 'MEMBER_CODE_REQUIRED'; end if;
    select * into m from private.aw_member_saves where code_hash=encode(extensions.digest(v_member_code,'sha256'),'hex');
    if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
    select count(*) into v_count from private.aw_team_members where team_id=t.id;
    if v_count >= 100 and not exists(select 1 from private.aw_team_members where team_id=t.id and member_id=m.id) then raise exception 'TEAM_MEMBER_LIMIT'; end if;
    insert into private.aw_team_members(team_id,member_id,sort_order) values(t.id,m.id,v_count) on conflict(team_id,member_id) do nothing;
    update private.aw_team_saves set version=version+1,updated_at=now() where id=t.id returning * into t;
  elsif p_action='unlink_member' then
    v_id := (p_payload->>'memberId')::uuid;
    delete from private.aw_team_members where team_id=t.id and member_id=v_id;
    -- Remove this team's associations only. The independent member save is retained.
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_data from jsonb_each(t.payload->'assignments') where split_part(value->>'assetId','~',1) <> v_id::text;
    t.payload := jsonb_set(t.payload,'{assignments}',v_data);
    select coalesce(jsonb_agg(value),'[]'::jsonb) into v_data from jsonb_array_elements(t.payload->'dependencies') where (t.payload->'assignments') ? (value->>'assignmentId') and (t.payload->'assignments') ? (value->>'targetId');
    t.payload := jsonb_set(t.payload,'{dependencies}',v_data);
    update private.aw_team_saves set payload=t.payload,version=version+1,updated_at=now() where id=t.id returning * into t;
  elsif p_action='put_team' then
    v_name := btrim(coalesce(p_payload->>'name',''));v_data := p_payload->'data';
    if length(v_name) not between 1 and 60 or jsonb_typeof(v_data) is distinct from 'object' then raise exception 'INVALID_TEAM_DATA'; end if;
    if (v_data - array['roles','assignments','dependencies','legacyAudit']) <> '{}'::jsonb then raise exception 'INVALID_TEAM_FIELDS'; end if;
    if jsonb_typeof(v_data->'roles') is distinct from 'array' or jsonb_typeof(v_data->'assignments') is distinct from 'object'
      or jsonb_typeof(v_data->'dependencies') is distinct from 'array' or jsonb_typeof(v_data->'legacyAudit') is distinct from 'array' then raise exception 'INVALID_TEAM_FIELDS'; end if;
    if jsonb_array_length(v_data->'roles')>100 then raise exception 'ROLE_LIMIT'; end if;
    for v_item in select value from jsonb_array_elements(v_data->'roles') loop
      if coalesce(v_item->>'id','')='' or length(btrim(coalesce(v_item->>'name',''))) not between 1 and 60 then raise exception 'INVALID_ROLE'; end if;
    end loop;
    for v_item in select value from jsonb_each(v_data->'assignments') loop
      if v_item->>'level' is null or v_item->>'level' not in ('primary','backup','transition') then raise exception 'INVALID_ASSIGNMENT'; end if;
      if not exists(select 1 from private.aw_team_members where team_id=t.id and member_id::text=split_part(v_item->>'assetId','~',1)) then raise exception 'UNLINKED_MEMBER'; end if;
      if not exists(select 1 from jsonb_array_elements(v_data->'roles') r where r->>'id'=v_item->>'roleId') then raise exception 'UNKNOWN_ROLE'; end if;
    end loop;
    for v_item in select value from jsonb_array_elements(v_data->'dependencies') loop
      if not ((v_data->'assignments') ? (v_item->>'assignmentId') and (v_data->'assignments') ? (v_item->>'targetId')) then raise exception 'INVALID_DEPENDENCY'; end if;
    end loop;
    for v_item in select value from jsonb_array_elements(coalesce(p_payload->'members','[]'::jsonb)) loop
      update private.aw_team_members set active=coalesce((v_item->>'active')::boolean,true),sort_order=coalesce((v_item->>'order')::integer,0)
        where team_id=t.id and member_id::text=v_item->>'id';
    end loop;
    update private.aw_team_saves set name=v_name,payload=v_data,version=version+1,updated_at=now() where id=t.id returning * into t;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',mem.id,'name',mem.name,'data',mem.payload,'version',mem.version,'active',l.active,'order',l.sort_order) order by l.sort_order,mem.id),'[]'::jsonb)
    into v_members from private.aw_team_members l join private.aw_member_saves mem on mem.id=l.member_id where l.team_id=t.id;
  return jsonb_build_object('id',t.id,'name',t.name,'data',t.payload,'members',v_members,'version',t.version,'updatedAt',t.updated_at);
end;
$$;
revoke all on function private.aw_archive_impl(text,text,jsonb,integer) from public,anon,authenticated;

create or replace function public.aw_archive(p_action text,p_code text default null,p_payload jsonb default '{}'::jsonb,p_expected_version integer default null)
returns jsonb language sql security definer set search_path = '' as $$
  select private.aw_archive_impl(p_action,p_code,p_payload,p_expected_version);
$$;
revoke all on function public.aw_archive(text,text,jsonb,integer) from public;
grant execute on function public.aw_archive(text,text,jsonb,integer) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
