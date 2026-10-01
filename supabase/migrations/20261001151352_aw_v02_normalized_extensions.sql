-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';
set local statement_timeout='25s';
set local idle_in_transaction_session_timeout='30s';

create table if not exists private.aw_import_batches (
 batch_key text primary key, status text not null check(status in ('pending','running','completed','failed')),
 started_at timestamptz, completed_at timestamptz, row_counts jsonb not null default '{}', note text
);
alter table private.aw_import_batches enable row level security;
revoke all on private.aw_import_batches from public,anon,authenticated;
create table if not exists private.aw_source_snapshots (
 entity_type text not null, entity_id uuid not null, payload jsonb not null,
 captured_at timestamptz not null default now(), primary key(entity_type,entity_id)
);
alter table private.aw_source_snapshots enable row level security;
revoke all on private.aw_source_snapshots from public,anon,authenticated;
create table if not exists private.aw_data_issues (
 issue_key text primary key, entity_type text not null, entity_id uuid,
 severity text not null check(severity in ('error','warning','info')),
 description text not null, original_data jsonb, resolved_at timestamptz, created_at timestamptz not null default now()
);
alter table private.aw_data_issues enable row level security;
revoke all on private.aw_data_issues from public,anon,authenticated;

alter table public.vehicles
 add column if not exists name_zh text,
 add column if not exists internal_name text,
 add column if not exists is_currently_researchable boolean,
 add column if not exists acquisition_note text,
 add column if not exists weight_t numeric check(weight_t>0),
 add column if not exists engine_power_hp numeric check(engine_power_hp>0),
 add column if not exists power_to_weight_hp_t numeric generated always as (engine_power_hp / nullif(weight_t,0)) stored,
 add column if not exists acceleration_0_32_seconds numeric check(acceleration_0_32_seconds>=0),
 add column if not exists capability_catalog_complete boolean not null default false,
 add column if not exists source_type text check(source_type in ('official','ingame','wiki','community')),
 add column if not exists image_url text;
comment on column public.vehicles.slug is 'Database stable identifier; not assumed to be the internal game identifier.';
comment on column public.vehicles.top_speed is 'km/h; source panel configuration in performance_basis.';
comment on column public.vehicles.reverse_speed is 'km/h';
comment on column public.vehicles.view_range is 'meters';
comment on column public.vehicles.camouflage is 'percentage points (0-100)';
comment on column public.vehicles.hull_traverse is 'degrees/second';
comment on column public.vehicles.turret_traverse is 'degrees/second';
comment on column public.vehicles.acceleration is 'Legacy unspecified acceleration; do not populate. Use acceleration_0_32_seconds.';
comment on column public.vehicles.accuracy is 'meters of dispersion; reference distance must be specified in performance_basis.';
comment on column public.vehicles.capability_catalog_complete is 'false means missing capability rows are unknown, not confirmed absence.';

create table if not exists public.tech_tree_branches (
 id uuid primary key default gen_random_uuid(), dealer_id uuid references public.dealers(id),
 slug text not null unique, name text not null, source_url text,
 verification_status text not null default 'needs_ingame_check' check(verification_status in ('public_verified','needs_ingame_check','ingame_verified'))
);
create index if not exists branches_dealer_idx on public.tech_tree_branches(dealer_id);
create table if not exists public.vehicle_branch_memberships (
 vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 branch_id uuid not null references public.tech_tree_branches(id) on delete cascade,
 display_order integer, primary key(vehicle_id,branch_id)
);
create index if not exists memberships_branch_idx on public.vehicle_branch_memberships(branch_id,vehicle_id);

create table if not exists public.vehicle_upgrades (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 slug text not null, name text not null, upgrade_type text not null default 'other'
 check(upgrade_type in ('engine','armor','era','smoke','aps','weapon','ammo','infantry','optics','mobility','loading','protection','other')),
 availability text not null default 'unknown' check(availability in ('default','research','upgrade','unknown')),
 xp_cost numeric check(xp_cost>=0), credit_cost numeric check(credit_cost>=0),
 is_mandatory boolean, is_vehicle_prerequisite boolean,
 hp_bonus integer, top_speed_kmh numeric check(top_speed_kmh>=0), reverse_speed_kmh numeric check(reverse_speed_kmh>=0),
 engine_power_hp numeric check(engine_power_hp>0), effect_description text, additional_effects jsonb not null default '{}',
 source_url text, source_type text check(source_type in ('official','ingame','wiki','community')),
 verification_status text not null default 'needs_ingame_check' check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 last_checked_at timestamptz, unique(vehicle_id,slug), unique(id,vehicle_id)
);
create table if not exists public.upgrade_prerequisites (
 upgrade_id uuid not null, prerequisite_upgrade_id uuid not null, vehicle_id uuid not null,
 primary key(upgrade_id,prerequisite_upgrade_id), check(upgrade_id<>prerequisite_upgrade_id),
 foreign key(upgrade_id,vehicle_id) references public.vehicle_upgrades(id,vehicle_id) on delete cascade,
 foreign key(prerequisite_upgrade_id,vehicle_id) references public.vehicle_upgrades(id,vehicle_id)
);
create index if not exists upgrade_prerequisite_source_idx on public.upgrade_prerequisites(prerequisite_upgrade_id,vehicle_id);
create index if not exists upgrade_prerequisite_target_idx on public.upgrade_prerequisites(upgrade_id,vehicle_id);

create table if not exists public.capabilities (
 code text primary key, name_zh text not null, category text not null, description text,
 parent_code text references public.capabilities(code), check(code<>parent_code)
);
create index if not exists capabilities_parent_idx on public.capabilities(parent_code);
create table if not exists public.vehicle_capabilities (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 capability_code text not null references public.capabilities(code), variant_key text not null default 'base',
 availability text not null default 'unknown' check(availability in ('default','research','upgrade','unknown','absent')),
 upgrade_id uuid, effect_description text, effect_data jsonb not null default '{}',
 source_url text, source_type text check(source_type in ('official','ingame','wiki','community')),
 verification_status text not null default 'needs_ingame_check' check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 last_checked_at timestamptz,
 unique(vehicle_id,capability_code,variant_key), unique(id,vehicle_id),
 foreign key(upgrade_id,vehicle_id) references public.vehicle_upgrades(id,vehicle_id),
 check(upgrade_id is null or availability in ('default','research','upgrade','unknown'))
);
create index if not exists vehicle_capability_filter_idx on public.vehicle_capabilities(capability_code,availability,vehicle_id);
create index if not exists vehicle_capability_upgrade_idx on public.vehicle_capabilities(upgrade_id,vehicle_id);

create table if not exists public.vehicle_era (
 capability_id uuid primary key references public.vehicle_capabilities(id) on delete cascade,
 era_name text, era_type text, generation smallint check(generation>0),
 layer_count smallint check(layer_count>0), is_special boolean,
 ap_reduction_pct numeric check(ap_reduction_pct between 0 and 100),
 heat_reduction_pct numeric check(heat_reduction_pct between 0 and 100)
);
create index if not exists era_type_idx on public.vehicle_era(era_type,generation);
create table if not exists public.era_coverage (
 capability_id uuid not null references public.vehicle_era(capability_id) on delete cascade,
 location text not null check(location in ('hull_front','hull_side','hull_rear','hull_roof','turret_front','turret_side','turret_rear','turret_roof','other')),
 note text, primary key(capability_id,location)
);
create table if not exists public.vehicle_infantry (
 capability_id uuid not null references public.vehicle_capabilities(id) on delete cascade,
 infantry_type text not null default 'unspecified' check(infantry_type in ('unspecified','at_squad','sniper','mortar_squad','assault_squad','other')),
 squad_count smallint check(squad_count>0), trooper_count smallint check(trooper_count>0),
 deployment_cooldown_seconds numeric check(deployment_cooldown_seconds>=0),
 primary key(capability_id,infantry_type)
);

create table if not exists public.vehicle_crew_positions (
 vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 position_key text not null, role text not null check(role in ('commander','driver','gunner','loader','operator','other')),
 occupant_count smallint not null default 1 check(occupant_count>0), location text, note text,
 source_url text, source_type text, verification_status text not null default 'needs_ingame_check'
 check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 primary key(vehicle_id,position_key)
);
create table if not exists public.vehicle_armor (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id) on delete cascade,
 configuration_key text not null default 'source_summary',
 location text not null check(location in ('hull_front','hull_side','hull_rear','hull_roof','turret_front','turret_side','turret_rear','turret_roof','other')),
 thickness_mm numeric check(thickness_mm>=0), effective_ap_mm numeric check(effective_ap_mm>=0),
 effective_heat_mm numeric check(effective_heat_mm>=0), composition text, upgrade_id uuid,
 source_url text, source_type text, verification_status text not null default 'needs_ingame_check'
 check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 unique(vehicle_id,configuration_key,location),
 foreign key(upgrade_id,vehicle_id) references public.vehicle_upgrades(id,vehicle_id)
);
create index if not exists armor_upgrade_idx on public.vehicle_armor(upgrade_id,vehicle_id);

alter table public.vehicle_weapons
 add column if not exists caliber_mm numeric check(caliber_mm>0),
 add column if not exists role text check(role in ('primary','secondary','remote_station','other')),
 add column if not exists depression_deg numeric check(depression_deg>=0),
 add column if not exists elevation_deg numeric check(elevation_deg>=0),
 add column if not exists magazine_mechanism text,
 add column if not exists source_type text;
alter table public.vehicle_weapons add constraint weapon_id_vehicle_unique unique(id,vehicle_id);
comment on column public.vehicle_weapons.rate_of_fire is 'rounds/minute; legacy records may represent burst rate, see note.';
comment on column public.vehicle_weapons.accuracy is 'dispersion in meters; source reference distance must be documented.';
comment on column public.vehicle_weapons.aim_time is 'seconds';
comment on column public.vehicle_weapons.velocity is 'meters/second';
create table if not exists public.weapon_upgrade_links (
 weapon_id uuid not null, upgrade_id uuid not null, vehicle_id uuid not null,
 primary key(weapon_id,upgrade_id),
 foreign key(weapon_id,vehicle_id) references public.vehicle_weapons(id,vehicle_id) on delete cascade,
 foreign key(upgrade_id,vehicle_id) references public.vehicle_upgrades(id,vehicle_id)
);
create index if not exists weapon_upgrade_source_idx on public.weapon_upgrade_links(upgrade_id,vehicle_id);
create index if not exists weapon_upgrade_weapon_idx on public.weapon_upgrade_links(weapon_id,vehicle_id);

alter table public.vehicle_ammo
 add column if not exists is_missile boolean,
 add column if not exists is_guided boolean,
 add column if not exists explosion_radius_m numeric check(explosion_radius_m>=0),
 add column if not exists module_damage numeric check(module_damage>=0),
 add column if not exists source_type text;
alter table public.vehicle_ammo drop constraint vehicle_ammo_ammo_type_check;
alter table public.vehicle_ammo add constraint vehicle_ammo_ammo_type_check
 check(ammo_type in ('ap','apfsds','apds','apcr','heat','he','hesh','atgm','smoke','other'));
comment on column public.vehicle_ammo.penetration is 'mm; legacy primary source panel value. Detailed conditions in ammo_penetration_samples.';
comment on column public.vehicle_ammo.penetration_reference_m is 'meters; NULL means unspecified source distance.';
comment on column public.vehicle_ammo.range is 'meters';
comment on column public.vehicle_ammo.velocity is 'meters/second';
create table if not exists public.ammo_traits (
 code text primary key, name_zh text not null, category text not null, description text
);
create table if not exists public.ammo_trait_links (
 ammo_id uuid not null references public.vehicle_ammo(id) on delete cascade,
 trait_code text not null references public.ammo_traits(code), source_url text,
 source_type text, verification_status text not null default 'needs_ingame_check'
 check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 primary key(ammo_id,trait_code)
);
create index if not exists ammo_traits_filter_idx on public.ammo_trait_links(trait_code,ammo_id);
create table if not exists public.ammo_guidance_modes (
 ammo_id uuid not null references public.vehicle_ammo(id) on delete cascade,
 mode_code text not null check(mode_code in ('self_guided','saclos','fire_and_forget','manual','laser_guided','other')),
 lock_time_seconds numeric check(lock_time_seconds>=0), note text, source_url text,
 source_type text, verification_status text not null default 'needs_ingame_check'
 check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 primary key(ammo_id,mode_code)
);
create index if not exists ammo_guidance_filter_idx on public.ammo_guidance_modes(mode_code,ammo_id);
create table if not exists public.ammo_penetration_samples (
 id uuid primary key default gen_random_uuid(), ammo_id uuid not null references public.vehicle_ammo(id) on delete cascade,
 sample_key text not null, penetration_mm numeric not null check(penetration_mm>=0),
 distance_m numeric check(distance_m>=0), impact_angle_deg numeric check(impact_angle_deg between 0 and 90),
 condition_note text, source_url text, source_type text,
 verification_status text not null default 'needs_ingame_check' check(verification_status in ('public_verified','needs_ingame_check','ingame_verified')),
 unique(ammo_id,sample_key)
);
create index if not exists penetration_filter_idx on public.ammo_penetration_samples(penetration_mm,ammo_id);
comment on column public.ammo_penetration_samples.impact_angle_deg is 'degrees from armor normal; NULL if unknown.';

create table if not exists public.tokens (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 name text not null, dealer_id uuid references public.dealers(id), tier smallint check(tier between 1 and 10),
 source_url text, source_type text
);
create index if not exists token_dealer_idx on public.tokens(dealer_id);
alter table public.vehicle_token_rewards add column if not exists token_id uuid references public.tokens(id);
alter table public.unlock_requirements
 add column if not exists token_id uuid references public.tokens(id),
 add column if not exists source_upgrade_id uuid,
 add column if not exists source_type text;
alter table public.unlock_requirements add constraint unlock_source_upgrade_same_vehicle
 foreign key(source_upgrade_id,source_vehicle_id) references public.vehicle_upgrades(id,vehicle_id);
alter table public.unlock_requirements add constraint unlock_upgrade_requires_vehicle
 check(source_upgrade_id is null or source_vehicle_id is not null);
alter table public.unlock_requirements drop constraint unlock_requirements_requirement_type_check;
alter table public.unlock_requirements add constraint unlock_requirements_requirement_type_check check(requirement_type in (
 'vehicle_progress','vehicle_proven','vehicle_renowned','dealer_token','reputation','spotting','damage','kills','assists','wins','battles','own_vehicle','own_vehicle_count','tier_requirement','special','upgrade'));
alter table public.unlock_requirements add constraint unlock_upgrade_reference_required
 check(requirement_type<>'upgrade' or source_upgrade_id is not null);
create index if not exists unlock_upgrade_idx on public.unlock_requirements(source_upgrade_id,source_vehicle_id);
create index if not exists unlock_token_id_idx on public.unlock_requirements(token_id);
create index if not exists rewards_token_id_idx on public.vehicle_token_rewards(token_id);
comment on table public.unlock_paths is 'Alternative paths are OR; requirements belonging to one path are AND. Pending paths must not be treated as satisfied.';
comment on table public.vehicle_progression_edges is 'Display-only source topology. Actual unlock facts are stored only in unlock_requirements.';

alter table private.aw_fleet_plan_items add column if not exists status text not null default 'planned'
 check(status in ('planned','researching','owned','abandoned'));
create index if not exists aw_plan_team_vehicle_idx on private.aw_fleet_plan_items(workspace_id,vehicle_id,status);

do $security$
declare t text;
begin
 foreach t in array array['tech_tree_branches','vehicle_branch_memberships','vehicle_upgrades','upgrade_prerequisites','capabilities','vehicle_capabilities','vehicle_era','era_coverage','vehicle_infantry','vehicle_crew_positions','vehicle_armor','weapon_upgrade_links','ammo_traits','ammo_trait_links','ammo_guidance_modes','ammo_penetration_samples','tokens']
 loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='aw_catalog_read')
 then execute format('create policy aw_catalog_read on public.%I for select to anon,authenticated using(true)',t); end if;
 end loop;
end $security$;
insert into private.aw_import_batches(batch_key,status,started_at,completed_at,note)
values('20261001_structure_v02','completed',now(),now(),'Existing 295 vehicles preserved; normalized extension tables created.')
on conflict(batch_key) do update set status=excluded.status,completed_at=excluded.completed_at;


