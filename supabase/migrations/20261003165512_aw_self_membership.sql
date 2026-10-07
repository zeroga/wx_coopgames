-- Apply after 004. Only replaces RPC functions; no table or stored record is changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function private.aw_archive_self_impl(p_action text,p_code text,p_payload jsonb,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  t private.aw_team_saves;
  m private.aw_member_saves;
  mc text;
  code text := upper(btrim(coalesce(p_code,'')));
  data jsonb;
  before_other jsonb;
  after_other jsonb;
  entry record;
begin
  if p_action not in ('unlink_member','put_team') then
    return private.aw_archive_impl(p_action,p_code,p_payload,p_expected_version);
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>1048576 then raise exception 'INVALID_PAYLOAD';end if;
  if code !~ '^AW-T-[A-F0-9]{32}$' then raise exception 'TEAM_CODE_REQUIRED';end if;
  select * into t from private.aw_team_saves where code_hash=encode(extensions.digest(code,'sha256'),'hex') for update;
  if not found then raise exception 'TEAM_NOT_FOUND';end if;
  if p_expected_version is distinct from t.version then raise exception 'AW_VERSION_CONFLICT';end if;
  mc:=upper(btrim(coalesce(p_payload->>'memberCode','')));
  if mc !~ '^AW-M-[A-F0-9]{32}$' then raise exception 'MEMBER_CODE_REQUIRED';end if;
  select * into m from private.aw_member_saves where code_hash=encode(extensions.digest(mc,'sha256'),'hex');
  if not found then raise exception 'MEMBER_NOT_FOUND';end if;
  if not exists(select 1 from private.aw_team_members where team_id=t.id and member_id=m.id and active) then raise exception 'MEMBER_NOT_LINKED';end if;
  if p_action='unlink_member' then
    if p_payload->>'memberId' is distinct from m.id::text then raise exception 'SELF_ONLY';end if;
  else
    data:=p_payload->'data';
    if jsonb_typeof(data->'assignments') is distinct from 'object' or jsonb_typeof(data->'dependencies') is distinct from 'array' then raise exception 'INVALID_TEAM_DATA';end if;
    -- A whole-team upload must preserve every other member's manual responsibility.
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into before_other from jsonb_each(t.payload->'assignments') where split_part(value->>'assetId','~',1)<>m.id::text;
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into after_other from jsonb_each(data->'assignments') where split_part(value->>'assetId','~',1)<>m.id::text;
    if before_other is distinct from after_other then raise exception 'SELF_ONLY';end if;
    select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into before_other from jsonb_array_elements(t.payload->'dependencies') where split_part(value->>'assignmentId','~',1)<>m.id::text;
    select coalesce(jsonb_agg(value order by value),'[]'::jsonb) into after_other from jsonb_array_elements(data->'dependencies') where split_part(value->>'assignmentId','~',1)<>m.id::text;
    if before_other is distinct from after_other then raise exception 'SELF_ONLY';end if;
    for entry in select key,value from jsonb_each(data->'assignments') loop
      if entry.key is distinct from (entry.value->>'assetId')||'~'||(entry.value->>'roleId') or entry.value->>'id' is distinct from entry.key then raise exception 'INVALID_ASSIGNMENT';end if;
    end loop;
    for entry in select value from jsonb_array_elements(data->'dependencies') loop
      if split_part(entry.value->>'assignmentId','~',1) is distinct from split_part(entry.value->>'targetId','~',1) then raise exception 'SELF_ONLY';end if;
    end loop;
    -- Member presence, activation and order are not editable through team uploads.
    if p_payload ? 'members' then
      if jsonb_typeof(p_payload->'members') is distinct from 'array' then raise exception 'INVALID_TEAM_DATA';end if;
      select coalesce(jsonb_agg(jsonb_build_object('id',member_id,'active',active,'order',sort_order) order by member_id),'[]'::jsonb) into before_other from private.aw_team_members where team_id=t.id;
      select coalesce(jsonb_agg(value order by value->>'id'),'[]'::jsonb) into after_other from jsonb_array_elements(p_payload->'members');
      if before_other is distinct from after_other then raise exception 'SELF_ONLY';end if;
    end if;
  end if;
  return private.aw_archive_impl(p_action,p_code,p_payload,p_expected_version);
end;
$$;
revoke all on function private.aw_archive_self_impl(text,text,jsonb,integer) from public,anon,authenticated;
create or replace function public.aw_archive(p_action text,p_code text default null,p_payload jsonb default '{}'::jsonb,p_expected_version integer default null)
returns jsonb language sql security definer set search_path='' as $$
  select private.aw_archive_self_impl(p_action,p_code,p_payload,p_expected_version);
$$;
revoke all on function public.aw_archive(text,text,jsonb,integer) from public;
grant execute on function public.aw_archive(text,text,jsonb,integer) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
