const cache = require('../../utils/cache')
const remote = require('../../utils/supabase')
const snow = require('../../data/snowrunner')

function clone(v) { return JSON.parse(JSON.stringify(v)) }
function mergeCatalog(extra) { return Object.assign({}, clone(snow.seasons), clone(extra || {})) }
function parseVehicles(text) {
  return String(text || '').split(/[\n,，;；]+/).map(x => x.trim()).filter(Boolean)
}
function sortedCatalog(catalog) {
  return Object.keys(catalog || {}).sort((a, b) => {
    const na = /^S(\d+)$/.exec(a), nb = /^S(\d+)$/.exec(b)
    if (na && nb) return +na[1] - +nb[1]
    if (na) return -1
    if (nb) return 1
    return a.localeCompare(b)
  }).map(key => ({ key, cn: catalog[key].cn || '', en: catalog[key].en || '', vehicleCount: (catalog[key].vehicles || []).length }))
}

Page({
  data: {
    state: null, cloudStatus: '本地', profileId: '', shareCode: '', catalogList: [],
    seasonKeyInput: '', seasonCnInput: '', seasonEnInput: '', seasonVehiclesInput: ''
  },

  onLoad() {
    const state = cache.get('snowrunner') || snow.createDefaultState()
    state.seasonCatalog = mergeCatalog(state.seasonCatalog)
    const saved = cache.getRemote()
    this.setData({ state, profileId: saved.profileId, shareCode: saved.inviteCode }, () => this.refresh())
    if (saved.profileId && saved.inviteCode) this.loadCloud()
  },

  onPullDownRefresh() { this.loadCloud().finally(() => wx.stopPullDownRefresh()) },

  refresh() {
    const state = this.data.state
    if (!state) return
    state.seasonCatalog = mergeCatalog(state.seasonCatalog)
    this.setData({ catalogList: sortedCatalog(state.seasonCatalog) })
    cache.set('snowrunner', state)
  },

  inputField(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },

  editExisting(e) {
    const key = e.currentTarget.dataset.key
    const item = this.data.state.seasonCatalog[key]
    if (!item) return
    this.setData({
      seasonKeyInput: key, seasonCnInput: item.cn || '', seasonEnInput: item.en || '',
      seasonVehiclesInput: (item.vehicles || []).join('\n')
    })
    wx.pageScrollTo({ scrollTop: 0, duration: 250 })
  },

  clearForm() {
    this.setData({ seasonKeyInput: '', seasonCnInput: '', seasonEnInput: '', seasonVehiclesInput: '' })
  },

  saveSeasonDefinition() {
    const key = String(this.data.seasonKeyInput || '').trim().toUpperCase()
    const cn = String(this.data.seasonCnInput || '').trim()
    const en = String(this.data.seasonEnInput || '').trim()
    const vehicles = parseVehicles(this.data.seasonVehiclesInput)
    if (!/^S\d+$/.test(key)) return wx.showToast({ title: '赛季编号请输入 S20 这种格式', icon: 'none' })
    if (!cn) return wx.showToast({ title: '请填写地区 / 中文名', icon: 'none' })
    const exists = !!this.data.state.seasonCatalog[key]
    const commit = () => {
      const state = clone(this.data.state)
      state.seasonCatalog = mergeCatalog(state.seasonCatalog)
      state.seasonCatalog[key] = { cn, en, vehicles }
      this.setData({ state }, () => {
        this.refresh(); this.saveCatalog(); this.clearForm()
        wx.showToast({ title: exists ? '赛季资料已更新' : '赛季资料已添加', icon: 'success' })
      })
    }
    if (!exists) return commit()
    wx.showModal({
      title: '更新 ' + key + '？',
      content: '只更新赛季目录；已经加入计划的卡片和历史进度不会被覆盖。',
      success: r => { if (r.confirm) commit() }
    })
  },

  async loadCloud() {
    if (!this.data.profileId || !this.data.shareCode) return
    try {
      this.setData({ cloudStatus: '同步中' })
      const game = await remote.getGameState(this.data.profileId, this.data.shareCode, 'snowrunner')
      if (game && game.exists) {
        const current = clone(this.data.state)
        const cloudCatalog = game.state && game.state.meta && game.state.meta.seasonCatalog
        current.seasonCatalog = mergeCatalog(cloudCatalog || current.seasonCatalog)
        this.setData({ state: current, cloudStatus: '已同步' }, () => this.refresh())
      } else {
        this.setData({ cloudStatus: '已同步' })
      }
    } catch (e) {
      this.setData({ cloudStatus: '同步失败' })
      wx.showToast({ title: '云同步失败，已保留本地资料', icon: 'none' })
    }
  },

  saveCatalog() {
    cache.set('snowrunner', this.data.state)
    if (!this.data.profileId || !this.data.shareCode) return
    this.setData({ cloudStatus: '保存中' })
    remote.patchGameState(this.data.profileId, this.data.shareCode, 'snowrunner', ['meta','seasonCatalog'], this.data.state.seasonCatalog, false)
      .then(() => this.setData({ cloudStatus: '已同步' }))
      .catch(() => this.setData({ cloudStatus: '保存失败' }))
  }
})