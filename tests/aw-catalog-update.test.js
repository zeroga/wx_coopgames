const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict'),crypto=require('node:crypto')
const catalog=require('../miniprogram/utils/aw/catalog'),fleet=require('../miniprogram/utils/aw/fleet')
const release=require('../supabase/functions/aw-catalog/release.json'),sha256=require('../miniprogram/utils/aw/checksum')
const original=JSON.parse(release.payload),memory=new Map()
let updates,calls,server,failStorage
const clone=x=>JSON.parse(JSON.stringify(x))
function nextRelease(change,offset=1){
  const content=clone(original);if(change)change(content)
  const payload=JSON.stringify(content),hash=crypto.createHash('sha256').update(payload).digest('hex')
  const manifest={...clone(release.manifest),sequence:release.manifest.sequence+offset,version:'aw-test-'+offset+'-'+hash.slice(0,12),sha256:hash,counts:Object.fromEntries(Object.entries(content.catalog.tables).map(([k,t])=>[k,t.rows.length]))}
  return {manifest,payload}
}
function reload(){delete require.cache[require.resolve('../miniprogram/utils/aw/catalog-update')];updates=require('../miniprogram/utils/aw/catalog-update');return updates}
beforeEach(()=>{
  catalog.installPackage(original);memory.clear();calls=[];failStorage=false;server=nextRelease()
  global.wx={getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>{if(failStorage)throw Error('storage full');memory.set(k,clone(v))},request:o=>{calls.push(o);o.success({statusCode:200,data:clone(o.url.includes('?bundle=1')?server:server.manifest)})}}
  reload()
})
test('SHA-256 matches standard vectors and UTF-8 catalog payload',()=>{
  for(const s of ['', 'abc', '中文🚗', 'a'.repeat(10000),release.payload])assert.equal(sha256(s),crypto.createHash('sha256').update(s).digest('hex'))
})
test('screenshots correct both displayed and planned XM800T prerequisite without declaring full unlock rules',()=>{
  const ids=Object.fromEntries(catalog.tables.vehicles.map(v=>[v.slug,v.id])),detail=catalog.detail(ids.xm800t_law)
  assert(detail.related.some(r=>r.id===ids.m113_acav&&r.direction==='前置'&&r.quality==='游戏内已核验'))
  assert(!detail.related.some(r=>r.id===ids.lav_150&&r.direction==='前置'))
  assert.equal(detail.paths[0].requirements[0].source_vehicle_id,ids.m113_acav)
  assert.equal(detail.paths[0].is_complete,false);assert.equal(detail.paths[0].requirements[0].verification_status,'needs_ingame_check')
  const state=fleet.empty({test:'Test'});fleet.setPrerequisites(state,'test',ids.xm800t_law,{mode:'known',pathId:detail.paths[0].id})
  const route=fleet.resolveRoute(state,'test',ids.xm800t_law)
  assert(route.nodes.some(n=>n.vehicleId===ids.m113_acav));assert.equal(route.complete,false)
})
test('new release installs complete data, caches in bounded chunks and reloads offline without any save request',async()=>{
  const unknown=Object.entries(original.ammoEvidence.entries).find(([,e])=>e.warhead_type==='unknown')[0]
  server=nextRelease(c=>{c.ammoEvidence.entries[unknown].warhead_type='thermobaric'})
  const vehicle=catalog.tables.vehicle_weapons.find(w=>w.id===catalog.byId[unknown].weapon_id).vehicle_id
  assert.equal(catalog.ammoFor(vehicle).find(a=>a.id===unknown).classification.warhead_type,'unknown')
  assert.equal((await updates.check(true)).updated,true);assert.equal(catalog.ammoColor(catalog.ammoFor(vehicle).find(a=>a.id===unknown)),'he')
  assert.equal(updates.info().version,server.manifest.version);assert.equal(calls.length,2);assert(calls.every(c=>c.method==='GET'&&c.url.includes('/functions/v1/aw-catalog')&&!c.header.Authorization))
  assert([...memory.values()].filter(v=>typeof v==='string').every(s=>Buffer.byteLength(s)<1024*1024))
  catalog.installPackage(original);reload().init();assert.equal(updates.info().version,server.manifest.version);assert.equal(catalog.ammoColor(catalog.ammoFor(vehicle).find(a=>a.id===unknown)),'he');assert.equal(calls.length,2)
})
test('failed download, corrupt checksum and invalid references preserve the active catalog and cache pointer',async()=>{
  await updates.check(true);const pointer=clone(memory.get('aw_catalog_v1_current')),active=updates.info().version
  server=nextRelease(undefined,2);server.payload+=' '
  await assert.rejects(updates.check(true),/校验值/);assert.equal(updates.info().version,active);assert.deepEqual(memory.get('aw_catalog_v1_current'),pointer)
  server=nextRelease(c=>{const t=c.catalog.tables.vehicle_ammo;t.rows[0][t.columns.indexOf('weapon_id')]='broken-reference'},2)
  await assert.rejects(updates.check(true),/关联缺失/);assert.equal(updates.info().version,active)
  wx.request=o=>o.fail({errMsg:'offline'});await assert.rejects(updates.check(true),/offline/);assert.equal(updates.info().version,active)
  reload().init();assert.equal(updates.info().version,active)
})
test('partial cache write retains last good slot; unsupported schemas and older releases cannot replace data',async()=>{
  await updates.check(true);const pointer=clone(memory.get('aw_catalog_v1_current')),active=updates.info().version
  server=nextRelease(undefined,2);let writes=0;const set=wx.setStorageSync;wx.setStorageSync=(k,v)=>{if(++writes===4)throw Error('storage full');set(k,v)}
  await assert.rejects(updates.check(true),/storage full/);assert.deepEqual(memory.get('aw_catalog_v1_current'),pointer);assert.equal(updates.info().version,active)
  reload().init();assert.equal(updates.info().version,active)
  server=clone(release);calls=[];assert.equal((await updates.check(true)).older,true);assert.equal(calls.length,1);assert.equal(updates.info().version,active)
  server=nextRelease(undefined,3);server.manifest.schemaVersion=99;await assert.rejects(updates.check(true),/不兼容/)
})
test('corrupt cold cache falls back to bundled catalog; concurrent checks deduplicate and automatic checks throttle',async()=>{
  memory.set('aw_catalog_v1_current',{slot:0,chunks:1,manifest:server.manifest});memory.set('aw_catalog_v1_0','truncated');reload().init();assert.equal(updates.info().version,release.manifest.version)
  let respond;wx.request=o=>{calls.push(o);if(!o.url.includes('?bundle'))respond=()=>o.success({statusCode:200,data:server.manifest});else o.success({statusCode:200,data:server})}
  const a=updates.check(true),b=updates.check(false);assert.equal(a,b);assert.equal(calls.length,1);respond();await a;assert.equal(calls.length,2);assert.equal((await updates.check(false)).skipped,true)
})
test('release changing during download is rejected and an open editor defers activation until closed',async()=>{
  const old=clone(server);wx.request=o=>o.success({statusCode:200,data:o.url.includes('?bundle')?nextRelease(undefined,2):old.manifest})
  await assert.rejects(updates.check(true),/版本变化/);assert.equal(updates.info().version,release.manifest.version)
  wx.request=o=>o.success({statusCode:200,data:o.url.includes('?bundle')?server:server.manifest})
  const editor={};updates.hold(editor);assert.equal((await updates.check(true)).deferred,true);assert.equal(updates.info().version,release.manifest.version)
  updates.release(editor);assert.equal(updates.info().version,server.manifest.version)
})
test('catalog activation only recomputes in-memory automatic duties, preserving explicit data and archive dirty state',async()=>{
  const storePath='../miniprogram/utils/aw/store';delete require.cache[require.resolve(storePath)];const store=require(storePath)
  const s=fleet.clone(store.load()),ids=Object.fromEntries(catalog.tables.vehicles.map(v=>[v.slug,v.id]))
  s.members.push({id:'synthetic',name:'Test',active:true,order:0});s.roles.push({id:'role',name:'Scout',order:0})
  fleet.saveAsset(s,'synthetic',ids.xm800t_law,'planned','kept',[{roleId:'role',level:'primary'}]);store.save(s)
  const storageBefore=JSON.stringify([...memory]),stateBefore=JSON.stringify(require('../miniprogram/utils/aw/archives').personal(store.load(),'synthetic')),dirty=store.dirty
  // Force a new catalog revision without making any archive network call.
  catalog.installPackage(original);store.load()
  assert.equal(JSON.stringify([...memory]),storageBefore);assert.equal(store.dirty,dirty);assert.equal(JSON.stringify(require('../miniprogram/utils/aw/archives').personal(store.load(),'synthetic')),stateBefore);assert.equal(calls.length,0)
})
test('one refresh performs both directions and reports archive and catalog failures independently',async()=>{
  const store=require('../miniprogram/utils/aw/store'),oldRefresh=store.refresh,oldInfo=store.syncInfo,oldCheck=updates.check
  const seen=[]
  try{
    store.syncInfo=()=>({ready:true});store.refresh=async()=>{seen.push('archive');throw Error('version conflict')};updates.check=async force=>{assert.equal(force,true);seen.push('catalog');return {updated:true}}
    delete require.cache[require.resolve('../miniprogram/utils/aw/refresh-all')];const refreshAll=require('../miniprogram/utils/aw/refresh-all')
    let r=await refreshAll();assert.deepEqual(seen,['archive','catalog']);assert.equal(r.updated,true);assert.match(r.error,/存档同步.*version conflict/)
    seen.length=0;store.refresh=async()=>{seen.push('archive');return true};updates.check=async()=>{seen.push('catalog');throw Error('offline')}
    r=await refreshAll();assert.deepEqual(seen,['archive','catalog']);assert.match(r.error,/资料更新.*offline/);assert.doesNotMatch(r.error,/存档同步/)
    store.syncInfo=()=>({ready:false});seen.length=0;await refreshAll();assert.deepEqual(seen,['catalog'])
  }finally{store.refresh=oldRefresh;store.syncInfo=oldInfo;updates.check=oldCheck}
})
