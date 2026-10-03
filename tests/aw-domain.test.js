const { test, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')
const catalog = require('../miniprogram/utils/aw/catalog')
const fleet = require('../miniprogram/utils/aw/fleet')
const original = catalog.tables, stamp = catalog.checkedAt
function fixture() {
  return {
    vehicles:['A','B','C','D','E','X'].map((id,i)=>({id,name:id,tier:i+5,vehicle_class:i%2?'TD':'AFV',top_speed:id==='A'?null:60,camouflage:null})),
    capabilities:[{code:'aps',name_zh:'APS'},{code:'hard',name_zh:'硬杀',parent_code:'aps'}],
    vehicle_capabilities:[{id:'capA',vehicle_id:'A',capability_code:'hard',availability:'research'},{id:'capB',vehicle_id:'B',capability_code:'hard',availability:'unknown'}],
    vehicle_weapons:[{id:'WA',vehicle_id:'A',name:'发射器',configuration_key:'weapon1',reload_seconds:20}],
    vehicle_ammo:[{id:'AT',weapon_id:'WA',name:'导弹',ammo_type:'atgm',penetration:800,reload_seconds:10},{id:'AP',weapon_id:'WA',name:'穿甲弹',ammo_type:'apfsds',penetration:700,reload_seconds:null}],
    ammo_traits:[{code:'top_attack',name_zh:'攻顶'}],ammo_trait_links:[{ammo_id:'AT',trait_code:'top_attack'}],ammo_guidance_modes:[{ammo_id:'AP',mode_code:'self_guided'}],
    unlock_paths:['A','B','C','D','E','X'].map(id=>({id:'p'+id,vehicle_id:id,name:id+'路线',is_complete:true,sort_order:0})),
    unlock_requirements:[['B','A'],['C','B'],['D','C'],['E','B']].map(([to,from])=>({id:'r'+to,unlock_path_id:'p'+to,source_vehicle_id:from,requirement_type:'own_vehicle',verification_status:'public_verified',sort_order:0})),
    tokens:[{id:'token',name:'T10 Token'},{id:'other',name:'其他 Token'}],vehicle_token_rewards:[],
    vehicle_progression_edges:[{from_vehicle_id:'X',to_vehicle_id:'D'}]
  }
}
let data
beforeEach(()=>{data=fixture();catalog.install(data,'test')})
after(()=>catalog.install(original,stamp))
function state() {const s=fleet.empty({m:'玩家'});s.roles.push({id:'r',name:'抗线',order:0});return s}
function target(s,v,level='primary') {fleet.saveAsset(s,'m',v,'planned','',[{roleId:'r',level}]);return fleet.assignmentKey(fleet.assetKey('m',v),'r')}
function tokenCost(v,amount=1,token='token') {data.unlock_requirements.push({id:'t'+v,unlock_path_id:'p'+v,token_id:token,required_value:amount,requirement_type:'dealer_token',verification_status:'public_verified',sort_order:1})}
test('filter combines group OR and inter-group AND; null values do not become zero',()=>{
  assert.deepEqual(catalog.filter({tiers:['5','6'],classes:['AFV']}).map(v=>v.id),['A'])
  assert(!catalog.filter({speed:'0'}).some(v=>v.id==='A'))
})
test('capability research allowed for full config, excluded for factory; unknown excluded; parent APS matches',()=>{
  assert.deepEqual(catalog.filter({capabilities:['aps']}).map(v=>v.id),['A'])
  assert.equal(catalog.filter({capabilities:['aps'],factory:true}).length,0)
})
test('all ammo traits and penetration must match the same ammo row',()=>{
  assert.equal(catalog.filter({ammoTypes:['atgm'],ammoTraits:['top_attack','self_guided']}).length,0)
  assert.equal(catalog.filter({ammoTypes:['apfsds'],penetration:'750'}).length,0)
  assert.equal(catalog.filter({ammoTypes:['atgm'],ammoTraits:['top_attack'],penetration:'750'}).length,1)
})
test('ammo reload overrides weapon fallback and nullable ammo uses weapon fallback',()=>{
  const ammo=catalog.detail('A').configs[0].weapons[0].ammo
  assert.equal(ammo[0].params.find(p=>p.key==='reload_seconds').value,'10 s')
  assert.equal(ammo[1].params.find(p=>p.key==='reload_seconds').value,'20 s')
})
test('all transitive prerequisites generated, owned preserved, backup also expands',()=>{
  const s=state();fleet.saveAsset(s,'m','B','owned','',[]);target(s,'D','backup')
  assert.equal(fleet.getAsset(s,'m','B').status,'owned')
  assert.deepEqual(Object.values(s.assets).map(a=>a.vehicleId).sort(),['A','B','C','D'])
  assert.equal(s.dependencies.length,3)
  assert(!fleet.getAsset(s,'m','X')) // display edge is not an unlock requirement
})
test('shared prerequisites reference multiple targets; cancelling one retains the other and every asset',()=>{
  const s=state();target(s,'D');target(s,'E')
  const b=fleet.assignmentKey(fleet.assetKey('m','B'),'r')
  assert.equal(s.dependencies.filter(d=>d.assignmentId===b).length,2)
  fleet.saveAsset(s,'m','D','planned','',[])
  assert.equal(s.dependencies.filter(d=>d.assignmentId===b).length,1)
  assert(fleet.getAsset(s,'m','C'));assert(fleet.getAsset(s,'m','D'))
})
test('independent role levels and rename remain keyed by stable IDs',()=>{
  const s=state();s.roles.push({id:'scout',name:'侦察',order:1})
  fleet.saveAsset(s,'m','A','owned','',[{roleId:'r',level:'primary'},{roleId:'scout',level:'backup'}]);s.members[0].name='新名'
  assert.equal(fleet.summary(s,'A')[0].roles.length,2);assert.equal(fleet.summary(s,'A')[0].memberName,'新名')
  fleet.deleteRole(s,'scout');assert(fleet.getAsset(s,'m','A'));assert.equal(fleet.summary(s,'A')[0].roles.length,1)
})
test('manual transitions may serve multiple formal targets',()=>{
  const s=state(),d=target(s,'D'),e=target(s,'E')
  fleet.saveAsset(s,'m','A','owned','',[{roleId:'r',level:'transition',targetIds:[d,e]}])
  assert.equal(s.dependencies.filter(d=>d.source==='manual').length,2)
})
test('multiple complete routes require selection; incomplete routes remain incomplete',()=>{
  data.unlock_paths.push({id:'pD2',vehicle_id:'D',name:'第二路线',is_complete:true,sort_order:1})
  const s=state();target(s,'D');assert.equal(fleet.memberPlan(s,'m').choices.length,1);assert.equal(fleet.memberPlan(s,'m').complete,false)
  s.routes[fleet.assetKey('m','D')]='pD';fleet.recompute(s);assert.equal(s.dependencies.length,3)
  data.unlock_paths.find(p=>p.id==='pC').is_complete=false
  assert.equal(fleet.memberPlan(s,'m').complete,false)
})
test('Token strict > rejects equality, different token holdings do not help',()=>{
  tokenCost('D');const s=state();target(s,'D');s.tokens['m~token']=1;s.tokens['m~other']=99
  assert.equal(fleet.memberPlan(s,'m').tokens[0].totalOk,false)
  s.tokens['m~token']=2;assert.equal(fleet.memberPlan(s,'m').executable,true)
})
test('later confirmed reward cannot finance an earlier spend',()=>{
  tokenCost('B');data.vehicle_token_rewards.push({id:'reward',vehicle_id:'C',token_id:'token',quantity:2,verification_status:'public_verified'})
  const s=state();target(s,'D');s.confirmedRewards['m~reward']=true
  const p=fleet.memberPlan(s,'m');assert.equal(p.tokens[0].totalOk,true);assert.equal(p.tokens[0].processOk,false);assert.equal(p.steps.find(x=>x.id==='B').blocked,true);assert.equal(p.executable,false)
})
test('unconfirmed rewards excluded; owned vehicle rewards never double counted',()=>{
  data.vehicle_token_rewards.push({id:'reward',vehicle_id:'A',token_id:'token',quantity:2,verification_status:'public_verified'})
  const s=state();target(s,'D');let p=fleet.memberPlan(s,'m');assert.equal(p.tokens[0].gained,0);assert.equal(p.complete,false)
  s.confirmedRewards['m~reward']=true;p=fleet.memberPlan(s,'m');assert.equal(p.tokens[0].gained,2)
  fleet.saveAsset(s,'m','A','owned','',[]);p=fleet.memberPlan(s,'m');assert.equal(p.tokens[0].gained,0)
})
test('all player goals share one prerequisite/reward budget',()=>{
  data.vehicle_token_rewards.push({id:'reward',vehicle_id:'A',token_id:'token',quantity:2,verification_status:'public_verified'})
  tokenCost('D');tokenCost('E');const s=state();target(s,'D');target(s,'E');s.confirmedRewards['m~reward']=true
  const p=fleet.memberPlan(s,'m');assert.equal(p.tokens[0].gained,2);assert.equal(p.tokens[0].consumed,2);assert.equal(p.tokens[0].totalOk,false)
})
test('legacy import is idempotent, preserves unmappable metadata and inactive records',()=>{
  const s=state(),rows=[{id:'old',user_id:'m',vehicle_id:'A',status:'owned',role:'unknown_role',priority:4},{id:'abandoned',user_id:'m',vehicle_id:'B',status:'abandoned'}]
  fleet.importLegacy(s,rows,{m:'玩家'});fleet.importLegacy(s,rows,{m:'玩家'})
  assert.equal(s.legacyAudit.length,2);assert.equal(s.legacyAudit[0].role,'unknown_role');assert.equal(fleet.getAsset(s,'m','A').status,'owned');assert(!fleet.getAsset(s,'m','B'))
})
