const store = require('../../utils/aw/store')
const fleet = require('../../utils/aw/fleet')
const catalog = require('../../utils/aw/catalog')
const navigation = require('../../utils/aw/navigation')
const identity = require('../../utils/aw/identity')
Component({
  properties: { vehicleId: String },
  data: { members: [], playerIndex: 0, statusIndex: 0, statuses: ['已拥有', '计划'], levels: ['不分配', '主力', '备选', '过渡'], rows: [], note: '', saving: false, editable: true, vehicleName: '', identityName:'', memberCode:'', identityBusy:false, showRoleManager:false, roleForm:null },
  lifetimes: { attached() { this.prepare() } },
  observers: { 'vehicleId'() { if (this.properties.vehicleId) this.prepare() } },
  methods: {
    prepare() {
      const s = store.load(), current = store.currentMember()
      const members = s.members.filter(m => m.id === current && m.active)
      this.setData({ members, playerIndex:0, memberId:current }); this.loadPlayer()
    },
    loadPlayer() {
      const s = store.load(), m = this.data.members[this.data.playerIndex]
      if (!m) { this.setData({ rows: [], note: '', editable:false, vehicleName:(catalog.byId[this.properties.vehicleId] || {}).name || '' }); return }
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
      this.setData({ editable: store.canEdit(m.id), vehicleName: (catalog.byId[this.properties.vehicleId] || {}).displayName || (catalog.byId[this.properties.vehicleId] || {}).name || '', rows, statusIndex: asset && asset.status === 'planned' ? 1 : 0, note: asset && asset.note || '' })
    },
    identityField(e) { this.setData({[e.currentTarget.dataset.key]:e.detail.value}) },
    async createSelf() {
      this.setData({identityBusy:true})
      try {
        await identity.create(this.data.identityName);this.prepare()
      } catch(e) { wx.showModal({title:'无法建立个人档',content:e.message,showCancel:false}) }
      finally{this.setData({identityBusy:false})}
    },
    async associateSelf() {
      this.setData({identityBusy:true})
      try{await identity.connect(this.data.memberCode);this.prepare()}
      catch(e){wx.showModal({title:'无法关联个人档',content:e.message,showCancel:false})}
      finally{this.setData({identityBusy:false})}
    },
    toggleRole(e) {
      const rows=fleet.clone(this.data.rows),row=rows[e.currentTarget.dataset.index]
      row.index=row.index?0:1;this.setData({rows})
    },
    roleManager() { this.setData({showRoleManager:!this.data.showRoleManager,roleForm:null}) },
    newRole() { this.setData({roleForm:{id:'',name:'',description:''}}) },
    editRole(e) { const r=store.load().roles.find(x=>x.id===e.currentTarget.dataset.id);if(r)this.setData({roleForm:fleet.clone(r)}) },
    roleField(e) { this.setData({['roleForm.'+e.currentTarget.dataset.key]:e.detail.value}) },
    cancelRole() { this.setData({roleForm:null}) },
    refreshRoles() {
      const draft=fleet.clone(this.data.rows),statusIndex=this.data.statusIndex,note=this.data.note
      this.loadPlayer()
      const rows=this.data.rows.map(row=>{
        const old=draft.find(x=>x.id===row.id)
        if(old){row.index=old.index;row.targets.forEach(t=>{const previous=old.targets.find(x=>x.id===t.id);if(previous)t.checked=previous.checked})}
        return row
      });this.setData({rows,statusIndex,note})
    },
    saveRole() {
      try{
        const form=this.data.roleForm,name=form.name.trim();if(!name)throw new Error('请填写职责名称')
        const next=fleet.clone(store.load())
        if(form.id)Object.assign(next.roles.find(r=>r.id===form.id),{name,description:form.description.trim()})
        else next.roles.push({id:fleet.id('role'),name,description:form.description.trim(),order:next.roles.length})
        store.save(next);this.refreshRoles();this.cancelRole()
      }catch(e){wx.showModal({title:'无法保存职责',content:e.message,showCancel:false})}
    },
    deleteRole(e) {
      const id=e.currentTarget.dataset.id
      wx.showModal({title:'删除职责？',content:'移除该职责及车队关联，保留成员车辆。',success:r=>{
        if(!r.confirm)return
        try{const next=fleet.clone(store.load());fleet.deleteRole(next,id);store.save(next);this.refreshRoles();this.cancelRole()}
        catch(e){wx.showModal({title:'无法删除职责',content:e.message,showCancel:false})}
      }})
    },
    pickStatus(e) { this.setData({ statusIndex: Number(e.detail.value) }) },
    note(e) { this.setData({ note: e.detail.value }) },
    pickLevel(e) { const rows = fleet.clone(this.data.rows); rows[e.currentTarget.dataset.index].index = Number(e.detail.value); this.setData({ rows }) },
    pickTargets(e) { const rows = fleet.clone(this.data.rows), row = rows[e.currentTarget.dataset.index]; row.targets.forEach(t => { t.checked = e.detail.value.includes(t.id) }); this.setData({ rows }) },
    cancel() { this.triggerEvent('cancel') },
    manage() { this.triggerEvent('cancel'); navigation.visit('pages/aw-fleet/index',{tab:'players'}) },
    save() {
      try {
        const m = this.data.members[this.data.playerIndex]; if (!m || m.id !== store.currentMember() || !m.active) throw new Error('请先建立自己的成员档')
        if(!store.canEdit(m.id))throw new Error('请先关联自己的 AW-M 成员码')
        const roles = this.data.rows.filter(r => r.index > 0).map(r => ({ roleId: r.id, level: ['','primary','backup','transition'][r.index], targetIds: r.targets.filter(t => t.checked).map(t => t.id) }))
        const next = fleet.clone(store.load()), previous = fleet.getAsset(next,m.id,this.properties.vehicleId), editable = store.canEdit(m.id), previousExplicit = previous && previous.explicit
        fleet.saveAsset(next,m.id,this.properties.vehicleId,editable ? (this.data.statusIndex ? 'planned' : 'owned') : (previous && previous.status || 'planned'),editable ? this.data.note.trim() : (previous && previous.note || ''),roles)
        if (!editable) fleet.getAsset(next,m.id,this.properties.vehicleId).explicit = previous ? previousExplicit : false
        store.save(next)
        store.setCurrentMember(m.id); this.triggerEvent('saved'); wx.showToast({ title: '已保存本地', icon: 'success' })
      } catch (e) { wx.showModal({ title: '无法保存', content: e.message, showCancel: false }) }
    }
  }
})
