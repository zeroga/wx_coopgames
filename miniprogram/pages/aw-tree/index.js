const navigation = require('../../utils/aw/navigation')
const catalog = require('../../utils/aw/catalog')
const fleet = require('../../utils/aw/fleet')
const store = require('../../utils/aw/store')
Page({
  data:{ id:'', query:'', vehicle:null, candidates:[], paths:[], related:[] },
  onLoad(o){this.setData({id:o.id||''});this.refresh()},
  refresh(){
    const v=this.data.id && catalog.detail(this.data.id)
    this.setData({vehicle:v||null, paths:v?v.paths:[],related:v?v.related:[],candidates:catalog.filter({query:this.data.query}).slice(0,30).map(x=>catalog.card(x))})
    if(v){const m=store.currentMember(),s=store.load();this.setData({route:m?fleet.resolveRoute(s,m,v.id):null})}
  },
  search(e){this.setData({query:e.detail.value});this.refresh()},
  select(e){this.setData({id:e.currentTarget.dataset.id});this.refresh()},
  detail(){navigation.visit('pages/aw-vehicle/index',{id:this.data.id})},
  receiveNavigation(o){this.setData({id:o.id||this.data.id});this.refresh()}
})
