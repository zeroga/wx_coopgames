// Synthetic catalog facts only. This file is never imported by the publisher or mini-program.
const protocol = require('../../miniprogram/utils/aw/catalog-package')
const pkg = require('../../tools/aw_catalog_package')
const base = require('../../supabase/functions/aw-catalog/release.json')
const clone = x=>JSON.parse(JSON.stringify(x))
function fixture() {
  const content = clone(protocol.validate(base)), tables = protocol.decode(content.catalog)
  const v = tables.vehicles[0], oldTarget = tables.vehicles[1]
  function add(name, data) {
    const row = Object.fromEntries(Object.keys(protocol.schema[name].columns).map(k=>[k,null]))
    Object.assign(row,data);tables[name].push(row);return row
  }
  const dealer = add('dealers',{...tables.dealers[0],id:'TEST_DEALER',slug:'test_dealer',name:'Test dealer'})
  const vehicle = add('vehicles',{...v,id:'TEST_VEHICLE',slug:'test_vehicle',name:'TEST_VEHICLE',name_zh:'合成新车辆',nation:'TEST_NATION',dealer_id:dealer.id,vehicle_class:'other',tier:10,is_legendary:false})
  const token = add('tokens',{...tables.tokens[0],id:'TEST_TOKEN',code:'test_token',name:'Test token',dealer_id:dealer.id,tier:10})
  add('capabilities',{code:'test_support',name_zh:'测试支援',category:'other',parent_code:null,description:null})
  add('ammo_traits',{code:'test_trait',name_zh:'测试弹药特性',category:'other',description:null})
  const upgrade = add('vehicle_upgrades',{...tables.vehicle_upgrades[0],id:'TEST_UPGRADE',slug:'test_upgrade',name:'测试配件',vehicle_id:vehicle.id,availability:'research'})
  const prerequisite = add('vehicle_upgrades',{...upgrade,id:'TEST_UPGRADE_BASE',slug:'test_upgrade_base',name:'测试前置配件'})
  add('upgrade_prerequisites',{upgrade_id:upgrade.id,prerequisite_upgrade_id:prerequisite.id,vehicle_id:vehicle.id})
  const weapon = add('vehicle_weapons',{...tables.vehicle_weapons[0],id:'TEST_WEAPON',vehicle_id:vehicle.id,slug:'test_weapon',name:'测试武器'})
  const ammo = add('vehicle_ammo',{...tables.vehicle_ammo[0],id:'TEST_AMMO',weapon_id:weapon.id,slug:'test_ammo',name:'测试烟幕弹',ammo_type:'smoke',is_missile:false,is_guided:false,penetration:777})
  add('ammo_trait_links',{...tables.ammo_trait_links[0],ammo_id:ammo.id,trait_code:'test_trait'})
  add('ammo_guidance_modes',{...tables.ammo_guidance_modes[0],ammo_id:ammo.id,mode_code:'laser_guided'})
  add('ammo_penetration_samples',{id:'TEST_SAMPLE',ammo_id:ammo.id,sample_key:'100m',penetration_mm:700,distance_m:100,verification_status:'public_verified'})
  add('weapon_upgrade_links',{weapon_id:weapon.id,upgrade_id:upgrade.id,vehicle_id:vehicle.id})
  add('ammo_upgrade_links',{ammo_id:ammo.id,weapon_id:weapon.id,upgrade_id:upgrade.id,vehicle_id:vehicle.id})
  const capability = add('vehicle_capabilities',{...tables.vehicle_capabilities[0],id:'TEST_CAPABILITY',vehicle_id:vehicle.id,capability_code:'test_support',upgrade_id:upgrade.id,availability:'research',variant_key:'test'})
  add('vehicle_era',{...tables.vehicle_era[0],capability_id:capability.id,era_name:'Test ERA'})
  add('era_coverage',{capability_id:capability.id,location:'hull_front',note:'Test coverage'})
  add('vehicle_infantry',{...tables.vehicle_infantry[0],capability_id:capability.id,infantry_type:'other'})
  add('vehicle_armor',{...tables.vehicle_armor[0],id:'TEST_ARMOR',vehicle_id:vehicle.id,upgrade_id:upgrade.id})
  add('vehicle_crew_positions',{...tables.vehicle_crew_positions[0],vehicle_id:vehicle.id})
  const branch = add('tech_tree_branches',{...tables.tech_tree_branches[0],id:'TEST_BRANCH',slug:'test_branch',name:'Test branch',dealer_id:dealer.id})
  add('vehicle_branch_memberships',{vehicle_id:vehicle.id,branch_id:branch.id,display_order:0})
  add('vehicle_progression_edges',{...tables.vehicle_progression_edges[0],id:'TEST_EDGE',from_vehicle_id:v.id,to_vehicle_id:vehicle.id})
  const path = add('unlock_paths',{...tables.unlock_paths[0],id:'TEST_PATH',vehicle_id:vehicle.id,slug:'test_path',target_upgrade_id:null,is_complete:true})
  const req = tables.unlock_requirements[0]
  add('unlock_requirements',{...req,id:'TEST_REQ',slug:'test_own',unlock_path_id:path.id,source_vehicle_id:v.id,source_upgrade_id:null,token_id:null,dealer_id:null,requirement_type:'own_vehicle',operator:'exists',required_value:null})
  add('unlock_requirements',{...req,id:'TEST_COST',slug:'test_cost',unlock_path_id:path.id,source_vehicle_id:null,source_upgrade_id:null,token_id:token.id,dealer_id:dealer.id,requirement_type:'dealer_token',operator:'>=',required_value:2,verification_status:'public_verified'})
  const reward = tables.vehicle_token_rewards[0]
  add('vehicle_token_rewards',{...reward,id:'TEST_REWARD',vehicle_id:vehicle.id,token_id:token.id,quantity:5,verification_status:'public_verified'})
  add('vehicle_token_rewards',{...reward,id:'TEST_OLD_PROVIDER',vehicle_id:v.id,token_id:token.id,quantity:20,verification_status:'public_verified'})
  const otherPath = add('unlock_paths',{...path,id:'TEST_OTHER_PATH',vehicle_id:oldTarget.id,slug:'test_other_path'})
  add('unlock_requirements',{...req,id:'TEST_OTHER_COST',slug:'test_other_cost',unlock_path_id:otherPath.id,source_vehicle_id:null,source_upgrade_id:null,token_id:token.id,dealer_id:dealer.id,requirement_type:'dealer_token',operator:'>=',required_value:3,verification_status:'public_verified'})
  // Modify an existing entity, delete an existing compound-key relationship.
  tables.vehicles.find(x=>x.id===v.id).summary='Synthetic correction'
  const removed = tables.ammo_trait_links.shift()
  content.catalog = protocol.encode(tables,content.catalog.checkedAt)
  content.ammoEvidence.entries[ammo.id] = {warhead_type:'future_visual_label',traits:['test_trait'],source_url:'https://synthetic.example/evidence'}
  const target = pkg.full(content,'2026.10.07.1','2026-10-07T00:00:00Z'), patch = pkg.patch(base,target)
  target.manifest.patches = [patch.descriptor]
  return {base,content,tables,target,patch,vehicle,weapon,ammo,capability,upgrade,path,token,v,oldTarget,removed}
}
module.exports = {fixture,clone}
