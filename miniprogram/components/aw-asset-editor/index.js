const store = require('../../utils/aw/store')
const fleet = require('../../utils/aw/fleet')
const catalog = require('../../utils/aw/catalog')
Component({
  properties: { vehicleId: String, memberId: String },
  data: { members: [], playerIndex: 0, statusIndex: 0, statuses: ['已拥有', '计划'], levels: ['不分配', '主力', '备选', '过渡'], rows: [], note: '', saving: false },
  lifetimes: { attached() { this.prepare() } },
  observers: { 'vehicleId,memberId'() { if (this.properties.vehicleId) this.prepare() } },
  methods: {
    prepare() {
      const s = store.load(), members = s.members.filter(m => m.active).sort((a, b) => a.order - b.order)
      const preferred = this.properties.memberId || store.currentMember()
      let i = members.findIndex(m => m.id === preferred); if (i < 0) i = 0
      this.setData({ members, playerIndex: i }); this.loadPlayer()
    },
    loadPlayer() {
      const s = store.load(), m = this.data.members[this.data.playerIndex]
      if (!m) { this.setData({ rows: [], note: '' }); return }
      const asset = fleet.getAsset(s, m.id, this.properties.vehicleId)
      const rows = s.roles.slice().sort((a, b) => a.order - b.order).map(r => {
        const a = asset && s.assignments[fleet.assignmentKey(asset.id, r.id)]
        const manual = a && a.source !== 'tech_tree'
        const selected = a ? s.dependencies.filter(d => d.assignmentId === a.id && d.source === 'manual').map(d => d.targetId) : []
        const targets = Object.values(s.assignments).filter(t => {
          const v = s.assets[t.assetId]
          return v && v.memberId === m.id && v.vehicleId !== this.properties.vehicleId && t.roleId === r.id && ['primary', 'backup'].includes(t.level)
        }).map(t => ({ id: t.id, name: (catalog.byId[s.assets[t.assetId].vehicleId] || {}).name || '未知车辆', checked: selected.includes(t.id) }))
        return { id: r.id, name: r.name, index: manual ? ['','primary','backup','transition'].indexOf(a.level) : 0, targets,
          automatic: a && a.source === 'tech_tree' }
      })
      this.setData({ rows, statusIndex: asset && asset.status === 'planned' ? 1 : 0, note: asset && asset.note || '' })
    },
    pickPlayer(e) { this.setData({ playerIndex: Number(e.detail.value) }); this.loadPlayer() },
    pickStatus(e) { this.setData({ statusIndex: Number(e.detail.value) }) },
    note(e) { this.setData({ note: e.detail.value }) },
    pickLevel(e) { const rows = fleet.clone(this.data.rows); rows[e.currentTarget.dataset.index].index = Number(e.detail.value); this.setData({ rows }) },
    pickTargets(e) { const rows = fleet.clone(this.data.rows), row = rows[e.currentTarget.dataset.index]; row.targets.forEach(t => { t.checked = e.detail.value.includes(t.id) }); this.setData({ rows }) },
    cancel() { this.triggerEvent('cancel') },
    manage() { this.triggerEvent('cancel'); wx.navigateTo({ url: '/pages/aw-fleet/index?tab=players' }) },
    save() {
      try {
        const m = this.data.members[this.data.playerIndex]; if (!m) throw new Error('请先添加玩家')
        const roles = this.data.rows.filter(r => r.index > 0).map(r => ({ roleId: r.id, level: ['','primary','backup','transition'][r.index], targetIds: r.targets.filter(t => t.checked).map(t => t.id) }))
        store.save(fleet.saveAsset(fleet.clone(store.load()), m.id, this.properties.vehicleId, this.data.statusIndex ? 'planned' : 'owned', this.data.note.trim(), roles))
        store.setCurrentMember(m.id); this.triggerEvent('saved'); wx.showToast({ title: '已保存本地', icon: 'success' })
      } catch (e) { wx.showModal({ title: '无法保存', content: e.message, showCancel: false }) }
    }
  }
})
