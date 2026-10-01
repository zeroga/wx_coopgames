-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';set local statement_timeout='20s';
alter table public.unlock_requirements add column if not exists event_code text;
alter table public.unlock_requirements drop constraint unlock_requirements_requirement_type_check;
alter table public.unlock_requirements add constraint unlock_requirements_requirement_type_check check(requirement_type in (
 'vehicle_progress','vehicle_proven','vehicle_renowned','dealer_token','reputation','spotting','damage','kills','assists','wins','battles','own_vehicle','own_vehicle_count','tier_requirement','special','upgrade','event_level','event_access','event_mission'));
alter table public.unlock_requirements add constraint unlock_event_code_required
 check(requirement_type not in ('event_level','event_access','event_mission') or event_code is not null);


