-- Captured from the already-applied Supabase migration history.
-- Historical migration: do not manually re-run on the existing database.
set local lock_timeout='3s';
set local statement_timeout='25s';
insert into public.capabilities(code,name_zh,category) values
('aps','主动防护系统','defense'),('era','爆炸反应装甲','armor'),('smoke','烟幕','defense'),
('infantry_squad','可部署步兵班','infantry'),('troop_compartment','步兵舱','structure'),
('autocannon','机炮','weapon'),('atgm','反坦克导弹','weapon'),('unmanned_turret','无人炮塔','structure'),
('active_camo','主动隐蔽','ability'),('recon','侦察能力','recon'),('magazine','弹匣装填','loading'),
('drone','无人机','recon'),('missile_warning','导弹预警','defense'),('laser_warning','激光告警','defense'),
('special_optics','特殊观瞄','recon'),('active_skill','主动技能','ability'),
('special_mobility','特殊机动能力','mobility'),('special_loading','特殊装填机制','loading'),
('nera','非爆炸反应装甲','armor')
on conflict(code) do nothing;
insert into public.capabilities(code,name_zh,category,parent_code) values
('hard_kill_aps','硬杀 APS','defense','aps'),('soft_kill_aps','软杀 APS','defense','aps')
on conflict(code) do nothing;
insert into public.ammo_traits(code,name_zh,category) values
('top_attack','攻顶','attack_profile'),('direct_attack','直射','attack_profile'),
('tandem','串联战斗部','warhead'),('thermobaric','热压','warhead'),('multipurpose','多用途','warhead'),
('programmable','可编程','effect'),('kinetic_missile','动能导弹','warhead'),
('pele','PELE 穿甲后效','effect'),('recon','侦察弹药','effect')
on conflict(code) do nothing;

create or replace view public.aw_effective_capabilities with(security_invoker=true) as
with recursive expanded as (
 select vc.id,vc.vehicle_id,vc.capability_code,vc.availability,vc.upgrade_id,vc.source_url,vc.verification_status
 from public.vehicle_capabilities vc
 union all
 select e.id,e.vehicle_id,c.parent_code,e.availability,e.upgrade_id,e.source_url,e.verification_status
 from expanded e join public.capabilities c on c.code=e.capability_code where c.parent_code is not null
)
select * from expanded
union all
select w.id,w.vehicle_id,case w.weapon_type when 'atgm' then 'atgm' else 'autocannon' end,
 case when w.requires_research=true then 'research' when w.requires_research=false then 'default' else 'unknown' end,
 null::uuid,w.source_url,w.verification_status
from public.vehicle_weapons w where w.weapon_type in ('atgm','autocannon');

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
 and (p_requires_token is null or exists(select 1 from public.unlock_paths u join public.unlock_requirements r on r.unlock_path_id=u.id join public.tokens t on t.id=r.token_id where u.vehicle_id=v.id and t.code=p_requires_token))
 and (p_produces_token is null or exists(select 1 from public.vehicle_token_rewards r join public.tokens t on t.id=r.token_id where r.vehicle_id=v.id and t.code=p_produces_token))
 order by v.tier nulls last,v.name
$fn$;

create or replace function public.filter_aw_vehicles(
 p_vehicle_traits text[] default '{}',p_ammo_traits text[] default '{}',p_min_ap_penetration numeric default null,
 p_tier integer default null,p_vehicle_class text default null,p_dealer_slug text default null,p_nation text default null)
returns setof public.vehicles language sql stable security invoker set search_path=pg_catalog as $fn$
 select * from public.search_aw_vehicles(p_tier=>p_tier,p_vehicle_class=>p_vehicle_class,p_dealer_slug=>p_dealer_slug,
 p_capabilities=>p_vehicle_traits,p_ammo_traits=>p_ammo_traits,p_min_ap_penetration=>p_min_ap_penetration,p_nation=>p_nation)
$fn$;

create or replace view public.aw_token_relations with(security_invoker=true) as
 select r.vehicle_id,t.id token_id,t.code token_code,'produces'::text relation_type,r.quantity::numeric quantity,
 null::uuid unlock_path_id,r.verification_status,r.source_url
 from public.vehicle_token_rewards r join public.tokens t on t.id=r.token_id
 union all
 select p.vehicle_id,t.id,t.code,'requires',r.required_value,r.unlock_path_id,r.verification_status,r.source_url
 from public.unlock_requirements r join public.unlock_paths p on p.id=r.unlock_path_id join public.tokens t on t.id=r.token_id;

create or replace view public.aw_tech_tree_requirements with(security_invoker=true) as
 select p.vehicle_id target_vehicle_id,p.id unlock_path_id,p.slug path_slug,
 r.id requirement_id,r.requirement_type,r.source_vehicle_id,r.source_upgrade_id,r.token_id,
 r.operator,r.required_value,r.unit,r.description,r.verification_status,r.source_url
 from public.unlock_paths p join public.unlock_requirements r on r.unlock_path_id=p.id;
grant select on public.aw_effective_capabilities,public.aw_token_relations,public.aw_tech_tree_requirements to anon,authenticated;

create or replace function private.aw_set_plan_status(
 p_workspace_id uuid,p_invite_code text,p_user_id text,p_vehicle_id uuid,p_status text)
returns void language plpgsql security definer set search_path=pg_catalog as $fn$
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
end $fn$;
revoke all on function private.aw_set_plan_status(uuid,text,text,uuid,text) from public;
grant execute on function private.aw_set_plan_status(uuid,text,text,uuid,text) to anon,authenticated;
create or replace function public.set_aw_vehicle_plan_status(
 p_workspace_id uuid,p_invite_code text,p_user_id text,p_vehicle_id uuid,p_status text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $fn$
begin
 perform private.aw_set_plan_status(p_workspace_id,p_invite_code,p_user_id,p_vehicle_id,p_status);
 return private.aw_plan_access(p_workspace_id,p_invite_code,'list');
end $fn$;
grant execute on function public.search_aw_vehicles(integer,text,text,text[],text[],numeric,text,boolean,text,text,text,text,text,numeric),
 public.set_aw_vehicle_plan_status(uuid,text,text,uuid,text) to anon,authenticated;
comment on function public.set_aw_vehicle_plan_status(uuid,text,text,uuid,text)
 is 'Shared-code authority model matching SnowRunner: code holders may edit any member plan; no claimed per-person auth identity. Tables remain private.';
insert into private.aw_import_batches(batch_key,status,started_at,completed_at,note)
values('20261001_queries_v02','completed',now(),now(),'Normalized filtering; inherited APS; explicit unknown-vs-absent ERA; token/unlock read views; shared-code plan statuses.')
on conflict(batch_key) do update set status=excluded.status,completed_at=excluded.completed_at;


