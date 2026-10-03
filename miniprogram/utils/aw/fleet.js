const catalog = require('./catalog')
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
function resolveRoute(s, memberId, vehicleId) {
  const visited = {}, stack = {}, nodes = [], warnings = [], choices = [], depths = {}
  let complete = true
  function visit(vid, depth) {
    depths[vid] = Math.max(depths[vid] || 0, depth)
    if (stack[vid]) { complete = false; warnings.push('获取路线存在循环，需核对资料'); return }
    if (visited[vid]) return
    stack[vid] = true
    const owned = (getAsset(s, memberId, vid) || {}).status === 'owned'
    const known = paths(vid), full = known.filter(p => p.is_complete)
    const selected = s.routes[assetKey(memberId, vid)]
    let path = known.find(p => p.id === selected)
    if (!path && full.length === 1) path = full[0]
    if (!path && full.length > 1) {
      choices.push({ vehicleId: vid, name: (catalog.byId[vid] || {}).name || '未知车辆', paths: full })
      if (!owned) { complete = false; warnings.push('请为 ' + (catalog.byId[vid] || {}).name + ' 选择获取路线') }
    } else if (!path && known.length === 1) path = known[0]
    if ((!path || !path.is_complete) && !owned) { complete = false; warnings.push((catalog.byId[vid] || {}).name + ' 获取路线待补全') }
    const reqs = path ? catalog.rows('unlock_requirements', 'unlock_path_id', path.id).sort((a, b) => a.sort_order - b.sort_order) : []
    // Only explicit requirement relations are prerequisites. Display edges are not proof of unlock requirements.
    reqs.forEach(r => { if (r.source_vehicle_id) visit(r.source_vehicle_id, depth + 1) })
    nodes.push({ vehicleId: vid, vehicle: catalog.byId[vid] || { name: '资料待补全' }, owned, path, requirements: reqs, depth })
    visited[vid] = true; delete stack[vid]
  }
  visit(vehicleId, 0)
  return { nodes, warnings: Array.from(new Set(warnings)), choices, complete, depths }
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
      const asset = ensureAsset(s, m.id, n.vehicleId), key = assignmentKey(asset.id, t.roleId)
      if (!s.assignments[key]) s.assignments[key] = { id: key, assetId: asset.id, roleId: t.roleId, level: 'transition', source: 'tech_tree', note: '' }
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
  delete s.assets[assetId]
  Object.keys(s.assignments).forEach(k => { if (s.assignments[k].assetId === assetId) delete s.assignments[k] })
  return recompute(s)
}
function memberPlan(s, memberId, targetId) {
  const ts = targets(s, memberId).filter(t => !targetId || t.id === targetId)
  const order = [], seen = {}, warnings = [], choices = []
  let complete = true
  ts.forEach(t => {
    const r = resolveRoute(s, memberId, s.assets[t.assetId].vehicleId)
    complete = complete && r.complete; warnings.push.apply(warnings, r.warnings); choices.push.apply(choices, r.choices)
    r.nodes.forEach(n => { if (!seen[n.vehicleId]) { seen[n.vehicleId] = true; order.push(n) } })
  })
  const budget = {}, steps = []
  function bucket(tokenId) {
    if (!budget[tokenId]) budget[tokenId] = { id: tokenId, name: (catalog.byId[tokenId] || {}).name || 'Token', owned: Number(s.tokens[assetKey(memberId, tokenId)] || 0), gained: 0, uncertain: 0, consumed: 0, balance: Number(s.tokens[assetKey(memberId, tokenId)] || 0), processOk: true }
    return budget[tokenId]
  }
  order.forEach(n => {
    const step = { id: n.vehicleId, name: n.vehicle.name_zh || n.vehicle.name, owned: n.owned, pathName: n.path && n.path.name, changes: [], requirements: n.requirements.map(r => Object.assign({}, r, { confirmed: !!s.confirmedRequirements[assetKey(memberId, r.id)] })), rewards: [], blocked: false, uncertain: false }
    if (!n.owned) n.requirements.forEach(r => {
      if (r.token_id) {
        const b = bucket(r.token_id), amount = Number(r.required_value)
        if (r.required_value === null || !Number.isFinite(amount) || amount < 0 || !['public_verified', 'ingame_verified'].includes(r.verification_status)) {
          complete = false; step.uncertain = true; warnings.push('Token 消耗待确认：' + (r.description || n.vehicle.name)); return
        }
        b.consumed += amount
        if (b.balance < amount) { b.processOk = false; step.blocked = true; step.changes.push(b.name + ' 不足，缺少 ' + (amount - b.balance)) }
        b.balance -= amount; step.changes.push(b.name + ' 消耗 ' + amount)
      } else if ((r.source_vehicle_id && !r.source_upgrade_id && ['own_vehicle', 'vehicle_progress'].includes(r.requirement_type)) || s.confirmedRequirements[assetKey(memberId, r.id)]) {
        // Vehicle progress can have an additional threshold, which must be explicitly confirmed.
        if (r.requirement_type === 'vehicle_progress' && !s.confirmedRequirements[assetKey(memberId, r.id)]) { complete = false; step.uncertain = true; warnings.push('车辆进度条件待确认：' + r.description) }
      } else { complete = false; step.uncertain = true; warnings.push('其他解锁条件待确认：' + (r.description || r.requirement_type)) }
    })
    catalog.rows('vehicle_token_rewards', 'vehicle_id', n.vehicleId).forEach(r => {
      const b = bucket(r.token_id), qty = Number(r.quantity), confirmed = !!s.confirmedRewards[assetKey(memberId, r.id)] && ['public_verified', 'ingame_verified'].includes(r.verification_status) && r.quantity !== null && Number.isFinite(qty) && qty >= 0
      step.rewards.push(Object.assign({}, r, { tokenName: b.name, confirmed }))
      // Owned vehicles' past rewards must already be part of current holdings. Never count twice.
      if (n.owned) return
      if (confirmed) { b.gained += qty; b.balance += qty; step.changes.push(b.name + ' 确认获取 ' + qty) }
      else { b.uncertain += Number.isFinite(qty) ? qty : 0; step.uncertain = true; warnings.push('奖励获取时点待确认：' + n.vehicle.name + ' · ' + b.name) }
    })
    steps.push(step)
  })
  const tokens = Object.values(budget).map(b => Object.assign(b, { totalOk: b.consumed === 0 || b.owned + b.gained > b.consumed, final: b.owned + b.gained - b.consumed }))
  const tokenOk = tokens.every(t => t.totalOk && t.processOk)
  const uncertain = !complete || steps.some(x => x.uncertain)
  const status = !tokenOk ? 'Token 不足 / 不满足' : uncertain ? '无法完全确认' : '已知条件通过'
  return { steps, tokens, choices: choices.filter((c, i) => choices.findIndex(x => x.vehicleId === c.vehicleId) === i), warnings: Array.from(new Set(warnings)), complete: !uncertain, status, executable: !uncertain && tokenOk, ownedCount: order.filter(n => n.owned).length, count: order.length }
}
function summary(s, vehicleId) {
  const roles = {}; s.roles.forEach(r => { roles[r.id] = r })
  return Object.values(s.assets).filter(a => a.vehicleId === vehicleId).map(a => {
    const m = s.members.find(x => x.id === a.memberId) || { name: '历史玩家' }
    const assigned = Object.values(s.assignments).filter(x => x.assetId === a.id)
    const formal = assigned.find(x => ['primary', 'backup'].includes(x.level) && x.source !== 'tech_tree')
    const plan = a.status === 'planned' && formal ? memberPlan(s, a.memberId, formal.id) : null
    return Object.assign({}, a, { memberName: m.name + (m.active ? '' : '（停用）'), statusText: catalog.label(a.status),
      roles: assigned.map(x => Object.assign({}, x, { name: (roles[x.roleId] || {}).name || '历史职责', levelText: catalog.label(x.level), sourceText: catalog.label(x.source),
        targetNames: s.dependencies.filter(d => d.assignmentId === x.id).map(d => { const t = s.assignments[d.targetId], v = t && s.assets[t.assetId]; return v ? (catalog.byId[v.vehicleId] || {}).name : '' }).filter(Boolean).join('、') })),
      roleText: assigned.map(x => (roles[x.roleId] || {}).name + '·' + catalog.label(x.level)).join(' / ') || '暂无车队职责',
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
module.exports = { clone, id, empty, assetKey, assignmentKey, getAsset, ensureAsset, paths, resolveRoute, recompute, saveAsset, deleteRole, removeAsset, targets, memberPlan, summary, overview, importLegacy }
