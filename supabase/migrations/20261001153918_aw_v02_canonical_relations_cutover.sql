-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';set local statement_timeout='25s';
do $verify$ begin
 if (select count(*) from public.vehicle_upgrades where slug like 'component_%') <>
 (select sum(jsonb_array_length(payload->'researchable_components')) from private.aw_source_snapshots where entity_type='vehicle')
 then raise exception 'COMPONENT_BACKFILL_INCOMPLETE';end if;
 if exists(select 1 from public.vehicle_token_rewards where token_id is null) or
 exists(select 1 from public.unlock_requirements where requirement_type='dealer_token' and token_id is null)
 then raise exception 'TOKEN_BACKFILL_INCOMPLETE';end if;
end $verify$;
create or replace function public.search_aw_vehicles(
 p_tier integer default null,p_vehicle_class text default null,p_dealer_slug text default null,
 p_capabilities text[] default '{}',p_ammo_traits text[] default '{}',
 p_min_ap_penetration numeric default null,p_availability text default 'any',
 p_has_era boolean default null,p_era_type text default null,
 p_branch_slug text default null,p_requires_token text default null,p_produces_token text default null,
 p_nation text default null,p_ap_distance_m numeric default null)
returns setof public.vehicles language sql stable security invoker set search_path=pg_catalog as $fn$
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
   or (p_availability='unknown' and (a.requires_research is null or w.requires_research is null)))
  and not exists(select 1 from unnest(p_ammo_traits) requested(code) where
   not exists(select 1 from public.ammo_trait_links l where l.ammo_id=a.id and l.trait_code=requested.code)
   and not exists(select 1 from public.ammo_guidance_modes g where g.ammo_id=a.id and g.mode_code=requested.code))
 ))
 and (p_min_ap_penetration is null or exists(
  select 1 from public.vehicle_weapons w join public.vehicle_ammo a on a.weapon_id=w.id
  where w.vehicle_id=v.id and a.ammo_type in ('ap','apfsds','apds','apcr')
  and (p_availability='any' or (p_availability='research' and (a.requires_research=true or w.requires_research=true))
   or (p_availability='default' and a.requires_research=false and w.requires_research=false)
   or (p_availability='unknown' and (a.requires_research is null or w.requires_research is null)))
  and ((p_ap_distance_m is null and a.penetration>=p_min_ap_penetration)
   or exists(select 1 from public.ammo_penetration_samples s where s.ammo_id=a.id and s.penetration_mm>=p_min_ap_penetration
    and (p_ap_distance_m is null or s.distance_m=p_ap_distance_m)))
 ))
 and (p_branch_slug is null or exists(select 1 from public.vehicle_branch_memberships m join public.tech_tree_branches b on b.id=m.branch_id where m.vehicle_id=v.id and b.slug=p_branch_slug))
 and (p_requires_token is null or exists(select 1 from public.unlock_paths u join public.unlock_requirements r on r.unlock_path_id=u.id join public.tokens t on t.id=r.token_id where u.vehicle_id=v.id and u.target_upgrade_id is null and t.code=p_requires_token))
 and (p_produces_token is null or exists(select 1 from public.vehicle_token_rewards r join public.tokens t on t.id=r.token_id where r.vehicle_id=v.id and t.code=p_produces_token))
 order by v.tier nulls last,v.name
$fn$;
create or replace view public.aw_tech_tree_requirements with(security_invoker=true) as
 select p.vehicle_id target_vehicle_id,p.id unlock_path_id,p.slug path_slug,
 r.id requirement_id,r.requirement_type,r.source_vehicle_id,r.source_upgrade_id,r.token_id,
 r.operator,r.required_value,r.unit,r.description,r.verification_status,r.source_url,p.is_complete,r.event_code
 from public.unlock_paths p join public.unlock_requirements r on r.unlock_path_id=p.id where p.target_upgrade_id is null;
create or replace view public.aw_token_relations with(security_invoker=true) as
 select r.vehicle_id,t.id token_id,t.code token_code,'produces'::text relation_type,r.quantity::numeric quantity,
 null::uuid unlock_path_id,r.verification_status,r.source_url
 from public.vehicle_token_rewards r join public.tokens t on t.id=r.token_id
 union all
 select p.vehicle_id,t.id,t.code,'requires',r.required_value,r.unlock_path_id,r.verification_status,r.source_url
 from public.unlock_requirements r join public.unlock_paths p on p.id=r.unlock_path_id join public.tokens t on t.id=r.token_id where p.target_upgrade_id is null;
alter table public.vehicles drop column traits,drop column trait_details,drop column researchable_components,
 drop column acceleration,drop column aim_time,drop column accuracy;
alter table public.vehicle_weapons drop column traits,drop column trait_details;
alter table public.vehicle_ammo drop column traits,drop column trait_details;
alter table public.vehicle_token_rewards add column if not exists source_type text;
alter table public.vehicle_token_rewards alter column token_id set not null;
alter table public.vehicle_token_rewards drop column token_code,drop column token_tier,drop column dealer_id,drop column requirements;
alter table public.vehicle_token_rewards add constraint reward_vehicle_token_unique unique(vehicle_id,token_id);
alter table public.unlock_requirements drop constraint unlock_requirements_check;
alter table public.unlock_requirements drop column token_code;
alter table public.unlock_requirements add constraint token_requirement_id_required check(requirement_type<>'dealer_token' or token_id is not null);
create index if not exists ammo_ap_family_pen_idx on public.vehicle_ammo(penetration,weapon_id)
 where ammo_type in ('ap','apfsds','apds','apcr');
drop index if exists public.vehicle_ammo_ap_pen_idx;
alter table public.vehicle_ammo add constraint atgm_guided_consistency check(ammo_type<>'atgm' or (is_missile is true and is_guided is true));

create or replace view public.aw_catalog_quality with(security_invoker=true) as
select v.id vehicle_id,v.slug,v.name,v.verification_status,v.release_status,
 (v.hp is not null and v.top_speed is not null and v.view_range is not null and v.camouflage is not null) basic_performance_present,
 exists(select 1 from public.vehicle_weapons w where w.vehicle_id=v.id) has_weapon_records,
 exists(select 1 from public.vehicle_weapons w join public.vehicle_ammo a on a.weapon_id=w.id where w.vehicle_id=v.id) has_ammo_records,
 v.capability_catalog_complete,
 exists(select 1 from public.unlock_paths p where p.vehicle_id=v.id and p.target_upgrade_id is null and p.is_complete) has_complete_unlock_path,
 (select count(*) from public.unlock_paths p where p.vehicle_id=v.id and p.target_upgrade_id is null and not p.is_complete) incomplete_unlock_paths,
 exists(select 1 from public.vehicle_crew_positions c where c.vehicle_id=v.id) has_crew_records,
 exists(select 1 from public.vehicle_armor a where a.vehicle_id=v.id) has_armor_records
from public.vehicles v;
grant select on public.aw_catalog_quality to anon,authenticated;
revoke all on private.aw_fleet_plan_items from public,anon,authenticated;
insert into private.aw_import_batches(batch_key,status,started_at,completed_at,note)
values('20261001_canonical_cutover','completed',now(),now(),'All 911 components migrated. Legacy arrays/JSON removed from public facts after private raw snapshots. Tokens normalized. Search uses canonical relations only.')
on conflict do nothing;


