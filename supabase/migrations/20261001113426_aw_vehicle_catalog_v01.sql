-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.

create table public.dealers (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 name text not null, sort_order integer not null default 0, source_url text
);
create table public.vehicles (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 name text not null, tier smallint check(tier between 1 and 10), is_legendary boolean not null default false,
 vehicle_class text check(vehicle_class in ('MBT','LT','AFV','TD','SPG')),
 nation text, dealer_id uuid references public.dealers(id),
 acquisition_type text check(acquisition_type in ('progression','premium','event','special','other')),
 hp integer check(hp>0), top_speed numeric check(top_speed>=0), view_range numeric check(view_range>=0),
 camouflage numeric check(camouflage between 0 and 100),
 reverse_speed numeric, acceleration numeric, hull_traverse numeric, turret_traverse numeric,
 aim_time numeric, accuracy numeric,
 traits text[] not null default '{}', trait_details jsonb not null default '{}' check(jsonb_typeof(trait_details)='object'),
 performance_basis jsonb not null default '{}' check(jsonb_typeof(performance_basis)='object'),
 researchable_components jsonb not null default '[]' check(jsonb_typeof(researchable_components)='array'),
 summary text, source_url text, source_note text,
 verification_status text not null default 'needs_ingame_check' check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 last_checked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.vehicle_weapons (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 slug text not null, sort_order integer not null default 0, name text not null,
 weapon_type text not null check(weapon_type in ('cannon','autocannon','atgm','machine_gun','rocket','mortar','howitzer','other')),
 rate_of_fire numeric check(rate_of_fire>0), reload_seconds numeric check(reload_seconds>=0),
 magazine_size integer check(magazine_size>0), accuracy numeric, aim_time numeric, range numeric, velocity numeric,
 burst_size integer, intra_clip_reload numeric,
 requires_research boolean, traits text[] not null default '{}', trait_details jsonb not null default '{}',
 note text, source_url text, source_note text,
 verification_status text not null default 'needs_ingame_check' check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 last_checked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(vehicle_id,slug)
);
create table public.vehicle_ammo (
 id uuid primary key default gen_random_uuid(), weapon_id uuid not null references public.vehicle_weapons(id) on delete cascade,
 slug text not null, sort_order integer not null default 0, name text not null,
 ammo_type text not null check(ammo_type in ('ap','heat','he','hesh','smoke','other')), ammo_subtype text,
 traits text[] not null default '{}', trait_details jsonb not null default '{}', requires_research boolean,
 damage numeric check(damage>=0), penetration numeric check(penetration>=0), penetration_reference_m numeric check(penetration_reference_m>=0),
 range numeric, velocity numeric, note text, source_url text, source_note text,
 verification_status text not null default 'needs_ingame_check' check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 last_checked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(weapon_id,slug)
);
create table public.vehicle_progression_edges (
 id uuid primary key default gen_random_uuid(), from_vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 to_vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 edge_type text not null check(edge_type in ('normal','branch','token','special')), display_order integer not null default 0,
 source_url text, note text,
 verification_status text not null default 'needs_ingame_check' check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 check(from_vehicle_id<>to_vehicle_id), unique(from_vehicle_id,to_vehicle_id,edge_type)
);
create table public.unlock_paths (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 slug text not null, name text not null, sort_order integer not null default 0, note text, unique(vehicle_id,slug)
);
create table public.unlock_requirements (
 id uuid primary key default gen_random_uuid(), unlock_path_id uuid not null references public.unlock_paths(id) on delete cascade,
 slug text not null, requirement_type text not null check(requirement_type in ('vehicle_progress','vehicle_proven','vehicle_renowned','dealer_token','reputation','spotting','damage','kills','assists','wins','battles','own_vehicle','own_vehicle_count','tier_requirement','special')),
 source_vehicle_id uuid references public.vehicles(id), dealer_id uuid references public.dealers(id), token_code text,
 operator text check(operator in ('>=','>','=','<=','<','exists')), required_value numeric, unit text,
 scope jsonb not null default '{}', description text not null,
 verification_status text not null default 'needs_ingame_check' check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 source_url text, source_note text, last_checked_at timestamptz, sort_order integer not null default 0,
 check(requirement_type<>'dealer_token' or token_code is not null),
 unique(unlock_path_id,slug)
);
create table public.vehicle_token_rewards (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 token_code text not null, dealer_id uuid references public.dealers(id), token_tier smallint not null check(token_tier in(9,10)),
 quantity integer not null default 1 check(quantity>0),
 requirements jsonb not null default '[]' check(jsonb_typeof(requirements)='array'),
 description text not null, verification_status text not null default 'needs_ingame_check' check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 source_url text, source_note text, last_checked_at timestamptz, unique(vehicle_id,token_code)
);
-- Existing SnowRunner profiles ARE the shared workspaces; expose aliases only in the private schema.
create view private.coop_workspaces with (security_invoker=true) as
 select id,profile_data,created_at,updated_at from private.coop_profiles;
create view private.workspace_members with (security_invoker=true) as
 select p.id workspace_id,m.key user_id,m.value display_name
 from private.coop_profiles p cross join lateral jsonb_each_text(p.profile_data->'users') m;
create table private.aw_fleet_plan_items (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references private.coop_profiles(id) on delete cascade,
 user_id text not null, vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 role text, priority integer, note text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,user_id,vehicle_id)
);
alter table private.aw_fleet_plan_items enable row level security;
revoke all on private.aw_fleet_plan_items,private.coop_workspaces,private.workspace_members from anon,authenticated;

create function private.aw_set_updated_at() returns trigger language plpgsql set search_path=pg_catalog as $fn$
begin new.updated_at=now();return new;end $fn$;
revoke all on function private.aw_set_updated_at() from public;
create function private.aw_validate_plan_member() returns trigger language plpgsql set search_path=pg_catalog as $fn$
begin
 if not exists(select 1 from private.coop_profiles p where p.id=new.workspace_id and (p.profile_data->'users') ? new.user_id)
 then raise exception 'UNKNOWN_WORKSPACE_MEMBER';end if;
 return new;
end $fn$;
revoke all on function private.aw_validate_plan_member() from public;
create trigger aw_plan_member before insert or update on private.aw_fleet_plan_items for each row execute function private.aw_validate_plan_member();

do $do$ declare t text;begin
 foreach t in array array['dealers','vehicles','vehicle_weapons','vehicle_ammo','vehicle_progression_edges','unlock_paths','unlock_requirements','vehicle_token_rewards'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to anon, authenticated',t);
 execute format('create policy aw_catalog_read on public.%I for select to anon, authenticated using (true)',t);
 end loop;
 foreach t in array array['vehicles','vehicle_weapons','vehicle_ammo'] loop
 execute format('create trigger aw_updated_at before update on public.%I for each row execute function private.aw_set_updated_at()',t);
 end loop;
end $do$;
create trigger aw_updated_at before update on private.aw_fleet_plan_items for each row execute function private.aw_set_updated_at();

create index vehicles_filter_idx on public.vehicles(tier,vehicle_class,acquisition_type);
create index vehicles_dealer_idx on public.vehicles(dealer_id);
create index vehicles_traits_idx on public.vehicles using gin(traits);
create index vehicles_nation_idx on public.vehicles(nation);
create index vehicle_weapons_traits_idx on public.vehicle_weapons using gin(traits);
create index vehicle_ammo_traits_idx on public.vehicle_ammo using gin(traits);
create index vehicle_ammo_ap_pen_idx on public.vehicle_ammo(penetration,weapon_id) where ammo_type='ap';
create index progression_to_idx on public.vehicle_progression_edges(to_vehicle_id);
create index unlock_req_source_idx on public.unlock_requirements(source_vehicle_id);
create index unlock_req_dealer_idx on public.unlock_requirements(dealer_id);
create index unlock_req_token_idx on public.unlock_requirements(token_code) where token_code is not null;
create index token_rewards_code_idx on public.vehicle_token_rewards(token_code);
create index token_rewards_dealer_idx on public.vehicle_token_rewards(dealer_id);
create index aw_plan_vehicle_idx on private.aw_fleet_plan_items(vehicle_id);

comment on column public.vehicles.camouflage is 'Percentage points: 15 means 15%, not 0.15. Unknown remains NULL.';
comment on column public.vehicles.performance_basis is 'Document source configuration and commander/crew/retrofit inclusion. Unknown must remain unknown.';
comment on column public.vehicles.researchable_components is 'Array of {name,requires_research,note,...}; vehicle capabilities themselves use stable codes in traits.';
comment on column public.vehicles.traits is 'Stable vehicle capability codes, e.g. era, smoke, infantry_squad. Missing tag does not prove absence until coverage is verified.';
comment on column public.vehicle_weapons.rate_of_fire is 'Rounds/minute; for autocannons specify burst versus sustained in note.';
comment on column public.vehicle_ammo.penetration is 'mm; reference distance in penetration_reference_m and other measurement conditions in note.';
comment on column public.unlock_paths.vehicle_id is 'Paths for the same vehicle are OR. Requirements within a path are AND.';
comment on column public.unlock_requirements.token_code is 'Exact same dealer-scoped token identifier as vehicle_token_rewards.token_code, e.g. marat_shishkin_t10.';
comment on column private.aw_fleet_plan_items.user_id is 'Existing team profile member key (e.g. A/B), not an auth.users UUID. Same shared-code authorization model as SnowRunner.';
comment on column public.vehicles.is_legendary is 'Legendary vehicles use NULL numeric tier rather than inventing Tier 11.';

-- Private privileged implementation validates the existing shared team code on EVERY operation.
create function private.aw_plan_access(p_workspace_id uuid,p_invite_code text,p_action text,p_user_id text default null,p_vehicle_id uuid default null,p_role text default null,p_priority integer default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare p private.coop_profiles;result jsonb;normalized text;
begin
 normalized:=upper(regexp_replace(coalesce(p_invite_code,''),'[^A-F0-9]','','g'));
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
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'workspace_id',i.workspace_id,'user_id',i.user_id,'display_name',p.profile_data->'users'->>i.user_id,'vehicle_id',i.vehicle_id,'role',i.role,'priority',i.priority,'note',i.note,'created_at',i.created_at,'updated_at',i.updated_at) order by i.created_at),'[]'::jsonb)
 into result from private.aw_fleet_plan_items i where i.workspace_id=p_workspace_id;
 return result;
end $fn$;
revoke all on function private.aw_plan_access(uuid,text,text,text,uuid,text,integer,text) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.aw_plan_access(uuid,text,text,text,uuid,text,integer,text) to anon,authenticated;
create function public.get_aw_fleet_plan(p_workspace_id uuid,p_invite_code text)
returns jsonb language sql security invoker set search_path=pg_catalog as $fn$
 select private.aw_plan_access(p_workspace_id,p_invite_code,'list')
$fn$;
create function public.upsert_aw_fleet_plan_item(p_workspace_id uuid,p_invite_code text,p_user_id text,p_vehicle_id uuid,p_role text default null,p_priority integer default null,p_note text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $fn$
 select private.aw_plan_access(p_workspace_id,p_invite_code,'upsert',p_user_id,p_vehicle_id,p_role,p_priority,p_note)
$fn$;
create function public.delete_aw_fleet_plan_item(p_workspace_id uuid,p_invite_code text,p_user_id text,p_vehicle_id uuid)
returns jsonb language sql security invoker set search_path=pg_catalog as $fn$
 select private.aw_plan_access(p_workspace_id,p_invite_code,'delete',p_user_id,p_vehicle_id)
$fn$;
revoke all on function public.get_aw_fleet_plan(uuid,text),public.upsert_aw_fleet_plan_item(uuid,text,text,uuid,text,integer,text),public.delete_aw_fleet_plan_item(uuid,text,text,uuid) from public;
grant execute on function public.get_aw_fleet_plan(uuid,text),public.upsert_aw_fleet_plan_item(uuid,text,text,uuid,text,integer,text),public.delete_aw_fleet_plan_item(uuid,text,text,uuid) to anon,authenticated;

create function public.filter_aw_vehicles(
 p_vehicle_traits text[] default '{}',p_ammo_traits text[] default '{}',p_min_ap_penetration numeric default null,
 p_tier integer default null,p_vehicle_class text default null,p_dealer_slug text default null,p_nation text default null)
returns setof public.vehicles language sql stable security invoker set search_path=pg_catalog as $fn$
 select v.* from public.vehicles v left join public.dealers d on d.id=v.dealer_id
 where v.traits @> coalesce(p_vehicle_traits,'{}')
 and (p_tier is null or v.tier=p_tier) and (p_vehicle_class is null or v.vehicle_class=p_vehicle_class)
 and (p_dealer_slug is null or d.slug=p_dealer_slug) and (p_nation is null or v.nation=p_nation)
 and (coalesce(cardinality(p_ammo_traits),0)=0 or exists(
 select 1 from public.vehicle_weapons w join public.vehicle_ammo a on a.weapon_id=w.id
 where w.vehicle_id=v.id and a.traits @> p_ammo_traits))
 and (p_min_ap_penetration is null or exists(
 select 1 from public.vehicle_weapons w join public.vehicle_ammo a on a.weapon_id=w.id
 where w.vehicle_id=v.id and a.ammo_type='ap' and a.penetration>=p_min_ap_penetration))
 order by v.tier nulls last,v.name
$fn$;
revoke all on function public.filter_aw_vehicles(text[],text[],numeric,integer,text,text,text) from public;
grant execute on function public.filter_aw_vehicles(text[],text[],numeric,integer,text,text,text) to anon,authenticated;


