-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';set local statement_timeout='20s';
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
$function$
;

