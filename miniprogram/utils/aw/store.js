const cache = require('../cache')
const remote = require('../supabase')
const fleet = require('./fleet')
const catalog = require('./catalog')
let state = null, scope = '', cloudVersion = 0, dirty = false, busy = false
function remoteInfo() { return cache.getRemote() }
function key() { const r = remoteInfo(); return 'aw.v1.' + (r.profileId || 'local') }
function load() {
  if (!state || scope !== key()) {
    scope = key(); const saved = cache.get(scope), snow = cache.get('snowrunner')
    state = saved && saved.state || fleet.empty(snow && snow.userNames || {})
    cloudVersion = saved && saved.version || 0; dirty = !!(saved && saved.dirty)
  }
  return state
}
function persist() { if (!cache.set(scope, { state, version: cloudVersion, dirty })) throw new Error('本地存储失败，改动未保存，请检查设备存储空间') }
function save(next) { const previous = state, wasDirty = dirty; state = fleet.recompute(next); dirty = true; try { persist() } catch (e) { state = previous; dirty = wasDirty; throw e }; return state }
function currentMember() { const m = cache.get(scope + '.current'); return m && m.id || '' }
function setCurrentMember(id) { cache.set(scope + '.current', { id }) }
async function pull() {
  load(); const r = remoteInfo(); if (!r.profileId || !r.inviteCode) return state
  if (dirty) throw new Error('本地有未同步改动，请先上传或保留本地继续测试')
  const before = JSON.stringify(state)
  const profile = await remote.openProfile(r.inviteCode)
  const game = await remote.getGameState(r.profileId, r.inviteCode, 'aw')
  if (JSON.stringify(state) !== before || dirty) throw new Error('载入期间本地发生改动，已保留本地版本')
  if (game.exists && (!game.state || !Array.isArray(game.state.members) || !Array.isArray(game.state.roles))) throw new Error('云端 AW 数据版本不兼容，已保留本地版本')
  state = game.exists ? game.state : fleet.empty((profile.profileData || {}).users || {})
  const users = (profile.profileData || {}).users || {}
  state.members.forEach(m => { if (users[m.id]) m.name = users[m.id] })
  Object.keys(users).forEach(id => { if (!state.members.some(m => m.id === id)) state.members.push({ id, name: users[id], active: true, order: state.members.length }) })
  cloudVersion = game.version || 0; dirty = false; fleet.recompute(state); persist(); return state
}
async function push() {
  load(); const r = remoteInfo()
  if (!r.profileId || !r.inviteCode) throw new Error('请先在 SnowRunner 页面连接团队码，或继续使用本地测试')
  if (busy) throw new Error('正在同步，请稍后重试')
  busy = true
  const snapshot = fleet.clone(state), before = JSON.stringify(snapshot)
  try {
    const latest = await remote.getGameState(r.profileId, r.inviteCode, 'aw')
    if ((latest.version || 0) !== cloudVersion) throw new Error('团队数据已更新；本地改动已保留。请导出本地备份后再载入云端')
    // Local test build uses the existing game-state transaction. No writes to legacy plan tables.
    const result = await remote.putGameState(r.profileId, r.inviteCode, 'aw', snapshot, 1)
    cloudVersion = result.version; dirty = JSON.stringify(state) !== before; persist()
    // Shared profile users use stable keys. Disable preserves users and all historical relationships.
    try {
      for (const m of snapshot.members) await remote.patchProfile(r.profileId, r.inviteCode, ['users', m.id], m.name, false)
    } catch (e) { dirty = true; persist(); throw new Error('AW 状态已上传，玩家名称同步失败，请重试：' + e.message) }
    return state
  } finally { busy = false }
}
async function loadCatalog() {
  const tableNames = Object.keys(catalog.tables), data = {}
  await Promise.all(tableNames.map(async table => {
    const all = []; let offset = 0
    while (true) {
      const batch = await remote.readCatalog(table, offset, 500)
      if (!Array.isArray(batch)) throw new Error('资料返回格式无效')
      all.push.apply(all, batch)
      if (batch.length < 500) break
      offset += 500
    }
    data[table] = all
  }))
  if (!data.vehicles.length) throw new Error('云端车辆资料为空，保留随包资料')
  catalog.install(data, new Date().toISOString())
}
async function importOld() {
  load(); const r = remoteInfo()
  if (!r.profileId || !r.inviteCode) throw new Error('请先连接共享团队')
  const rows = await remote.getLegacyAwPlan(r.profileId, r.inviteCode)
  const profile = await remote.openProfile(r.inviteCode)
  const next = fleet.importLegacy(fleet.clone(state), rows, profile.profileData.users || {})
  return save(next)
}
module.exports = { load, save, pull, push, currentMember, setCurrentMember, remoteInfo, loadCatalog, importOld,
  get dirty() { return dirty }, get connected() { return !!remoteInfo().profileId },
  exportText() { return JSON.stringify(load(), null, 2) },
  discardAndPull() { dirty = false; return pull().catch(e => { dirty = true; persist(); throw e }) }
}
