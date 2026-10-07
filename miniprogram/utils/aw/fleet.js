const catalog = require('./catalog')
const tokenPlan = require('./token-plan')
function clone(x) { return JSON.parse(JSON.stringify(x)) }
function id(prefix) { return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9) }
function empty(users) {
  return { schemaVersion: 1, members: Object.keys(users || {}).map((key, i) => ({ id: key, name: users[key], active: true, order: i })), roles: [], assets: {}, assignments: {}, dependencies: [], routes: {}, tokens: {}, confirmedRewards: {}, confirmedRequirements: {}, legacyAudit: [] }
}
function assetKey(memberId, vehicleId) { return memberId + '~' + vehicleId }
function assignmentKey(assetId, roleId) { return assetId + '~' + roleId }
function getAsset(s, memberId, vehicleId) { return s.assets[assetKey(memberId, vehicleId)] }
function ensureAsset(s, memberId, vehicleId) {
  const key = assetKey(memberId, vehicleId)
  if (!s.assets[key]) s.assets[key] = { id: key, memberId, vehicleId, status: 'planned', note: '', explicit: false }
  return s.assets[key]
}
function paths(vehicleId) { return catalog.rows('unlock_paths', 'vehicle_id', vehicleId).filter(p => !p.target_upgrade_id).sort((a, b) => a.sort_order - b.sort_order) }
function prerequisiteConfig(s, memberId, vehicleId) {
  const a = getAsset(s, memberId, vehicleId) || {}, saved = a.prerequisites
  if (saved && ['ignore', 'known', 'custom'].includes(saved.mode)) return Object.assign({pathId:'',customVehicleIds:[],tokenSourceVehicleIds:[]}, saved)
  const route = s.routes[assetKey(memberId, vehicleId)]
  return {mode:route ? 'known' : a.explicit === false && Object.values(s.assignments).some(x=>x.assetId===a.id&&x.source==='tech_tree') ? 'known' : 'ignore', pathId:route || '', customVehicleIds:[], tokenSourceVehicleIds:[]}
}
function prerequisiteOptions(vehicleId) {
  return paths(vehicleId).filter(p=>p.is_complete||catalog.rows('unlock_requirements','unlock_path_id',p.id).some(r=>r.source_vehicle_id||r.token_id)).map(p => {
    const requirements = catalog.rows('unlock_requirements','unlock_path_id',p.id)
    const sources = Array.from(new Set(requirements.map(r=>r.source_vehicle_id).filter(id=>catalog.byId[id])))
    const tokens = Array.from(new Set(requirements.map(r=>r.token_id).filter(Boolean)))
    const providers = catalog.tables.vehicle_token_rewards.filter(r=>tokens.includes(r.token_id)&&catalog.byId[r.vehicle_id]&&r.vehicle_id!==vehicleId).map(r=>({id:r.id,vehicleId:r.vehicle_id,name:catalog.byId[r.vehicle_id].displayName||catalog.byId[r.vehicle_id].name,tokenName:(catalog.byId[r.token_id]||{}).name||'Token',quantity:r.quantity}))
    const names = sources.map(id=>catalog.byId[id].displayName||catalog.byId[id].name)
    const tokenText = requirements.filter(r=>r.token_id).map(r=>((catalog.byId[r.token_id]||{}).name||'Token')+' ×'+(r.required_value == null ? '—' : r.required_value)).join('、')
    return {id:p.id,name:names.length?'从 '+names.join(' / ')+' 研发':tokenText?'使用 '+tokenText:p.name, sources:sources.map(id=>({id,name:catalog.byId[id].displayName||catalog.byId[id].name})),tokenText,providers}
  })
}
function resolveRoute(s, memberId, vehicleId) {
  const visited = {}, stack = {}, nodes = [], warnings = [], choices = [], depths = {}
  let complete = true
  function visit(vid, depth, derived) {
    depths[vid] = Math.max(depths[vid] || 0, depth)
    if (stack[vid]) { complete = false; warnings.push('前置配置存在循环'); return }
    if (visited[vid]) return
    stack[vid] = true
    const asset = getAsset(s,memberId,vid), owned = (asset || {}).status === 'owned'
    const known = paths(vid)
    const config = prerequisiteConfig(s,memberId,vid)
    if (derived && (!asset || !asset.explicit && !asset.prerequisites) && !s.routes[assetKey(memberId,vid)]) config.mode='known'
    const ignored = !owned && !tokenPlan.hasRecordedUnlock(asset||{}) && config.mode==='ignore'
    let path = known.find(p=>p.id===config.pathId)
    if (!path && known.length===1) path=known[0]
    if (!path && config.mode==='known' && !owned) choices.push({vehicleId:vid,name:(catalog.byId[vid]||{}).name,paths:known})
    let reqs = path ? catalog.rows('unlock_requirements','unlock_path_id',path.id).slice().sort((a,b)=>a.sort_order-b.sort_order) : []
    if(config.mode==='custom') {
      reqs=reqs.filter(r=>!r.source_vehicle_id).concat(config.customVehicleIds.map(id=>({id:'custom:'+vid+':'+id,source_vehicle_id:id,requirement_type:'own_vehicle',description:'拥有 '+(catalog.byId[id]||{}).name,custom:true})))
    }
    const routeKnown = !ignored && (config.mode==='custom' ? !!config.customVehicleIds.length && (!known.some(p=>catalog.rows('unlock_requirements','unlock_path_id',p.id).some(r=>r.token_id)) || !!path) : !!(path&&path.is_complete))
    if (!owned && !tokenPlan.hasRecordedUnlock(asset||{}) && !routeKnown) {complete=false;warnings.push((catalog.byId[vid]||{}).name+'：需要前置')}
    if (!owned && !ignored && !tokenPlan.hasRecordedUnlock(asset||{})) {
      reqs.forEach(r=>{if(r.source_vehicle_id)visit(r.source_vehicle_id,depth+1,true)})
      config.tokenSourceVehicleIds.forEach(id=>visit(id,depth+1,true))
    }
    nodes.push({vehicleId:vid,vehicle:catalog.byId[vid]||{name:'车辆资料缺失'},owned,path,requirements:reqs,depth,ignored,custom:config.mode==='custom',routeKnown})
    visited[vid]=true;delete stack[vid]
  }
  visit(vehicleId,0,false)
  return {nodes,warnings:Array.from(new Set(warnings)),choices,complete,depths}
}
function setPrerequisites(s,memberId,vehicleId,input) {
  if(!s.members.some(m=>m.id===memberId&&m.active)||!catalog.byId[vehicleId])throw new Error('请选择有效玩家和车辆')
  if(!['ignore','known','custom'].includes(input.mode))throw new Error('前置配置无效')
  const config={mode:input.mode,pathId:input.pathId||'',customVehicleIds:Array.from(new Set(input.customVehicleIds||[])),tokenSourceVehicleIds:Array.from(new Set(input.tokenSourceVehicleIds||[]))}
  const options=prerequisiteOptions(vehicleId),option=options.find(p=>p.id===config.pathId)
  if(config.mode==='known'&&!option)throw new Error('请选择数据已知的获取路线')
  if(config.mode==='custom'&&!config.customVehicleIds.length)throw new Error('请选择自定义前置车辆')
  if(config.mode==='ignore'){config.pathId='';config.customVehicleIds=[];config.tokenSourceVehicleIds=[]}
  if(config.mode!=='custom')config.customVehicleIds=[]
  if(config.customVehicleIds.some(id=>!catalog.byId[id]||id===vehicleId))throw new Error('自定义前置车辆无效')
  if(config.tokenSourceVehicleIds.some(id=>!option||!option.providers.some(r=>r.vehicleId===id)))throw new Error('请选择该路线已知的 Token 来源车辆')
  const next=clone(s),a=ensureAsset(next,memberId,vehicleId);a.prerequisites=config;a.explicit=true
  delete next.routes[assetKey(memberId,vehicleId)]
  if(resolveRoute(next,memberId,vehicleId).warnings.some(x=>x.includes('循环')))throw new Error('前置配置存在循环，请调整选择')
  const saved=ensureAsset(s,memberId,vehicleId);saved.prerequisites=config;saved.explicit=true
  delete s.routes[assetKey(memberId,vehicleId)]
  return recompute(s)
}
function prerequisiteStatus(s,memberId,vehicleId) {
  const a=getAsset(s,memberId,vehicleId)||{},config=prerequisiteConfig(s,memberId,vehicleId)
  if(a.status==='owned'||tokenPlan.hasRecordedUnlock(a))return {needsPrerequisite:false,customPrerequisite:config.mode==='custom'}
  return {needsPrerequisite:a.status==='planned'&&config.mode==='ignore',customPrerequisite:config.mode==='custom'}
}
function targets(s, memberId) {
  return Object.values(s.assignments).filter(a => {
    const v = s.assets[a.assetId]
    return v && v.memberId === memberId && v.status === 'planned' && ['primary', 'backup'].indexOf(a.level) >= 0 && a.source !== 'tech_tree'
  })
}
function recompute(s) {
  Object.keys(s.assignments).forEach(k => { if (s.assignments[k].source === 'tech_tree') delete s.assignments[k] })
  s.dependencies = s.dependencies.filter(d => d.source === 'manual' && s.assignments[d.assignmentId] && s.assignments[d.targetId])
  s.members.forEach(m => targets(s, m.id).forEach(t => {
    const targetAsset = s.assets[t.assetId], route = resolveRoute(s, m.id, targetAsset.vehicleId)
    route.nodes.filter(n => n.vehicleId !== targetAsset.vehicleId).forEach(n => {
      const asset = ensureAsset(s, m.id, n.vehicleId), key = assignmentKey(asset.id, '')
      if (!s.assignments[key]) s.assignments[key] = { id: key, assetId: asset.id, roleId: '', level: 'transition', source: 'tech_tree', note: '' }
      s.dependencies.push({ id: key + '>' + t.id, assignmentId: key, targetId: t.id, source: 'tech_tree', depth: route.depths[n.vehicleId], pathId: (n.path || {}).id || null })
    })
  }))
  // Assets are retained, including unreferenced automatic assets. Only derived role/dependency records are removed.
  return s
}
function saveAsset(s, memberId, vehicleId, status, note, roles) {
  if (!s.members.some(m => m.id === memberId && m.active)) throw new Error('请选择有效玩家')
  if (!catalog.byId[vehicleId]) throw new Error('车辆不存在')
  if (['owned', 'planned'].indexOf(status) < 0) throw new Error('车辆状态无效')
  const asset = ensureAsset(s, memberId, vehicleId)
  if (!asset.explicit && !asset.prerequisites && !s.routes[asset.id]) asset.prerequisites={mode:'ignore',pathId:'',customVehicleIds:[],tokenSourceVehicleIds:[]}
  asset.status = status; asset.note = note || ''; asset.explicit = true
  const old = Object.values(s.assignments).filter(a => a.assetId === asset.id && a.source !== 'tech_tree')
  old.forEach(a => { delete s.assignments[a.id] })
  s.dependencies = s.dependencies.filter(d => !old.some(a => a.id === d.assignmentId))
  roles.forEach(r => {
    if (!s.roles.some(x => x.id === r.roleId) || ['primary', 'backup', 'transition'].indexOf(r.level) < 0) throw new Error('职责设置无效')
    const key = assignmentKey(asset.id, r.roleId)
    s.assignments[key] = { id: key, assetId: asset.id, roleId: r.roleId, level: r.level, source: 'manual', note: r.note || '' }
    if (r.level === 'transition') (r.targetIds || []).forEach(tid => {
      const t = s.assignments[tid], ta = t && s.assets[t.assetId]
      if (!ta || ta.memberId !== memberId || t.roleId !== r.roleId || ['primary', 'backup'].indexOf(t.level) < 0 || ta.id === asset.id) throw new Error('过渡目标必须是同玩家、同职责的主力或备选')
      s.dependencies.push({ id: key + '>' + tid + ':manual', assignmentId: key, targetId: tid, source: 'manual', depth: null, pathId: null })
    })
  })
  return recompute(s)
}
function deleteRole(s, roleId) {
  s.roles = s.roles.filter(r => r.id !== roleId)
  Object.keys(s.assignments).forEach(k => { if (s.assignments[k].roleId === roleId) delete s.assignments[k] })
  return recompute(s)
}
function removeAsset(s, assetId) {
  const asset = s.assets[assetId]
  if (!asset) return s
  const automatic = Object.values(s.assets).filter(a => a.memberId === asset.memberId && !a.explicit).map(a => a.id)
  delete s.routes[assetId]
  const pathIds = new Set(catalog.rows('unlock_paths', 'vehicle_id', asset.vehicleId).map(p => p.id))
  catalog.tables.unlock_requirements.filter(r => pathIds.has(r.unlock_path_id)).forEach(r => { delete s.confirmedRequirements[assetKey(asset.memberId, r.id)] })
  catalog.rows('vehicle_token_rewards', 'vehicle_id', asset.vehicleId).forEach(r => { delete s.confirmedRewards[assetKey(asset.memberId, r.id)] })
  delete s.assets[assetId]
  Object.keys(s.assignments).forEach(k => { if (s.assignments[k].assetId === assetId) delete s.assignments[k] })
  recompute(s)
  // Keep prerequisites still needed by another target, but drop orphaned derived vehicles.
  automatic.forEach(id => { if (s.assets[id] && !s.assets[id].explicit && !Object.values(s.assignments).some(a => a.assetId === id)) delete s.assets[id] })
  return s
}
function planningTargets(s, memberId) {
  const formal=targets(s,memberId), seen=new Set(formal.map(t=>t.assetId))
  return formal.concat(Object.values(s.assets).filter(a=>a.memberId===memberId&&a.status==='planned'&&a.explicit&&!seen.has(a.id)).map(a=>({id:a.id+'~plan',assetId:a.id,roleId:'',level:'planned',source:'manual'})))
}
function memberPlan(s, memberId, targetId) {
  const ts=planningTargets(s,memberId).filter(t=>!targetId||t.id===targetId||(s.assets[t.assetId]||{}).tokenSupply),nodes=[],seen=new Set(),context={complete:true,warnings:[],choices:[]}
  ts.forEach(t=>{
    const route=resolveRoute(s,memberId,s.assets[t.assetId].vehicleId)
    context.complete=context.complete&&route.complete;context.warnings.push.apply(context.warnings,route.warnings);context.choices.push.apply(context.choices,route.choices)
    route.nodes.forEach(n=>{if(!seen.has(n.vehicleId)){seen.add(n.vehicleId);nodes.push(n)}})
  })
  const plan=tokenPlan.build(s,memberId,nodes,context)
  plan.steps.forEach(step=>Object.assign(step,prerequisiteStatus(s,memberId,step.id)))
  return plan
}
function summary(s, vehicleId) {
  const roles = {}; s.roles.forEach(r => { roles[r.id] = r })
  return Object.values(s.assets).filter(a => a.vehicleId === vehicleId).map(a => {
    const m = s.members.find(x => x.id === a.memberId) || { name: '历史玩家' }
    const assigned = Object.values(s.assignments).filter(x => x.assetId === a.id)
    const formal = assigned.find(x => ['primary', 'backup'].includes(x.level) && x.source !== 'tech_tree')
    const plan = a.status === 'planned' && formal ? memberPlan(s, a.memberId, formal.id) : null
    return Object.assign({}, a, prerequisiteStatus(s,a.memberId,a.vehicleId), { memberName: m.name + (m.active ? '' : '（停用）'), statusText: catalog.label(a.status),
      roles: assigned.map(x => Object.assign({}, x, { name: x.roleId ? (roles[x.roleId] || {}).name || '历史职责' : '未定义职责', levelText: catalog.label(x.level), sourceText: catalog.label(x.source),
        targetVehicles: s.dependencies.filter(d => d.assignmentId === x.id).map(d => { const t=s.assignments[d.targetId], v=t&&s.assets[t.assetId]; return v?{id:v.vehicleId,name:(catalog.byId[v.vehicleId]||{}).name}:null }).filter(Boolean),
        targetNames: s.dependencies.filter(d => d.assignmentId === x.id).map(d => { const t = s.assignments[d.targetId], v = t && s.assets[t.assetId]; return v ? (catalog.byId[v.vehicleId] || {}).name : '' }).filter(Boolean).join('、') })),
      roleText: assigned.map(x => (x.roleId ? (roles[x.roleId] || {}).name || '历史职责' : '未定义职责') + '·' + catalog.label(x.level)).join(' / ') || '暂无车队职责',
      planText: plan ? '前置 ' + plan.steps.filter(n => n.id !== vehicleId && n.owned).length + '/' + plan.steps.filter(n => n.id !== vehicleId).length + ' · ' + plan.status : '', planTargetId: formal && formal.id
    })
  }).sort((a, b) => a.memberName.localeCompare(b.memberName))
}
function overview(s) {
  return s.roles.slice().sort((a, b) => a.order - b.order).map(r => Object.assign({}, r, {
    groups: ['primary', 'backup', 'transition'].map(level => {
      const vehicleGroups = {}
      Object.values(s.assignments).filter(a => a.roleId === r.id && a.level === level).forEach(a => {
        const asset = s.assets[a.assetId]; if (!asset) return
        const v = catalog.byId[asset.vehicleId] || { name: '资料待补全', id: asset.vehicleId }
        if (!vehicleGroups[v.id]) vehicleGroups[v.id] = { id: v.id, name: v.name_zh || v.name, members: [] }
        vehicleGroups[v.id].members.push(summary(s, v.id).find(x => x.id === asset.id))
      })
      return { level, name: catalog.label(level), vehicles: Object.values(vehicleGroups) }
    })
  }))
}
function importLegacy(s, entries, users) {
  const imported = new Set(s.legacyAudit.map(x => x.id))
  entries.forEach(row => {
    if (imported.has(row.id)) return
    s.legacyAudit.push(clone(row))
    if (!['owned', 'planned', 'researching'].includes(row.status)) return
    if (!s.members.some(m => m.id === row.user_id)) s.members.push({ id: row.user_id, name: users[row.user_id] || row.display_name || '待确认玩家', active: true, order: s.members.length })
    const a = ensureAsset(s, row.user_id, row.vehicle_id)
    if (row.status === 'owned') a.status = 'owned'
    a.explicit = true; a.note = a.note || row.note || ''
    // Legacy role/priority/status remain in audit; do not guess custom role mappings.
  })
  return recompute(s)
}
module.exports = { clone, id, empty, assetKey, assignmentKey, getAsset, ensureAsset, paths, prerequisiteConfig, prerequisiteOptions, setPrerequisites, prerequisiteStatus, resolveRoute, recompute, saveAsset, deleteRole, removeAsset, targets, planningTargets, memberPlan, summary, overview, importLegacy }
