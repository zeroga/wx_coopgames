-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';set local statement_timeout='20s';
alter table public.vehicle_ammo add column if not exists accuracy_deg numeric check(accuracy_deg>=0),
 add column if not exists magazine_mechanism text,
 add column if not exists module_damage_bonus_pct numeric;
comment on column public.vehicle_ammo.accuracy_deg is 'degrees; per-ammunition angular dispersion override';
alter table public.vehicle_armor drop constraint vehicle_armor_location_check;
alter table public.vehicle_armor add constraint vehicle_armor_location_check check(location in ('hull_unspecified','turret_unspecified','hull_front','hull_side','hull_rear','hull_roof','turret_front','turret_side','turret_rear','turret_roof','other'));
comment on column public.vehicle_armor.location is 'unspecified means panel gives hull/turret summary without exact surface; must not infer front.';


