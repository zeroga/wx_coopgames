-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';set local statement_timeout='20s';
alter table public.vehicles add column if not exists is_premium boolean,
 add column if not exists release_status text not null default 'unknown' check(release_status in ('unknown','announced','released','removed'));
alter table public.unlock_paths add column if not exists target_upgrade_id uuid,
 add column if not exists is_complete boolean not null default false,
 add constraint unlock_target_upgrade_same_vehicle foreign key(target_upgrade_id,vehicle_id) references public.vehicle_upgrades(id,vehicle_id);
create index if not exists unlock_target_upgrade_idx on public.unlock_paths(target_upgrade_id,vehicle_id);
comment on table public.unlock_paths is 'OR between paths for the same target. AND within a path. target_upgrade_id NULL means target is vehicle; non-NULL means target is that module. is_complete=false must not be treated as sufficient unlock evidence.';
comment on column public.vehicles.accuracy is 'Legacy empty field. Canonical accuracy is weapon dispersion; do not copy values across units.';
alter table public.vehicle_weapons add column if not exists accuracy_deg numeric check(accuracy_deg>=0);
comment on column public.vehicle_weapons.accuracy_deg is 'angular dispersion in degrees; use for wiki data explicitly marked degrees.';
comment on column public.vehicle_weapons.accuracy is 'linear dispersion in meters; only populate with documented reference distance.';
create or replace view public.aw_upgrade_unlock_requirements with(security_invoker=true) as
 select p.vehicle_id,p.target_upgrade_id,p.id unlock_path_id,p.slug path_slug,p.is_complete,
 r.id requirement_id,r.requirement_type,r.source_vehicle_id,r.source_upgrade_id,r.token_id,r.operator,r.required_value,r.unit,r.description,r.verification_status,r.source_url
 from public.unlock_paths p join public.unlock_requirements r on r.unlock_path_id=p.id where p.target_upgrade_id is not null;
grant select on public.aw_upgrade_unlock_requirements to anon,authenticated;
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;


