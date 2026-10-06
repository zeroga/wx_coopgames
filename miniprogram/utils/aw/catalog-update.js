const catalog = require('./catalog')
const bundled = require('../../data/aw/release')
const bundledCatalog = require('../../data/aw/catalog')
const config = require('../../config')
const protocol = require('./catalog-package')
const {validate,validateManifest} = protocol
const prefix = 'aw_catalog_v1_', pointerKey = prefix + 'current', chunkSize = 64000
const interval = 15 * 60 * 1000
let initialized = false, active = bundled, origin = '随包资料', pending = null, lastAttempt = 0, lastCheck = '', error = ''
const editors = new Set()
let deferred = null, activeBundle = null, needsFull = false
function activate(bundle, content, stage) {
  if(editors.size){deferred={bundle,content,stage};return}
  wx.setStorageSync(pointerKey,stage)
  catalog.installPackage(content);active=bundle.manifest;activeBundle=bundle;origin='已缓存资料';deferred=null;needsFull=false
}
function hold(editor){editors.add(editor)}
function release(editor){
  editors.delete(editor)
  if(!editors.size&&deferred){
    const next=deferred;deferred=null
    try{activate(next.bundle,next.content,next.stage)}catch(e){error=e.message||String(e)}
  }
}
function invalid(message) { throw new Error('资料包校验失败：' + message) }
function bundledBundle() {
  const content={catalog:bundledCatalog,ammoEvidence:require('../../data/aw/ammo-classification'),presentation:require('../../data/aw/presentation')}
  return {manifest:bundled,payload:bundled.encoding==='stable-key-v1'?protocol.canonicalPayload(content):JSON.stringify(content)}
}
function init() {
  if (initialized) return
  initialized = true
  try {
    const p = wx.getStorageSync(pointerKey)
    if (!p) return
    if (![0,1].includes(p.slot) || !Number.isSafeInteger(p.chunks) || p.chunks < 1 || p.chunks > 150) invalid('缓存指针无效')
    const parts = []
    for (let i=0;i<p.chunks;i++) { const s=wx.getStorageSync(prefix+p.slot+'_'+i); if(typeof s!=='string') invalid('缓存不完整'); parts.push(s) }
    const bundle={manifest:p.manifest,payload:parts.join('')}, content=validate(bundle)
    if (p.manifest.sequence < bundled.sequence) return
    if (p.manifest.sequence === bundled.sequence && p.manifest.version !== bundled.version) return
    catalog.installPackage(content);active=p.manifest;activeBundle=bundle;origin='已缓存资料'
  } catch (_) { needsFull=true;error='缓存不可用，已使用随包资料' }
}
function cache(bundle) {
  const previous=wx.getStorageSync(pointerKey), slot=previous && previous.slot===0?1:0
  const chunks=Math.ceil(bundle.payload.length/chunkSize)
  if(chunks<1||chunks>150)invalid('缓存大小超出限制')
  for(let i=0;i<chunks;i++)wx.setStorageSync(prefix+slot+'_'+i,bundle.payload.slice(i*chunkSize,(i+1)*chunkSize))
  // Verify the actual inactive slot before committing the pointer (including silent write failures).
  const parts=[]
  for(let i=0;i<chunks;i++){
    const s=wx.getStorageSync(prefix+slot+'_'+i)
    if(typeof s!=='string')invalid('缓存不完整')
    parts.push(s)
  }
  validate({manifest:bundle.manifest,payload:parts.join('')})
  return {slot,chunks,manifest:bundle.manifest}
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
  if (deferred) return Promise.resolve({updated:false,deferred:true})
  if (!force && Date.now()-lastAttempt<interval) return Promise.resolve({updated:false,skipped:true})
  lastAttempt=Date.now();error=''
  pending=(async()=>{
    try {
      const m=validateManifest(await request(''))
      if(m.sequence<active.sequence) { lastCheck=new Date().toISOString();return {updated:false,older:true} }
      if(m.sequence===active.sequence) {
        if(m.version!==active.version) invalid('同一发布序号内容发生变化')
        if(!needsFull){lastCheck=new Date().toISOString();return {updated:false}}
      }
      let bundle, mode='full', fallbackReason=''
      const descriptor=!needsFull&&Array.isArray(m.patches)&&m.patches.find(d=>protocol.applicable(d,active,m))
      if(descriptor){
        try{
          const patch=await request('?patch=1&baseVersion='+encodeURIComponent(active.version)+'&version='+encodeURIComponent(m.version))
          if(!patch||protocol.stringify(patch.descriptor)!==protocol.stringify(descriptor))invalid('下载期间 patch 版本变化')
          bundle=protocol.applyPatch(activeBundle||bundledBundle(),patch,m);mode='patch'
        }catch(e){fallbackReason=e.message||String(e)}
      }
      if(!bundle){
        const download=await request('?bundle=1&version='+encodeURIComponent(m.version))
        if(!download||!download.manifest||download.manifest.version!==m.version||download.manifest.sha256!==m.sha256||download.manifest.sequence!==m.sequence)invalid('下载期间版本变化')
        bundle={manifest:m,payload:download.payload}
      }
      const content=validate(bundle),stage=cache(bundle)
      activate(bundle,content,stage);lastCheck=new Date().toISOString()
      return {updated:!deferred,deferred:!!deferred,mode,fallbackReason}
    } catch(e) { error=e.message||String(e);throw e }
    finally { pending=null }
  })()
  return pending
}
module.exports={init,check,info,validate,validateManifest,hold,release}
