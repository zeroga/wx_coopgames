const catalog = require('../../utils/aw/catalog')
const fleet = require('../../utils/aw/fleet')
const store = require('../../utils/aw/store')
Page({
  data: { id: '', vehicle: null, configIndex: 0, team: [], extra: 0, showTeam: false, showMore: false, showBasis: false, expandedWeapons: {}, editor: false, editMemberId: '' },
  onLoad(o) { this.setData({ id: o.id || '' }); this.refresh() },
  onShow() { this.refresh() },
  refresh() {
    if (!this.data.id) return
    const v = catalog.detail(this.data.id)
    if (!v) { this.setData({ vehicle: null }); return }
    const all = fleet.summary(store.load(), v.id), current = store.currentMember()
    all.sort((a,b)=>(b.memberId===current?1:0)-(a.memberId===current?1:0))
    this.setData({ vehicle:v, team:this.data.showTeam?all:all.slice(0,2), extra:this.data.showTeam?0:Math.max(0,all.length-2) })
    wx.setNavigationBarTitle({title:v.displayName})
  },
  config(e) { this.setData({ configIndex:Number(e.currentTarget.dataset.index) }) },
  more() { this.setData({showMore:!this.data.showMore}) },
  basis() { this.setData({showBasis:!this.data.showBasis}) },
  allTeam() { this.setData({showTeam:!this.data.showTeam});this.refresh() },
  weapon(e) { const id=e.currentTarget.dataset.id;this.setData({['expandedWeapons.'+id]:!this.data.expandedWeapons[id]}) },
  edit(e) { this.setData({ editor:true, editMemberId:e.currentTarget.dataset.member || '' }) },
  cancel() { this.setData({editor:false}) },
  saved() { this.setData({editor:false});this.refresh() },
  fleet(e) { const m=e.currentTarget.dataset.member || store.currentMember();wx.navigateTo({url:'/pages/aw-fleet/index?tab='+ (e.currentTarget.dataset.plan?'plans':'players') + '&member='+encodeURIComponent(m)+'&target='+encodeURIComponent(e.currentTarget.dataset.target||'')}) },
  tree() { wx.navigateTo({url:'/pages/aw-tree/index?id='+this.data.id}) },
  related(e) { wx.navigateTo({url:'/pages/aw-vehicle/index?id='+e.currentTarget.dataset.id}) },
  source(e) { if(e.currentTarget.dataset.url) wx.setClipboardData({data:e.currentTarget.dataset.url}) }
})
