-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';set local statement_timeout='20s';
alter table public.vehicle_ammo add constraint ammo_id_weapon_unique unique(id,weapon_id);
create table if not exists public.ammo_upgrade_links (
 ammo_id uuid not null, weapon_id uuid not null, vehicle_id uuid not null, upgrade_id uuid not null,
 primary key(ammo_id,upgrade_id),
 foreign key(ammo_id,weapon_id) references public.vehicle_ammo(id,weapon_id) on delete cascade,
 foreign key(weapon_id,vehicle_id) references public.vehicle_weapons(id,vehicle_id),
 foreign key(upgrade_id,vehicle_id) references public.vehicle_upgrades(id,vehicle_id)
);
create index if not exists ammo_upgrade_upgrade_idx on public.ammo_upgrade_links(upgrade_id,vehicle_id);
create index if not exists ammo_upgrade_weapon_idx on public.ammo_upgrade_links(weapon_id,vehicle_id);
create index if not exists ammo_upgrade_ammo_idx on public.ammo_upgrade_links(ammo_id,weapon_id);
alter table public.ammo_upgrade_links enable row level security;
revoke all on public.ammo_upgrade_links from public,anon,authenticated;
grant select on public.ammo_upgrade_links to anon,authenticated;
grant all on public.ammo_upgrade_links to service_role;
create policy aw_catalog_read on public.ammo_upgrade_links for select to anon,authenticated using(true);


