-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.

alter table public.vehicle_weapons add column configuration_key text;
alter table public.vehicle_ammo add column reload_seconds numeric check(reload_seconds>=0), add column magazine_size integer check(magazine_size>0), add column intra_clip_reload numeric check(intra_clip_reload>=0), add column rate_of_fire numeric check(rate_of_fire>0);
comment on column public.vehicle_weapons.configuration_key is 'Source weapon configuration/module key; identical weapon names in distinct loadouts remain separate.';
comment on column public.vehicle_ammo.reload_seconds is 'Seconds for the documented ammo/loadout. Weapon table reload can vary by selected ammo; do not derive damage per minute from burst RPM.';


