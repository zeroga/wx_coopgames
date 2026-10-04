const store = require('../../utils/aw/store')
const fleet = require('../../utils/aw/fleet')
const catalog = require('../../utils/aw/catalog')
const navigation = require('../../utils/aw/navigation')
const identity = require('../../utils/aw/identity')
const tokenPlan = require('../../utils/aw/token-plan')
const updates = require('../../utils/aw/catalog-update')
Component({
  properties: { vehicleId: String },
  data: { members: [], playerIndex: 0, statusIndex: 1, statuses: ['已拥有', '计划'], levels: ['主力', '备选', '过渡'], rows: [], note: '', saving: false, editable: true, vehicleName: '', identityName:'', memberCode:'', identityBusy:false, showRoleManager:false, roleForm:null,fieldError:'',syncError:'',keyboardHeight:0,sheetHeight:560,contentHeight:410,tokenRewards:[],tokenAcquisition:'unknown',unlockPathId:'',unlockPaths:[] },
  lifetimes: { attached() { this.prepare() }, detached() { updates.release(this) } },
  observers: { 'vehicleId'() { if (this.properties.vehicleId) this.prepare() } },
  methods: {
    prepare() {
      updates.hold(this)
      this.keyboard({detail:{height:0}})
      const s = store.load(), current = store.currentMember()
      const members = s.members.filter(m => m.id === current && m.active)
      this.setData({ catalogRevision:catalog.revision, members, playerIndex:0, memberId:current }); this.loadPlayer()
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
        }).map(t => ({ id: t.id, vehicleId:s.assets[t.assetId].vehicleId, name: (catalog.byId[s.assets[t.assetId].vehicleId] || {}).name || '未知车辆', checked: selected.includes(t.id) }))
        return { id: r.id, name: r.name, index: manual ? ['','primary','backup','transition'].indexOf(a.level) : 0, targets,
          automatic: !!(a && a.source === 'tech_tree'), automaticVehicles:a?s.dependencies.filter(d=>d.assignmentId===a.id&&d.source==='tech_tree').map(d=>{const t=s.assignments[d.targetId],v=t&&s.assets[t.assetId];return v?{id:v.vehicleId,name:(catalog.byId[v.vehicleId]||{}).name}:null}).filter(Boolean):[], automaticTargets: a ? s.dependencies.filter(d=>d.assignmentId===a.id&&d.source==='tech_tree').map(d=>{const target=s.assignments[d.targetId];return target&&(catalog.byId[(s.assets[target.assetId]||{}).vehicleId]||{}).name}).filter(Boolean).join('、') : '' }
      })
      this.setData({ editable: store.canEdit(m.id), vehicleName: (catalog.byId[this.properties.vehicleId] || {}).displayName || (catalog.byId[this.properties.vehicleId] || {}).name || '', rows, statusIndex: !asset || asset.status === 'planned' ? 1 : 0, note: asset && asset.note || '', tokenRewards:tokenPlan.rewards(asset||{vehicleId:this.properties.vehicleId}), tokenAcquisition:asset&&asset.tokenAcquisition||'unknown',unlockPathId:asset&&asset.tokenUnlockPathId||'',unlockPaths:tokenPlan.pathCards(this.properties.vehicleId,asset&&asset.tokenUnlockPathId).filter(p=>catalog.rows('unlock_requirements','unlock_path_id',p.id).some(r=>r.token_id)) })
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
      if(this.data.saving)return
      const rows=fleet.clone(this.data.rows),row=rows[e.currentTarget.dataset.index]
      row.index=row.index?0:1;this.setData({rows})
    },
    roleManager() { if(this.data.saving)return; this.setData({showRoleManager:!this.data.showRoleManager,roleForm:null,fieldError:''}) },
    newRole() { if(this.data.saving)return; this.setData({roleForm:{id:'',name:'',description:''}}) },
    editRole(e) { if(this.data.saving)return; const r=store.load().roles.find(x=>x.id===e.currentTarget.dataset.id);if(r)this.setData({roleForm:fleet.clone(r)}) },
    roleField(e) { this.setData({['roleForm.'+e.currentTarget.dataset.key]:e.detail.value}) },
    cancelRole() { this.setData({roleForm:null,fieldError:''}) },
    async retrySync(){this.setData({saving:true});try{await store.push();this.setData({syncError:''});this.refreshRoles()}catch(e){this.setData({syncError:e.message})}finally{this.setData({saving:false})}},
    refreshRoles() {
      const draft=fleet.clone(this.data.rows),statusIndex=this.data.statusIndex,note=this.data.note,tokenRewards=this.data.tokenRewards,tokenAcquisition=this.data.tokenAcquisition,unlockPathId=this.data.unlockPathId
      this.loadPlayer()
      const rows=this.data.rows.map(row=>{
        const old=draft.find(x=>x.id===row.id)
        if(old){row.index=old.index;row.targets.forEach(t=>{const previous=old.targets.find(x=>x.id===t.id);if(previous)t.checked=previous.checked})}
        return row
      });this.setData({rows,statusIndex,note,tokenRewards,tokenAcquisition,unlockPathId})
    },
    async saveRole() {
      if(this.data.saving)return
      try{
        const form=this.data.roleForm,name=form.name.trim();if(!name)throw new Error('请填写职责名称')
        const next=fleet.clone(store.load())
        if(form.id)Object.assign(next.roles.find(r=>r.id===form.id),{name,description:form.description.trim()})
        else next.roles.push({id:fleet.id('role'),name,description:form.description.trim(),order:next.roles.length})
        await this.syncRoles(next)
      }catch(e){this.setData({fieldError:e.message})}
    },
    deleteRole(e) {
      const id=e.currentTarget.dataset.id
      wx.showModal({title:'删除职责？',content:'移除该职责及车队关联，保留成员车辆。',success:async r=>{
        if(!r.confirm)return
        try{const next=fleet.clone(store.load());fleet.deleteRole(next,id);await this.syncRoles(next)}
        catch(e){wx.showModal({title:'无法删除职责',content:e.message,showCancel:false})}
      }})
    },
    async syncRoles(next) {
      this.setData({saving:true})
      try{await store.saveSharedRoles(next);this.cancelRole();wx.showToast({title:store.connected?'职责已同步':'职责已保存本地',icon:'success'})}
      catch(e){if(e.localSaved)this.cancelRole();this.setData({syncError:(e.localSaved?'职责已保存本地，尚未同步：':'')+e.message});if(!e.localSaved)throw e}
      finally{this.refreshRoles();this.setData({saving:false})}
    },
    pickStatus(e) { if(!this.data.saving)this.setData({ statusIndex: Number(e.currentTarget.dataset.value),fieldError:'' }) },
    note(e) { if(this.data.saving)return; this.setData({ note: e.detail.value }) },
    pickLevel(e) { if(this.data.saving)return; const rows = fleet.clone(this.data.rows); rows[e.currentTarget.dataset.index].index = Number(e.currentTarget.dataset.value); this.setData({ rows }) },
    pickTargets(e) { if(this.data.saving)return; const rows = fleet.clone(this.data.rows), row = rows[e.currentTarget.dataset.index]; row.targets.forEach(t => { t.checked = e.detail.value.includes(t.id) }); this.setData({ rows }) },
    keyboard(e) { const h=Number(e.detail.height)||0,win=wx.getWindowInfo?wx.getWindowInfo().windowHeight:680,available=Math.max(230,Math.min(win*.88,win-h-12));this.setData({keyboardHeight:h,sheetHeight:available,contentHeight:Math.max(100,available-140)}) },
    reward(e) { if(this.data.saving)return;const {id,state}=e.currentTarget.dataset;if(this.data.statusIndex&&state!=='unearned'){this.setData({fieldError:'先登记为已拥有，再记录满经验或已领取'});return}this.setData({tokenRewards:this.data.tokenRewards.map(r=>Object.assign({},r,r.id===id?{state}:{})),fieldError:''}) },
    acquisition(e) { if(this.data.saving)return;this.setData({tokenAcquisition:e.currentTarget.dataset.value,unlockPathId:e.currentTarget.dataset.value==='token'?this.data.unlockPathId:'',fieldError:''}) },
    unlockPath(e) { if(!this.data.saving)this.setData({unlockPathId:e.currentTarget.dataset.id}) },
    cancel() { if(!this.data.saving){updates.release(this);this.triggerEvent('cancel')} },
    manage() { updates.release(this);this.triggerEvent('cancel'); navigation.visit('pages/aw-fleet/index',{tab:'players'}) },
    async save() {
      if(this.data.saving)return
      this.setData({fieldError:'',syncError:''})
      try {
        const m = this.data.members[this.data.playerIndex]; if (!m || m.id !== store.currentMember() || !m.active) throw new Error('请先建立自己的成员档')
        if(!store.canEdit(m.id))throw new Error('请先关联自己的 AW-M 成员码')
        const roles = this.data.rows.filter(r => r.index > 0).map(r => ({ roleId: r.id, level: ['','primary','backup','transition'][r.index], targetIds: r.targets.filter(t => t.checked).map(t => t.id) }))
        const next = fleet.clone(store.load()), previous = fleet.getAsset(next,m.id,this.properties.vehicleId), editable = store.canEdit(m.id), previousExplicit = previous && previous.explicit
        fleet.saveAsset(next,m.id,this.properties.vehicleId,editable ? (this.data.statusIndex ? 'planned' : 'owned') : (previous && previous.status || 'planned'),editable ? this.data.note.trim() : (previous && previous.note || ''),roles)
        if (!editable) fleet.getAsset(next,m.id,this.properties.vehicleId).explicit = previous ? previousExplicit : false
        const asset=fleet.getAsset(next,m.id,this.properties.vehicleId)
        this.data.tokenRewards.forEach(r=>{if(r.state!=='unknown')tokenPlan.setReward(asset,r.id,r.state)})
        if(this.data.tokenAcquisition==='token'&&!this.data.unlockPathId)throw new Error('请选择实际消耗 Token 的解锁路线')
        tokenPlan.setUnlock(asset,this.data.tokenAcquisition,this.data.unlockPathId)
        this.setData({saving:true});await store.saveAndSync(next)
        store.setCurrentMember(m.id); updates.release(this);this.triggerEvent('saved'); wx.showToast({ title: store.syncInfo().ready?'已保存并同步':'已保存本地', icon: 'success' })
      } catch (e) { this.setData({fieldError:e.localSaved?'':e.message,syncError:e.localSaved?'已保存本地，同步未完成：'+e.message:''}) }
      finally{this.setData({saving:false})}
    }
  }
})
