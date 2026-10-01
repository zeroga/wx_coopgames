-- AW catalog: current-state idempotent schema (2026-10-01 UTC).
-- Requires supabase/sql/001_snowrunner_core_idempotent.sql first.
-- MANUAL REVIEW: not an automatic deployment entry point.
-- Existing compatible objects and all data are retained.
-- Missing objects are added; incompatible columns/constraints/indexes/triggers
-- abort the short transaction instead of coercing or deleting user data.
-- No vehicle import, migration-history rewrite, DROP TABLE or TRUNCATE.
begin;
set local lock_timeout='3s';
set local statement_timeout='25s';
set local idle_in_transaction_session_timeout='30s';
set local search_path=pg_catalog,public,extensions;
create schema if not exists private;
do $aw_dependency$
begin
 if to_regclass('private.coop_profiles') is null then
  raise exception 'AW_REQUIRES_SNOWRUNNER_COOP_PROFILES: apply 001_snowrunner_core_idempotent.sql first';
 end if;
end $aw_dependency$;

-- 1. Tables and columns. Declarative catalog captured from the running database.
create table if not exists "public"."ammo_guidance_modes" (
  "ammo_id" uuid not null,
  "mode_code" text not null,
  "lock_time_seconds" numeric,
  "note" text,
  "source_url" text,
  "source_type" text,
  "verification_status" text default 'needs_ingame_check'::text not null
);
create table if not exists "public"."ammo_penetration_samples" (
  "id" uuid default gen_random_uuid() not null,
  "ammo_id" uuid not null,
  "sample_key" text not null,
  "penetration_mm" numeric not null,
  "distance_m" numeric,
  "impact_angle_deg" numeric,
  "condition_note" text,
  "source_url" text,
  "source_type" text,
  "verification_status" text default 'needs_ingame_check'::text not null
);
create table if not exists "public"."ammo_trait_links" (
  "ammo_id" uuid not null,
  "trait_code" text not null,
  "source_url" text,
  "source_type" text,
  "verification_status" text default 'needs_ingame_check'::text not null
);
create table if not exists "public"."ammo_traits" (
  "code" text not null,
  "name_zh" text not null,
  "category" text not null,
  "description" text
);
create table if not exists "public"."ammo_upgrade_links" (
  "ammo_id" uuid not null,
  "weapon_id" uuid not null,
  "vehicle_id" uuid not null,
  "upgrade_id" uuid not null
);
create table if not exists "public"."capabilities" (
  "code" text not null,
  "name_zh" text not null,
  "category" text not null,
  "description" text,
  "parent_code" text
);
create table if not exists "public"."dealers" (
  "id" uuid default gen_random_uuid() not null,
  "slug" text not null,
  "name" text not null,
  "sort_order" integer default 0 not null,
  "source_url" text
);
create table if not exists "public"."era_coverage" (
  "capability_id" uuid not null,
  "location" text not null,
  "note" text
);
create table if not exists "public"."tech_tree_branches" (
  "id" uuid default gen_random_uuid() not null,
  "dealer_id" uuid,
  "slug" text not null,
  "name" text not null,
  "source_url" text,
  "verification_status" text default 'needs_ingame_check'::text not null
);
create table if not exists "public"."tokens" (
  "id" uuid default gen_random_uuid() not null,
  "code" text not null,
  "name" text not null,
  "dealer_id" uuid,
  "tier" smallint,
  "source_url" text,
  "source_type" text
);
create table if not exists "public"."unlock_paths" (
  "id" uuid default gen_random_uuid() not null,
  "vehicle_id" uuid not null,
  "slug" text not null,
  "name" text not null,
  "sort_order" integer default 0 not null,
  "note" text,
  "target_upgrade_id" uuid,
  "is_complete" boolean default false not null
);
create table if not exists "public"."unlock_requirements" (
  "id" uuid default gen_random_uuid() not null,
  "unlock_path_id" uuid not null,
  "slug" text not null,
  "requirement_type" text not null,
  "source_vehicle_id" uuid,
  "dealer_id" uuid,
  "operator" text,
  "required_value" numeric,
  "unit" text,
  "scope" jsonb default '{}'::jsonb not null,
  "description" text not null,
  "verification_status" text default 'needs_ingame_check'::text not null,
  "source_url" text,
  "source_note" text,
  "last_checked_at" timestamp with time zone,
  "sort_order" integer default 0 not null,
  "token_id" uuid,
  "source_upgrade_id" uuid,
  "source_type" text,
  "event_code" text
);
create table if not exists "public"."upgrade_prerequisites" (
  "upgrade_id" uuid not null,
  "prerequisite_upgrade_id" uuid not null,
  "vehicle_id" uuid not null
);
create table if not exists "public"."vehicle_ammo" (
  "id" uuid default gen_random_uuid() not null,
  "weapon_id" uuid not null,
  "slug" text not null,
  "sort_order" integer default 0 not null,
  "name" text not null,
  "ammo_type" text not null,
  "ammo_subtype" text,
  "requires_research" boolean,
  "damage" numeric,
  "penetration" numeric,
  "penetration_reference_m" numeric,
  "range" numeric,
  "velocity" numeric,
  "note" text,
  "source_url" text,
  "source_note" text,
  "verification_status" text default 'needs_ingame_check'::text not null,
  "last_checked_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "reload_seconds" numeric,
  "magazine_size" integer,
  "intra_clip_reload" numeric,
  "rate_of_fire" numeric,
  "is_missile" boolean,
  "is_guided" boolean,
  "explosion_radius_m" numeric,
  "module_damage" numeric,
  "source_type" text,
  "accuracy_deg" numeric,
  "magazine_mechanism" text,
  "module_damage_bonus_pct" numeric
);
create table if not exists "public"."vehicle_armor" (
  "id" uuid default gen_random_uuid() not null,
  "vehicle_id" uuid not null,
  "configuration_key" text default 'source_summary'::text not null,
  "location" text not null,
  "thickness_mm" numeric,
  "effective_ap_mm" numeric,
  "effective_heat_mm" numeric,
  "composition" text,
  "upgrade_id" uuid,
  "source_url" text,
  "source_type" text,
  "verification_status" text default 'needs_ingame_check'::text not null
);
create table if not exists "public"."vehicle_branch_memberships" (
  "vehicle_id" uuid not null,
  "branch_id" uuid not null,
  "display_order" integer
);
create table if not exists "public"."vehicle_capabilities" (
  "id" uuid default gen_random_uuid() not null,
  "vehicle_id" uuid not null,
  "capability_code" text not null,
  "variant_key" text default 'base'::text not null,
  "availability" text default 'unknown'::text not null,
  "upgrade_id" uuid,
  "effect_description" text,
  "effect_data" jsonb default '{}'::jsonb not null,
  "source_url" text,
  "source_type" text,
  "verification_status" text default 'needs_ingame_check'::text not null,
  "last_checked_at" timestamp with time zone
);
create table if not exists "public"."vehicle_crew_positions" (
  "vehicle_id" uuid not null,
  "position_key" text not null,
  "role" text not null,
  "occupant_count" smallint default 1 not null,
  "location" text,
  "note" text,
  "source_url" text,
  "source_type" text,
  "verification_status" text default 'needs_ingame_check'::text not null
);
create table if not exists "public"."vehicle_era" (
  "capability_id" uuid not null,
  "era_name" text,
  "era_type" text,
  "generation" smallint,
  "layer_count" smallint,
  "is_special" boolean,
  "ap_reduction_pct" numeric,
  "heat_reduction_pct" numeric
);
create table if not exists "public"."vehicle_infantry" (
  "capability_id" uuid not null,
  "infantry_type" text default 'unspecified'::text not null,
  "squad_count" smallint,
  "trooper_count" smallint,
  "deployment_cooldown_seconds" numeric
);
create table if not exists "public"."vehicle_progression_edges" (
  "id" uuid default gen_random_uuid() not null,
  "from_vehicle_id" uuid not null,
  "to_vehicle_id" uuid not null,
  "edge_type" text not null,
  "display_order" integer default 0 not null,
  "source_url" text,
  "note" text,
  "verification_status" text default 'needs_ingame_check'::text not null
);
create table if not exists "public"."vehicle_token_rewards" (
  "id" uuid default gen_random_uuid() not null,
  "vehicle_id" uuid not null,
  "quantity" integer default 1 not null,
  "description" text not null,
  "verification_status" text default 'needs_ingame_check'::text not null,
  "source_url" text,
  "source_note" text,
  "last_checked_at" timestamp with time zone,
  "token_id" uuid not null,
  "source_type" text
);
create table if not exists "public"."vehicle_upgrades" (
  "id" uuid default gen_random_uuid() not null,
  "vehicle_id" uuid not null,
  "slug" text not null,
  "name" text not null,
  "upgrade_type" text default 'other'::text not null,
  "availability" text default 'unknown'::text not null,
  "xp_cost" numeric,
  "credit_cost" numeric,
  "is_mandatory" boolean,
  "is_vehicle_prerequisite" boolean,
  "hp_bonus" integer,
  "top_speed_kmh" numeric,
  "reverse_speed_kmh" numeric,
  "engine_power_hp" numeric,
  "effect_description" text,
  "additional_effects" jsonb default '{}'::jsonb not null,
  "source_url" text,
  "source_type" text,
  "verification_status" text default 'needs_ingame_check'::text not null,
  "last_checked_at" timestamp with time zone
);
create table if not exists "public"."vehicle_weapons" (
  "id" uuid default gen_random_uuid() not null,
  "vehicle_id" uuid not null,
  "slug" text not null,
  "sort_order" integer default 0 not null,
  "name" text not null,
  "weapon_type" text not null,
  "rate_of_fire" numeric,
  "reload_seconds" numeric,
  "magazine_size" integer,
  "accuracy" numeric,
  "aim_time" numeric,
  "range" numeric,
  "velocity" numeric,
  "burst_size" integer,
  "intra_clip_reload" numeric,
  "requires_research" boolean,
  "note" text,
  "source_url" text,
  "source_note" text,
  "verification_status" text default 'needs_ingame_check'::text not null,
  "last_checked_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "configuration_key" text,
  "caliber_mm" numeric,
  "role" text,
  "depression_deg" numeric,
  "elevation_deg" numeric,
  "magazine_mechanism" text,
  "source_type" text,
  "accuracy_deg" numeric
);
create table if not exists "public"."vehicles" (
  "id" uuid default gen_random_uuid() not null,
  "slug" text not null,
  "name" text not null,
  "tier" smallint,
  "is_legendary" boolean default false not null,
  "vehicle_class" text,
  "nation" text,
  "dealer_id" uuid,
  "acquisition_type" text,
  "hp" integer,
  "top_speed" numeric,
  "view_range" numeric,
  "camouflage" numeric,
  "reverse_speed" numeric,
  "hull_traverse" numeric,
  "turret_traverse" numeric,
  "performance_basis" jsonb default '{}'::jsonb not null,
  "summary" text,
  "source_url" text,
  "source_note" text,
  "verification_status" text default 'needs_ingame_check'::text not null,
  "last_checked_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "name_zh" text,
  "internal_name" text,
  "is_currently_researchable" boolean,
  "acquisition_note" text,
  "weight_t" numeric,
  "engine_power_hp" numeric,
  "power_to_weight_hp_t" numeric generated always as ((engine_power_hp / NULLIF(weight_t, (0)::numeric))) stored,
  "acceleration_0_32_seconds" numeric,
  "capability_catalog_complete" boolean default false not null,
  "source_type" text,
  "image_url" text,
  "is_premium" boolean,
  "release_status" text default 'unknown'::text not null
);
create table if not exists "public"."weapon_upgrade_links" (
  "weapon_id" uuid not null,
  "upgrade_id" uuid not null,
  "vehicle_id" uuid not null
);
create table if not exists "private"."aw_fleet_plan_items" (
  "id" uuid default gen_random_uuid() not null,
  "workspace_id" uuid not null,
  "user_id" text not null,
  "vehicle_id" uuid not null,
  "role" text,
  "priority" integer,
  "note" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "status" text default 'planned'::text not null
);
create table if not exists "private"."aw_data_issues" (
  "issue_key" text not null,
  "entity_type" text not null,
  "entity_id" uuid,
  "severity" text not null,
  "description" text not null,
  "original_data" jsonb,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone default now() not null
);
create table if not exists "private"."aw_import_batches" (
  "batch_key" text not null,
  "status" text not null,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "row_counts" jsonb default '{}'::jsonb not null,
  "note" text
);
create table if not exists "private"."aw_source_snapshots" (
  "entity_type" text not null,
  "entity_id" uuid not null,
  "payload" jsonb not null,
  "captured_at" timestamp with time zone default now() not null
);

do $aw_columns$
declare expected jsonb; actual record; spec text;
begin
 for expected in select value from jsonb_array_elements($aw_json$[{"type":"text","table":"private.aw_data_issues","column":"issue_key","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"private.aw_data_issues","column":"entity_type","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"private.aw_data_issues","column":"entity_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"private.aw_data_issues","column":"severity","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"private.aw_data_issues","column":"description","default":null,"notnull":true,"identity":"","generated":""},{"type":"jsonb","table":"private.aw_data_issues","column":"original_data","default":null,"notnull":false,"identity":"","generated":""},{"type":"timestamp with time zone","table":"private.aw_data_issues","column":"resolved_at","default":null,"notnull":false,"identity":"","generated":""},{"type":"timestamp with time zone","table":"private.aw_data_issues","column":"created_at","default":"now()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"private.aw_fleet_plan_items","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"private.aw_fleet_plan_items","column":"workspace_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"private.aw_fleet_plan_items","column":"user_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"private.aw_fleet_plan_items","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"private.aw_fleet_plan_items","column":"role","default":null,"notnull":false,"identity":"","generated":""},{"type":"integer","table":"private.aw_fleet_plan_items","column":"priority","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"private.aw_fleet_plan_items","column":"note","default":null,"notnull":false,"identity":"","generated":""},{"type":"timestamp with time zone","table":"private.aw_fleet_plan_items","column":"created_at","default":"now()","notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"private.aw_fleet_plan_items","column":"updated_at","default":"now()","notnull":true,"identity":"","generated":""},{"type":"text","table":"private.aw_fleet_plan_items","column":"status","default":"'planned'::text","notnull":true,"identity":"","generated":""},{"type":"text","table":"private.aw_import_batches","column":"batch_key","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"private.aw_import_batches","column":"status","default":null,"notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"private.aw_import_batches","column":"started_at","default":null,"notnull":false,"identity":"","generated":""},{"type":"timestamp with time zone","table":"private.aw_import_batches","column":"completed_at","default":null,"notnull":false,"identity":"","generated":""},{"type":"jsonb","table":"private.aw_import_batches","column":"row_counts","default":"'{}'::jsonb","notnull":true,"identity":"","generated":""},{"type":"text","table":"private.aw_import_batches","column":"note","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"private.aw_source_snapshots","column":"entity_type","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"private.aw_source_snapshots","column":"entity_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"jsonb","table":"private.aw_source_snapshots","column":"payload","default":null,"notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"private.aw_source_snapshots","column":"captured_at","default":"now()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.ammo_guidance_modes","column":"ammo_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.ammo_guidance_modes","column":"mode_code","default":null,"notnull":true,"identity":"","generated":""},{"type":"numeric","table":"public.ammo_guidance_modes","column":"lock_time_seconds","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.ammo_guidance_modes","column":"note","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.ammo_guidance_modes","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.ammo_guidance_modes","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.ammo_guidance_modes","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.ammo_penetration_samples","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.ammo_penetration_samples","column":"ammo_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.ammo_penetration_samples","column":"sample_key","default":null,"notnull":true,"identity":"","generated":""},{"type":"numeric","table":"public.ammo_penetration_samples","column":"penetration_mm","default":null,"notnull":true,"identity":"","generated":""},{"type":"numeric","table":"public.ammo_penetration_samples","column":"distance_m","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.ammo_penetration_samples","column":"impact_angle_deg","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.ammo_penetration_samples","column":"condition_note","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.ammo_penetration_samples","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.ammo_penetration_samples","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.ammo_penetration_samples","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.ammo_trait_links","column":"ammo_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.ammo_trait_links","column":"trait_code","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.ammo_trait_links","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.ammo_trait_links","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.ammo_trait_links","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.ammo_traits","column":"code","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.ammo_traits","column":"name_zh","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.ammo_traits","column":"category","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.ammo_traits","column":"description","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.ammo_upgrade_links","column":"ammo_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.ammo_upgrade_links","column":"weapon_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.ammo_upgrade_links","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.ammo_upgrade_links","column":"upgrade_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.capabilities","column":"code","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.capabilities","column":"name_zh","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.capabilities","column":"category","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.capabilities","column":"description","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.capabilities","column":"parent_code","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.dealers","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.dealers","column":"slug","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.dealers","column":"name","default":null,"notnull":true,"identity":"","generated":""},{"type":"integer","table":"public.dealers","column":"sort_order","default":"0","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.dealers","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.era_coverage","column":"capability_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.era_coverage","column":"location","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.era_coverage","column":"note","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.tech_tree_branches","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.tech_tree_branches","column":"dealer_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.tech_tree_branches","column":"slug","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.tech_tree_branches","column":"name","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.tech_tree_branches","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.tech_tree_branches","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.tokens","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.tokens","column":"code","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.tokens","column":"name","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.tokens","column":"dealer_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"smallint","table":"public.tokens","column":"tier","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.tokens","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.tokens","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.unlock_paths","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.unlock_paths","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.unlock_paths","column":"slug","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.unlock_paths","column":"name","default":null,"notnull":true,"identity":"","generated":""},{"type":"integer","table":"public.unlock_paths","column":"sort_order","default":"0","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.unlock_paths","column":"note","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.unlock_paths","column":"target_upgrade_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.unlock_paths","column":"is_complete","default":"false","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.unlock_requirements","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.unlock_requirements","column":"unlock_path_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.unlock_requirements","column":"slug","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.unlock_requirements","column":"requirement_type","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.unlock_requirements","column":"source_vehicle_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.unlock_requirements","column":"dealer_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.unlock_requirements","column":"operator","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.unlock_requirements","column":"required_value","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.unlock_requirements","column":"unit","default":null,"notnull":false,"identity":"","generated":""},{"type":"jsonb","table":"public.unlock_requirements","column":"scope","default":"'{}'::jsonb","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.unlock_requirements","column":"description","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.unlock_requirements","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.unlock_requirements","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.unlock_requirements","column":"source_note","default":null,"notnull":false,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.unlock_requirements","column":"last_checked_at","default":null,"notnull":false,"identity":"","generated":""},{"type":"integer","table":"public.unlock_requirements","column":"sort_order","default":"0","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.unlock_requirements","column":"token_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.unlock_requirements","column":"source_upgrade_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.unlock_requirements","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.unlock_requirements","column":"event_code","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.upgrade_prerequisites","column":"upgrade_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.upgrade_prerequisites","column":"prerequisite_upgrade_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.upgrade_prerequisites","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_ammo","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_ammo","column":"weapon_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_ammo","column":"slug","default":null,"notnull":true,"identity":"","generated":""},{"type":"integer","table":"public.vehicle_ammo","column":"sort_order","default":"0","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_ammo","column":"name","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_ammo","column":"ammo_type","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_ammo","column":"ammo_subtype","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicle_ammo","column":"requires_research","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"damage","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"penetration","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"penetration_reference_m","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"range","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"velocity","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_ammo","column":"note","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_ammo","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_ammo","column":"source_note","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_ammo","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicle_ammo","column":"last_checked_at","default":null,"notnull":false,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicle_ammo","column":"created_at","default":"now()","notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicle_ammo","column":"updated_at","default":"now()","notnull":true,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"reload_seconds","default":null,"notnull":false,"identity":"","generated":""},{"type":"integer","table":"public.vehicle_ammo","column":"magazine_size","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"intra_clip_reload","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"rate_of_fire","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicle_ammo","column":"is_missile","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicle_ammo","column":"is_guided","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"explosion_radius_m","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"module_damage","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_ammo","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"accuracy_deg","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_ammo","column":"magazine_mechanism","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_ammo","column":"module_damage_bonus_pct","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_armor","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_armor","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_armor","column":"configuration_key","default":"'source_summary'::text","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_armor","column":"location","default":null,"notnull":true,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_armor","column":"thickness_mm","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_armor","column":"effective_ap_mm","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_armor","column":"effective_heat_mm","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_armor","column":"composition","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_armor","column":"upgrade_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_armor","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_armor","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_armor","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_branch_memberships","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_branch_memberships","column":"branch_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"integer","table":"public.vehicle_branch_memberships","column":"display_order","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_capabilities","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_capabilities","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_capabilities","column":"capability_code","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_capabilities","column":"variant_key","default":"'base'::text","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_capabilities","column":"availability","default":"'unknown'::text","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_capabilities","column":"upgrade_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_capabilities","column":"effect_description","default":null,"notnull":false,"identity":"","generated":""},{"type":"jsonb","table":"public.vehicle_capabilities","column":"effect_data","default":"'{}'::jsonb","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_capabilities","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_capabilities","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_capabilities","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicle_capabilities","column":"last_checked_at","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_crew_positions","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_crew_positions","column":"position_key","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_crew_positions","column":"role","default":null,"notnull":true,"identity":"","generated":""},{"type":"smallint","table":"public.vehicle_crew_positions","column":"occupant_count","default":"1","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_crew_positions","column":"location","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_crew_positions","column":"note","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_crew_positions","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_crew_positions","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_crew_positions","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_era","column":"capability_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_era","column":"era_name","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_era","column":"era_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"smallint","table":"public.vehicle_era","column":"generation","default":null,"notnull":false,"identity":"","generated":""},{"type":"smallint","table":"public.vehicle_era","column":"layer_count","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicle_era","column":"is_special","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_era","column":"ap_reduction_pct","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_era","column":"heat_reduction_pct","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_infantry","column":"capability_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_infantry","column":"infantry_type","default":"'unspecified'::text","notnull":true,"identity":"","generated":""},{"type":"smallint","table":"public.vehicle_infantry","column":"squad_count","default":null,"notnull":false,"identity":"","generated":""},{"type":"smallint","table":"public.vehicle_infantry","column":"trooper_count","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_infantry","column":"deployment_cooldown_seconds","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_progression_edges","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_progression_edges","column":"from_vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_progression_edges","column":"to_vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_progression_edges","column":"edge_type","default":null,"notnull":true,"identity":"","generated":""},{"type":"integer","table":"public.vehicle_progression_edges","column":"display_order","default":"0","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_progression_edges","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_progression_edges","column":"note","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_progression_edges","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_token_rewards","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_token_rewards","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"integer","table":"public.vehicle_token_rewards","column":"quantity","default":"1","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_token_rewards","column":"description","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_token_rewards","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_token_rewards","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_token_rewards","column":"source_note","default":null,"notnull":false,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicle_token_rewards","column":"last_checked_at","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_token_rewards","column":"token_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_token_rewards","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_upgrades","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_upgrades","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_upgrades","column":"slug","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_upgrades","column":"name","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_upgrades","column":"upgrade_type","default":"'other'::text","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_upgrades","column":"availability","default":"'unknown'::text","notnull":true,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_upgrades","column":"xp_cost","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_upgrades","column":"credit_cost","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicle_upgrades","column":"is_mandatory","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicle_upgrades","column":"is_vehicle_prerequisite","default":null,"notnull":false,"identity":"","generated":""},{"type":"integer","table":"public.vehicle_upgrades","column":"hp_bonus","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_upgrades","column":"top_speed_kmh","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_upgrades","column":"reverse_speed_kmh","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_upgrades","column":"engine_power_hp","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_upgrades","column":"effect_description","default":null,"notnull":false,"identity":"","generated":""},{"type":"jsonb","table":"public.vehicle_upgrades","column":"additional_effects","default":"'{}'::jsonb","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_upgrades","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_upgrades","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_upgrades","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicle_upgrades","column":"last_checked_at","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_weapons","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.vehicle_weapons","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"slug","default":null,"notnull":true,"identity":"","generated":""},{"type":"integer","table":"public.vehicle_weapons","column":"sort_order","default":"0","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"name","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"weapon_type","default":null,"notnull":true,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"rate_of_fire","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"reload_seconds","default":null,"notnull":false,"identity":"","generated":""},{"type":"integer","table":"public.vehicle_weapons","column":"magazine_size","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"accuracy","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"aim_time","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"range","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"velocity","default":null,"notnull":false,"identity":"","generated":""},{"type":"integer","table":"public.vehicle_weapons","column":"burst_size","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"intra_clip_reload","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicle_weapons","column":"requires_research","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"note","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"source_note","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicle_weapons","column":"last_checked_at","default":null,"notnull":false,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicle_weapons","column":"created_at","default":"now()","notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicle_weapons","column":"updated_at","default":"now()","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"configuration_key","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"caliber_mm","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"role","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"depression_deg","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"elevation_deg","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"magazine_mechanism","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicle_weapons","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicle_weapons","column":"accuracy_deg","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicles","column":"id","default":"gen_random_uuid()","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"slug","default":null,"notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"name","default":null,"notnull":true,"identity":"","generated":""},{"type":"smallint","table":"public.vehicles","column":"tier","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicles","column":"is_legendary","default":"false","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"vehicle_class","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"nation","default":null,"notnull":false,"identity":"","generated":""},{"type":"uuid","table":"public.vehicles","column":"dealer_id","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"acquisition_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"integer","table":"public.vehicles","column":"hp","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicles","column":"top_speed","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicles","column":"view_range","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicles","column":"camouflage","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicles","column":"reverse_speed","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicles","column":"hull_traverse","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicles","column":"turret_traverse","default":null,"notnull":false,"identity":"","generated":""},{"type":"jsonb","table":"public.vehicles","column":"performance_basis","default":"'{}'::jsonb","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"summary","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"source_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"source_note","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"verification_status","default":"'needs_ingame_check'::text","notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicles","column":"last_checked_at","default":null,"notnull":false,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicles","column":"created_at","default":"now()","notnull":true,"identity":"","generated":""},{"type":"timestamp with time zone","table":"public.vehicles","column":"updated_at","default":"now()","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"name_zh","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"internal_name","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicles","column":"is_currently_researchable","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"acquisition_note","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicles","column":"weight_t","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicles","column":"engine_power_hp","default":null,"notnull":false,"identity":"","generated":""},{"type":"numeric","table":"public.vehicles","column":"power_to_weight_hp_t","default":"(engine_power_hp / NULLIF(weight_t, (0)::numeric))","notnull":false,"identity":"","generated":"s"},{"type":"numeric","table":"public.vehicles","column":"acceleration_0_32_seconds","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicles","column":"capability_catalog_complete","default":"false","notnull":true,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"source_type","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"image_url","default":null,"notnull":false,"identity":"","generated":""},{"type":"boolean","table":"public.vehicles","column":"is_premium","default":null,"notnull":false,"identity":"","generated":""},{"type":"text","table":"public.vehicles","column":"release_status","default":"'unknown'::text","notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.weapon_upgrade_links","column":"weapon_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.weapon_upgrade_links","column":"upgrade_id","default":null,"notnull":true,"identity":"","generated":""},{"type":"uuid","table":"public.weapon_upgrade_links","column":"vehicle_id","default":null,"notnull":true,"identity":"","generated":""}]$aw_json$::jsonb) loop
  select format_type(a.atttypid,a.atttypmod) as type, a.attnotnull as notnull,
         a.attgenerated::text as generated,a.attidentity::text as identity,
         pg_get_expr(d.adbin,d.adrelid) as default_expr into actual
  from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid=to_regclass(expected->>'table')
    and a.attname=expected->>'column' and a.attnum>0 and not a.attisdropped;
  if not found then
   spec:=format('%I %s',expected->>'column',expected->>'type');
   if expected->>'generated'='s' then
    spec:=spec||' generated always as ('||(expected->>'default')||') stored';
   elsif expected->>'default' is not null then
    spec:=spec||' default '||(expected->>'default');
   end if;
   if (expected->>'notnull')::boolean then spec:=spec||' not null'; end if;
   execute format('alter table %s add column if not exists %s',to_regclass(expected->>'table'),spec);
  elsif actual.type is distinct from expected->>'type'
     or actual.notnull is distinct from (expected->>'notnull')::boolean
     or actual.generated is distinct from expected->>'generated'
     or actual.identity is distinct from expected->>'identity'
     or actual.default_expr is distinct from expected->>'default' then
   raise exception 'AW_COLUMN_MISMATCH: %.%; inspect type/nullability/default before applying',
      expected->>'table',expected->>'column';
  end if;
 end loop;
end $aw_columns$;

-- 2. Primary/unique/check constraints precede all foreign keys.
do $aw_constraints$
declare expected jsonb; actual text;
begin
 for expected in select value from jsonb_array_elements($aw_json$[{"table":"public.ammo_guidance_modes","name":"ammo_guidance_modes_lock_time_seconds_check","type":"c","definition":"CHECK ((lock_time_seconds >= (0)::numeric))"},{"table":"public.ammo_guidance_modes","name":"ammo_guidance_modes_mode_code_check","type":"c","definition":"CHECK ((mode_code = ANY (ARRAY['self_guided'::text, 'saclos'::text, 'fire_and_forget'::text, 'manual'::text, 'laser_guided'::text, 'other'::text])))"},{"table":"public.ammo_guidance_modes","name":"ammo_guidance_modes_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.ammo_penetration_samples","name":"ammo_penetration_samples_distance_m_check","type":"c","definition":"CHECK ((distance_m >= (0)::numeric))"},{"table":"public.ammo_penetration_samples","name":"ammo_penetration_samples_impact_angle_deg_check","type":"c","definition":"CHECK (((impact_angle_deg >= (0)::numeric) AND (impact_angle_deg <= (90)::numeric)))"},{"table":"public.ammo_penetration_samples","name":"ammo_penetration_samples_penetration_mm_check","type":"c","definition":"CHECK ((penetration_mm >= (0)::numeric))"},{"table":"public.ammo_penetration_samples","name":"ammo_penetration_samples_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.ammo_trait_links","name":"ammo_trait_links_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.vehicle_ammo","name":"atgm_guided_consistency","type":"c","definition":"CHECK (((ammo_type <> 'atgm'::text) OR ((is_missile IS TRUE) AND (is_guided IS TRUE))))"},{"table":"private.aw_data_issues","name":"aw_data_issues_severity_check","type":"c","definition":"CHECK ((severity = ANY (ARRAY['error'::text, 'warning'::text, 'info'::text])))"},{"table":"private.aw_fleet_plan_items","name":"aw_fleet_plan_items_status_check","type":"c","definition":"CHECK ((status = ANY (ARRAY['planned'::text, 'researching'::text, 'owned'::text, 'abandoned'::text])))"},{"table":"private.aw_import_batches","name":"aw_import_batches_status_check","type":"c","definition":"CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])))"},{"table":"public.capabilities","name":"capabilities_check","type":"c","definition":"CHECK ((code <> parent_code))"},{"table":"public.era_coverage","name":"era_coverage_location_check","type":"c","definition":"CHECK ((location = ANY (ARRAY['hull_front'::text, 'hull_side'::text, 'hull_rear'::text, 'hull_roof'::text, 'turret_front'::text, 'turret_side'::text, 'turret_rear'::text, 'turret_roof'::text, 'other'::text])))"},{"table":"public.tech_tree_branches","name":"tech_tree_branches_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.unlock_requirements","name":"token_requirement_id_required","type":"c","definition":"CHECK (((requirement_type <> 'dealer_token'::text) OR (token_id IS NOT NULL)))"},{"table":"public.tokens","name":"tokens_tier_check","type":"c","definition":"CHECK (((tier >= 1) AND (tier <= 10)))"},{"table":"public.unlock_requirements","name":"unlock_event_code_required","type":"c","definition":"CHECK (((requirement_type <> ALL (ARRAY['event_level'::text, 'event_access'::text, 'event_mission'::text])) OR (event_code IS NOT NULL)))"},{"table":"public.unlock_requirements","name":"unlock_requirements_operator_check","type":"c","definition":"CHECK ((operator = ANY (ARRAY['>='::text, '>'::text, '='::text, '<='::text, '<'::text, 'exists'::text])))"},{"table":"public.unlock_requirements","name":"unlock_requirements_requirement_type_check","type":"c","definition":"CHECK ((requirement_type = ANY (ARRAY['vehicle_progress'::text, 'vehicle_proven'::text, 'vehicle_renowned'::text, 'dealer_token'::text, 'reputation'::text, 'spotting'::text, 'damage'::text, 'kills'::text, 'assists'::text, 'wins'::text, 'battles'::text, 'own_vehicle'::text, 'own_vehicle_count'::text, 'tier_requirement'::text, 'special'::text, 'upgrade'::text, 'event_level'::text, 'event_access'::text, 'event_mission'::text])))"},{"table":"public.unlock_requirements","name":"unlock_requirements_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.unlock_requirements","name":"unlock_upgrade_reference_required","type":"c","definition":"CHECK (((requirement_type <> 'upgrade'::text) OR (source_upgrade_id IS NOT NULL)))"},{"table":"public.unlock_requirements","name":"unlock_upgrade_requires_vehicle","type":"c","definition":"CHECK (((source_upgrade_id IS NULL) OR (source_vehicle_id IS NOT NULL)))"},{"table":"public.upgrade_prerequisites","name":"upgrade_prerequisites_check","type":"c","definition":"CHECK ((upgrade_id <> prerequisite_upgrade_id))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_accuracy_deg_check","type":"c","definition":"CHECK ((accuracy_deg >= (0)::numeric))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_ammo_type_check","type":"c","definition":"CHECK ((ammo_type = ANY (ARRAY['ap'::text, 'apfsds'::text, 'apds'::text, 'apcr'::text, 'heat'::text, 'he'::text, 'hesh'::text, 'atgm'::text, 'smoke'::text, 'other'::text])))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_damage_check","type":"c","definition":"CHECK ((damage >= (0)::numeric))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_explosion_radius_m_check","type":"c","definition":"CHECK ((explosion_radius_m >= (0)::numeric))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_intra_clip_reload_check","type":"c","definition":"CHECK ((intra_clip_reload >= (0)::numeric))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_magazine_size_check","type":"c","definition":"CHECK ((magazine_size > 0))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_module_damage_check","type":"c","definition":"CHECK ((module_damage >= (0)::numeric))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_penetration_check","type":"c","definition":"CHECK ((penetration >= (0)::numeric))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_penetration_reference_m_check","type":"c","definition":"CHECK ((penetration_reference_m >= (0)::numeric))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_rate_of_fire_check","type":"c","definition":"CHECK ((rate_of_fire > (0)::numeric))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_reload_seconds_check","type":"c","definition":"CHECK ((reload_seconds >= (0)::numeric))"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.vehicle_armor","name":"vehicle_armor_effective_ap_mm_check","type":"c","definition":"CHECK ((effective_ap_mm >= (0)::numeric))"},{"table":"public.vehicle_armor","name":"vehicle_armor_effective_heat_mm_check","type":"c","definition":"CHECK ((effective_heat_mm >= (0)::numeric))"},{"table":"public.vehicle_armor","name":"vehicle_armor_location_check","type":"c","definition":"CHECK ((location = ANY (ARRAY['hull_unspecified'::text, 'turret_unspecified'::text, 'hull_front'::text, 'hull_side'::text, 'hull_rear'::text, 'hull_roof'::text, 'turret_front'::text, 'turret_side'::text, 'turret_rear'::text, 'turret_roof'::text, 'other'::text])))"},{"table":"public.vehicle_armor","name":"vehicle_armor_thickness_mm_check","type":"c","definition":"CHECK ((thickness_mm >= (0)::numeric))"},{"table":"public.vehicle_armor","name":"vehicle_armor_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.vehicle_capabilities","name":"vehicle_capabilities_availability_check","type":"c","definition":"CHECK ((availability = ANY (ARRAY['default'::text, 'research'::text, 'upgrade'::text, 'unknown'::text, 'absent'::text])))"},{"table":"public.vehicle_capabilities","name":"vehicle_capabilities_check","type":"c","definition":"CHECK (((upgrade_id IS NULL) OR (availability = ANY (ARRAY['default'::text, 'research'::text, 'upgrade'::text, 'unknown'::text]))))"},{"table":"public.vehicle_capabilities","name":"vehicle_capabilities_source_type_check","type":"c","definition":"CHECK ((source_type = ANY (ARRAY['official'::text, 'ingame'::text, 'wiki'::text, 'community'::text])))"},{"table":"public.vehicle_capabilities","name":"vehicle_capabilities_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.vehicle_crew_positions","name":"vehicle_crew_positions_occupant_count_check","type":"c","definition":"CHECK ((occupant_count > 0))"},{"table":"public.vehicle_crew_positions","name":"vehicle_crew_positions_role_check","type":"c","definition":"CHECK ((role = ANY (ARRAY['commander'::text, 'driver'::text, 'gunner'::text, 'loader'::text, 'operator'::text, 'other'::text])))"},{"table":"public.vehicle_crew_positions","name":"vehicle_crew_positions_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.vehicle_era","name":"vehicle_era_ap_reduction_pct_check","type":"c","definition":"CHECK (((ap_reduction_pct >= (0)::numeric) AND (ap_reduction_pct <= (100)::numeric)))"},{"table":"public.vehicle_era","name":"vehicle_era_generation_check","type":"c","definition":"CHECK ((generation > 0))"},{"table":"public.vehicle_era","name":"vehicle_era_heat_reduction_pct_check","type":"c","definition":"CHECK (((heat_reduction_pct >= (0)::numeric) AND (heat_reduction_pct <= (100)::numeric)))"},{"table":"public.vehicle_era","name":"vehicle_era_layer_count_check","type":"c","definition":"CHECK ((layer_count > 0))"},{"table":"public.vehicle_infantry","name":"vehicle_infantry_deployment_cooldown_seconds_check","type":"c","definition":"CHECK ((deployment_cooldown_seconds >= (0)::numeric))"},{"table":"public.vehicle_infantry","name":"vehicle_infantry_infantry_type_check","type":"c","definition":"CHECK ((infantry_type = ANY (ARRAY['unspecified'::text, 'at_squad'::text, 'sniper'::text, 'mortar_squad'::text, 'assault_squad'::text, 'other'::text])))"},{"table":"public.vehicle_infantry","name":"vehicle_infantry_squad_count_check","type":"c","definition":"CHECK ((squad_count > 0))"},{"table":"public.vehicle_infantry","name":"vehicle_infantry_trooper_count_check","type":"c","definition":"CHECK ((trooper_count > 0))"},{"table":"public.vehicle_progression_edges","name":"vehicle_progression_edges_check","type":"c","definition":"CHECK ((from_vehicle_id <> to_vehicle_id))"},{"table":"public.vehicle_progression_edges","name":"vehicle_progression_edges_edge_type_check","type":"c","definition":"CHECK ((edge_type = ANY (ARRAY['normal'::text, 'branch'::text, 'token'::text, 'special'::text])))"},{"table":"public.vehicle_progression_edges","name":"vehicle_progression_edges_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.vehicle_token_rewards","name":"vehicle_token_rewards_quantity_check","type":"c","definition":"CHECK ((quantity > 0))"},{"table":"public.vehicle_token_rewards","name":"vehicle_token_rewards_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_availability_check","type":"c","definition":"CHECK ((availability = ANY (ARRAY['default'::text, 'research'::text, 'upgrade'::text, 'unknown'::text])))"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_credit_cost_check","type":"c","definition":"CHECK ((credit_cost >= (0)::numeric))"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_engine_power_hp_check","type":"c","definition":"CHECK ((engine_power_hp > (0)::numeric))"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_reverse_speed_kmh_check","type":"c","definition":"CHECK ((reverse_speed_kmh >= (0)::numeric))"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_source_type_check","type":"c","definition":"CHECK ((source_type = ANY (ARRAY['official'::text, 'ingame'::text, 'wiki'::text, 'community'::text])))"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_top_speed_kmh_check","type":"c","definition":"CHECK ((top_speed_kmh >= (0)::numeric))"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_upgrade_type_check","type":"c","definition":"CHECK ((upgrade_type = ANY (ARRAY['engine'::text, 'armor'::text, 'era'::text, 'smoke'::text, 'aps'::text, 'weapon'::text, 'ammo'::text, 'infantry'::text, 'optics'::text, 'mobility'::text, 'loading'::text, 'protection'::text, 'other'::text])))"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_xp_cost_check","type":"c","definition":"CHECK ((xp_cost >= (0)::numeric))"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_accuracy_deg_check","type":"c","definition":"CHECK ((accuracy_deg >= (0)::numeric))"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_caliber_mm_check","type":"c","definition":"CHECK ((caliber_mm > (0)::numeric))"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_depression_deg_check","type":"c","definition":"CHECK ((depression_deg >= (0)::numeric))"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_elevation_deg_check","type":"c","definition":"CHECK ((elevation_deg >= (0)::numeric))"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_magazine_size_check","type":"c","definition":"CHECK ((magazine_size > 0))"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_rate_of_fire_check","type":"c","definition":"CHECK ((rate_of_fire > (0)::numeric))"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_reload_seconds_check","type":"c","definition":"CHECK ((reload_seconds >= (0)::numeric))"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_role_check","type":"c","definition":"CHECK ((role = ANY (ARRAY['primary'::text, 'secondary'::text, 'remote_station'::text, 'other'::text])))"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_weapon_type_check","type":"c","definition":"CHECK ((weapon_type = ANY (ARRAY['cannon'::text, 'autocannon'::text, 'atgm'::text, 'machine_gun'::text, 'rocket'::text, 'mortar'::text, 'howitzer'::text, 'other'::text])))"},{"table":"public.vehicles","name":"vehicles_acceleration_0_32_seconds_check","type":"c","definition":"CHECK ((acceleration_0_32_seconds >= (0)::numeric))"},{"table":"public.vehicles","name":"vehicles_acquisition_type_check","type":"c","definition":"CHECK ((acquisition_type = ANY (ARRAY['progression'::text, 'premium'::text, 'event'::text, 'special'::text, 'other'::text])))"},{"table":"public.vehicles","name":"vehicles_camouflage_check","type":"c","definition":"CHECK (((camouflage >= (0)::numeric) AND (camouflage <= (100)::numeric)))"},{"table":"public.vehicles","name":"vehicles_engine_power_hp_check","type":"c","definition":"CHECK ((engine_power_hp > (0)::numeric))"},{"table":"public.vehicles","name":"vehicles_hp_check","type":"c","definition":"CHECK ((hp > 0))"},{"table":"public.vehicles","name":"vehicles_performance_basis_check","type":"c","definition":"CHECK ((jsonb_typeof(performance_basis) = 'object'::text))"},{"table":"public.vehicles","name":"vehicles_release_status_check","type":"c","definition":"CHECK ((release_status = ANY (ARRAY['unknown'::text, 'announced'::text, 'released'::text, 'removed'::text])))"},{"table":"public.vehicles","name":"vehicles_source_type_check","type":"c","definition":"CHECK ((source_type = ANY (ARRAY['official'::text, 'ingame'::text, 'wiki'::text, 'community'::text])))"},{"table":"public.vehicles","name":"vehicles_tier_check","type":"c","definition":"CHECK (((tier >= 1) AND (tier <= 10)))"},{"table":"public.vehicles","name":"vehicles_top_speed_check","type":"c","definition":"CHECK ((top_speed >= (0)::numeric))"},{"table":"public.vehicles","name":"vehicles_vehicle_class_check","type":"c","definition":"CHECK ((vehicle_class = ANY (ARRAY['MBT'::text, 'LT'::text, 'AFV'::text, 'TD'::text, 'SPG'::text])))"},{"table":"public.vehicles","name":"vehicles_verification_status_check","type":"c","definition":"CHECK ((verification_status = ANY (ARRAY['public_verified'::text, 'needs_ingame_check'::text, 'ingame_verified'::text])))"},{"table":"public.vehicles","name":"vehicles_view_range_check","type":"c","definition":"CHECK ((view_range >= (0)::numeric))"},{"table":"public.vehicles","name":"vehicles_weight_t_check","type":"c","definition":"CHECK ((weight_t > (0)::numeric))"},{"table":"public.ammo_guidance_modes","name":"ammo_guidance_modes_ammo_id_fkey","type":"f","definition":"FOREIGN KEY (ammo_id) REFERENCES vehicle_ammo(id) ON DELETE CASCADE"},{"table":"public.ammo_penetration_samples","name":"ammo_penetration_samples_ammo_id_fkey","type":"f","definition":"FOREIGN KEY (ammo_id) REFERENCES vehicle_ammo(id) ON DELETE CASCADE"},{"table":"public.ammo_trait_links","name":"ammo_trait_links_ammo_id_fkey","type":"f","definition":"FOREIGN KEY (ammo_id) REFERENCES vehicle_ammo(id) ON DELETE CASCADE"},{"table":"public.ammo_trait_links","name":"ammo_trait_links_trait_code_fkey","type":"f","definition":"FOREIGN KEY (trait_code) REFERENCES ammo_traits(code)"},{"table":"public.ammo_upgrade_links","name":"ammo_upgrade_links_ammo_id_weapon_id_fkey","type":"f","definition":"FOREIGN KEY (ammo_id, weapon_id) REFERENCES vehicle_ammo(id, weapon_id) ON DELETE CASCADE"},{"table":"public.ammo_upgrade_links","name":"ammo_upgrade_links_upgrade_id_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (upgrade_id, vehicle_id) REFERENCES vehicle_upgrades(id, vehicle_id)"},{"table":"public.ammo_upgrade_links","name":"ammo_upgrade_links_weapon_id_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (weapon_id, vehicle_id) REFERENCES vehicle_weapons(id, vehicle_id)"},{"table":"private.aw_fleet_plan_items","name":"aw_fleet_plan_items_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"private.aw_fleet_plan_items","name":"aw_fleet_plan_items_workspace_id_fkey","type":"f","definition":"FOREIGN KEY (workspace_id) REFERENCES private.coop_profiles(id) ON DELETE CASCADE"},{"table":"public.capabilities","name":"capabilities_parent_code_fkey","type":"f","definition":"FOREIGN KEY (parent_code) REFERENCES capabilities(code)"},{"table":"public.era_coverage","name":"era_coverage_capability_id_fkey","type":"f","definition":"FOREIGN KEY (capability_id) REFERENCES vehicle_era(capability_id) ON DELETE CASCADE"},{"table":"public.tech_tree_branches","name":"tech_tree_branches_dealer_id_fkey","type":"f","definition":"FOREIGN KEY (dealer_id) REFERENCES dealers(id)"},{"table":"public.tokens","name":"tokens_dealer_id_fkey","type":"f","definition":"FOREIGN KEY (dealer_id) REFERENCES dealers(id)"},{"table":"public.unlock_paths","name":"unlock_paths_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"public.unlock_requirements","name":"unlock_requirements_dealer_id_fkey","type":"f","definition":"FOREIGN KEY (dealer_id) REFERENCES dealers(id)"},{"table":"public.unlock_requirements","name":"unlock_requirements_source_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (source_vehicle_id) REFERENCES vehicles(id)"},{"table":"public.unlock_requirements","name":"unlock_requirements_token_id_fkey","type":"f","definition":"FOREIGN KEY (token_id) REFERENCES tokens(id)"},{"table":"public.unlock_requirements","name":"unlock_requirements_unlock_path_id_fkey","type":"f","definition":"FOREIGN KEY (unlock_path_id) REFERENCES unlock_paths(id) ON DELETE CASCADE"},{"table":"public.unlock_requirements","name":"unlock_source_upgrade_same_vehicle","type":"f","definition":"FOREIGN KEY (source_upgrade_id, source_vehicle_id) REFERENCES vehicle_upgrades(id, vehicle_id)"},{"table":"public.unlock_paths","name":"unlock_target_upgrade_same_vehicle","type":"f","definition":"FOREIGN KEY (target_upgrade_id, vehicle_id) REFERENCES vehicle_upgrades(id, vehicle_id)"},{"table":"public.upgrade_prerequisites","name":"upgrade_prerequisites_prerequisite_upgrade_id_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (prerequisite_upgrade_id, vehicle_id) REFERENCES vehicle_upgrades(id, vehicle_id)"},{"table":"public.upgrade_prerequisites","name":"upgrade_prerequisites_upgrade_id_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (upgrade_id, vehicle_id) REFERENCES vehicle_upgrades(id, vehicle_id) ON DELETE CASCADE"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_weapon_id_fkey","type":"f","definition":"FOREIGN KEY (weapon_id) REFERENCES vehicle_weapons(id) ON DELETE CASCADE"},{"table":"public.vehicle_armor","name":"vehicle_armor_upgrade_id_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (upgrade_id, vehicle_id) REFERENCES vehicle_upgrades(id, vehicle_id)"},{"table":"public.vehicle_armor","name":"vehicle_armor_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"public.vehicle_branch_memberships","name":"vehicle_branch_memberships_branch_id_fkey","type":"f","definition":"FOREIGN KEY (branch_id) REFERENCES tech_tree_branches(id) ON DELETE CASCADE"},{"table":"public.vehicle_branch_memberships","name":"vehicle_branch_memberships_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"public.vehicle_capabilities","name":"vehicle_capabilities_capability_code_fkey","type":"f","definition":"FOREIGN KEY (capability_code) REFERENCES capabilities(code)"},{"table":"public.vehicle_capabilities","name":"vehicle_capabilities_upgrade_id_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (upgrade_id, vehicle_id) REFERENCES vehicle_upgrades(id, vehicle_id)"},{"table":"public.vehicle_capabilities","name":"vehicle_capabilities_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"public.vehicle_crew_positions","name":"vehicle_crew_positions_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"public.vehicle_era","name":"vehicle_era_capability_id_fkey","type":"f","definition":"FOREIGN KEY (capability_id) REFERENCES vehicle_capabilities(id) ON DELETE CASCADE"},{"table":"public.vehicle_infantry","name":"vehicle_infantry_capability_id_fkey","type":"f","definition":"FOREIGN KEY (capability_id) REFERENCES vehicle_capabilities(id) ON DELETE CASCADE"},{"table":"public.vehicle_progression_edges","name":"vehicle_progression_edges_from_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (from_vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"public.vehicle_progression_edges","name":"vehicle_progression_edges_to_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (to_vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"public.vehicle_token_rewards","name":"vehicle_token_rewards_token_id_fkey","type":"f","definition":"FOREIGN KEY (token_id) REFERENCES tokens(id)"},{"table":"public.vehicle_token_rewards","name":"vehicle_token_rewards_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE"},{"table":"public.vehicles","name":"vehicles_dealer_id_fkey","type":"f","definition":"FOREIGN KEY (dealer_id) REFERENCES dealers(id)"},{"table":"public.weapon_upgrade_links","name":"weapon_upgrade_links_upgrade_id_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (upgrade_id, vehicle_id) REFERENCES vehicle_upgrades(id, vehicle_id)"},{"table":"public.weapon_upgrade_links","name":"weapon_upgrade_links_weapon_id_vehicle_id_fkey","type":"f","definition":"FOREIGN KEY (weapon_id, vehicle_id) REFERENCES vehicle_weapons(id, vehicle_id) ON DELETE CASCADE"},{"table":"public.ammo_guidance_modes","name":"ammo_guidance_modes_pkey","type":"p","definition":"PRIMARY KEY (ammo_id, mode_code)"},{"table":"public.ammo_penetration_samples","name":"ammo_penetration_samples_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.ammo_trait_links","name":"ammo_trait_links_pkey","type":"p","definition":"PRIMARY KEY (ammo_id, trait_code)"},{"table":"public.ammo_traits","name":"ammo_traits_pkey","type":"p","definition":"PRIMARY KEY (code)"},{"table":"public.ammo_upgrade_links","name":"ammo_upgrade_links_pkey","type":"p","definition":"PRIMARY KEY (ammo_id, upgrade_id)"},{"table":"private.aw_data_issues","name":"aw_data_issues_pkey","type":"p","definition":"PRIMARY KEY (issue_key)"},{"table":"private.aw_fleet_plan_items","name":"aw_fleet_plan_items_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"private.aw_import_batches","name":"aw_import_batches_pkey","type":"p","definition":"PRIMARY KEY (batch_key)"},{"table":"private.aw_source_snapshots","name":"aw_source_snapshots_pkey","type":"p","definition":"PRIMARY KEY (entity_type, entity_id)"},{"table":"public.capabilities","name":"capabilities_pkey","type":"p","definition":"PRIMARY KEY (code)"},{"table":"public.dealers","name":"dealers_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.era_coverage","name":"era_coverage_pkey","type":"p","definition":"PRIMARY KEY (capability_id, location)"},{"table":"public.tech_tree_branches","name":"tech_tree_branches_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.tokens","name":"tokens_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.unlock_paths","name":"unlock_paths_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.unlock_requirements","name":"unlock_requirements_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.upgrade_prerequisites","name":"upgrade_prerequisites_pkey","type":"p","definition":"PRIMARY KEY (upgrade_id, prerequisite_upgrade_id)"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.vehicle_armor","name":"vehicle_armor_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.vehicle_branch_memberships","name":"vehicle_branch_memberships_pkey","type":"p","definition":"PRIMARY KEY (vehicle_id, branch_id)"},{"table":"public.vehicle_capabilities","name":"vehicle_capabilities_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.vehicle_crew_positions","name":"vehicle_crew_positions_pkey","type":"p","definition":"PRIMARY KEY (vehicle_id, position_key)"},{"table":"public.vehicle_era","name":"vehicle_era_pkey","type":"p","definition":"PRIMARY KEY (capability_id)"},{"table":"public.vehicle_infantry","name":"vehicle_infantry_pkey","type":"p","definition":"PRIMARY KEY (capability_id, infantry_type)"},{"table":"public.vehicle_progression_edges","name":"vehicle_progression_edges_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.vehicle_token_rewards","name":"vehicle_token_rewards_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.vehicles","name":"vehicles_pkey","type":"p","definition":"PRIMARY KEY (id)"},{"table":"public.weapon_upgrade_links","name":"weapon_upgrade_links_pkey","type":"p","definition":"PRIMARY KEY (weapon_id, upgrade_id)"},{"table":"public.vehicle_ammo","name":"ammo_id_weapon_unique","type":"u","definition":"UNIQUE (id, weapon_id)"},{"table":"public.ammo_penetration_samples","name":"ammo_penetration_samples_ammo_id_sample_key_key","type":"u","definition":"UNIQUE (ammo_id, sample_key)"},{"table":"private.aw_fleet_plan_items","name":"aw_fleet_plan_items_workspace_id_user_id_vehicle_id_key","type":"u","definition":"UNIQUE (workspace_id, user_id, vehicle_id)"},{"table":"public.dealers","name":"dealers_slug_key","type":"u","definition":"UNIQUE (slug)"},{"table":"public.vehicle_token_rewards","name":"reward_vehicle_token_unique","type":"u","definition":"UNIQUE (vehicle_id, token_id)"},{"table":"public.tech_tree_branches","name":"tech_tree_branches_slug_key","type":"u","definition":"UNIQUE (slug)"},{"table":"public.tokens","name":"tokens_code_key","type":"u","definition":"UNIQUE (code)"},{"table":"public.unlock_paths","name":"unlock_paths_vehicle_id_slug_key","type":"u","definition":"UNIQUE (vehicle_id, slug)"},{"table":"public.unlock_requirements","name":"unlock_requirements_unlock_path_id_slug_key","type":"u","definition":"UNIQUE (unlock_path_id, slug)"},{"table":"public.vehicle_ammo","name":"vehicle_ammo_weapon_id_slug_key","type":"u","definition":"UNIQUE (weapon_id, slug)"},{"table":"public.vehicle_armor","name":"vehicle_armor_vehicle_id_configuration_key_location_key","type":"u","definition":"UNIQUE (vehicle_id, configuration_key, location)"},{"table":"public.vehicle_capabilities","name":"vehicle_capabilities_id_vehicle_id_key","type":"u","definition":"UNIQUE (id, vehicle_id)"},{"table":"public.vehicle_capabilities","name":"vehicle_capabilities_vehicle_id_capability_code_variant_key_key","type":"u","definition":"UNIQUE (vehicle_id, capability_code, variant_key)"},{"table":"public.vehicle_progression_edges","name":"vehicle_progression_edges_from_vehicle_id_to_vehicle_id_edg_key","type":"u","definition":"UNIQUE (from_vehicle_id, to_vehicle_id, edge_type)"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_id_vehicle_id_key","type":"u","definition":"UNIQUE (id, vehicle_id)"},{"table":"public.vehicle_upgrades","name":"vehicle_upgrades_vehicle_id_slug_key","type":"u","definition":"UNIQUE (vehicle_id, slug)"},{"table":"public.vehicle_weapons","name":"vehicle_weapons_vehicle_id_slug_key","type":"u","definition":"UNIQUE (vehicle_id, slug)"},{"table":"public.vehicles","name":"vehicles_slug_key","type":"u","definition":"UNIQUE (slug)"},{"table":"public.vehicle_weapons","name":"weapon_id_vehicle_unique","type":"u","definition":"UNIQUE (id, vehicle_id)"}]$aw_json$::jsonb)
                 order by case value->>'type' when 'p' then 0 when 'u' then 1 when 'c' then 2 when 'f' then 3 else 4 end loop
  select pg_get_constraintdef(c.oid) into actual from pg_constraint c
  where c.conrelid=to_regclass(expected->>'table') and c.conname=expected->>'name';
  if not found then
   execute format('alter table %s add constraint %I %s',to_regclass(expected->>'table'),
       expected->>'name',expected->>'definition');
  elsif actual is distinct from expected->>'definition' then
   raise exception 'AW_CONSTRAINT_MISMATCH: %.%',expected->>'table',expected->>'name';
  end if;
 end loop;
end $aw_constraints$;

-- 3. Non-constraint indexes; never silently accept an incompatible same-name index.
do $aw_indexes$
declare expected jsonb; actual text; index_ref regclass;
begin
 for expected in select value from jsonb_array_elements($aw_json$[{"table":"public.vehicle_ammo","name":"ammo_ap_family_pen_idx","definition":"CREATE INDEX ammo_ap_family_pen_idx ON public.vehicle_ammo USING btree (penetration, weapon_id) WHERE (ammo_type = ANY (ARRAY['ap'::text, 'apfsds'::text, 'apds'::text, 'apcr'::text]))"},{"table":"public.ammo_guidance_modes","name":"ammo_guidance_filter_idx","definition":"CREATE INDEX ammo_guidance_filter_idx ON public.ammo_guidance_modes USING btree (mode_code, ammo_id)"},{"table":"public.ammo_trait_links","name":"ammo_traits_filter_idx","definition":"CREATE INDEX ammo_traits_filter_idx ON public.ammo_trait_links USING btree (trait_code, ammo_id)"},{"table":"public.ammo_upgrade_links","name":"ammo_upgrade_ammo_idx","definition":"CREATE INDEX ammo_upgrade_ammo_idx ON public.ammo_upgrade_links USING btree (ammo_id, weapon_id)"},{"table":"public.ammo_upgrade_links","name":"ammo_upgrade_upgrade_idx","definition":"CREATE INDEX ammo_upgrade_upgrade_idx ON public.ammo_upgrade_links USING btree (upgrade_id, vehicle_id)"},{"table":"public.ammo_upgrade_links","name":"ammo_upgrade_weapon_idx","definition":"CREATE INDEX ammo_upgrade_weapon_idx ON public.ammo_upgrade_links USING btree (weapon_id, vehicle_id)"},{"table":"public.vehicle_armor","name":"armor_upgrade_idx","definition":"CREATE INDEX armor_upgrade_idx ON public.vehicle_armor USING btree (upgrade_id, vehicle_id)"},{"table":"private.aw_fleet_plan_items","name":"aw_plan_team_vehicle_idx","definition":"CREATE INDEX aw_plan_team_vehicle_idx ON private.aw_fleet_plan_items USING btree (workspace_id, vehicle_id, status)"},{"table":"private.aw_fleet_plan_items","name":"aw_plan_vehicle_idx","definition":"CREATE INDEX aw_plan_vehicle_idx ON private.aw_fleet_plan_items USING btree (vehicle_id)"},{"table":"public.tech_tree_branches","name":"branches_dealer_idx","definition":"CREATE INDEX branches_dealer_idx ON public.tech_tree_branches USING btree (dealer_id)"},{"table":"public.capabilities","name":"capabilities_parent_idx","definition":"CREATE INDEX capabilities_parent_idx ON public.capabilities USING btree (parent_code)"},{"table":"public.vehicle_era","name":"era_type_idx","definition":"CREATE INDEX era_type_idx ON public.vehicle_era USING btree (era_type, generation)"},{"table":"public.vehicle_branch_memberships","name":"memberships_branch_idx","definition":"CREATE INDEX memberships_branch_idx ON public.vehicle_branch_memberships USING btree (branch_id, vehicle_id)"},{"table":"public.ammo_penetration_samples","name":"penetration_filter_idx","definition":"CREATE INDEX penetration_filter_idx ON public.ammo_penetration_samples USING btree (penetration_mm, ammo_id)"},{"table":"public.vehicle_progression_edges","name":"progression_to_idx","definition":"CREATE INDEX progression_to_idx ON public.vehicle_progression_edges USING btree (to_vehicle_id)"},{"table":"public.vehicle_token_rewards","name":"rewards_token_id_idx","definition":"CREATE INDEX rewards_token_id_idx ON public.vehicle_token_rewards USING btree (token_id)"},{"table":"public.tokens","name":"token_dealer_idx","definition":"CREATE INDEX token_dealer_idx ON public.tokens USING btree (dealer_id)"},{"table":"public.unlock_requirements","name":"unlock_req_dealer_idx","definition":"CREATE INDEX unlock_req_dealer_idx ON public.unlock_requirements USING btree (dealer_id)"},{"table":"public.unlock_requirements","name":"unlock_req_source_idx","definition":"CREATE INDEX unlock_req_source_idx ON public.unlock_requirements USING btree (source_vehicle_id)"},{"table":"public.unlock_paths","name":"unlock_target_upgrade_idx","definition":"CREATE INDEX unlock_target_upgrade_idx ON public.unlock_paths USING btree (target_upgrade_id, vehicle_id)"},{"table":"public.unlock_requirements","name":"unlock_token_id_idx","definition":"CREATE INDEX unlock_token_id_idx ON public.unlock_requirements USING btree (token_id)"},{"table":"public.unlock_requirements","name":"unlock_upgrade_idx","definition":"CREATE INDEX unlock_upgrade_idx ON public.unlock_requirements USING btree (source_upgrade_id, source_vehicle_id)"},{"table":"public.upgrade_prerequisites","name":"upgrade_prerequisite_source_idx","definition":"CREATE INDEX upgrade_prerequisite_source_idx ON public.upgrade_prerequisites USING btree (prerequisite_upgrade_id, vehicle_id)"},{"table":"public.upgrade_prerequisites","name":"upgrade_prerequisite_target_idx","definition":"CREATE INDEX upgrade_prerequisite_target_idx ON public.upgrade_prerequisites USING btree (upgrade_id, vehicle_id)"},{"table":"public.vehicle_capabilities","name":"vehicle_capability_filter_idx","definition":"CREATE INDEX vehicle_capability_filter_idx ON public.vehicle_capabilities USING btree (capability_code, availability, vehicle_id)"},{"table":"public.vehicle_capabilities","name":"vehicle_capability_upgrade_idx","definition":"CREATE INDEX vehicle_capability_upgrade_idx ON public.vehicle_capabilities USING btree (upgrade_id, vehicle_id)"},{"table":"public.vehicles","name":"vehicles_dealer_idx","definition":"CREATE INDEX vehicles_dealer_idx ON public.vehicles USING btree (dealer_id)"},{"table":"public.vehicles","name":"vehicles_filter_idx","definition":"CREATE INDEX vehicles_filter_idx ON public.vehicles USING btree (tier, vehicle_class, acquisition_type)"},{"table":"public.vehicles","name":"vehicles_nation_idx","definition":"CREATE INDEX vehicles_nation_idx ON public.vehicles USING btree (nation)"},{"table":"public.weapon_upgrade_links","name":"weapon_upgrade_source_idx","definition":"CREATE INDEX weapon_upgrade_source_idx ON public.weapon_upgrade_links USING btree (upgrade_id, vehicle_id)"},{"table":"public.weapon_upgrade_links","name":"weapon_upgrade_weapon_idx","definition":"CREATE INDEX weapon_upgrade_weapon_idx ON public.weapon_upgrade_links USING btree (weapon_id, vehicle_id)"}]$aw_json$::jsonb) loop
  index_ref:=to_regclass(split_part(expected->>'table','.',1)||'.'||(expected->>'name'));
  if index_ref is null then
   execute replace(expected->>'definition',' INDEX ',' INDEX IF NOT EXISTS ');
  else
   select pg_get_indexdef(index_ref) into actual;
   if actual is distinct from expected->>'definition' then
    raise exception 'AW_INDEX_MISMATCH: %',expected->>'name';
   end if;
  end if;
 end loop;
end $aw_indexes$;

-- 4. Current views. They use invoker permissions, including private adapters.
create or replace view "public"."aw_effective_capabilities" with (security_invoker=true) as
 WITH RECURSIVE expanded AS (
         SELECT vc.id,
            vc.vehicle_id,
            vc.capability_code,
            vc.availability,
            vc.upgrade_id,
            vc.source_url,
            vc.verification_status
           FROM vehicle_capabilities vc
        UNION ALL
         SELECT e.id,
            e.vehicle_id,
            c.parent_code,
            e.availability,
            e.upgrade_id,
            e.source_url,
            e.verification_status
           FROM (expanded e
             JOIN capabilities c ON ((c.code = e.capability_code)))
          WHERE (c.parent_code IS NOT NULL)
        )
 SELECT expanded.id,
    expanded.vehicle_id,
    expanded.capability_code,
    expanded.availability,
    expanded.upgrade_id,
    expanded.source_url,
    expanded.verification_status
   FROM expanded
UNION ALL
 SELECT w.id,
    w.vehicle_id,
        CASE w.weapon_type
            WHEN 'atgm'::text THEN 'atgm'::text
            ELSE 'autocannon'::text
        END AS capability_code,
        CASE
            WHEN (w.requires_research = true) THEN 'research'::text
            WHEN (w.requires_research = false) THEN 'default'::text
            ELSE 'unknown'::text
        END AS availability,
    NULL::uuid AS upgrade_id,
    w.source_url,
    w.verification_status
   FROM vehicle_weapons w
  WHERE (w.weapon_type = ANY (ARRAY['atgm'::text, 'autocannon'::text]));
create or replace view "public"."aw_upgrade_unlock_requirements" with (security_invoker=true) as
 SELECT p.vehicle_id,
    p.target_upgrade_id,
    p.id AS unlock_path_id,
    p.slug AS path_slug,
    p.is_complete,
    r.id AS requirement_id,
    r.requirement_type,
    r.source_vehicle_id,
    r.source_upgrade_id,
    r.token_id,
    r.operator,
    r.required_value,
    r.unit,
    r.description,
    r.verification_status,
    r.source_url
   FROM (unlock_paths p
     JOIN unlock_requirements r ON ((r.unlock_path_id = p.id)))
  WHERE (p.target_upgrade_id IS NOT NULL);
create or replace view "public"."aw_tech_tree_requirements" with (security_invoker=true) as
 SELECT p.vehicle_id AS target_vehicle_id,
    p.id AS unlock_path_id,
    p.slug AS path_slug,
    r.id AS requirement_id,
    r.requirement_type,
    r.source_vehicle_id,
    r.source_upgrade_id,
    r.token_id,
    r.operator,
    r.required_value,
    r.unit,
    r.description,
    r.verification_status,
    r.source_url,
    p.is_complete,
    r.event_code
   FROM (unlock_paths p
     JOIN unlock_requirements r ON ((r.unlock_path_id = p.id)))
  WHERE (p.target_upgrade_id IS NULL);
create or replace view "public"."aw_token_relations" with (security_invoker=true) as
 SELECT r.vehicle_id,
    t.id AS token_id,
    t.code AS token_code,
    'produces'::text AS relation_type,
    (r.quantity)::numeric AS quantity,
    NULL::uuid AS unlock_path_id,
    r.verification_status,
    r.source_url
   FROM (vehicle_token_rewards r
     JOIN tokens t ON ((t.id = r.token_id)))
UNION ALL
 SELECT p.vehicle_id,
    t.id AS token_id,
    t.code AS token_code,
    'requires'::text AS relation_type,
    r.required_value AS quantity,
    r.unlock_path_id,
    r.verification_status,
    r.source_url
   FROM ((unlock_requirements r
     JOIN unlock_paths p ON ((p.id = r.unlock_path_id)))
     JOIN tokens t ON ((t.id = r.token_id)))
  WHERE (p.target_upgrade_id IS NULL);
create or replace view "public"."aw_catalog_quality" with (security_invoker=true) as
 SELECT id AS vehicle_id,
    slug,
    name,
    verification_status,
    release_status,
    ((hp IS NOT NULL) AND (top_speed IS NOT NULL) AND (view_range IS NOT NULL) AND (camouflage IS NOT NULL)) AS basic_performance_present,
    (EXISTS ( SELECT 1
           FROM vehicle_weapons w
          WHERE (w.vehicle_id = v.id))) AS has_weapon_records,
    (EXISTS ( SELECT 1
           FROM (vehicle_weapons w
             JOIN vehicle_ammo a ON ((a.weapon_id = w.id)))
          WHERE (w.vehicle_id = v.id))) AS has_ammo_records,
    capability_catalog_complete,
    (EXISTS ( SELECT 1
           FROM unlock_paths p
          WHERE ((p.vehicle_id = v.id) AND (p.target_upgrade_id IS NULL) AND p.is_complete))) AS has_complete_unlock_path,
    ( SELECT count(*) AS count
           FROM unlock_paths p
          WHERE ((p.vehicle_id = v.id) AND (p.target_upgrade_id IS NULL) AND (NOT p.is_complete))) AS incomplete_unlock_paths,
    (EXISTS ( SELECT 1
           FROM vehicle_crew_positions c
          WHERE (c.vehicle_id = v.id))) AS has_crew_records,
    (EXISTS ( SELECT 1
           FROM vehicle_armor a
          WHERE (a.vehicle_id = v.id))) AS has_armor_records
   FROM vehicles v;
create or replace view "private"."coop_workspaces" with (security_invoker=true) as
 SELECT id,
    profile_data,
    created_at,
    updated_at
   FROM private.coop_profiles;
create or replace view "private"."workspace_members" with (security_invoker=true) as
 SELECT p.id AS workspace_id,
    m.key AS user_id,
    m.value AS display_name
   FROM (private.coop_profiles p
     CROSS JOIN LATERAL jsonb_each_text((p.profile_data -> 'users'::text)) m(key, value));

-- 5. Current functions, with schema-qualified references and fixed search_path.
CREATE OR REPLACE FUNCTION private.aw_set_plan_status(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare normalized text;
begin
 normalized:=regexp_replace(upper(coalesce(p_invite_code,'')),'[^A-F0-9]','','g');
 if length(normalized)<>20 then raise exception 'INVALID_INVITE_CODE';end if;
 if not exists(select 1 from private.coop_profiles p where p.id=p_workspace_id
  and p.invite_code_hash=encode(extensions.digest(normalized,'sha256'),'hex')
  and (p.profile_data->'users') ? p_user_id) then raise exception 'WORKSPACE_NOT_FOUND_BAD_CODE_OR_MEMBER';end if;
 if p_status is null or p_status not in ('planned','researching','owned','abandoned') then raise exception 'INVALID_PLAN_STATUS';end if;
 update private.aw_fleet_plan_items set status=p_status where workspace_id=p_workspace_id and user_id=p_user_id and vehicle_id=p_vehicle_id;
 if not found then raise exception 'PLAN_NOT_FOUND';end if;
end $function$;
CREATE OR REPLACE FUNCTION private.aw_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin new.updated_at=now();return new;end $function$;
CREATE OR REPLACE FUNCTION private.aw_validate_plan_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if not exists(select 1 from private.coop_profiles p where p.id=new.workspace_id and (p.profile_data->'users') ? new.user_id)
 then raise exception 'UNKNOWN_WORKSPACE_MEMBER';end if;
 return new;
end $function$;
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
end $function$;
CREATE OR REPLACE FUNCTION private.aw_protect_plan_members()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if exists(select 1 from private.aw_fleet_plan_items i where i.workspace_id=new.id and not (coalesce(new.profile_data->'users','{}'::jsonb) ? i.user_id))
 then raise exception 'MEMBER_HAS_AW_PLANS';end if;return new;
end $function$;
CREATE OR REPLACE FUNCTION private.aw_validate_capability_parent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if new.parent_code is not null and exists(
 with recursive ancestry as (
  select code,parent_code from public.capabilities where code=new.parent_code
  union
  select c.code,c.parent_code from public.capabilities c join ancestry a on c.code=a.parent_code
 ) select 1 from ancestry where code=new.code
 ) then raise exception 'CAPABILITY_PARENT_CYCLE';end if;
 return new;
end $function$;
CREATE OR REPLACE FUNCTION private.aw_validate_special_capability()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare expected text;actual text;
begin
 expected:=case tg_table_name when 'vehicle_era' then 'era' else 'infantry_squad' end;
 select capability_code into actual from public.vehicle_capabilities where id=new.capability_id;
 if actual is distinct from expected then raise exception 'CAPABILITY_SUBTYPE_MISMATCH';end if;
 return new;
end $function$;
CREATE OR REPLACE FUNCTION public.search_aw_vehicles(p_tier integer DEFAULT NULL::integer, p_vehicle_class text DEFAULT NULL::text, p_dealer_slug text DEFAULT NULL::text, p_capabilities text[] DEFAULT '{}'::text[], p_ammo_traits text[] DEFAULT '{}'::text[], p_min_ap_penetration numeric DEFAULT NULL::numeric, p_availability text DEFAULT 'any'::text, p_has_era boolean DEFAULT NULL::boolean, p_era_type text DEFAULT NULL::text, p_branch_slug text DEFAULT NULL::text, p_requires_token text DEFAULT NULL::text, p_produces_token text DEFAULT NULL::text, p_nation text DEFAULT NULL::text, p_ap_distance_m numeric DEFAULT NULL::numeric)
 RETURNS SETOF vehicles
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
 select v.* from public.vehicles v left join public.dealers d on d.id=v.dealer_id
 where (p_tier is null or v.tier=p_tier)
 and (p_vehicle_class is null or v.vehicle_class=p_vehicle_class)
 and (p_dealer_slug is null or d.slug=p_dealer_slug)
 and (p_nation is null or v.nation=p_nation)
 and p_availability in ('any','default','research','upgrade','unknown')
 and not exists (
  select 1 from unnest(coalesce(p_capabilities,'{}')) requested(code)
  where not exists(select 1 from public.aw_effective_capabilities ec
   where ec.vehicle_id=v.id and ec.capability_code=requested.code and ec.availability<>'absent'
   and (p_availability='any' or ec.availability=p_availability))
 )
 and (p_has_era is null or
  (p_has_era=true and exists(select 1 from public.vehicle_capabilities vc where vc.vehicle_id=v.id and vc.capability_code='era' and vc.availability<>'absent' and (p_availability='any' or vc.availability=p_availability)))
  or (p_has_era=false and not exists(select 1 from public.vehicle_capabilities vc where vc.vehicle_id=v.id and vc.capability_code='era' and vc.availability<>'absent')
   and (v.capability_catalog_complete or exists(select 1 from public.vehicle_capabilities vc where vc.vehicle_id=v.id and vc.capability_code='era' and vc.availability='absent'))))
 and (p_era_type is null or exists(select 1 from public.vehicle_era e join public.vehicle_capabilities vc on vc.id=e.capability_id
  where vc.vehicle_id=v.id and e.era_type=p_era_type and vc.availability<>'absent' and (p_availability='any' or vc.availability=p_availability)))
 and (cardinality(coalesce(p_ammo_traits,'{}'))=0 or exists(
  select 1 from public.vehicle_weapons w join public.vehicle_ammo a on a.weapon_id=w.id
  where w.vehicle_id=v.id
  and (p_availability='any' or (p_availability='research' and (a.requires_research=true or w.requires_research=true))
   or (p_availability='default' and a.requires_research=false and w.requires_research=false)
   or (p_availability='unknown' and (a.requires_research is null or w.requires_research is null) and a.requires_research is not true and w.requires_research is not true))
  and not exists(select 1 from unnest(p_ammo_traits) requested(code) where
   not exists(select 1 from public.ammo_trait_links l where l.ammo_id=a.id and l.trait_code=requested.code)
   and not exists(select 1 from public.ammo_guidance_modes g where g.ammo_id=a.id and g.mode_code=requested.code))
 ))
 and (p_min_ap_penetration is null or exists(
  select 1 from public.vehicle_weapons w join public.vehicle_ammo a on a.weapon_id=w.id
  where w.vehicle_id=v.id and a.ammo_type in ('ap','apfsds','apds','apcr')
  and (p_availability='any' or (p_availability='research' and (a.requires_research=true or w.requires_research=true))
   or (p_availability='default' and a.requires_research=false and w.requires_research=false)
   or (p_availability='unknown' and (a.requires_research is null or w.requires_research is null) and a.requires_research is not true and w.requires_research is not true))
  and ((p_ap_distance_m is null and a.penetration>=p_min_ap_penetration)
   or exists(select 1 from public.ammo_penetration_samples s where s.ammo_id=a.id and s.penetration_mm>=p_min_ap_penetration
    and (p_ap_distance_m is null or s.distance_m=p_ap_distance_m)))
 ))
 and (p_branch_slug is null or exists(select 1 from public.vehicle_branch_memberships m join public.tech_tree_branches b on b.id=m.branch_id where m.vehicle_id=v.id and b.slug=p_branch_slug))
 and (p_requires_token is null or exists(select 1 from public.unlock_paths u join public.unlock_requirements r on r.unlock_path_id=u.id join public.tokens t on t.id=r.token_id where u.vehicle_id=v.id and u.target_upgrade_id is null and t.code=p_requires_token))
 and (p_produces_token is null or exists(select 1 from public.vehicle_token_rewards r join public.tokens t on t.id=r.token_id where r.vehicle_id=v.id and t.code=p_produces_token))
 order by v.tier nulls last,v.name
$function$;
CREATE OR REPLACE FUNCTION public.upsert_aw_fleet_plan_item(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_role text DEFAULT NULL::text, p_priority integer DEFAULT NULL::integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'pg_catalog'
AS $function$
 select private.aw_plan_access(p_workspace_id,p_invite_code,'upsert',p_user_id,p_vehicle_id,p_role,p_priority,p_note)
$function$;
CREATE OR REPLACE FUNCTION public.set_aw_vehicle_plan_status(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
 perform private.aw_set_plan_status(p_workspace_id,p_invite_code,p_user_id,p_vehicle_id,p_status);
 return private.aw_plan_access(p_workspace_id,p_invite_code,'list');
end $function$;
CREATE OR REPLACE FUNCTION public.get_aw_fleet_plan(p_workspace_id uuid, p_invite_code text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'pg_catalog'
AS $function$
 select private.aw_plan_access(p_workspace_id,p_invite_code,'list')
$function$;
CREATE OR REPLACE FUNCTION public.delete_aw_fleet_plan_item(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'pg_catalog'
AS $function$
 select private.aw_plan_access(p_workspace_id,p_invite_code,'delete',p_user_id,p_vehicle_id)
$function$;
CREATE OR REPLACE FUNCTION public.filter_aw_vehicles(p_vehicle_traits text[] DEFAULT '{}'::text[], p_ammo_traits text[] DEFAULT '{}'::text[], p_min_ap_penetration numeric DEFAULT NULL::numeric, p_tier integer DEFAULT NULL::integer, p_vehicle_class text DEFAULT NULL::text, p_dealer_slug text DEFAULT NULL::text, p_nation text DEFAULT NULL::text)
 RETURNS SETOF vehicles
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
 select * from public.search_aw_vehicles(p_tier=>p_tier,p_vehicle_class=>p_vehicle_class,p_dealer_slug=>p_dealer_slug,
 p_capabilities=>p_vehicle_traits,p_ammo_traits=>p_ammo_traits,p_min_ap_penetration=>p_min_ap_penetration,p_nation=>p_nation)
$function$;

-- 6. Idempotent triggers; wrong definitions are errors.
do $aw_triggers$
declare expected jsonb; actual text;
begin
 for expected in select value from jsonb_array_elements($aw_json$[{"table":"private.aw_fleet_plan_items","name":"aw_plan_member","definition":"CREATE TRIGGER aw_plan_member BEFORE INSERT OR UPDATE ON private.aw_fleet_plan_items FOR EACH ROW EXECUTE FUNCTION private.aw_validate_plan_member()"},{"table":"public.vehicles","name":"aw_updated_at","definition":"CREATE TRIGGER aw_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION private.aw_set_updated_at()"},{"table":"public.vehicle_weapons","name":"aw_updated_at","definition":"CREATE TRIGGER aw_updated_at BEFORE UPDATE ON public.vehicle_weapons FOR EACH ROW EXECUTE FUNCTION private.aw_set_updated_at()"},{"table":"public.vehicle_ammo","name":"aw_updated_at","definition":"CREATE TRIGGER aw_updated_at BEFORE UPDATE ON public.vehicle_ammo FOR EACH ROW EXECUTE FUNCTION private.aw_set_updated_at()"},{"table":"private.aw_fleet_plan_items","name":"aw_updated_at","definition":"CREATE TRIGGER aw_updated_at BEFORE UPDATE ON private.aw_fleet_plan_items FOR EACH ROW EXECUTE FUNCTION private.aw_set_updated_at()"},{"table":"private.coop_profiles","name":"aw_protect_members","definition":"CREATE TRIGGER aw_protect_members BEFORE UPDATE OF profile_data ON private.coop_profiles FOR EACH ROW EXECUTE FUNCTION private.aw_protect_plan_members()"},{"table":"public.vehicle_era","name":"era_capability_type","definition":"CREATE TRIGGER era_capability_type BEFORE INSERT OR UPDATE ON public.vehicle_era FOR EACH ROW EXECUTE FUNCTION private.aw_validate_special_capability()"},{"table":"public.vehicle_infantry","name":"infantry_capability_type","definition":"CREATE TRIGGER infantry_capability_type BEFORE INSERT OR UPDATE ON public.vehicle_infantry FOR EACH ROW EXECUTE FUNCTION private.aw_validate_special_capability()"},{"table":"public.capabilities","name":"aw_capability_parent_check","definition":"CREATE TRIGGER aw_capability_parent_check BEFORE INSERT OR UPDATE OF parent_code ON public.capabilities FOR EACH ROW EXECUTE FUNCTION private.aw_validate_capability_parent()"}]$aw_json$::jsonb) loop
  select pg_get_triggerdef(t.oid) into actual from pg_trigger t
  where t.tgrelid=to_regclass(expected->>'table') and t.tgname=expected->>'name' and not t.tgisinternal;
  if not found then execute expected->>'definition';
  elsif actual is distinct from expected->>'definition' then
   raise exception 'AW_TRIGGER_MISMATCH: %.%',expected->>'table',expected->>'name';
  end if;
 end loop;
end $aw_triggers$;

-- 7. Read-only public catalog; private data is accessed through checked RPCs.
alter table "public"."ammo_guidance_modes" enable row level security;
revoke all on table "public"."ammo_guidance_modes" from public,anon,authenticated;
grant select on table "public"."ammo_guidance_modes" to anon,authenticated;
grant all on table "public"."ammo_guidance_modes" to service_role;
alter table "public"."ammo_penetration_samples" enable row level security;
revoke all on table "public"."ammo_penetration_samples" from public,anon,authenticated;
grant select on table "public"."ammo_penetration_samples" to anon,authenticated;
grant all on table "public"."ammo_penetration_samples" to service_role;
alter table "public"."ammo_trait_links" enable row level security;
revoke all on table "public"."ammo_trait_links" from public,anon,authenticated;
grant select on table "public"."ammo_trait_links" to anon,authenticated;
grant all on table "public"."ammo_trait_links" to service_role;
alter table "public"."ammo_traits" enable row level security;
revoke all on table "public"."ammo_traits" from public,anon,authenticated;
grant select on table "public"."ammo_traits" to anon,authenticated;
grant all on table "public"."ammo_traits" to service_role;
alter table "public"."ammo_upgrade_links" enable row level security;
revoke all on table "public"."ammo_upgrade_links" from public,anon,authenticated;
grant select on table "public"."ammo_upgrade_links" to anon,authenticated;
grant all on table "public"."ammo_upgrade_links" to service_role;
alter table "public"."capabilities" enable row level security;
revoke all on table "public"."capabilities" from public,anon,authenticated;
grant select on table "public"."capabilities" to anon,authenticated;
grant all on table "public"."capabilities" to service_role;
alter table "public"."dealers" enable row level security;
revoke all on table "public"."dealers" from public,anon,authenticated;
grant select on table "public"."dealers" to anon,authenticated;
grant all on table "public"."dealers" to service_role;
alter table "public"."era_coverage" enable row level security;
revoke all on table "public"."era_coverage" from public,anon,authenticated;
grant select on table "public"."era_coverage" to anon,authenticated;
grant all on table "public"."era_coverage" to service_role;
alter table "public"."tech_tree_branches" enable row level security;
revoke all on table "public"."tech_tree_branches" from public,anon,authenticated;
grant select on table "public"."tech_tree_branches" to anon,authenticated;
grant all on table "public"."tech_tree_branches" to service_role;
alter table "public"."tokens" enable row level security;
revoke all on table "public"."tokens" from public,anon,authenticated;
grant select on table "public"."tokens" to anon,authenticated;
grant all on table "public"."tokens" to service_role;
alter table "public"."unlock_paths" enable row level security;
revoke all on table "public"."unlock_paths" from public,anon,authenticated;
grant select on table "public"."unlock_paths" to anon,authenticated;
grant all on table "public"."unlock_paths" to service_role;
alter table "public"."unlock_requirements" enable row level security;
revoke all on table "public"."unlock_requirements" from public,anon,authenticated;
grant select on table "public"."unlock_requirements" to anon,authenticated;
grant all on table "public"."unlock_requirements" to service_role;
alter table "public"."upgrade_prerequisites" enable row level security;
revoke all on table "public"."upgrade_prerequisites" from public,anon,authenticated;
grant select on table "public"."upgrade_prerequisites" to anon,authenticated;
grant all on table "public"."upgrade_prerequisites" to service_role;
alter table "public"."vehicle_ammo" enable row level security;
revoke all on table "public"."vehicle_ammo" from public,anon,authenticated;
grant select on table "public"."vehicle_ammo" to anon,authenticated;
grant all on table "public"."vehicle_ammo" to service_role;
alter table "public"."vehicle_armor" enable row level security;
revoke all on table "public"."vehicle_armor" from public,anon,authenticated;
grant select on table "public"."vehicle_armor" to anon,authenticated;
grant all on table "public"."vehicle_armor" to service_role;
alter table "public"."vehicle_branch_memberships" enable row level security;
revoke all on table "public"."vehicle_branch_memberships" from public,anon,authenticated;
grant select on table "public"."vehicle_branch_memberships" to anon,authenticated;
grant all on table "public"."vehicle_branch_memberships" to service_role;
alter table "public"."vehicle_capabilities" enable row level security;
revoke all on table "public"."vehicle_capabilities" from public,anon,authenticated;
grant select on table "public"."vehicle_capabilities" to anon,authenticated;
grant all on table "public"."vehicle_capabilities" to service_role;
alter table "public"."vehicle_crew_positions" enable row level security;
revoke all on table "public"."vehicle_crew_positions" from public,anon,authenticated;
grant select on table "public"."vehicle_crew_positions" to anon,authenticated;
grant all on table "public"."vehicle_crew_positions" to service_role;
alter table "public"."vehicle_era" enable row level security;
revoke all on table "public"."vehicle_era" from public,anon,authenticated;
grant select on table "public"."vehicle_era" to anon,authenticated;
grant all on table "public"."vehicle_era" to service_role;
alter table "public"."vehicle_infantry" enable row level security;
revoke all on table "public"."vehicle_infantry" from public,anon,authenticated;
grant select on table "public"."vehicle_infantry" to anon,authenticated;
grant all on table "public"."vehicle_infantry" to service_role;
alter table "public"."vehicle_progression_edges" enable row level security;
revoke all on table "public"."vehicle_progression_edges" from public,anon,authenticated;
grant select on table "public"."vehicle_progression_edges" to anon,authenticated;
grant all on table "public"."vehicle_progression_edges" to service_role;
alter table "public"."vehicle_token_rewards" enable row level security;
revoke all on table "public"."vehicle_token_rewards" from public,anon,authenticated;
grant select on table "public"."vehicle_token_rewards" to anon,authenticated;
grant all on table "public"."vehicle_token_rewards" to service_role;
alter table "public"."vehicle_upgrades" enable row level security;
revoke all on table "public"."vehicle_upgrades" from public,anon,authenticated;
grant select on table "public"."vehicle_upgrades" to anon,authenticated;
grant all on table "public"."vehicle_upgrades" to service_role;
alter table "public"."vehicle_weapons" enable row level security;
revoke all on table "public"."vehicle_weapons" from public,anon,authenticated;
grant select on table "public"."vehicle_weapons" to anon,authenticated;
grant all on table "public"."vehicle_weapons" to service_role;
alter table "public"."vehicles" enable row level security;
revoke all on table "public"."vehicles" from public,anon,authenticated;
grant select on table "public"."vehicles" to anon,authenticated;
grant all on table "public"."vehicles" to service_role;
alter table "public"."weapon_upgrade_links" enable row level security;
revoke all on table "public"."weapon_upgrade_links" from public,anon,authenticated;
grant select on table "public"."weapon_upgrade_links" to anon,authenticated;
grant all on table "public"."weapon_upgrade_links" to service_role;
alter table "private"."aw_fleet_plan_items" enable row level security;
revoke all on table "private"."aw_fleet_plan_items" from public,anon,authenticated;
grant all on table "private"."aw_fleet_plan_items" to service_role;
alter table "private"."aw_data_issues" enable row level security;
revoke all on table "private"."aw_data_issues" from public,anon,authenticated;
grant all on table "private"."aw_data_issues" to service_role;
alter table "private"."aw_import_batches" enable row level security;
revoke all on table "private"."aw_import_batches" from public,anon,authenticated;
grant all on table "private"."aw_import_batches" to service_role;
alter table "private"."aw_source_snapshots" enable row level security;
revoke all on table "private"."aw_source_snapshots" from public,anon,authenticated;
grant all on table "private"."aw_source_snapshots" to service_role;
do $aw_policies$
declare expected jsonb; actual record;
begin
 for expected in select value from jsonb_array_elements($aw_json$[{"table":"public.ammo_guidance_modes","name":"aw_catalog_read"},{"table":"public.ammo_penetration_samples","name":"aw_catalog_read"},{"table":"public.ammo_trait_links","name":"aw_catalog_read"},{"table":"public.ammo_traits","name":"aw_catalog_read"},{"table":"public.ammo_upgrade_links","name":"aw_catalog_read"},{"table":"public.capabilities","name":"aw_catalog_read"},{"table":"public.dealers","name":"aw_catalog_read"},{"table":"public.era_coverage","name":"aw_catalog_read"},{"table":"public.tech_tree_branches","name":"aw_catalog_read"},{"table":"public.tokens","name":"aw_catalog_read"},{"table":"public.unlock_paths","name":"aw_catalog_read"},{"table":"public.unlock_requirements","name":"aw_catalog_read"},{"table":"public.upgrade_prerequisites","name":"aw_catalog_read"},{"table":"public.vehicle_ammo","name":"aw_catalog_read"},{"table":"public.vehicle_armor","name":"aw_catalog_read"},{"table":"public.vehicle_branch_memberships","name":"aw_catalog_read"},{"table":"public.vehicle_capabilities","name":"aw_catalog_read"},{"table":"public.vehicle_crew_positions","name":"aw_catalog_read"},{"table":"public.vehicle_era","name":"aw_catalog_read"},{"table":"public.vehicle_infantry","name":"aw_catalog_read"},{"table":"public.vehicle_progression_edges","name":"aw_catalog_read"},{"table":"public.vehicle_token_rewards","name":"aw_catalog_read"},{"table":"public.vehicle_upgrades","name":"aw_catalog_read"},{"table":"public.vehicle_weapons","name":"aw_catalog_read"},{"table":"public.vehicles","name":"aw_catalog_read"},{"table":"public.weapon_upgrade_links","name":"aw_catalog_read"}]$aw_json$::jsonb) loop
  select cmd,qual,with_check,roles,permissive into actual from pg_policies
  where schemaname=split_part(expected->>'table','.',1)
    and tablename=split_part(expected->>'table','.',2) and policyname=expected->>'name';
  if not found then
   execute format('create policy %I on %s for select to anon,authenticated using (true)',
    expected->>'name',to_regclass(expected->>'table'));
  elsif actual.cmd<>'SELECT' or actual.qual<>'true' or actual.with_check is not null
     or actual.permissive<>'PERMISSIVE' or actual.roles<>array['anon','authenticated']::name[] then
   raise exception 'AW_POLICY_MISMATCH: %',expected->>'table';
  end if;
 end loop;
end $aw_policies$;
grant usage on schema public,private to anon,authenticated;
revoke all on table "public"."aw_effective_capabilities" from public,anon,authenticated;
grant select on table "public"."aw_effective_capabilities" to anon,authenticated;
revoke all on table "public"."aw_upgrade_unlock_requirements" from public,anon,authenticated;
grant select on table "public"."aw_upgrade_unlock_requirements" to anon,authenticated;
revoke all on table "public"."aw_tech_tree_requirements" from public,anon,authenticated;
grant select on table "public"."aw_tech_tree_requirements" to anon,authenticated;
revoke all on table "public"."aw_token_relations" from public,anon,authenticated;
grant select on table "public"."aw_token_relations" to anon,authenticated;
revoke all on table "public"."aw_catalog_quality" from public,anon,authenticated;
grant select on table "public"."aw_catalog_quality" to anon,authenticated;
revoke all on table "private"."coop_workspaces" from public,anon,authenticated;
revoke all on table "private"."workspace_members" from public,anon,authenticated;
revoke all on function "private"."aw_set_plan_status"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_status text) from public,anon,authenticated;
grant execute on function "private"."aw_set_plan_status"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_status text) to "anon";
grant execute on function "private"."aw_set_plan_status"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_status text) to "authenticated";
revoke all on function "private"."aw_set_updated_at"() from public,anon,authenticated;
revoke all on function "private"."aw_validate_plan_member"() from public,anon,authenticated;
revoke all on function "private"."aw_plan_access"(p_workspace_id uuid, p_invite_code text, p_action text, p_user_id text, p_vehicle_id uuid, p_role text, p_priority integer, p_note text) from public,anon,authenticated;
grant execute on function "private"."aw_plan_access"(p_workspace_id uuid, p_invite_code text, p_action text, p_user_id text, p_vehicle_id uuid, p_role text, p_priority integer, p_note text) to "anon";
grant execute on function "private"."aw_plan_access"(p_workspace_id uuid, p_invite_code text, p_action text, p_user_id text, p_vehicle_id uuid, p_role text, p_priority integer, p_note text) to "authenticated";
revoke all on function "private"."aw_protect_plan_members"() from public,anon,authenticated;
revoke all on function "private"."aw_validate_capability_parent"() from public,anon,authenticated;
revoke all on function "private"."aw_validate_special_capability"() from public,anon,authenticated;
revoke all on function "public"."search_aw_vehicles"(p_tier integer, p_vehicle_class text, p_dealer_slug text, p_capabilities text[], p_ammo_traits text[], p_min_ap_penetration numeric, p_availability text, p_has_era boolean, p_era_type text, p_branch_slug text, p_requires_token text, p_produces_token text, p_nation text, p_ap_distance_m numeric) from public,anon,authenticated;
grant execute on function "public"."search_aw_vehicles"(p_tier integer, p_vehicle_class text, p_dealer_slug text, p_capabilities text[], p_ammo_traits text[], p_min_ap_penetration numeric, p_availability text, p_has_era boolean, p_era_type text, p_branch_slug text, p_requires_token text, p_produces_token text, p_nation text, p_ap_distance_m numeric) to "anon";
grant execute on function "public"."search_aw_vehicles"(p_tier integer, p_vehicle_class text, p_dealer_slug text, p_capabilities text[], p_ammo_traits text[], p_min_ap_penetration numeric, p_availability text, p_has_era boolean, p_era_type text, p_branch_slug text, p_requires_token text, p_produces_token text, p_nation text, p_ap_distance_m numeric) to "authenticated";
grant execute on function "public"."search_aw_vehicles"(p_tier integer, p_vehicle_class text, p_dealer_slug text, p_capabilities text[], p_ammo_traits text[], p_min_ap_penetration numeric, p_availability text, p_has_era boolean, p_era_type text, p_branch_slug text, p_requires_token text, p_produces_token text, p_nation text, p_ap_distance_m numeric) to "service_role";
revoke all on function "public"."upsert_aw_fleet_plan_item"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_role text, p_priority integer, p_note text) from public,anon,authenticated;
grant execute on function "public"."upsert_aw_fleet_plan_item"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_role text, p_priority integer, p_note text) to "anon";
grant execute on function "public"."upsert_aw_fleet_plan_item"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_role text, p_priority integer, p_note text) to "authenticated";
grant execute on function "public"."upsert_aw_fleet_plan_item"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_role text, p_priority integer, p_note text) to "service_role";
revoke all on function "public"."set_aw_vehicle_plan_status"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_status text) from public,anon,authenticated;
grant execute on function "public"."set_aw_vehicle_plan_status"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_status text) to "anon";
grant execute on function "public"."set_aw_vehicle_plan_status"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_status text) to "authenticated";
grant execute on function "public"."set_aw_vehicle_plan_status"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid, p_status text) to "service_role";
revoke all on function "public"."get_aw_fleet_plan"(p_workspace_id uuid, p_invite_code text) from public,anon,authenticated;
grant execute on function "public"."get_aw_fleet_plan"(p_workspace_id uuid, p_invite_code text) to "anon";
grant execute on function "public"."get_aw_fleet_plan"(p_workspace_id uuid, p_invite_code text) to "authenticated";
grant execute on function "public"."get_aw_fleet_plan"(p_workspace_id uuid, p_invite_code text) to "service_role";
revoke all on function "public"."delete_aw_fleet_plan_item"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid) from public,anon,authenticated;
grant execute on function "public"."delete_aw_fleet_plan_item"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid) to "anon";
grant execute on function "public"."delete_aw_fleet_plan_item"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid) to "authenticated";
grant execute on function "public"."delete_aw_fleet_plan_item"(p_workspace_id uuid, p_invite_code text, p_user_id text, p_vehicle_id uuid) to "service_role";
revoke all on function "public"."filter_aw_vehicles"(p_vehicle_traits text[], p_ammo_traits text[], p_min_ap_penetration numeric, p_tier integer, p_vehicle_class text, p_dealer_slug text, p_nation text) from public,anon,authenticated;
grant execute on function "public"."filter_aw_vehicles"(p_vehicle_traits text[], p_ammo_traits text[], p_min_ap_penetration numeric, p_tier integer, p_vehicle_class text, p_dealer_slug text, p_nation text) to "anon";
grant execute on function "public"."filter_aw_vehicles"(p_vehicle_traits text[], p_ammo_traits text[], p_min_ap_penetration numeric, p_tier integer, p_vehicle_class text, p_dealer_slug text, p_nation text) to "authenticated";
grant execute on function "public"."filter_aw_vehicles"(p_vehicle_traits text[], p_ammo_traits text[], p_min_ap_penetration numeric, p_tier integer, p_vehicle_class text, p_dealer_slug text, p_nation text) to "service_role";

-- Remove the pre-existing accidental execution grant on the RLS event-trigger helper.
do $aw_event_helper$
begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $aw_event_helper$;
commit;
