const catalog = require('../../utils/aw/catalog')
const store = require('../../utils/aw/store')
function fresh() { return { query: '', tiers: [], classes: [], dealers: [], capabilities: [], ammoTypes: [], ammoTraits: [], acquisition: [], factory: false, penetration: '', speed: '', view: '', camo: '', premium: '', researchable: '' } }
Page({
  data: { filters: fresh(), results: [], selected: [], filterTab: '', filterTabs: [{key:'base',name:'等级 / 车型'},{key:'cap',name:'能力'},{key:'ammo',name:'武器 / 弹药'},{key:'perf',name:'性能'},{key:'get',name:'获取方式'}], limit: 30, count: 0, loading: false, error: '', source: '', booleanOptions: ['不限', '是', '否'], premiumIndex: 0, researchIndex: 0 },
  onLoad() { this.options(); this.refresh() },
  onShow() { this.refresh() },
  options() {
    const caps = catalog.tables.capabilities.map(c => ({ value: c.code, name: c.name_zh, group: ['armor','defense'].includes(c.category) ? '防护' : ['recon','infantry'].includes(c.category) ? '侦察 / 支援' : c.category === 'weapon' ? '武器能力' : '车辆特性' }))
    this.setData({ groups: [
      { key: 'tiers', name: '等级', options: Array.from({length:10}, (_,i) => ({value:String(i+1),name:'T'+(i+1)})).concat({value:'legendary',name:'传奇'}) },
      { key: 'classes', name: '车型', options: ['MBT','LT','AFV','TD','SPG'].map(x => ({value:x,name:x})) },
      { key: 'dealers', name: '经销商', options: catalog.tables.dealers.map(x => ({value:x.id,name:x.name})) }
    ], capabilityGroups: ['防护','侦察 / 支援','车辆特性','武器能力'].map(name => ({ name, options: caps.filter(c => c.group === name) })),
    ammoTypes: ['ap','apfsds','apds','apcr','heat','he','hesh','atgm'].map(x=>({value:x,name:x.toUpperCase()})),
    ammoTraits: catalog.tables.ammo_traits.map(x => ({value:x.code,name:x.name_zh})).concat([{value:'self_guided',name:'自导'},{value:'fire_and_forget',name:'射后不理'}]),
    acquisitions: ['progression','premium','event','special','other'].map(x=>({value:x,name:catalog.label(x)})) })
  },
  refresh() {
    const f = this.data.filters, s = store.load(), all = catalog.filter(f)
    const choices = {}; this.data.groups && this.data.groups.forEach(g=>g.options.forEach(o=>{choices[g.key+':'+o.value]=o.name}))
    ;(this.data.capabilityGroups||[]).forEach(g=>g.options.forEach(o=>{choices['capabilities:'+o.value]=o.name}))
    ;['ammoTypes','ammoTraits'].forEach(key=>(this.data[key]||[]).forEach(o=>{choices[key+':'+o.value]=o.name}))
    ;(this.data.acquisitions||[]).forEach(o=>{choices['acquisition:'+o.value]=o.name})
    const selected = []; if(f.factory)selected.push({key:'factory',value:true,name:'出厂能力'})
    ;['tiers','classes','dealers','capabilities','ammoTypes','ammoTraits','acquisition'].forEach(key=>f[key].forEach(value=>selected.push({key,value,name:choices[key+':'+value]||value})))
    ;[['penetration','穿深'],['speed','速度'],['view','视野'],['camo','隐蔽']].forEach(([key,name])=>{if(f[key] !== '') selected.push({key,value:f[key],name:name+' ≥ '+f[key]})})
    ;[['premium','高级车'],['researchable','当前可研发']].forEach(([key,name])=>{if(f[key]) selected.push({key,value:f[key],name:name+'：'+(f[key]==='yes'?'是':'否')})})
    const selection = {}; selected.forEach(x=>{selection[x.key+':'+x.value]=true})
    this.setData({ count: all.length, selected, selection, results: all.slice(0,this.data.limit).map(v=>{
      const c = catalog.card(v,f), summaries = s.members.length ? fleetSummary(s,v.id) : []
      return Object.assign(c,{ team: summaries.slice(0,2), extra: Math.max(0,summaries.length-2) })
    }), source: '资料时间：'+catalog.checkedAt.slice(0,10) })
  },
  input(e) { const key=e.currentTarget.dataset.key; this.setData({ ['filters.'+key]:e.detail.value, limit:30 }); this.refresh() },
  toggle(e) { const {key,value}=e.currentTarget.dataset, values=this.data.filters[key].slice(), i=values.indexOf(value); if(i>=0) values.splice(i,1); else values.push(value); this.setData({['filters.'+key]:values,limit:30});this.refresh() },
  remove(e) { const {key,value}=e.currentTarget.dataset; if(Array.isArray(this.data.filters[key])) this.toggle(e); else {this.setData({['filters.'+key]:key==='factory'?false:'', premiumIndex:key==='premium'?0:this.data.premiumIndex,researchIndex:key==='researchable'?0:this.data.researchIndex});this.refresh()} },
  clear() { this.setData({filters:fresh(),premiumIndex:0,researchIndex:0,limit:30}); this.refresh() },
  factory(e) { this.setData({'filters.factory':e.detail.value});this.refresh() },
  bool(e) { const key=e.currentTarget.dataset.key,i=Number(e.detail.value);this.setData({['filters.'+key]:['','yes','no'][i],[key==='premium'?'premiumIndex':'researchIndex']:i});this.refresh() },
  showFilters(e) { const tab=e.currentTarget.dataset.tab;this.setData({filterTab:this.data.filterTab===tab?'':tab}) },
  switchFilters(e) { this.setData({filterTab:e.currentTarget.dataset.tab}) },
  closeFilters() { this.setData({filterTab:''}) },
  open(e) { wx.navigateTo({url:'/pages/aw-vehicle/index?id='+e.currentTarget.dataset.id}) },
  nav(e) { wx.navigateTo({url:'/pages/aw-'+e.currentTarget.dataset.page+'/index'}) },
  onReachBottom() { this.setData({limit:this.data.limit+30});this.refresh() },
  async refreshCloud() { this.setData({loading:true,error:''});try{await store.loadCatalog();this.options();this.refresh()}catch(e){this.setData({error:'刷新失败，已保留随包资料：'+e.message})}finally{this.setData({loading:false})} }
})
function fleetSummary(s,id) { return require('../../utils/aw/fleet').summary(s,id) }
