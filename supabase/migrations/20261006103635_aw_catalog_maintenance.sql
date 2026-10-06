-- AW maintenance v1. No production facts or release pointer are changed here.
-- Separate reviewed bootstrap SQL imports existing Git evidence into Supabase.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
create schema if not exists private;
create table private.aw_catalog_contract (name text primary key, spec jsonb not null);
insert into private.aw_catalog_contract(name,spec) values('ammo_guidance_modes',$contract${"columns":{"ammo_id":{"type":"uuid","required":true},"lock_time_seconds":{"type":"numeric","required":false},"mode_code":{"type":"text","required":true},"note":{"type":"text","required":false},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"verification_status":{"type":"text","required":true}},"primaryKey":["ammo_id","mode_code"],"unique":[],"references":[{"fields":["ammo_id"],"table":"vehicle_ammo","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('ammo_penetration_samples',$contract${"columns":{"ammo_id":{"type":"uuid","required":true},"condition_note":{"type":"text","required":false},"distance_m":{"type":"numeric","required":false},"id":{"type":"uuid","required":true},"impact_angle_deg":{"type":"numeric","required":false},"penetration_mm":{"type":"numeric","required":true},"sample_key":{"type":"text","required":true},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"verification_status":{"type":"text","required":true}},"primaryKey":["id"],"unique":[["ammo_id","sample_key"]],"references":[{"fields":["ammo_id"],"table":"vehicle_ammo","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('ammo_trait_links',$contract${"columns":{"ammo_id":{"type":"uuid","required":true},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"trait_code":{"type":"text","required":true},"verification_status":{"type":"text","required":true}},"primaryKey":["ammo_id","trait_code"],"unique":[],"references":[{"fields":["ammo_id"],"table":"vehicle_ammo","target":["id"]},{"fields":["trait_code"],"table":"ammo_traits","target":["code"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('ammo_traits',$contract${"columns":{"category":{"type":"text","required":true},"code":{"type":"text","required":true},"description":{"type":"text","required":false},"name_zh":{"type":"text","required":true}},"primaryKey":["code"],"unique":[],"references":[]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('ammo_upgrade_links',$contract${"columns":{"ammo_id":{"type":"uuid","required":true},"upgrade_id":{"type":"uuid","required":true},"vehicle_id":{"type":"uuid","required":true},"weapon_id":{"type":"uuid","required":true}},"primaryKey":["ammo_id","upgrade_id"],"unique":[],"references":[{"fields":["ammo_id","weapon_id"],"table":"vehicle_ammo","target":["id","weapon_id"]},{"fields":["upgrade_id","vehicle_id"],"table":"vehicle_upgrades","target":["id","vehicle_id"]},{"fields":["weapon_id","vehicle_id"],"table":"vehicle_weapons","target":["id","vehicle_id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('capabilities',$contract${"columns":{"category":{"type":"text","required":true},"code":{"type":"text","required":true},"description":{"type":"text","required":false},"name_zh":{"type":"text","required":true},"parent_code":{"type":"text","required":false}},"primaryKey":["code"],"unique":[],"references":[{"fields":["parent_code"],"table":"capabilities","target":["code"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('dealers',$contract${"columns":{"id":{"type":"uuid","required":true},"name":{"type":"text","required":true},"slug":{"type":"text","required":true},"sort_order":{"type":"integer","required":true},"source_url":{"type":"text","required":false}},"primaryKey":["id"],"unique":[["slug"]],"references":[]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('era_coverage',$contract${"columns":{"capability_id":{"type":"uuid","required":true},"location":{"type":"text","required":true},"note":{"type":"text","required":false}},"primaryKey":["capability_id","location"],"unique":[],"references":[{"fields":["capability_id"],"table":"vehicle_era","target":["capability_id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('tech_tree_branches',$contract${"columns":{"dealer_id":{"type":"uuid","required":false},"id":{"type":"uuid","required":true},"name":{"type":"text","required":true},"slug":{"type":"text","required":true},"source_url":{"type":"text","required":false},"verification_status":{"type":"text","required":true}},"primaryKey":["id"],"unique":[["slug"]],"references":[{"fields":["dealer_id"],"table":"dealers","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('tokens',$contract${"columns":{"code":{"type":"text","required":true},"dealer_id":{"type":"uuid","required":false},"id":{"type":"uuid","required":true},"name":{"type":"text","required":true},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"tier":{"type":"smallint","required":false}},"primaryKey":["id"],"unique":[["code"]],"references":[{"fields":["dealer_id"],"table":"dealers","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('unlock_paths',$contract${"columns":{"id":{"type":"uuid","required":true},"is_complete":{"type":"boolean","required":true},"name":{"type":"text","required":true},"note":{"type":"text","required":false},"slug":{"type":"text","required":true},"sort_order":{"type":"integer","required":true},"target_upgrade_id":{"type":"uuid","required":false},"vehicle_id":{"type":"uuid","required":true}},"primaryKey":["id"],"unique":[["vehicle_id","slug"]],"references":[{"fields":["vehicle_id"],"table":"vehicles","target":["id"]},{"fields":["target_upgrade_id","vehicle_id"],"table":"vehicle_upgrades","target":["id","vehicle_id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('unlock_requirements',$contract${"columns":{"dealer_id":{"type":"uuid","required":false},"description":{"type":"text","required":true},"event_code":{"type":"text","required":false},"id":{"type":"uuid","required":true},"last_checked_at":{"type":"timestamp with time zone","required":false},"operator":{"type":"text","required":false},"required_value":{"type":"numeric","required":false},"requirement_type":{"type":"text","required":true},"scope":{"type":"jsonb","required":true},"slug":{"type":"text","required":true},"sort_order":{"type":"integer","required":true},"source_note":{"type":"text","required":false},"source_type":{"type":"text","required":false},"source_upgrade_id":{"type":"uuid","required":false},"source_url":{"type":"text","required":false},"source_vehicle_id":{"type":"uuid","required":false},"token_id":{"type":"uuid","required":false},"unit":{"type":"text","required":false},"unlock_path_id":{"type":"uuid","required":true},"verification_status":{"type":"text","required":true}},"primaryKey":["id"],"unique":[["unlock_path_id","slug"]],"references":[{"fields":["dealer_id"],"table":"dealers","target":["id"]},{"fields":["source_vehicle_id"],"table":"vehicles","target":["id"]},{"fields":["token_id"],"table":"tokens","target":["id"]},{"fields":["unlock_path_id"],"table":"unlock_paths","target":["id"]},{"fields":["source_upgrade_id","source_vehicle_id"],"table":"vehicle_upgrades","target":["id","vehicle_id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('upgrade_prerequisites',$contract${"columns":{"prerequisite_upgrade_id":{"type":"uuid","required":true},"upgrade_id":{"type":"uuid","required":true},"vehicle_id":{"type":"uuid","required":true}},"primaryKey":["upgrade_id","prerequisite_upgrade_id"],"unique":[],"references":[{"fields":["prerequisite_upgrade_id","vehicle_id"],"table":"vehicle_upgrades","target":["id","vehicle_id"]},{"fields":["upgrade_id","vehicle_id"],"table":"vehicle_upgrades","target":["id","vehicle_id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_ammo',$contract${"columns":{"accuracy_deg":{"type":"numeric","required":false},"ammo_subtype":{"type":"text","required":false},"ammo_type":{"type":"text","required":true},"created_at":{"type":"timestamp with time zone","required":true},"damage":{"type":"numeric","required":false},"explosion_radius_m":{"type":"numeric","required":false},"id":{"type":"uuid","required":true},"intra_clip_reload":{"type":"numeric","required":false},"is_guided":{"type":"boolean","required":false},"is_missile":{"type":"boolean","required":false},"last_checked_at":{"type":"timestamp with time zone","required":false},"magazine_mechanism":{"type":"text","required":false},"magazine_size":{"type":"integer","required":false},"module_damage":{"type":"numeric","required":false},"module_damage_bonus_pct":{"type":"numeric","required":false},"name":{"type":"text","required":true},"note":{"type":"text","required":false},"penetration":{"type":"numeric","required":false},"penetration_reference_m":{"type":"numeric","required":false},"range":{"type":"numeric","required":false},"rate_of_fire":{"type":"numeric","required":false},"reload_seconds":{"type":"numeric","required":false},"requires_research":{"type":"boolean","required":false},"slug":{"type":"text","required":true},"sort_order":{"type":"integer","required":true},"source_note":{"type":"text","required":false},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"updated_at":{"type":"timestamp with time zone","required":true},"velocity":{"type":"numeric","required":false},"verification_status":{"type":"text","required":true},"weapon_id":{"type":"uuid","required":true}},"primaryKey":["id"],"unique":[["id","weapon_id"],["weapon_id","slug"]],"references":[{"fields":["weapon_id"],"table":"vehicle_weapons","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_armor',$contract${"columns":{"composition":{"type":"text","required":false},"configuration_key":{"type":"text","required":true},"effective_ap_mm":{"type":"numeric","required":false},"effective_heat_mm":{"type":"numeric","required":false},"id":{"type":"uuid","required":true},"location":{"type":"text","required":true},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"thickness_mm":{"type":"numeric","required":false},"upgrade_id":{"type":"uuid","required":false},"vehicle_id":{"type":"uuid","required":true},"verification_status":{"type":"text","required":true}},"primaryKey":["id"],"unique":[["vehicle_id","configuration_key","location"]],"references":[{"fields":["upgrade_id","vehicle_id"],"table":"vehicle_upgrades","target":["id","vehicle_id"]},{"fields":["vehicle_id"],"table":"vehicles","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_branch_memberships',$contract${"columns":{"branch_id":{"type":"uuid","required":true},"display_order":{"type":"integer","required":false},"vehicle_id":{"type":"uuid","required":true}},"primaryKey":["vehicle_id","branch_id"],"unique":[],"references":[{"fields":["branch_id"],"table":"tech_tree_branches","target":["id"]},{"fields":["vehicle_id"],"table":"vehicles","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_capabilities',$contract${"columns":{"availability":{"type":"text","required":true},"capability_code":{"type":"text","required":true},"effect_data":{"type":"jsonb","required":true},"effect_description":{"type":"text","required":false},"id":{"type":"uuid","required":true},"last_checked_at":{"type":"timestamp with time zone","required":false},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"upgrade_id":{"type":"uuid","required":false},"variant_key":{"type":"text","required":true},"vehicle_id":{"type":"uuid","required":true},"verification_status":{"type":"text","required":true}},"primaryKey":["id"],"unique":[["id","vehicle_id"],["vehicle_id","capability_code","variant_key"]],"references":[{"fields":["capability_code"],"table":"capabilities","target":["code"]},{"fields":["upgrade_id","vehicle_id"],"table":"vehicle_upgrades","target":["id","vehicle_id"]},{"fields":["vehicle_id"],"table":"vehicles","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_crew_positions',$contract${"columns":{"location":{"type":"text","required":false},"note":{"type":"text","required":false},"occupant_count":{"type":"smallint","required":true},"position_key":{"type":"text","required":true},"role":{"type":"text","required":true},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"vehicle_id":{"type":"uuid","required":true},"verification_status":{"type":"text","required":true}},"primaryKey":["vehicle_id","position_key"],"unique":[],"references":[{"fields":["vehicle_id"],"table":"vehicles","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_era',$contract${"columns":{"ap_reduction_pct":{"type":"numeric","required":false},"capability_id":{"type":"uuid","required":true},"era_name":{"type":"text","required":false},"era_type":{"type":"text","required":false},"generation":{"type":"smallint","required":false},"heat_reduction_pct":{"type":"numeric","required":false},"is_special":{"type":"boolean","required":false},"layer_count":{"type":"smallint","required":false}},"primaryKey":["capability_id"],"unique":[],"references":[{"fields":["capability_id"],"table":"vehicle_capabilities","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_infantry',$contract${"columns":{"capability_id":{"type":"uuid","required":true},"deployment_cooldown_seconds":{"type":"numeric","required":false},"infantry_type":{"type":"text","required":true},"squad_count":{"type":"smallint","required":false},"trooper_count":{"type":"smallint","required":false}},"primaryKey":["capability_id","infantry_type"],"unique":[],"references":[{"fields":["capability_id"],"table":"vehicle_capabilities","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_progression_edges',$contract${"columns":{"display_order":{"type":"integer","required":true},"edge_type":{"type":"text","required":true},"from_vehicle_id":{"type":"uuid","required":true},"id":{"type":"uuid","required":true},"note":{"type":"text","required":false},"source_url":{"type":"text","required":false},"to_vehicle_id":{"type":"uuid","required":true},"verification_status":{"type":"text","required":true}},"primaryKey":["id"],"unique":[["from_vehicle_id","to_vehicle_id","edge_type"]],"references":[{"fields":["from_vehicle_id"],"table":"vehicles","target":["id"]},{"fields":["to_vehicle_id"],"table":"vehicles","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_token_rewards',$contract${"columns":{"description":{"type":"text","required":true},"id":{"type":"uuid","required":true},"last_checked_at":{"type":"timestamp with time zone","required":false},"quantity":{"type":"integer","required":true},"source_note":{"type":"text","required":false},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"token_id":{"type":"uuid","required":true},"vehicle_id":{"type":"uuid","required":true},"verification_status":{"type":"text","required":true}},"primaryKey":["id"],"unique":[["vehicle_id","token_id"]],"references":[{"fields":["token_id"],"table":"tokens","target":["id"]},{"fields":["vehicle_id"],"table":"vehicles","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_upgrades',$contract${"columns":{"additional_effects":{"type":"jsonb","required":true},"availability":{"type":"text","required":true},"credit_cost":{"type":"numeric","required":false},"effect_description":{"type":"text","required":false},"engine_power_hp":{"type":"numeric","required":false},"hp_bonus":{"type":"integer","required":false},"id":{"type":"uuid","required":true},"is_mandatory":{"type":"boolean","required":false},"is_vehicle_prerequisite":{"type":"boolean","required":false},"last_checked_at":{"type":"timestamp with time zone","required":false},"name":{"type":"text","required":true},"reverse_speed_kmh":{"type":"numeric","required":false},"slug":{"type":"text","required":true},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"top_speed_kmh":{"type":"numeric","required":false},"upgrade_type":{"type":"text","required":true},"vehicle_id":{"type":"uuid","required":true},"verification_status":{"type":"text","required":true},"xp_cost":{"type":"numeric","required":false}},"primaryKey":["id"],"unique":[["id","vehicle_id"],["vehicle_id","slug"]],"references":[{"fields":["vehicle_id"],"table":"vehicles","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicle_weapons',$contract${"columns":{"accuracy":{"type":"numeric","required":false},"accuracy_deg":{"type":"numeric","required":false},"aim_time":{"type":"numeric","required":false},"burst_size":{"type":"integer","required":false},"caliber_mm":{"type":"numeric","required":false},"configuration_key":{"type":"text","required":false},"created_at":{"type":"timestamp with time zone","required":true},"depression_deg":{"type":"numeric","required":false},"elevation_deg":{"type":"numeric","required":false},"id":{"type":"uuid","required":true},"intra_clip_reload":{"type":"numeric","required":false},"last_checked_at":{"type":"timestamp with time zone","required":false},"magazine_mechanism":{"type":"text","required":false},"magazine_size":{"type":"integer","required":false},"name":{"type":"text","required":true},"note":{"type":"text","required":false},"range":{"type":"numeric","required":false},"rate_of_fire":{"type":"numeric","required":false},"reload_seconds":{"type":"numeric","required":false},"requires_research":{"type":"boolean","required":false},"role":{"type":"text","required":false},"slug":{"type":"text","required":true},"sort_order":{"type":"integer","required":true},"source_note":{"type":"text","required":false},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"updated_at":{"type":"timestamp with time zone","required":true},"vehicle_id":{"type":"uuid","required":true},"velocity":{"type":"numeric","required":false},"verification_status":{"type":"text","required":true},"weapon_type":{"type":"text","required":true}},"primaryKey":["id"],"unique":[["vehicle_id","slug"],["id","vehicle_id"]],"references":[{"fields":["vehicle_id"],"table":"vehicles","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('vehicles',$contract${"columns":{"acceleration_0_32_seconds":{"type":"numeric","required":false},"acquisition_note":{"type":"text","required":false},"acquisition_type":{"type":"text","required":false},"camouflage":{"type":"numeric","required":false},"capability_catalog_complete":{"type":"boolean","required":true},"created_at":{"type":"timestamp with time zone","required":true},"dealer_id":{"type":"uuid","required":false},"engine_power_hp":{"type":"numeric","required":false},"hp":{"type":"integer","required":false},"hull_traverse":{"type":"numeric","required":false},"id":{"type":"uuid","required":true},"image_url":{"type":"text","required":false},"internal_name":{"type":"text","required":false},"is_currently_researchable":{"type":"boolean","required":false},"is_legendary":{"type":"boolean","required":true},"is_premium":{"type":"boolean","required":false},"last_checked_at":{"type":"timestamp with time zone","required":false},"name":{"type":"text","required":true},"name_zh":{"type":"text","required":false},"nation":{"type":"text","required":false},"performance_basis":{"type":"jsonb","required":true},"power_to_weight_hp_t":{"type":"numeric","required":false},"release_status":{"type":"text","required":true},"reverse_speed":{"type":"numeric","required":false},"slug":{"type":"text","required":true},"source_note":{"type":"text","required":false},"source_type":{"type":"text","required":false},"source_url":{"type":"text","required":false},"summary":{"type":"text","required":false},"tier":{"type":"smallint","required":false},"top_speed":{"type":"numeric","required":false},"turret_traverse":{"type":"numeric","required":false},"updated_at":{"type":"timestamp with time zone","required":true},"vehicle_class":{"type":"text","required":false},"verification_status":{"type":"text","required":true},"view_range":{"type":"numeric","required":false},"weight_t":{"type":"numeric","required":false}},"primaryKey":["id"],"unique":[["slug"]],"references":[{"fields":["dealer_id"],"table":"dealers","target":["id"]}]}$contract$::jsonb);
insert into private.aw_catalog_contract(name,spec) values('weapon_upgrade_links',$contract${"columns":{"upgrade_id":{"type":"uuid","required":true},"vehicle_id":{"type":"uuid","required":true},"weapon_id":{"type":"uuid","required":true}},"primaryKey":["weapon_id","upgrade_id"],"unique":[],"references":[{"fields":["upgrade_id","vehicle_id"],"table":"vehicle_upgrades","target":["id","vehicle_id"]},{"fields":["weapon_id","vehicle_id"],"table":"vehicle_weapons","target":["id","vehicle_id"]}]}$contract$::jsonb);
create table private.aw_catalog_state (
 id boolean primary key default true check(id), revision bigint not null default 0,
 environment text not null default 'production' check(environment in ('production','staging')),
 checked_at text not null default '2026-10-01T12:06:24.751614+00:00', current_version text,
 initialized boolean not null default false
);
insert into private.aw_catalog_state(id) values(true);
create table private.aw_catalog_sections (name text primary key check(name in ('ammoEvidence','presentation')), content jsonb not null);
create table private.aw_catalog_grants (
 id uuid primary key default gen_random_uuid(), label text not null, task_id text not null,
 environment text not null check(environment in ('production','staging')),
 scopes text[] not null check(scopes <@ array['changes.upload','reviews.fetch','reviews.confirm']),
 allowed_tables text[] not null, allowed_sections text[] not null default '{}',
 allowed_operations text[] not null default array['upsert','delete'] check(allowed_operations <@ array['upsert','delete']),
 max_operations integer not null default 100 check(max_operations between 1 and 1000),
 max_uploads_per_day integer not null default 20 check(max_uploads_per_day between 1 and 1000),
 max_reviews_per_day integer not null default 20 check(max_reviews_per_day between 1 and 1000),
 max_publishes_per_day integer not null default 5 check(max_publishes_per_day between 1 and 100),
 issued_at timestamptz not null default now(), expires_at timestamptz not null,
 revoked_at timestamptz, check(expires_at > issued_at)
);
create table private.aw_catalog_keys (
 id uuid primary key default gen_random_uuid(), grant_id uuid not null references private.aw_catalog_grants(id),
 label text not null, token_sha256 text not null unique check(token_sha256 ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz,
 check(expires_at > issued_at)
);
create table private.aw_catalog_usage (
 grant_id uuid not null references private.aw_catalog_grants(id), day date not null,
 uploads integer not null default 0, reviews integer not null default 0, publishes integer not null default 0,
 last_used_at timestamptz not null default now(), primary key(grant_id,day)
);
create table private.aw_catalog_changes (
 id uuid primary key default gen_random_uuid(), grant_id uuid not null references private.aw_catalog_grants(id),
 key_id uuid not null references private.aw_catalog_keys(id), task_id text not null, environment text not null,
 request_id uuid not null, body jsonb not null, body_sha256 text not null, submitted_at timestamptz not null default now(),
 unique(grant_id,request_id)
);
create table private.aw_catalog_reviews (
 id uuid primary key default gen_random_uuid(), task_id text not null, environment text not null,
 grant_id uuid not null references private.aw_catalog_grants(id), request_id uuid not null,
 base_revision bigint not null, base_version text not null, changes jsonb not null, list_sha256 text not null,
 fetched_at timestamptz not null default now(), preview jsonb, result jsonb,
 unique(grant_id,request_id)
);
create table private.aw_catalog_processed (
 change_id uuid primary key references private.aw_catalog_changes(id), review_id uuid not null references private.aw_catalog_reviews(id),
 decision text not null check(decision in ('published','rejected')), processed_at timestamptz not null default now(), reason text not null
);
create table private.aw_catalog_releases (
 version text primary key, sequence bigint not null unique, revision bigint not null,
 review_id uuid unique references private.aw_catalog_reviews(id), release jsonb not null, published_at timestamptz not null default now()
);

-- Serialize all catalog writes before row locks, including manual SQL edits.
-- An immutable review compares this revision; count/max(updated_at) is not used.
create function private.aw_catalog_revision() returns trigger language plpgsql security definer set search_path='' set timezone='UTC' as $$
begin update private.aw_catalog_state set revision=revision+1 where id; return null; end $$;
create function private.aw_catalog_fixed_time() returns trigger language plpgsql set search_path='' set timezone='UTC' as $$
declare v text:=current_setting('aw.catalog_time',true);
begin if nullif(v,'') is not null then new.updated_at:=v::timestamptz; end if; return new; end $$;
do $$ declare n text; begin
 for n in select name from private.aw_catalog_contract loop
  execute format('create trigger aw_catalog_revision before insert or update or delete or truncate on public.%I for each statement execute function private.aw_catalog_revision()',n);
 end loop;
 foreach n in array array['vehicles','vehicle_weapons','vehicle_ammo'] loop
  execute format('create trigger zz_aw_catalog_fixed_time before update on public.%I for each row execute function private.aw_catalog_fixed_time()',n);
 end loop;
end $$;
create trigger aw_catalog_revision before insert or update or delete or truncate on private.aw_catalog_sections
 for each statement execute function private.aw_catalog_revision();

create function private.aw_catalog_snapshot() returns jsonb language plpgsql set search_path='' set timezone='UTC' as $$
declare n text; t jsonb; stable_key text; all_tables jsonb:='{}'; sections jsonb; checked text;
begin
 for n in select name from private.aw_catalog_contract order by name loop
  select string_agg(format('to_jsonb(t)->%L',v),',') into stable_key from jsonb_array_elements_text((select spec->'primaryKey' from private.aw_catalog_contract where name=n)) v;
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by jsonb_build_array(%s)::text collate "C"),''[]''::jsonb) from public.%I t',stable_key,n) into t;
  all_tables:=all_tables || jsonb_build_object(n,t);
 end loop;
 select jsonb_object_agg(name,content) into sections from private.aw_catalog_sections;
 select checked_at into checked from private.aw_catalog_state where id;
 return jsonb_build_object('tables',all_tables,'ammoEvidence',sections->'ammoEvidence','presentation',sections->'presentation','checkedAt',checked);
end $$;
create function private.aw_catalog_row(n text,k jsonb) returns jsonb language plpgsql set search_path='' set timezone='UTC' as $$
declare spec jsonb; predicate text; r jsonb;
begin
 select c.spec into spec from private.aw_catalog_contract c where name=n;
 if spec is null or jsonb_typeof(k)<>'array' or jsonb_array_length(k)<>jsonb_array_length(spec->'primaryKey') then raise exception 'AW_INVALID_PRIMARY_KEY'; end if;
 select string_agg(format('to_jsonb(t)->%L = $1->%s',p.value,p.i-1),' and ') into predicate from jsonb_array_elements_text(spec->'primaryKey') with ordinality p(value,i);
 execute format('select to_jsonb(t) from public.%I t where %s',n,predicate) into r using k;
 return r;
end $$;

-- Validate and merge against ORIGINAL rows, before applying any statement.
-- Equal writes deduplicate; different writes to the same field or delete/upsert conflict fail the whole review.
create function private.aw_catalog_merge(changes jsonb) returns jsonb language plpgsql set search_path='' set timezone='UTC' as $$
declare c jsonb; op jsonb; spec jsonb; pk text; f text; r jsonb; e jsonb; v jsonb; ident text;
 merged jsonb:='{}'; sections jsonb:='{}'; old jsonb; result jsonb;
begin
 for c in select value from jsonb_array_elements(changes) loop
  for op in select value from jsonb_array_elements(c->'body'->'operations') loop
   select s.spec into spec from private.aw_catalog_contract s where name=op->>'table';
   if spec is null or (op->>'op') not in ('upsert','delete') then raise exception 'AW_INVALID_OPERATION'; end if;
   r:=private.aw_catalog_row(op->>'table',op->'key'); e:=op->'expected'; v:=op->'values';
   if e='null'::jsonb then
    if r is not null or op->>'op'='delete' then raise exception 'AW_EXPECTED_MISMATCH'; end if;
   elsif jsonb_typeof(e)='object' and e<>'{}'::jsonb then
    if r is null then raise exception 'AW_EXPECTED_MISMATCH'; end if;
    for f in select jsonb_object_keys(e) loop
     if not (spec->'columns' ? f) or r->f is distinct from e->f then raise exception 'AW_EXPECTED_MISMATCH'; end if;
    end loop;
   else raise exception 'AW_EXPECTED_REQUIRED'; end if;
   if op->>'op'='upsert' then
    if jsonb_typeof(v)<>'object' or v='{}'::jsonb then raise exception 'AW_INVALID_VALUES'; end if;
    for f in select jsonb_object_keys(v) loop
     if not (spec->'columns' ? f) or f in ('created_at','updated_at','power_to_weight_hp_t') or spec->'primaryKey' ? f then raise exception 'AW_READ_ONLY_OR_UNKNOWN_COLUMN'; end if;
     if r is not null and not (e ? f) then raise exception 'AW_EXPECTED_REQUIRED'; end if;
    end loop;
   elsif v is not null then raise exception 'AW_DELETE_HAS_VALUES'; end if;
   ident:=(op->>'table')||':'||(op->'key')::text; old:=merged->ident;
   if old is not null then
    if old->>'op'<>op->>'op' then raise exception 'AW_BATCH_FIELD_CONFLICT'; end if;
    if op->>'op'='upsert' then
     for f in select jsonb_object_keys(v) loop
      if old->'values' ? f and old->'values'->f is distinct from v->f then raise exception 'AW_BATCH_FIELD_CONFLICT'; end if;
     end loop;
     op:=jsonb_set(op,'{values}',old->'values'||v);
    end if;
   end if;
   merged:=merged||jsonb_build_object(ident,op);
  end loop;
  for f,v in select key,value from jsonb_each(coalesce(c->'body'->'sections','{}'::jsonb)) loop
   if v->>'expected_sha256' is distinct from (select encode(sha256(convert_to(content::text,'UTF8')),'hex') from private.aw_catalog_sections where name=f) then raise exception 'AW_EXPECTED_MISMATCH'; end if;
   v:=v->'content';
   if sections ? f and sections->f is distinct from v then raise exception 'AW_BATCH_FIELD_CONFLICT'; end if;
   sections:=sections||jsonb_build_object(f,v);
  end loop;
 end loop;
 select coalesce(jsonb_agg(value order by key),'[]') into result from jsonb_each(merged);
 return jsonb_build_object('operations',result,'sections',sections);
end $$;

-- A public DELETE must never cascade into player/team archives or any non-catalog table.
create function private.aw_catalog_protect_archives(n text,k jsonb) returns void language plpgsql set search_path='' set timezone='UTC' as $$
declare fk record; row_data jsonb; predicate text; referenced boolean;
begin
 row_data:=private.aw_catalog_row(n,k);
 for fk in select c.*,s.nspname,cl.relname from pg_catalog.pg_constraint c
  join pg_catalog.pg_class cl on cl.oid=c.conrelid join pg_catalog.pg_namespace s on s.oid=cl.relnamespace
  where c.contype='f' and c.confrelid=format('public.%I',n)::regclass
  and not (s.nspname='public' and cl.relname in(select name from private.aw_catalog_contract)) loop
  select string_agg(format('to_jsonb(t)->%L = $1->%L',a.attname,b.attname),' and ') into predicate
   from unnest(fk.conkey,fk.confkey) p(src,dst)
   join pg_catalog.pg_attribute a on a.attrelid=fk.conrelid and a.attnum=p.src
   join pg_catalog.pg_attribute b on b.attrelid=fk.confrelid and b.attnum=p.dst;
  execute format('select exists(select 1 from %I.%I t where %s)',fk.nspname,fk.relname,predicate) into referenced using row_data;
  if referenced then raise exception 'AW_PRIVATE_ARCHIVE_REFERENCE'; end if;
 end loop;
end $$;

-- Apply trusted merged partial writes, or captured after-images for exact commit reproduction.
-- Foreign key dependencies are retried in a bounded pass; constraints and triggers remain enabled.
create function private.aw_catalog_apply(merged jsonb, at_time timestamptz) returns void language plpgsql set search_path='' set timezone='UTC' as $$
declare todo jsonb:=merged->'operations'; next_todo jsonb; op jsonb; n text; spec jsonb; k jsonb; r jsonb;
 values_row jsonb; cols text; expressions text; assignments text; predicate text; f text; i integer; progress boolean; why text;
begin
 perform set_config('aw.catalog_time',at_time::text,true);
 while jsonb_array_length(todo)>0 loop
  next_todo:='[]'; progress:=false;
  for op in select value from jsonb_array_elements(todo) loop
   n:=op->>'table'; k:=op->'key'; select c.spec into spec from private.aw_catalog_contract c where name=n;
   if spec is null then raise exception 'AW_INVALID_TABLE'; end if;
   select string_agg(format('to_jsonb(t)->%L = $1->%s',p.value,p.i-1),' and ') into predicate from jsonb_array_elements_text(spec->'primaryKey') with ordinality p(value,i);
   begin
    if op->>'op'='delete' then
     perform private.aw_catalog_protect_archives(n,k);
     execute format('delete from public.%I t where %s',n,predicate) using k;
    else
     values_row:=op->'values'; r:=private.aw_catalog_row(n,k);
     if r is null then
      for f,i in select value,ordinality::integer from jsonb_array_elements_text(spec->'primaryKey') with ordinality loop
       values_row:=values_row||jsonb_build_object(f,k->(i-1));
      end loop;
      select string_agg(format('%I',a.attname),',' order by a.attnum),string_agg(format('v.%I',a.attname),',' order by a.attnum) into cols,expressions
       from pg_catalog.pg_attribute a where a.attrelid=format('public.%I',n)::regclass and a.attnum>0 and not a.attisdropped and a.attgenerated='' and values_row ? a.attname;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) v',n,cols,expressions,n) using values_row;
     else
      select string_agg(format('%I=v.%I',a.attname,a.attname),',' order by a.attnum) into assignments
       from pg_catalog.pg_attribute a where a.attrelid=format('public.%I',n)::regclass and a.attnum>0 and not a.attisdropped and a.attgenerated='' and values_row ? a.attname and not (spec->'primaryKey' ? a.attname);
      execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$2) v where %s',n,assignments,n,predicate) using k,values_row;
     end if;
    end if;
    progress:=true;
   exception when foreign_key_violation then next_todo:=next_todo||jsonb_build_array(op); get stacked diagnostics why=MESSAGE_TEXT;
   end;
  end loop;
  if not progress then raise exception 'AW_FOREIGN_KEY_CONFLICT: %',why; end if;
  todo:=next_todo;
 end loop;
 for f,values_row in select key,value from jsonb_each(merged->'sections') loop
  insert into private.aw_catalog_sections(name,content) values(f,values_row) on conflict(name) do update set content=excluded.content;
 end loop;
end $$;

create function private.aw_catalog_authorize(token_hash text, required_scope text) returns private.aw_catalog_grants language plpgsql set search_path='' set timezone='UTC' as $$
declare g private.aw_catalog_grants; k private.aw_catalog_keys;
begin
 select * into k from private.aw_catalog_keys where token_sha256=token_hash for share;
 if not found or k.revoked_at is not null or k.issued_at>clock_timestamp() or k.expires_at<=clock_timestamp() then raise exception 'AW_UNAUTHORIZED'; end if;
 select * into g from private.aw_catalog_grants where id=k.grant_id for share;
 if g.revoked_at is not null or g.issued_at>clock_timestamp() or g.expires_at<=clock_timestamp() then raise exception 'AW_UNAUTHORIZED'; end if;
 if required_scope<>'' and not required_scope=any(g.scopes) then raise exception 'AW_SCOPE_DENIED'; end if;
 if g.environment<>(select environment from private.aw_catalog_state where id) then raise exception 'AW_ENVIRONMENT_MISMATCH'; end if;
 return g;
end $$;
create function private.aw_catalog_scope(g private.aw_catalog_grants,b jsonb) returns void language plpgsql set search_path='' set timezone='UTC' as $$
declare op jsonb; f text; spec jsonb; e jsonb;
begin
 if jsonb_typeof(b)<>'object' or b->>'reason' is null or length(b->>'reason') not between 1 and 2000
  or jsonb_typeof(b->'evidence') is distinct from 'array' or jsonb_array_length(b->'evidence')=0
  or jsonb_typeof(b->'operations') is distinct from 'array'
  or jsonb_array_length(b->'operations')+(select count(*) from jsonb_object_keys(coalesce(b->'sections','{}'))) not between 1 and g.max_operations
  or b-'reason'-'evidence'-'operations'-'sections'<>'{}'::jsonb then raise exception 'AW_INVALID_CHANGE'; end if;
 for e in select value from jsonb_array_elements(b->'evidence') loop
  if jsonb_typeof(e)<>'object' or length(coalesce(e->>'note',''))=0 or length(coalesce(e->>'checked_at',''))=0 then raise exception 'AW_EVIDENCE_REQUIRED'; end if;
 end loop;
 for op in select value from jsonb_array_elements(b->'operations') loop
  if jsonb_typeof(op)<>'object' or op-'table'-'op'-'key'-'expected'-'values'<>'{}'::jsonb
   or not (op->>'table')=any(g.allowed_tables) or not (op->>'op')=any(g.allowed_operations) then raise exception 'AW_RESOURCE_DENIED'; end if;
  select c.spec into spec from private.aw_catalog_contract c where name=op->>'table';
  if spec is null or jsonb_typeof(op->'key') is distinct from 'array' or jsonb_array_length(op->'key')<>jsonb_array_length(spec->'primaryKey')
   or exists(select 1 from jsonb_array_elements(op->'key') v where jsonb_typeof(v)<>'string' or v='""'::jsonb) then raise exception 'AW_INVALID_PRIMARY_KEY'; end if;
  if not (op ? 'expected') or (jsonb_typeof(op->'expected') not in ('object','null')) then raise exception 'AW_EXPECTED_REQUIRED'; end if;
  if op->>'op'='upsert' then
   if jsonb_typeof(op->'values') is distinct from 'object' or op->'values'='{}' then raise exception 'AW_INVALID_VALUES'; end if;
   for f in select jsonb_object_keys(op->'values') loop
    if not (spec->'columns' ? f) or f in ('created_at','updated_at','power_to_weight_hp_t') or spec->'primaryKey' ? f then raise exception 'AW_READ_ONLY_OR_UNKNOWN_COLUMN'; end if;
   end loop;
  elsif op ? 'values' then raise exception 'AW_DELETE_HAS_VALUES'; end if;
 end loop;
 for f in select jsonb_object_keys(coalesce(b->'sections','{}')) loop
  if f not in ('ammoEvidence','presentation') or not f=any(g.allowed_sections) then raise exception 'AW_RESOURCE_DENIED'; end if;
  e:=b->'sections'->f;
  if jsonb_typeof(e) is distinct from 'object' or e-'expected_sha256'-'content'<>'{}'::jsonb or coalesce(e->>'expected_sha256','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(e->'content') is distinct from 'object' then raise exception 'AW_INVALID_SECTION'; end if;
 end loop;
end $$;
create function private.aw_catalog_charge(g private.aw_catalog_grants,kind text) returns void language plpgsql set search_path='' set timezone='UTC' as $$
declare u private.aw_catalog_usage;
begin
 insert into private.aw_catalog_usage(grant_id,day) values(g.id,(clock_timestamp() at time zone 'UTC')::date) on conflict do nothing;
 select * into u from private.aw_catalog_usage where grant_id=g.id and day=(clock_timestamp() at time zone 'UTC')::date for update;
 if (kind='uploads' and u.uploads>=g.max_uploads_per_day) or (kind='reviews' and u.reviews>=g.max_reviews_per_day) or (kind='publishes' and u.publishes>=g.max_publishes_per_day) then raise exception 'AW_QUOTA_EXCEEDED'; end if;
 update private.aw_catalog_usage set uploads=uploads+(kind='uploads')::integer,reviews=reviews+(kind='reviews')::integer,publishes=publishes+(kind='publishes')::integer,last_used_at=clock_timestamp() where grant_id=u.grant_id and day=u.day;
end $$;

-- Only Edge service_role can call this wrapper. The raw task KEY never reaches SQL.
create function public.aw_catalog_admin(p_action text,p_token_hash text,p_body jsonb default '{}') returns jsonb
 language plpgsql security definer set search_path='' set timezone='UTC' as $$
#variable_conflict use_variable
declare g private.aw_catalog_grants; s private.aw_catalog_state; r private.aw_catalog_reviews;
 c private.aw_catalog_changes; b jsonb; frozen jsonb; merged jsonb; snapshot jsonb; after_ops jsonb; op jsonb;
 result jsonb; saved jsonb; digest text; req uuid; artifact jsonb; seq bigint; canonical jsonb; reply jsonb;
begin
 if p_action not in ('introspect','upload','fetch','preview','commit') then raise exception 'AW_INVALID_ACTION'; end if;
 g:=private.aw_catalog_authorize(p_token_hash,case p_action when 'upload' then 'changes.upload' when 'fetch' then 'reviews.fetch' when 'introspect' then '' else 'reviews.confirm' end);
 if p_action='introspect' then
  return jsonb_build_object('task_id',g.task_id,'grant_id',g.id,'environment',g.environment,'scopes',g.scopes,'allowed_tables',g.allowed_tables,'allowed_sections',g.allowed_sections,'allowed_operations',g.allowed_operations,'max_operations',g.max_operations,'expires_at',least(g.expires_at,(select expires_at from private.aw_catalog_keys where token_sha256=p_token_hash)), 'max_uploads_per_day',g.max_uploads_per_day,'max_reviews_per_day',g.max_reviews_per_day,'max_publishes_per_day',g.max_publishes_per_day,'usage',coalesce((select to_jsonb(u)-'grant_id' from private.aw_catalog_usage u where grant_id=g.id and day=(clock_timestamp() at time zone 'UTC')::date),'{}'::jsonb));
 end if;
 select * into s from private.aw_catalog_state where id for update;
 if not s.initialized then raise exception 'AW_NOT_INITIALIZED'; end if;
 if p_action='upload' then
  req:=(p_body->>'request_id')::uuid; b:=p_body->'change';
  if req is null then raise exception 'AW_REQUEST_ID_REQUIRED'; end if;
  perform private.aw_catalog_scope(g,b);
  digest:=encode(sha256(convert_to(b::text,'UTF8')),'hex');
  select * into c from private.aw_catalog_changes where grant_id=g.id and request_id=req;
  if found then
   if c.body_sha256<>digest then raise exception 'AW_IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('change_id',c.id,'body_sha256',c.body_sha256,'submitted_at',c.submitted_at,'processed',exists(select 1 from private.aw_catalog_processed where change_id=c.id));
  end if;
  perform private.aw_catalog_charge(g,'uploads');
  insert into private.aw_catalog_changes(grant_id,key_id,task_id,environment,request_id,body,body_sha256)
   values(g.id,(select id from private.aw_catalog_keys where token_sha256=p_token_hash),g.task_id,g.environment,req,b,digest) returning * into c;
  return jsonb_build_object('change_id',c.id,'body_sha256',c.body_sha256,'submitted_at',c.submitted_at,'processed',false);
 elsif p_action='fetch' then
  req:=(p_body->>'request_id')::uuid;
  if req is null then raise exception 'AW_REQUEST_ID_REQUIRED'; end if;
  select * into r from private.aw_catalog_reviews where grant_id=g.id and request_id=req;
  if not found then
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'body_sha256',x.body_sha256,'submitted_at',x.submitted_at,'task_id',x.task_id,'body',x.body) order by x.submitted_at,x.id),'[]') into frozen
    from private.aw_catalog_changes x where environment=s.environment and not exists(select 1 from private.aw_catalog_processed p where p.change_id=x.id);
   -- Empty fetches are recorded too: retrying a request_id cannot acquire later uploads.
   if jsonb_array_length(frozen)>1000 or octet_length(frozen::text)>4194304 then raise exception 'AW_QUEUE_TOO_LARGE'; end if;
   for b in select value from jsonb_array_elements(frozen) loop perform private.aw_catalog_scope(g,b->'body'); end loop;
   perform private.aw_catalog_charge(g,'reviews');
   insert into private.aw_catalog_reviews(task_id,environment,grant_id,request_id,base_revision,base_version,changes,list_sha256)
    values(g.task_id,g.environment,g.id,req,s.revision,s.current_version,frozen,encode(sha256(convert_to(frozen::text,'UTF8')),'hex')) returning * into r;
  end if;
  if jsonb_array_length(r.changes)=0 then return jsonb_build_object('review_id',null,'changes','[]'::jsonb,'fetched_at',r.fetched_at); end if;
  return jsonb_build_object('review_id',r.id,'list_sha256',r.list_sha256,'base_revision',r.base_revision,'base_version',r.base_version,'fetched_at',r.fetched_at,'changes',r.changes,'result',r.result);
 end if;
 select * into r from private.aw_catalog_reviews where id=(p_body->>'review_id')::uuid for update;
 if not found then raise exception 'AW_REVIEW_NOT_FOUND'; end if;
 if r.task_id<>g.task_id or r.environment<>g.environment then raise exception 'AW_RESOURCE_DENIED'; end if;
 if r.list_sha256 is distinct from p_body->>'list_sha256' then raise exception 'AW_REVIEW_LIST_MISMATCH'; end if;
 for b in select value from jsonb_array_elements(r.changes) loop perform private.aw_catalog_scope(g,b->'body'); end loop;
 if r.result is not null then
  if r.result->>'decision' is distinct from p_body->>'decision' then raise exception 'AW_IDEMPOTENCY_CONFLICT'; end if;
  return r.result;
 end if;
 if exists(select 1 from private.aw_catalog_processed p where p.change_id in(select (v->>'id')::uuid from jsonb_array_elements(r.changes) v)) then raise exception 'AW_REVIEW_ALREADY_PROCESSED'; end if;
 if p_body->>'decision'='reject' then
  if length(coalesce(p_body->>'reason','')) not between 1 and 2000 then raise exception 'AW_REASON_REQUIRED'; end if;
  result:=jsonb_build_object('review_id',r.id,'decision','reject','count',jsonb_array_length(r.changes),'reason',p_body->>'reason');
  insert into private.aw_catalog_processed(change_id,review_id,decision,reason) select (v->>'id')::uuid,r.id,'rejected',p_body->>'reason' from jsonb_array_elements(r.changes) v;
  update private.aw_catalog_reviews set result=result where id=r.id;
  return result;
 elsif p_body->>'decision' is distinct from 'publish' then raise exception 'AW_DECISION_REQUIRED'; end if;
 if s.revision<>r.base_revision or s.current_version<>r.base_version then raise exception 'AW_BASE_CHANGED'; end if;
 if p_action='preview' then
  if r.preview is null then
   merged:=private.aw_catalog_merge(r.changes);
   -- Execute real defaults, generated fields, FKs and triggers, then roll back ALL trial DML.
   begin
    perform private.aw_catalog_apply(merged,r.fetched_at);
    update private.aw_catalog_state set checked_at=to_char(r.fetched_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') where id;
    snapshot:=private.aw_catalog_snapshot(); after_ops:='[]';
    for op in select value from jsonb_array_elements(merged->'operations') loop
     if op->>'op'='upsert' then op:=jsonb_set(op,'{values}',private.aw_catalog_row(op->>'table',op->'key')); end if;
     after_ops:=after_ops||jsonb_build_array(op);
    end loop;
    raise exception using errcode='AW001',message='rollback preview';
   exception when sqlstate 'AW001' then null; end;
   saved:=jsonb_build_object('snapshot',snapshot,'after',jsonb_build_object('operations',after_ops,'sections',merged->'sections'));
   update private.aw_catalog_reviews set preview=saved where id=r.id; r.preview:=saved;
  end if;
  select release into artifact from private.aw_catalog_releases where version=r.base_version;
  return jsonb_build_object('snapshot',r.preview->'snapshot','base',artifact,'published_at',r.fetched_at,'base_revision',r.base_revision,'review_id',r.id);
 end if;
 if r.preview is null then raise exception 'AW_PREVIEW_REQUIRED'; end if;
 artifact:=p_body->'artifact'; canonical:=p_body->'snapshot';
 if canonical is distinct from r.preview->'snapshot' then raise exception 'AW_ARTIFACT_SNAPSHOT_MISMATCH'; end if;
 if jsonb_typeof(artifact)<>'object' or jsonb_typeof(artifact->'payload')<>'string' then raise exception 'AW_INVALID_ARTIFACT'; end if;
 digest:=encode(sha256(convert_to(artifact->>'payload','UTF8')),'hex');
 if digest is distinct from artifact->'manifest'->>'sha256' then raise exception 'AW_INVALID_ARTIFACT_HASH'; end if;
 seq:=(artifact->'manifest'->>'sequence')::bigint;
 if seq<=(select sequence from private.aw_catalog_releases where version=r.base_version) or right(artifact->'manifest'->>'version',13)<>'-'||left(digest,12) then raise exception 'AW_INVALID_ARTIFACT_VERSION'; end if;
 perform private.aw_catalog_charge(g,'publishes');
 perform private.aw_catalog_apply(r.preview->'after',r.fetched_at);
 update private.aw_catalog_state set checked_at=canonical->>'checkedAt' where id;
 if private.aw_catalog_snapshot() is distinct from canonical then raise exception 'AW_ACTUAL_WRITE_DIFFERS_FROM_PREVIEW'; end if;
 -- Expiry is checked again at the irreversible boundary. Row locks serialize revocation.
 perform private.aw_catalog_authorize(p_token_hash,'reviews.confirm');
 insert into private.aw_catalog_releases(version,sequence,revision,review_id,release) values(artifact->'manifest'->>'version',seq,(select revision from private.aw_catalog_state where id),r.id,artifact);
 update private.aw_catalog_state set current_version=artifact->'manifest'->>'version' where id;
 insert into private.aw_catalog_processed(change_id,review_id,decision,reason) select (v->>'id')::uuid,r.id,'published','AI confirmed fixed review list' from jsonb_array_elements(r.changes) v;
 result:=jsonb_build_object('review_id',r.id,'decision','publish','version',artifact->'manifest'->>'version','sha256',digest,'sequence',seq,'count',jsonb_array_length(r.changes));
 update private.aw_catalog_reviews set result=result where id=r.id;
 return result;
end $$;

-- Public facts snapshot is complete and revision-consistent. Never returns control/key/player tables.
create function public.aw_catalog_facts() returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare s private.aw_catalog_state; begin
 select * into s from private.aw_catalog_state where id for share;
 return private.aw_catalog_snapshot()||jsonb_build_object('revision',s.revision,'current_version',s.current_version,'initialized',s.initialized,'section_sha256',(select jsonb_object_agg(name,encode(sha256(convert_to(content::text,'UTF8')),'hex')) from private.aw_catalog_sections));
end $$;
create function public.aw_catalog_read(p_kind text default 'manifest',p_version text default null,p_base_version text default null) returns jsonb
 language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare s private.aw_catalog_state; artifact jsonb; p jsonb;
begin
 select * into s from private.aw_catalog_state where id;
 if not s.initialized then raise exception 'AW_NOT_INITIALIZED'; end if;
 select release into artifact from private.aw_catalog_releases where version=s.current_version;
 if p_kind='manifest' then return artifact->'manifest'; end if;
 if p_version is distinct from s.current_version then raise exception 'AW_RELEASE_CHANGED'; end if;
 if p_kind='full' then return jsonb_build_object('manifest',artifact->'manifest','payload',artifact->'payload'); end if;
 if p_kind='patch' then
  for p in select value from jsonb_array_elements(artifact->'patches') loop if p->'descriptor'->>'baseVersion'=p_base_version then return p; end if; end loop;
  raise exception 'AW_NO_DIRECT_PATCH';
 end if;
 raise exception 'AW_INVALID_ACTION';
end $$;

-- No Data API table writes, no AI key creation API, no direct service_role key configuration.
do $$ declare n text; begin
 for n in select tablename from pg_catalog.pg_tables where schemaname='private' and tablename like 'aw_catalog_%' loop
  execute format('alter table private.%I enable row level security',n);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',n);
 end loop;
 for n in select name from private.aw_catalog_contract loop
  execute format('revoke insert,update,delete,truncate,references,trigger on public.%I from public,anon,authenticated,service_role',n);
  execute format('grant select on public.%I to anon,authenticated',n);
 end loop;
 for n in select p.oid::regprocedure::text from pg_catalog.pg_proc p join pg_catalog.pg_namespace s on s.oid=p.pronamespace where s.nspname='private' and p.proname like 'aw_catalog_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',n);
 end loop;
end $$;
revoke all on function public.aw_catalog_admin(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.aw_catalog_admin(text,text,jsonb) to service_role;
revoke all on function public.aw_catalog_facts(),public.aw_catalog_read(text,text,text) from public;
grant execute on function public.aw_catalog_facts(),public.aw_catalog_read(text,text,text) to anon,authenticated,service_role;
commit;
