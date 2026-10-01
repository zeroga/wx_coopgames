-- ISOLATED DATABASE ONLY. Use synthetic fixtures; never run this on production.
-- ROLLBACK does not prevent locks or make production a safe test environment.
begin;set local statement_timeout='20s';set local lock_timeout='3s';
do $test$
declare a uuid;b uuid;w uuid;am uuid;cap uuid;tok uuid;path uuid;up uuid;br uuid;profile jsonb;ws uuid;code text;items jsonb;rejected boolean;
begin
 insert into vehicles(slug,name,tier,vehicle_class) values('__aw_test_a','Test A',10,'MBT') returning id into a;
 insert into vehicles(slug,name,tier,vehicle_class) values('__aw_test_b','Test B',9,'AFV') returning id into b;
 insert into vehicle_upgrades(vehicle_id,slug,name,availability) values(a,'test_upgrade','Test Upgrade','research') returning id into up;
 insert into vehicle_capabilities(vehicle_id,capability_code,availability,upgrade_id) values(a,'era','research',up) returning id into cap;
 insert into vehicle_era(capability_id,era_type,generation,layer_count) values(cap,'test_era',3,2);
 insert into vehicle_capabilities(vehicle_id,capability_code,availability) values(a,'smoke','default'),(a,'infantry_squad','unknown'),(a,'hard_kill_aps','default'),(b,'era','absent');
 insert into vehicle_weapons(vehicle_id,slug,name,weapon_type,requires_research) values(a,'w','Test cannon','cannon',false) returning id into w;
 insert into vehicle_ammo(weapon_id,slug,name,ammo_type,penetration,requires_research) values(w,'ap','Test APFSDS','apfsds',800,false);
 insert into vehicle_ammo(weapon_id,slug,name,ammo_type,requires_research,is_missile,is_guided) values(w,'missile','Test missile','atgm',true,true,true) returning id into am;
 insert into ammo_trait_links(ammo_id,trait_code) values(am,'top_attack');
 insert into ammo_guidance_modes(ammo_id,mode_code) values(am,'self_guided'),(am,'fire_and_forget');
 insert into tokens(code,name,tier) values('__test_token','Test',10) returning id into tok;
 insert into vehicle_token_rewards(vehicle_id,description,token_id) values(a,'Test',tok);
 insert into unlock_paths(vehicle_id,slug,name) values(b,'test','Test') returning id into path;
 insert into unlock_requirements(unlock_path_id,slug,requirement_type,token_id,description) values(path,'token','dealer_token',tok,'Test');
 insert into unlock_requirements(unlock_path_id,slug,requirement_type,source_vehicle_id,source_upgrade_id,description) values(path,'upgrade','upgrade',a,up,'Test');
 insert into tech_tree_branches(slug,name) values('__test_branch','Test') returning id into br;
 insert into vehicle_branch_memberships(vehicle_id,branch_id) values(a,br),(b,br);
 if not exists(select 1 from public.search_aw_vehicles(p_tier=>10,p_vehicle_class=>'MBT',p_has_era=>true,p_era_type=>'test_era',p_capabilities=>array['smoke','aps','infantry_squad'],p_ammo_traits=>array['self_guided','top_attack','fire_and_forget'],p_min_ap_penetration=>800,p_branch_slug=>'__test_branch',p_produces_token=>'__test_token') where id=a) then raise exception 'COMBINED_FILTER_FAILED';end if;
 if exists(select 1 from public.search_aw_vehicles(p_has_era=>true,p_availability=>'default') where id=a) then raise exception 'ERA_DEFAULT_FALSE_POSITIVE';end if;
 if not exists(select 1 from public.search_aw_vehicles(p_has_era=>true,p_availability=>'research') where id=a) then raise exception 'ERA_RESEARCH_FAILED';end if;
 if not exists(select 1 from public.search_aw_vehicles(p_has_era=>false,p_requires_token=>'__test_token') where id=b) then raise exception 'ABSENCE_TOKEN_FAILED';end if;
 if not exists(select 1 from public.aw_tech_tree_requirements where target_vehicle_id=b and source_upgrade_id=up) then raise exception 'UPGRADE_TREE_FAILED';end if;
 execute 'set local role anon';
 profile:=public.create_coop_profile('{"users":{"A":"Test A","B":"Test B"},"settings":{}}');
 ws:=(profile->>'profileId')::uuid;code:=profile->>'inviteCode';
 items:=public.upsert_aw_fleet_plan_item(ws,lower(code),'A',a);
 items:=public.upsert_aw_fleet_plan_item(ws,code,'B',a);
 if jsonb_array_length(items)<>2 then raise exception 'MULTIPLE_MEMBERS_FAILED';end if;
 items:=public.set_aw_vehicle_plan_status(ws,code,'B',a,'owned');
 if not exists(select 1 from jsonb_array_elements(items) x where x->>'user_id'='B' and x->>'status'='owned') then raise exception 'PLAN_STATUS_FAILED';end if;
 rejected:=false;begin perform public.get_aw_fleet_plan(ws,repeat('0',20));exception when others then rejected:=true;end;
 if not rejected then raise exception 'BAD_CODE_ALLOWED';end if;
 rejected:=false;begin perform public.upsert_aw_fleet_plan_item(ws,code,'C',a);exception when others then rejected:=true;end;
 if not rejected then raise exception 'NONMEMBER_ALLOWED';end if;
 if has_table_privilege('anon','private.aw_fleet_plan_items','SELECT') or has_table_privilege('anon','vehicles','INSERT') or has_table_privilege('authenticated','vehicle_capabilities','INSERT') then raise exception 'PUBLIC_WRITE_OR_TEAM_READ';end if;
end $test$;
set local role anon;
select count(*) as anon_combined_test_match from public.search_aw_vehicles(p_has_era=>true,p_capabilities=>array['smoke','aps','infantry_squad'],p_ammo_traits=>array['self_guided','top_attack'],p_min_ap_penetration=>800) where slug='__aw_test_a';
rollback;
