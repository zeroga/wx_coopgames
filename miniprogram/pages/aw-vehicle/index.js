const catalog = require('../../utils/aw/catalog')
const fleet = require('../../utils/aw/fleet')
const store = require('../../utils/aw/store')
const navigation = require('../../utils/aw/navigation')
const updates = require('../../utils/aw/catalog-update')
Page({
  data: { prerequisiteForm:null, syncError:'', id: '', vehicle: null, team: [], extra: 0, showTeam: false, showMore: false, showBasis: false, sections: { performance:true, weapons:false, abilities:false, upgrades:false, acquisition:false, armor:false, sources:false }, expandedAmmo: {}, editor: false, editMemberId: '', currentId:'' },
  configurePrerequisites(e){const d=e.currentTarget.dataset;this.setData({prerequisiteForm:{vehicleId:d.vehicle||d.id||this.data.id,memberId:d.member||store.currentMember()}})},
  closePrerequisites(){this.setData({prerequisiteForm:null});this.refresh()},
  prerequisitesSaved(){this.closePrerequisites()},
  onLoad(o) { updates.init();this.setData({ id: o.id || '' }); this.refresh() },
  async onShow() { if(this.data.editor||this.data.prerequisiteForm)return;this.refresh();await Promise.all([updates.check(false).catch(()=>{}),(async()=>{try{await store.refreshIfClean();this.setData({syncError:''})}catch(e){this.setData({syncError:'未能读取车队最新信息：'+e.message})}})()]);this.refresh() },
  refresh() {
    if (!this.data.id) return
    const v = catalog.detail(this.data.id)
    if (!v) { this.setData({ vehicle: null }); return }
    const all = fleet.summary(store.load(), v.id), current = store.currentMember()
    all.sort((a,b)=>(b.memberId===current?1:0)-(a.memberId===current?1:0))
    this.setData({ vehicle:v, prerequisite:fleet.prerequisiteStatus(store.load(),current,v.id), currentId:current, team:this.data.showTeam?all:all.slice(0,2), extra:this.data.showTeam?0:Math.max(0,all.length-2) })
    wx.setNavigationBarTitle({title:v.displayName})
  },
  section(e) { const key=e.currentTarget.dataset.section;if(Object.prototype.hasOwnProperty.call(this.data.sections,key))this.setData({['sections.'+key]:!this.data.sections[key]}) },
  receiveNavigation(o) { this.setData({id:o.id||this.data.id,expandedAmmo:{}});this.refresh() },
  more() { this.setData({showMore:!this.data.showMore}) },
  basis() { this.setData({showBasis:!this.data.showBasis}) },
  allTeam() { this.setData({showTeam:!this.data.showTeam});this.refresh() },
  ammo(e) { const id=e.currentTarget.dataset.id;this.setData({['expandedAmmo.'+id]:!this.data.expandedAmmo[id]}) },
  edit() { this.setData({ editor:true, editMemberId:store.currentMember() }) },
  cancel() { this.setData({editor:false});this.refresh() },
  saved() { this.setData({editor:false});this.refresh() },
  fleet(e) { const m=e.currentTarget.dataset.member || store.currentMember();navigation.visit('pages/aw-fleet/index',{tab:e.currentTarget.dataset.plan?'plans':'players',member:m,target:e.currentTarget.dataset.target||''}) },
  tree() { navigation.visit('pages/aw-tree/index',{id:this.data.id}) },
  related(e) { navigation.visit('pages/aw-vehicle/index',{id:e.currentTarget.dataset.id}) },
  source(e) { if(e.currentTarget.dataset.url) wx.setClipboardData({data:e.currentTarget.dataset.url}) }
})
