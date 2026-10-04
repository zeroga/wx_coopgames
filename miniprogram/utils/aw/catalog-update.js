const catalog = require('./catalog')
const bundled = require('../../data/aw/release')
const bundledCatalog = require('../../data/aw/catalog')
const config = require('../../config')
const sha256 = require('./checksum')
const prefix = 'aw_catalog_v1_', pointerKey = prefix + 'current', chunkSize = 64000
const interval = 15 * 60 * 1000
let initialized = false, active = bundled, origin = '随包资料', pending = null, lastAttempt = 0, lastCheck = '', error = ''
const editors = new Set()
let deferred = null
function activate(bundle, content) {
  if(editors.size){deferred={bundle,content};return}
  catalog.installPackage(content);active=bundle.manifest;origin='已缓存资料';deferred=null
}
function hold(editor){editors.add(editor)}
function release(editor){editors.delete(editor);if(!editors.size&&deferred)activate(deferred.bundle,deferred.content)}
function invalid(message) { throw new Error('资料包校验失败：' + message) }
function validateManifest(m) {
  if (!m || m.schemaVersion !== 1 || !Number.isSafeInteger(m.sequence) || m.sequence < 0 || !Number.isFinite(Date.parse(m.publishedAt)) || !Number.isFinite(Date.parse(m.sourceCheckedAt))) invalid('版本格式不兼容')
  if (!/^[a-f0-9]{64}$/.test(m.sha256 || '') || typeof m.version !== 'string' || !m.version.endsWith('-'+m.sha256.slice(0,12))) invalid('版本校验值无效')
  const tables = Object.keys(bundledCatalog.tables)
  if (!m.counts || Object.keys(m.counts).length !== tables.length || tables.some(k => !Number.isSafeInteger(m.counts[k]) || m.counts[k] < 0 || m.counts[k] > 30000) || !m.counts.vehicles) invalid('表清单不完整')
  return m
}
function validate(bundle) {
  if (!bundle || typeof bundle.payload !== 'string' || bundle.payload.length > 8 * 1024 * 1024) invalid('内容不完整或过大')
  const m = validateManifest(bundle.manifest)
  if (sha256(bundle.payload) !== m.sha256) invalid('内容校验值不一致')
  let content
  try { content = JSON.parse(bundle.payload) } catch (_) { invalid('内容无法解析') }
  const pack = content.catalog
  if (!pack || !pack.tables || !Array.isArray(pack.strings) || pack.strings.length > 100000 || pack.strings.some(s=>typeof s!=='string') || pack.checkedAt !== m.sourceCheckedAt) invalid('目录格式错误')
  const names = Object.keys(bundledCatalog.tables)
  if (Object.keys(pack.tables).length !== names.length) invalid('目录表缺失')
  names.forEach(k => {
    const t = pack.tables[k]
    if (!t || !Array.isArray(t.columns) || !Array.isArray(t.rows) || t.rows.length !== m.counts[k] || new Set(t.columns).size !== t.columns.length || bundledCatalog.tables[k].columns.some(c => !t.columns.includes(c))) invalid(k+' 字段或数量不完整')
    t.rows.forEach(r => {
      if (!Array.isArray(r) || r.length !== t.columns.length) invalid(k+' 行格式错误')
      r.forEach(v => { if (typeof v==='string' && v[0]==='@' && (!/^@\d+$/.test(v) || Number(v.slice(1)) >= pack.strings.length)) invalid(k+' 字符串索引错误') })
    })
  })
  const decoded = catalog.decode(pack), ids = {}
  names.forEach(k => {
    ids[k] = new Set()
    decoded[k].forEach(r => {
      if ('id' in r) { if (typeof r.id !== 'string' || !r.id || ids[k].has(r.id)) invalid(k+' ID 重复或无效'); ids[k].add(r.id) }
    })
  })
  const refs = {
    vehicles:{dealer_id:'dealers'}, vehicle_weapons:{vehicle_id:'vehicles'}, vehicle_ammo:{weapon_id:'vehicle_weapons'},
    vehicle_progression_edges:{from_vehicle_id:'vehicles',to_vehicle_id:'vehicles'}, vehicle_upgrades:{vehicle_id:'vehicles'},
    unlock_paths:{vehicle_id:'vehicles',target_upgrade_id:'vehicle_upgrades'},
    unlock_requirements:{unlock_path_id:'unlock_paths',source_vehicle_id:'vehicles',source_upgrade_id:'vehicle_upgrades',token_id:'tokens',dealer_id:'dealers'},
    vehicle_token_rewards:{vehicle_id:'vehicles',token_id:'tokens'}, vehicle_capabilities:{vehicle_id:'vehicles'},
    vehicle_armor:{vehicle_id:'vehicles'}, vehicle_crew_positions:{vehicle_id:'vehicles'}, vehicle_branch_memberships:{vehicle_id:'vehicles',branch_id:'tech_tree_branches'},
    vehicle_era:{capability_id:'vehicle_capabilities'}, vehicle_infantry:{capability_id:'vehicle_capabilities'}, era_coverage:{capability_id:'vehicle_capabilities'},
    ammo_trait_links:{ammo_id:'vehicle_ammo'}, ammo_guidance_modes:{ammo_id:'vehicle_ammo'}, ammo_penetration_samples:{ammo_id:'vehicle_ammo'},
    ammo_upgrade_links:{ammo_id:'vehicle_ammo',upgrade_id:'vehicle_upgrades'}, weapon_upgrade_links:{weapon_id:'vehicle_weapons',upgrade_id:'vehicle_upgrades'},
    upgrade_prerequisites:{upgrade_id:'vehicle_upgrades',prerequisite_upgrade_id:'vehicle_upgrades'}
  }
  Object.keys(refs).forEach(k => decoded[k].forEach(r => Object.keys(refs[k]).forEach(f => { if (r[f] != null && !ids[refs[k][f]].has(r[f])) invalid(k+' 关联缺失') })))
  const evidence = content.ammoEvidence
  if (!evidence || !evidence.entries || Array.isArray(evidence.entries)) invalid('弹头分类缺失')
  const warheads = ['kinetic','heat','tandem_heat','thermobaric','he','hesh','pele','smoke','unknown']
  Object.keys(evidence.entries).forEach(id => {
    const e = evidence.entries[id]
    if (!ids.vehicle_ammo.has(id) || !e || !warheads.includes(e.warhead_type) || !Array.isArray(e.traits) || e.traits.some(t=>typeof t!=='string')) invalid('弹头分类关联错误')
  })
  const presentation = content.presentation
  if (!presentation || !Array.isArray(presentation.exclusiveWeaponGroups)) invalid('武器分组缺失')
  presentation.exclusiveWeaponGroups.forEach(g => {
    if (!ids.vehicles.has(g.vehicleId) || !Array.isArray(g.weaponIds) || g.weaponIds.some(id=>!decoded.vehicle_weapons.some(w=>w.id===id && w.vehicle_id===g.vehicleId)) || typeof g.sourceNote !== 'string') invalid('武器分组关联错误')
  })
  return content
}
function init() {
  if (initialized) return
  initialized = true
  try {
    const p = wx.getStorageSync(pointerKey)
    if (!p || ![0,1].includes(p.slot) || !Number.isSafeInteger(p.chunks) || p.chunks < 1 || p.chunks > 150) return
    const parts = []
    for (let i=0;i<p.chunks;i++) { const s=wx.getStorageSync(prefix+p.slot+'_'+i); if(typeof s!=='string') invalid('缓存不完整'); parts.push(s) }
    const bundle={manifest:p.manifest,payload:parts.join('')}, content=validate(bundle)
    if (p.manifest.sequence < bundled.sequence) return
    if (p.manifest.sequence === bundled.sequence && p.manifest.version !== bundled.version) return
    catalog.installPackage(content);active=p.manifest;origin='已缓存资料'
  } catch (_) { error='缓存不可用，已使用随包资料' }
}
function cache(bundle) {
  const previous=wx.getStorageSync(pointerKey), slot=previous && previous.slot===0?1:0
  const chunks=Math.ceil(bundle.payload.length/chunkSize)
  for(let i=0;i<chunks;i++)wx.setStorageSync(prefix+slot+'_'+i,bundle.payload.slice(i*chunkSize,(i+1)*chunkSize))
  // The pointer commits last; interrupted/quota-failed writes keep the old slot.
  wx.setStorageSync(pointerKey,{slot,chunks,manifest:bundle.manifest})
}
function request(query) {
  return new Promise((resolve,reject)=>wx.request({
    url:String(config.supabaseUrl||'').replace(/\/+$/,'')+'/functions/v1/aw-catalog'+query,
    method:'GET',timeout:15000,header:{apikey:config.supabasePublishableKey},
    success:r=>r.statusCode===200?resolve(r.data):reject(new Error('资料服务 HTTP '+r.statusCode)),
    fail:e=>reject(new Error(e.errMsg||'无法连接资料服务'))
  }))
}
function info() {
  init()
  const timeText=new Date(Date.parse(active.publishedAt)+8*60*60*1000).toISOString().replace('T',' ').slice(0,16)+' 北京时间'
  return {version:active.version,versionText:active.version.replace(/^aw-/,'').replace(/-[a-f0-9]{12}$/,''),publishedAt:active.publishedAt,timeText,sourceCheckedAt:active.sourceCheckedAt,source:origin,busy:!!pending,lastCheck,error,status:pending?'正在检查资料':error?'更新未完成，继续使用已有资料':lastCheck?'资料已检查':'资料可离线使用'}
}
function check(force) {
  init()
  if (pending) return pending
  if (!force && Date.now()-lastAttempt<interval) return Promise.resolve({updated:false,skipped:true})
  lastAttempt=Date.now();error=''
  pending=(async()=>{
    try {
      const m=validateManifest(await request(''))
      if(m.sequence<active.sequence) { lastCheck=new Date().toISOString();return {updated:false,older:true} }
      if(m.sequence===active.sequence) {
        if(m.version!==active.version) invalid('同一发布序号内容发生变化')
        lastCheck=new Date().toISOString();return {updated:false}
      }
      const bundle=await request('?bundle=1&version='+encodeURIComponent(m.version))
      if(!bundle || bundle.manifest.version!==m.version || bundle.manifest.sha256!==m.sha256 || bundle.manifest.sequence!==m.sequence) invalid('下载期间版本变化')
      const content=validate(bundle)
      cache(bundle)
      activate(bundle,content);lastCheck=new Date().toISOString()
      return {updated:!deferred,deferred:!!deferred}
    } catch(e) { error=e.message||String(e);throw e }
    finally { pending=null }
  })()
  return pending
}
module.exports={init,check,info,validate,validateManifest,hold,release}
