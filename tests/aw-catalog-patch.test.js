const {test,beforeEach} = require('node:test')
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), {execFile} = require('node:child_process'), run = require('node:util').promisify(execFile)
const protocol = require('../miniprogram/utils/aw/catalog-package'), pkg = require('../tools/aw_catalog_package'), sha256 = require('../miniprogram/utils/aw/checksum')
const catalog = require('../miniprogram/utils/aw/catalog'), fleet = require('../miniprogram/utils/aw/fleet')
const {fixture,clone} = require('./fixtures/aw-new-vehicle')
const sample = fixture(), memory = new Map()
let f, calls, updates, full, delta
function reload(){delete require.cache[require.resolve('../miniprogram/utils/aw/catalog-update')];updates=require('../miniprogram/utils/aw/catalog-update');return updates}
function serve(){wx.request=o=>{calls.push(o);o.success({statusCode:200,data:clone(o.url.includes('?patch=1')?delta:o.url.includes('?bundle=1')?full:full.manifest)})}}
function rewrite(change){const c=JSON.parse(delta.payload);change(c);delta.payload=protocol.stringify(c);delta.descriptor.patchSha256=sha256(delta.payload);full.manifest.patches=[clone(delta.descriptor)]}
beforeEach(()=>{
  f=clone(sample);full=f.target;delta=f.patch;memory.clear();calls=[]
  catalog.installPackage(protocol.validate(f.base))
  global.wx={getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>memory.set(k,clone(v)),removeStorageSync:k=>memory.delete(k),showToast(){},showModal(){},navigateTo(){},pageScrollTo(){},setNavigationBarTitle(){}}
  serve();reload()
})
test('matching patch adds a complete unseen vehicle, modifies an entity and deletes a compound-key relation',async()=>{
  assert(!catalog.byId.TEST_VEHICLE)
  const result=await updates.check(true)
  assert.equal(result.mode,'patch');assert.equal(result.updated,true)
  assert.equal(calls.length,2);assert(calls[1].url.includes('?patch=1'));assert(!calls.some(c=>c.url.includes('?bundle')))
  assert.equal(catalog.byId.TEST_VEHICLE.name,'TEST_VEHICLE')
  assert.equal(catalog.byId[f.v.id].summary,'Synthetic correction')
  assert(!catalog.tables.ammo_trait_links.some(r=>r.ammo_id===f.removed.ammo_id&&r.trait_code===f.removed.trait_code))
  const pointer=memory.get('aw_catalog_v1_current')
  const payload=Array.from({length:pointer.chunks},(_,i)=>memory.get('aw_catalog_v1_'+pointer.slot+'_'+i)).join('')
  assert.equal(payload,full.payload);assert.equal(sha256(payload),delta.descriptor.resultSha256)
  assert(!JSON.parse(payload).upserts);assert(calls.every(c=>c.method==='GET'&&c.url.includes('aw-catalog')))
})
test('restart loads only the merged full catalog with no patch replay or network request',async()=>{
  await updates.check(true);calls=[];catalog.installPackage(protocol.validate(f.base));reload().init()
  assert(catalog.byId.TEST_VEHICLE);assert.equal(updates.info().version,full.manifest.version);assert.equal(calls.length,0)
})
test('baseVersion or base hash mismatch rejects direct application and selects latest full',async()=>{
  for(const field of ['baseVersion','baseSha256']) {
    const wrong=clone(delta);wrong.descriptor[field]='wrong'
    assert.throws(()=>protocol.applyPatch(f.base,wrong,full.manifest),/baseVersion/)
  }
  full.manifest.patches[0].baseVersion='old-version'
  assert.equal((await updates.check(true)).mode,'full');assert(calls[1].url.includes('?bundle'))
})
test('missing direct path downloads one full, without traversing historical patches',async()=>{
  full.manifest.patches=[];const r=await updates.check(true)
  assert.equal(r.mode,'full');assert.equal(calls.length,2)
  assert.equal(r.reasonCode,'no_direct_patch');assert.equal(updates.info().lastUpdate.state,'activated')
  assert.equal(updates.info().lastUpdate.attemptedPatch,false)
})
test('unsupported patch format or encoding skips patch and accepts a schema-compatible full with diagnostics',async()=>{
  for(const change of [()=>{full.manifest.patches[0].patchFormat=99},()=>{full.manifest.encoding='future-readable-full'}]) {
    full=clone(f.target);delta=clone(f.patch);calls=[];memory.clear();reload();change()
    const result=await updates.check(true)
    assert.equal(result.mode,'full');assert.equal(calls.length,2);assert(!calls.some(c=>c.url.includes('?patch')))
    assert.match(result.reasonCode,/patch_(format|encoding)_unsupported/)
    assert.equal(updates.info().lastUpdate.state,'activated')
  }
})
test('diagnostics survive restart, record failed attempts and track deferred activation',async()=>{
  const editor={};updates.hold(editor);await updates.check(true)
  assert.equal(updates.info().lastUpdate.state,'staged');assert.equal(updates.info().lastUpdate.mode,'patch')
  updates.release(editor);assert.equal(updates.info().lastUpdate.state,'activated')
  reload().init();assert.equal(updates.info().lastUpdate.state,'activated')
  const previous=updates.info().version
  wx.request=o=>o.fail({errMsg:'synthetic offline'})
  await assert.rejects(updates.check(true),/synthetic offline/)
  assert.equal(updates.info().lastUpdate.state,'failed');assert.match(updates.info().lastUpdate.error,/offline/)
  assert.equal(updates.info().version,previous)
})
test('bad patch checksum falls back to a verified full without installing partial data',async()=>{
  delta.payload+=' '
  assert.throws(()=>protocol.applyPatch(f.base,delta,full.manifest),/patch 校验值/)
  const result=await updates.check(true);assert.equal(result.mode,'full');assert.match(result.fallbackReason,/patch 校验值/);assert.equal(calls.length,3)
})
test('merged result hash mismatch rejects candidate and recovers with latest full',async()=>{
  rewrite(c=>{c.upserts.vehicles.find(v=>v.id==='TEST_VEHICLE').name='tampered'})
  assert.throws(()=>protocol.applyPatch(f.base,delta,full.manifest),/resultSha256/)
  const r=await updates.check(true);assert.equal(r.mode,'full');assert.match(r.fallbackReason,/resultSha256/);assert.equal(catalog.byId.TEST_VEHICLE.name,'TEST_VEHICLE')
})
test('patch and full failures keep old version, pointer and private storage intact',async()=>{
  memory.set('private-synthetic',{note:'keep'})
  delta.payload+=' ';full.payload+=' '
  await assert.rejects(updates.check(true),/校验值/)
  assert.equal(updates.info().version,f.base.manifest.version);assert(!catalog.byId.TEST_VEHICLE)
  assert(!memory.has('aw_catalog_v1_current'));assert.deepEqual(memory.get('private-synthetic'),{note:'keep'})
})
test('mid-write and silent cache corruption cannot switch the active slot',async()=>{
  await updates.check(true);const pointer=clone(memory.get('aw_catalog_v1_current'))
  const next=pkg.full(protocol.validate(full),'2026.10.08.1','2026-10-08T00:00:00Z')
  delta=pkg.patch(full,next);next.manifest.patches=[delta.descriptor];full=next
  const set=wx.setStorageSync;let writes=0
  wx.setStorageSync=(k,v)=>{if(++writes===3)throw Error('quota failure');set(k,v)}
  await assert.rejects(updates.check(true),/quota failure/);assert.deepEqual(memory.get('aw_catalog_v1_current'),pointer)
  wx.setStorageSync=(k,v)=>set(k,typeof v==='string'?v+'corrupt':v)
  await assert.rejects(updates.check(true),/校验值/);assert.deepEqual(memory.get('aw_catalog_v1_current'),pointer)
  reload().init();assert.equal(updates.info().version,pointer.manifest.version)
})
test('corrupt local cache forces full recovery even when the server version equals bundled',async()=>{
  memory.set('aw_catalog_v1_current',{slot:0,chunks:1,manifest:clone(full.manifest)});memory.set('aw_catalog_v1_0_0','corrupt')
  full=f.base;reload().init();await updates.check(true)
  assert.equal(calls.length,2);assert(calls[1].url.includes('?bundle'));assert.equal(updates.info().version,f.base.manifest.version)
  assert(protocol.validate({manifest:memory.get('aw_catalog_v1_current').manifest,payload:full.payload}))
})
test('unsupported schema refuses the release before patch/full requests',async()=>{
  full.manifest.schemaVersion=99
  await assert.rejects(updates.check(true),/schemaVersion 不兼容：数据结构需要升级小程序/);assert.equal(calls.length,1);assert(!catalog.byId.TEST_VEHICLE)
})
test('open editor stages a full candidate and commits pointer only after editor closes',async()=>{
  const editor={};updates.hold(editor)
  const r=await updates.check(true);assert.equal(r.deferred,true);assert(!memory.has('aw_catalog_v1_current'));assert(!catalog.byId.TEST_VEHICLE)
  assert.equal((await updates.check(true)).deferred,true);assert.equal(calls.length,2)
  updates.release(editor);assert(memory.has('aw_catalog_v1_current'));assert(catalog.byId.TEST_VEHICLE)
})
test('pointer write failure when editor closes preserves the old catalog',async()=>{
  const editor={};updates.hold(editor);await updates.check(true)
  const set=wx.setStorageSync;wx.setStorageSync=(k,v)=>{if(k==='aw_catalog_v1_current')throw Error('pointer failed');set(k,v)}
  updates.release(editor);assert(!catalog.byId.TEST_VEHICLE);assert(!memory.has('aw_catalog_v1_current'));assert.match(updates.info().error,/pointer failed/)
})
test('stable generation ignores row/dictionary/object order and exactly reconstructs target bytes',()=>{
  const tables=protocol.decode(f.content.catalog);Object.values(tables).forEach(rows=>rows.reverse())
  const shuffled={presentation:f.content.presentation,ammoEvidence:f.content.ammoEvidence,catalog:protocol.encode(tables,f.content.catalog.checkedAt)}
  const target=pkg.full(shuffled,'2026.10.07.1','2026-10-07T00:00:00Z')
  assert.equal(target.payload,full.payload);assert.deepEqual(pkg.patch(f.base,target),delta)
  assert.equal(pkg.verify(f.base,full,delta).payload,full.payload)
  assert(delta.payload.length < full.payload.length / 5)
})
test('independent later human/AI CLI runs reproduce the same patch using only old/new files',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aw-diff-'))
  try {
    pkg.write(path.join(dir,'old.json'),f.base);pkg.write(path.join(dir,'new.json'),full)
    const script=path.join(__dirname,'../tools/build_aw_catalog_package.js')
    await run(process.execPath,[script,'patch','--from',path.join(dir,'old.json'),'--to',path.join(dir,'new.json'),'--output',path.join(dir,'patch.json')])
    assert.deepEqual(pkg.read(path.join(dir,'patch.json')),delta)
    await run(process.execPath,[script,'validate','--from',path.join(dir,'old.json'),'--to',path.join(dir,'new.json'),'--patch',path.join(dir,'patch.json')])
    pkg.archive(dir,f.base);pkg.archive(dir,f.base)
    const bad=clone(f.base);bad.manifest.publishedAt='2026-10-09T00:00:00Z'
    assert.throws(()=>pkg.archive(dir,bad),/Immutable/)
  } finally {fs.rmSync(dir,{recursive:true,force:true})}
})
test('unknown/private tables, duplicate IDs, invalid composite keys and unmarked hand patches fail',()=>{
  for(const mutate of [c=>{c.upserts.private_players=[]},c=>{c.upserts.vehicles.push(clone(c.upserts.vehicles[0]))},c=>{c.deletes.ammo_trait_links=[['not-enough-fields']]},c=>{delete c.generator}]) {
    const wrong=clone(delta),changes=JSON.parse(wrong.payload);mutate(changes);wrong.payload=protocol.stringify(changes);wrong.descriptor.patchSha256=sha256(wrong.payload)
    assert.throws(()=>protocol.applyPatch(f.base,wrong,full.manifest),/patch/)
  }
})
test('full integrity includes composite foreign keys, code references and previously empty supported tables',()=>{
  assert.equal(protocol.validate(full).catalog.tables.ammo_penetration_samples.rows.length,1)
  for(const change of [t=>t.vehicle_capabilities.find(r=>r.id==='TEST_CAPABILITY').capability_code='absent_code',t=>t.ammo_upgrade_links.find(r=>r.ammo_id==='TEST_AMMO').vehicle_id=f.v.id]) {
    const c=clone(f.content),tables=protocol.decode(c.catalog);change(tables);c.catalog=protocol.encode(tables,c.catalog.checkedAt)
    assert.throws(()=>pkg.full(c,'2026.10.09.1','2026-10-09T00:00:00Z'),/关联缺失/)
  }
})
test('new vehicle participates in list, search, dynamic filters, details, tree, duties, prerequisites and tokens',async()=>{
  const old=fleet.empty({tester:'Tester'});old.roles.push({id:'scout',name:'Scout',order:0})
  fleet.saveAsset(old,'tester',f.v.id,'owned','old note',[{roleId:'scout',level:'primary'}])
  const before=JSON.stringify(old)
  await updates.check(true)
  assert.equal(JSON.stringify(old),before);assert(!fleet.getAsset(old,'tester','TEST_VEHICLE'))
  const options=catalog.filterOptions()
  for(const [key,value] of [['tiers','10'],['classes','other'],['dealers','TEST_DEALER'],['nations','TEST_NATION']])assert(options.groups.find(g=>g.key===key).options.some(o=>o.value===value))
  assert(options.ammoTypes.some(o=>o.value==='smoke'));assert(options.capabilities.some(o=>o.value==='test_support'))
  for(const filter of [{},{query:'TEST_VEHICLE'},{query:'合成新车辆'},{tiers:['10'],classes:['other'],dealers:['TEST_DEALER'],nations:['TEST_NATION']},{capabilities:['test_support']},{ammoTypes:['smoke'],ammoTraits:['test_trait'],penetration:700}])assert(catalog.filter(filter).some(v=>v.id==='TEST_VEHICLE'))
  const detail=catalog.detail('TEST_VEHICLE')
  assert.equal(detail.dealerName,'Test dealer');assert(detail.weaponGroups.some(g=>g.weapons.some(w=>w.id==='TEST_WEAPON'&&w.ammo.some(a=>a.id==='TEST_AMMO'&&a.warheadLabel==='future_visual_label'&&a.colorClass==='unknown'))))
  assert(detail.capabilities.some(c=>c.name==='测试支援'&&c.era.length&&c.infantry.length));assert(detail.upgradeGroups.some(g=>g.items.some(u=>u.id==='TEST_UPGRADE')))
  assert(detail.capabilities.some(c=>c.params.some(p=>p.key==='coverage:hull_front')))
  assert(detail.upgradeGroups.some(g=>g.items.some(u=>u.id==='TEST_UPGRADE'&&u.displayDescription.includes('测试前置配件'))))
  assert(detail.weaponGroups.some(g=>g.weapons.some(w=>w.ammo.some(a=>a.id==='TEST_AMMO'&&a.guidance.some(s=>s.includes('700 mm'))))))
  assert(detail.related.some(r=>r.id===f.v.id));assert(detail.paths.some(p=>p.id==='TEST_PATH'))
  assert(fleet.prerequisiteOptions(f.oldTarget.id).some(p=>p.providers.some(r=>r.vehicleId==='TEST_VEHICLE')))
  const state=clone(old);fleet.saveAsset(state,'tester','TEST_VEHICLE','planned','new note',[{roleId:'scout',level:'primary'}])
  assert(fleet.overview(state).some(r=>JSON.stringify(r).includes('TEST_VEHICLE')))
  fleet.setPrerequisites(state,'tester','TEST_VEHICLE',{mode:'known',pathId:'TEST_PATH',tokenSourceVehicleIds:[f.v.id]})
  assert(fleet.resolveRoute(state,'tester','TEST_VEHICLE').nodes.some(n=>n.vehicleId===f.v.id))
  const plan=fleet.memberPlan(state,'tester');assert(plan.tokens.some(t=>t.id==='TEST_TOKEN'&&t.consumed===2))
  fleet.setPrerequisites(state,'tester',f.oldTarget.id,{mode:'custom',customVehicleIds:['TEST_VEHICLE'],pathId:'TEST_OTHER_PATH'})
  assert(fleet.resolveRoute(state,'tester',f.oldTarget.id).nodes.some(n=>n.vehicleId==='TEST_VEHICLE'))
})
test('actual generic pages and editor include unseen vehicle; update leaves personal/team bytes and dirty state unchanged',async()=>{
  for(const name of ['store','archives'])delete require.cache[require.resolve('../miniprogram/utils/aw/'+name)]
  const store=require('../miniprogram/utils/aw/store'),archives=require('../miniprogram/utils/aw/archives')
  const state=clone(store.load());state.members.push({id:'tester',name:'Tester',active:true,order:0});state.roles.push({id:'role',name:'Scout',order:0})
  fleet.saveAsset(state,'tester',f.v.id,'owned','preserved note',[{roleId:'role',level:'primary'}]);store.save(state)
  const personal=protocol.stringify(archives.personal(store.load(),'tester')),team=protocol.stringify(archives.team(store.load())),dirty=store.dirty
  const privateValues=protocol.stringify([...memory].filter(([k])=>!k.startsWith('aw_catalog_v1_')))
  await updates.check(true);store.load()
  assert.equal(protocol.stringify(archives.personal(store.load(),'tester')),personal);assert.equal(protocol.stringify(archives.team(store.load())),team);assert.equal(store.dirty,dirty)
  assert.equal(protocol.stringify([...memory].filter(([k])=>!k.startsWith('aw_catalog_v1_'))),privateValues)
  function hydrate(def,component=false){const p={...(component?def.methods:def),data:clone(def.data),properties:{vehicleId:'TEST_VEHICLE'}};p.setData=function(update){for(const [k,v]of Object.entries(update)){const parts=k.split('.');let o=this.data;for(const f of parts.slice(0,-1))o=o[f]||(o[f]={});o[parts.at(-1)]=v}};p.triggerEvent=()=>{};return p}
  function page(name){let def;global.Page=d=>{def=d};delete require.cache[require.resolve('../miniprogram/pages/'+name+'/index')];require('../miniprogram/pages/'+name+'/index');return hydrate(def)}
  const list=page('aw-catalog');list.onLoad();list.input({currentTarget:{dataset:{key:'query'}},detail:{value:'TEST_VEHICLE'}})
  assert.equal(list.data.results[0].id,'TEST_VEHICLE');assert(list.data.groups.find(g=>g.key==='nations').options.some(o=>o.value==='TEST_NATION'))
  const vehicle=page('aw-vehicle');vehicle.onLoad({id:'TEST_VEHICLE'});assert.equal(vehicle.data.vehicle.id,'TEST_VEHICLE')
  const tree=page('aw-tree');tree.onLoad({id:'TEST_VEHICLE'});assert(tree.data.paths.some(p=>p.id==='TEST_PATH'));tree.search({detail:{value:'TEST_VEHICLE'}});assert(tree.data.candidates.some(v=>v.id==='TEST_VEHICLE'))
  let def;global.Component=d=>{def=d};require('../miniprogram/components/aw-asset-editor/index');const editor=hydrate(def,true);editor.prepare()
  assert.equal(editor.data.vehicleName,'TEST_VEHICLE');assert(editor.data.unlockPaths.some(p=>p.id==='TEST_PATH'))
  editor.pickLevel({currentTarget:{dataset:{index:0,value:1}}});await editor.save()
  const fleetPage=page('aw-fleet');fleetPage.onLoad({});assert(fleetPage.data.playerAssets.some(a=>a.vehicleId==='TEST_VEHICLE'))
  global.Component=d=>{def=d};require('../miniprogram/components/aw-prerequisites/index');const prerequisites=hydrate(def,true);prerequisites.properties.vehicleId=f.oldTarget.id;prerequisites.prepare();prerequisites.custom();prerequisites.search({detail:{value:'TEST_VEHICLE'}})
  assert(prerequisites.data.candidates.some(v=>v.id==='TEST_VEHICLE'));assert(prerequisites.data.options.some(p=>p.providers.some(v=>v.vehicleId==='TEST_VEHICLE')));prerequisites.cancel()
})
test('unrecognized Token accounting is refused instead of inferred from token_id',()=>{
  const c=clone(f.content),tables=protocol.decode(c.catalog)
  tables.unlock_requirements.find(r=>r.id==='TEST_COST').requirement_type='new_token_mechanism'
  c.catalog=protocol.encode(tables,c.catalog.checkedAt)
  assert.throws(()=>pkg.full(c,'2026.10.09.1','2026-10-09T00:00:00Z'),/Token 机制需要客户端升级/)
})
test('deleting an entity and updating an existing relation use stable keys and exact full results',()=>{
  const c=clone(f.content),tables=protocol.decode(c.catalog)
  tables.ammo_penetration_samples=[]
  tables.vehicle_progression_edges.find(r=>r.id==='TEST_EDGE').note='Changed relation fact'
  c.catalog=protocol.encode(tables,c.catalog.checkedAt)
  const next=pkg.full(c,'2026.10.09.1','2026-10-09T00:00:00Z'),patch=pkg.patch(full,next),change=JSON.parse(patch.payload)
  assert.deepEqual(change.deletes.ammo_penetration_samples,[['TEST_SAMPLE']])
  assert.equal(change.upserts.vehicle_progression_edges[0].id,'TEST_EDGE')
  assert.equal(change.upserts.vehicle_progression_edges[0].note,'Changed relation fact')
  assert.equal(pkg.verify(full,next,patch).payload,next.payload)
})
test('new Tier and unfamiliar display enum are derived from a schema-compatible catalog',()=>{
  const c=clone(f.content),tables=protocol.decode(c.catalog)
  const v=tables.vehicles.find(v=>v.id==='TEST_VEHICLE');v.tier=11;v.acquisition_type='other'
  c.catalog=protocol.encode(tables,c.catalog.checkedAt)
  catalog.installPackage(protocol.validate(pkg.full(c,'2026.10.09.1','2026-10-09T00:00:00Z')))
  assert(catalog.filterOptions().groups.find(g=>g.key==='tiers').options.some(o=>o.value==='11'))
  assert(catalog.filterOptions().acquisitions.some(o=>o.value==='other'))
  assert(catalog.filter({tiers:['11'],classes:['other'],acquisition:['other']}).some(v=>v.id==='TEST_VEHICLE'))
})
