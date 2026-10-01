const cache = require('../../utils/cache')
const remote = require('../../utils/supabase')
const snow = require('../../data/snowrunner')

function clone(v) { return JSON.parse(JSON.stringify(v)) }

function mergeCatalog(extra) {
  return Object.assign({}, clone(snow.seasons), clone(extra || {}))
}

function encodeGame(state) {
  return {
    schemaVersion: state.version || 1,
    meta: {
      order: state.order,
      seasonCatalog: state.seasonCatalog || mergeCatalog(),
      collapseCompleted: state.collapseCompleted !== false
    },
    steps: state.steps
  }
}

function isStepComplete(step) {
  const goals = step.goals || []
  const vehicles = step.vehicles || []
  const total = goals.length + vehicles.length
  if (!total) return false
  return goals.every(x => x.done) && vehicles.every(x => x.got)
}

function applyCompletionTransition(step, wasComplete) {
  const nowComplete = isStepComplete(step)
  if (!nowComplete) step.collapsed = false
  else if (!wasComplete && nowComplete) step.collapsed = true
  return nowComplete
}

function usersFromProfile(profile, fallback) {
  const users = profile && profile.profileData && profile.profileData.users
  return {
    A: (users && users.A) || (fallback && fallback.A) || '用户A名称',
    B: (users && users.B) || (fallback && fallback.B) || '用户B名称'
  }
}

function decodeGame(game, users) {
  if (!game) return null
  if (game.order && game.steps && !game.meta) {
    return {
      version: Math.max(game.version || game.schemaVersion || 1, 4),
      userNames: users,
      seasonCatalog: mergeCatalog(game.seasonCatalog),
      collapseCompleted: game.collapseCompleted !== false,
      order: game.order,
      steps: game.steps
    }
  }
  const meta = game.meta || {}
  return {
    version: Math.max(game.schemaVersion || 1, 4),
    userNames: users,
    seasonCatalog: mergeCatalog(meta.seasonCatalog),
    collapseCompleted: meta.collapseCompleted !== false,
    order: meta.order || { pc: [], console: [] },
    steps: game.steps || {}
  }
}

function cleanDefaultState(users) {
  const s = snow.createDefaultState()
  if (users) s.userNames = clone(users)
  if (s.collapseCompleted === undefined) s.collapseCompleted = true
  return s
}


Page({
  data: {
    gameKey: 'snowrunner', state: null, platform: 'pc', visibleSteps: [], stats: {},
    cloudStatus: '本地', profileId: '', shareCode: '', joinCode: '',
    availableSeasons: [], availableLabels: [], addSeasonIndex: 0,
    seasonCatalogCount: 0, collapseCompleted: true
  },

  onLoad(options) {
    const gameKey = options.game || 'snowrunner'
    if (gameKey !== 'snowrunner') return
    const local = cache.get(gameKey) || snow.createDefaultState()
    if (!local.seasonCatalog) local.seasonCatalog = mergeCatalog()
    if (local.collapseCompleted === undefined) local.collapseCompleted = true
    const savedRemote = cache.getRemote()
    this.setData({
      gameKey,
      state: local,
      profileId: savedRemote.profileId,
      shareCode: savedRemote.inviteCode
    })
    this.refresh()
    if (savedRemote.profileId && savedRemote.inviteCode) this.loadCloud()
  },

  onShow() {
    if (!this.data.state) return
    const latest = cache.get(this.data.gameKey)
    if (!latest) return
    if (!latest.seasonCatalog) latest.seasonCatalog = mergeCatalog()
    if (latest.collapseCompleted === undefined) latest.collapseCompleted = true
    this.setData({ state: latest }, () => this.refresh())
  },

  onPullDownRefresh() {
    this.loadCloud().finally(() => wx.stopPullDownRefresh())
  },

  refresh() {
    const s = this.data.state
    if (!s) return
    if (!s.seasonCatalog) s.seasonCatalog = mergeCatalog()
    if (s.collapseCompleted === undefined) s.collapseCompleted = true
    const catalog = s.seasonCatalog
    const ids = s.order[this.data.platform] || []
    const visibleSteps = ids.map((id, i) => {
      const st = clone(s.steps[id]); st.no = i + 1
      const gd = st.goals.filter(x => x.done).length, ga = st.goals.length
      const vd = st.vehicles.filter(x => x.got).length, va = st.vehicles.length
      st.gDone = gd; st.gAll = ga; st.vGot = vd; st.vAll = va
      st.complete = (ga + va) > 0 && gd === ga && vd === va
      st.collapsed = !!(s.collapseCompleted && st.complete && st.collapsed !== false)
      st.creatorLabel = st.creator ? s.userNames[st.creator] : '未标记'
      st.vehicles.forEach(x => { x.ownerLabel = x.owner ? s.userNames[x.owner] : '未分配' })
      return st
    })
    let vGot = 0, vAll = 0, gDone = 0, gAll = 0
    Object.values(s.steps).forEach(st => {
      vGot += st.vehicles.filter(x => x.got).length
      vAll += st.vehicles.length
      gDone += st.goals.filter(x => x.done).length
      gAll += st.goals.length
    })
    const used = new Set(ids.map(id => s.steps[id] && s.steps[id].season))
    const availableSeasons = Object.keys(catalog).filter(k => !used.has(k)).sort((a, b) => {
      const na = /^S(\d+)$/.exec(a), nb = /^S(\d+)$/.exec(b)
      if (na && nb) return +na[1] - +nb[1]
      if (na) return -1
      if (nb) return 1
      return a.localeCompare(b)
    })
    this.setData({
      visibleSteps,
      stats: { vGot, vAll, gDone, gAll },
      availableSeasons,
      availableLabels: availableSeasons.map(k => k + ' · ' + catalog[k].cn),
      seasonCatalogCount: Object.keys(catalog).length,
      collapseCompleted: s.collapseCompleted !== false
    })
    cache.set(this.data.gameKey, s)
  },

  switchPlatform(e) { this.setData({ platform: e.currentTarget.dataset.platform }, () => this.refresh()) },

  toggleCollapseCompleted(e) {
    const s = clone(this.data.state)
    s.collapseCompleted = !!e.detail.value
    this.setData({ state: s, collapseCompleted: s.collapseCompleted }, () => {
      this.refresh()
      this.saveCollapseSetting()
    })
  },

  toggleStepCollapse(e) {
    const id = e.currentTarget.dataset.id
    const s = clone(this.data.state)
    const st = s.steps[id]
    if (!st || !isStepComplete(st)) return
    const isCollapsed = s.collapseCompleted !== false && st.collapsed !== false
    st.collapsed = !isCollapsed
    this.setData({ state: s }, () => { this.refresh(); this.saveStep(id) })
  },

  editUser(e) {
    const slot = e.currentTarget.dataset.slot
    const value = e.detail.value.trim() || (slot === 'A' ? '用户A名称' : '用户B名称')
    const s = clone(this.data.state); s.userNames[slot] = value
    this.setData({ state: s }, () => {
      this.refresh()
      this.saveUser(slot, value)
    })
  },

  setCreator(e) {
    const id = e.currentTarget.dataset.id, slot = e.currentTarget.dataset.slot
    const s = clone(this.data.state); s.steps[id].creator = s.steps[id].creator === slot ? null : slot
    this.setData({ state: s }, () => { this.refresh(); this.saveStep(id) })
  },

  toggleGoal(e) {
    const id = e.currentTarget.dataset.id, gi = +e.currentTarget.dataset.gi
    const s = clone(this.data.state), st = s.steps[id], wasComplete = isStepComplete(st)
    st.goals[gi].done = !st.goals[gi].done
    applyCompletionTransition(st, wasComplete)
    this.setData({ state: s }, () => { this.refresh(); this.saveStep(id) })
  },

  editGoal(e) {
    const id = e.currentTarget.dataset.id, gi = +e.currentTarget.dataset.gi
    const s = clone(this.data.state); s.steps[id].goals[gi].text = e.detail.value
    this.setData({ state: s }, () => { this.refresh(); this.saveStep(id) })
  },

  addGoal(e) {
    const id = e.currentTarget.dataset.id, s = clone(this.data.state), st = s.steps[id], wasComplete = isStepComplete(st)
    st.goals.push({ id: 'g_' + Date.now(), text: '新目标', done: false })
    applyCompletionTransition(st, wasComplete)
    this.setData({ state: s }, () => { this.refresh(); this.saveStep(id) })
  },

  deleteGoal(e) {
    const id = e.currentTarget.dataset.id, gi = +e.currentTarget.dataset.gi
    const s = clone(this.data.state), st = s.steps[id], wasComplete = isStepComplete(st)
    st.goals.splice(gi, 1)
    applyCompletionTransition(st, wasComplete)
    this.setData({ state: s }, () => { this.refresh(); this.saveStep(id) })
  },

  toggleVehicle(e) {
    const id = e.currentTarget.dataset.id, vi = +e.currentTarget.dataset.vi
    const s = clone(this.data.state), st = s.steps[id], wasComplete = isStepComplete(st)
    st.vehicles[vi].got = !st.vehicles[vi].got
    applyCompletionTransition(st, wasComplete)
    this.setData({ state: s }, () => { this.refresh(); this.saveStep(id) })
  },

  setOwner(e) {
    const id = e.currentTarget.dataset.id, vi = +e.currentTarget.dataset.vi, slot = e.currentTarget.dataset.slot
    const s = clone(this.data.state), st = s.steps[id], wasComplete = isStepComplete(st), v = st.vehicles[vi]
    v.owner = v.owner === slot ? null : slot
    if (v.owner) v.got = true
    applyCompletionTransition(st, wasComplete)
    this.setData({ state: s }, () => { this.refresh(); this.saveStep(id) })
  },

  editNote(e) {
    const id = e.currentTarget.dataset.id, s = clone(this.data.state)
    s.steps[id].note = e.detail.value
    this.setData({ state: s }, () => { this.refresh(); this.saveStep(id) })
  },

  moveStep(e) {
    const id = e.currentTarget.dataset.id, dir = +e.currentTarget.dataset.dir
    const s = clone(this.data.state), a = s.order[this.data.platform], i = a.indexOf(id), j = i + dir
    if (i < 0 || j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    this.setData({ state: s }, () => { this.refresh(); this.saveOrder() })
  },

  removeStep(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '移除这一站？',
      content: '只从当前计划移除；赛季目录资料会保留，之后仍可重新加入。',
      success: r => {
        if (!r.confirm) return
        const s = clone(this.data.state)
        s.order[this.data.platform] = s.order[this.data.platform].filter(x => x !== id)
        delete s.steps[id]
        this.setData({ state: s }, () => {
          this.refresh()
          this.saveOrder()
          if (this.data.profileId && this.data.shareCode) {
            remote.patchGameState(this.data.profileId, this.data.shareCode, this.data.gameKey, ['steps', id], null, true).catch(() => {})
          }
        })
      }
    })
  },

  pickSeason(e) { this.setData({ addSeasonIndex: +e.detail.value }) },

  addSeason() {
    const key = this.data.availableSeasons[this.data.addSeasonIndex]
    if (!key) return
    const s = clone(this.data.state), st = snow.createSeasonStep(key, this.data.platform, s.seasonCatalog)
    s.steps[st.id] = st; s.order[this.data.platform].push(st.id)
    this.setData({ state: s, addSeasonIndex: 0 }, () => {
      this.refresh(); this.saveOrder(); this.saveStep(st.id)
    })
  },

  openSeasonManager() {
    wx.navigateTo({ url: '/pages/season/index' })
  },

  inputJoin(e) {
    this.setData({ joinCode: remote.normalizeCode(e.detail.value) })
  },

  copyShareCode() {
    if (!this.data.shareCode) return
    wx.setClipboardData({
      data: this.data.shareCode,
      success: () => wx.showToast({ title: '合作码已复制', icon: 'success' })
    })
  },

  async createCloud() {
    const users = this.data.state && this.data.state.userNames
    await this.createProfileWithState(cleanDefaultState(users), '创建新档')
  },

  switchCloud() {
    cache.clearRemote()
    this.setData({
      profileId: '',
      shareCode: '',
      joinCode: '',
      cloudStatus: '未连接'
    })
  },

  async createProfileWithState(initialState, loadingTitle) {
    wx.showLoading({ title: loadingTitle || '创建云存档' })
    try {
      if (!initialState.seasonCatalog) initialState.seasonCatalog = mergeCatalog()
      const profile = await remote.createProfile({
        users: initialState.userNames,
        settings: {}
      })
      cache.setRemote(profile.profileId, profile.inviteCode)
      this.setData({
        profileId: profile.profileId,
        shareCode: profile.inviteCode,
        joinCode: '',
        state: initialState,
        cloudStatus: '初始化游戏数据'
      })
      await remote.putGameState(
        profile.profileId,
        profile.inviteCode,
        this.data.gameKey,
        encodeGame(initialState),
        initialState.version || 1
      )
      cache.set(this.data.gameKey, initialState)
      this.refresh()
      this.setData({ cloudStatus: '已同步' })
      wx.showModal({
        title: '合作档已创建',
        content: '合作码：' + profile.inviteCode + '\n\n页面上可以直接复制。合作码相当于访问凭证，请不要公开。',
        showCancel: false
      })
    } catch (e) {
      wx.showModal({ title: '创建失败', content: e.message || String(e), showCancel: false })
    } finally { wx.hideLoading() }
  },

  async joinCloud() {
    const code = remote.normalizeCode(this.data.joinCode)
    if (code.length !== 20) {
      wx.showToast({ title: '请输入20位合作码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '切换合作档' })
    try {
      const profile = await remote.openProfile(code)
      cache.setRemote(profile.profileId, code)
      this.setData({ profileId: profile.profileId, shareCode: code, joinCode: '' })
      const game = await remote.getGameState(profile.profileId, code, this.data.gameKey)
      await this.applyRemote(profile, game)
    } catch (e) {
      wx.showModal({ title: '打开失败', content: e.message || String(e), showCancel: false })
    } finally { wx.hideLoading() }
  },

  async applyRemote(profile, gameResult) {
    const users = usersFromProfile(profile, this.data.state && this.data.state.userNames)
    if (gameResult && gameResult.exists) {
      const game = decodeGame(gameResult.state, users)
      this.setData({ state: game, cloudStatus: '已同步' })
      cache.set(this.data.gameKey, game)
      this.refresh()
      return
    }

    // 切换到一个还没启用 SnowRunner 的合作档时，初始化默认计划，不复制当前旧档。
    const local = cleanDefaultState(users)
    this.setData({ state: local, cloudStatus: '初始化游戏数据' })
    await remote.putGameState(
      profile.profileId,
      this.data.shareCode,
      this.data.gameKey,
      encodeGame(local),
      local.version || 1
    )
    cache.set(this.data.gameKey, local)
    this.refresh()
    this.setData({ cloudStatus: '已同步' })
  },

  async loadCloud() {
    if (!this.data.shareCode) return
    try {
      this.setData({ cloudStatus: '同步中' })
      const profile = await remote.openProfile(this.data.shareCode)
      if (this.data.profileId !== profile.profileId) {
        cache.setRemote(profile.profileId, this.data.shareCode)
        this.setData({ profileId: profile.profileId })
      }
      const game = await remote.getGameState(profile.profileId, this.data.shareCode, this.data.gameKey)
      await this.applyRemote(profile, game)
    } catch (e) {
      this.setData({ cloudStatus: '同步失败' })
      wx.showToast({ title: '云同步失败，已保留本地缓存', icon: 'none' })
    }
  },

  saveUser(slot, value) {
    cache.set(this.data.gameKey, this.data.state)
    if (!this.data.profileId || !this.data.shareCode) return
    this.setData({ cloudStatus: '保存中' })
    remote.patchProfile(this.data.profileId, this.data.shareCode, ['users', slot], value, false)
      .then(() => this.setData({ cloudStatus: '已同步' }))
      .catch(() => this.setData({ cloudStatus: '保存失败' }))
  },

  saveOrder() {
    cache.set(this.data.gameKey, this.data.state)
    if (!this.data.profileId || !this.data.shareCode) return
    this.setData({ cloudStatus: '保存中' })
    remote.patchGameState(
      this.data.profileId,
      this.data.shareCode,
      this.data.gameKey,
      ['meta', 'order'],
      this.data.state.order,
      false
    )
      .then(() => this.setData({ cloudStatus: '已同步' }))
      .catch(() => this.setData({ cloudStatus: '保存失败' }))
  },

  saveCollapseSetting() {
    cache.set(this.data.gameKey, this.data.state)
    if (!this.data.profileId || !this.data.shareCode) return
    this.setData({ cloudStatus: '保存中' })
    remote.patchGameState(
      this.data.profileId,
      this.data.shareCode,
      this.data.gameKey,
      ['meta', 'collapseCompleted'],
      this.data.state.collapseCompleted !== false,
      false
    )
      .then(() => this.setData({ cloudStatus: '已同步' }))
      .catch(() => this.setData({ cloudStatus: '保存失败' }))
  },

  saveSeasonCatalog() {
    cache.set(this.data.gameKey, this.data.state)
    if (!this.data.profileId || !this.data.shareCode) return
    this.setData({ cloudStatus: '保存中' })
    remote.patchGameState(
      this.data.profileId,
      this.data.shareCode,
      this.data.gameKey,
      ['meta', 'seasonCatalog'],
      this.data.state.seasonCatalog,
      false
    )
      .then(() => this.setData({ cloudStatus: '已同步' }))
      .catch(() => this.setData({ cloudStatus: '保存失败' }))
  },

  saveStep(id) {
    cache.set(this.data.gameKey, this.data.state)
    if (!this.data.profileId || !this.data.shareCode) return
    this.setData({ cloudStatus: '保存中' })
    remote.patchGameState(
      this.data.profileId,
      this.data.shareCode,
      this.data.gameKey,
      ['steps', id],
      this.data.state.steps[id],
      false
    )
      .then(() => this.setData({ cloudStatus: '已同步' }))
      .catch(() => this.setData({ cloudStatus: '保存失败' }))
  }
})