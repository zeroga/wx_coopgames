-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';set local statement_timeout='25s';
CREATE OR REPLACE FUNCTION private.aw_plan_access(p_workspace_id uuid, p_invite_code text, p_action text, p_user_id text DEFAULT NULL::text, p_vehicle_id uuid DEFAULT NULL::uuid, p_role text DEFAULT NULL::text, p_priority integer DEFAULT NULL::integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare p private.coop_profiles;result jsonb;normalized text;
begin
 normalized:=regexp_replace(upper(coalesce(p_invite_code,'')),'[^A-F0-9]','','g');
 if length(normalized)<>20 then raise exception 'INVALID_INVITE_CODE';end if;
 select * into p from private.coop_profiles
 where id=p_workspace_id and invite_code_hash=encode(extensions.digest(normalized,'sha256'),'hex');
 if not found then raise exception 'WORKSPACE_NOT_FOUND_OR_BAD_CODE';end if;
 if p_action in ('upsert','delete') then
  if p_user_id is null or not ((p.profile_data->'users') ? p_user_id) then raise exception 'UNKNOWN_WORKSPACE_MEMBER';end if;
  if p_vehicle_id is null then raise exception 'VEHICLE_REQUIRED';end if;
 end if;
 if p_action='upsert' then
  insert into private.aw_fleet_plan_items(workspace_id,user_id,vehicle_id,role,priority,note)
  values(p_workspace_id,p_user_id,p_vehicle_id,p_role,p_priority,p_note)
  on conflict(workspace_id,user_id,vehicle_id) do update set role=excluded.role,priority=excluded.priority,note=excluded.note;
 elsif p_action='delete' then
  delete from private.aw_fleet_plan_items where workspace_id=p_workspace_id and user_id=p_user_id and vehicle_id=p_vehicle_id;
 elsif p_action<>'list' then raise exception 'INVALID_ACTION';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'workspace_id',i.workspace_id,'user_id',i.user_id,'display_name',p.profile_data->'users'->>i.user_id,'vehicle_id',i.vehicle_id,'status',i.status,'role',i.role,'priority',i.priority,'note',i.note,'created_at',i.created_at,'updated_at',i.updated_at) order by i.created_at),'[]'::jsonb)
 into result from private.aw_fleet_plan_items i where i.workspace_id=p_workspace_id;
 return result;
end $function$
;

create or replace function private.aw_protect_plan_members() returns trigger language plpgsql set search_path=pg_catalog as $fn$
begin
 if exists(select 1 from private.aw_fleet_plan_items i where i.workspace_id=new.id and not (coalesce(new.profile_data->'users','{}'::jsonb) ? i.user_id))
 then raise exception 'MEMBER_HAS_AW_PLANS';end if;return new;
end $fn$;
create trigger aw_protect_members before update of profile_data on private.coop_profiles
 for each row execute function private.aw_protect_plan_members();
revoke all on function private.aw_protect_plan_members() from public,anon,authenticated;
revoke execute on function public.set_aw_vehicle_plan_status(uuid,text,text,uuid,text),
 public.search_aw_vehicles(integer,text,text,text[],text[],numeric,text,boolean,text,text,text,text,text,numeric) from public;


