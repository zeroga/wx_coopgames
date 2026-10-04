const navigation = require('../../utils/aw/navigation')
const catalog = require('../../utils/aw/catalog')
const fleet = require('../../utils/aw/fleet')
const store = require('../../utils/aw/store')
const updates = require('../../utils/aw/catalog-update')
Page({
  data:{id:'',query:'',vehicle:null,candidates:[],paths:[],related:[],limit:30,count:0,historyCount:0},
  onLoad(o){updates.init();this.history=[];this.scrollTop=0;this.setData({id:o.id||''});this.refresh()},
  async onShow(){try{await updates.check(false)}catch(_){}this.refresh()},
  onPageScroll(e){this.scrollTop=e.scrollTop},
  refresh(){
    const v=this.data.id&&catalog.detail(this.data.id),all=catalog.filter({query:this.data.query})
    this.setData({vehicle:v||null,paths:v?v.paths:[],related:v?v.related:[],count:all.length,candidates:all.slice(0,this.data.limit).map(x=>catalog.card(x)),historyCount:(this.history||[]).length,route:v?fleet.resolveRoute(store.load(),store.currentMember(),v.id):null})
  },
  search(e){this.setData({query:e.detail.value,limit:30});this.refresh()},
  select(e){this.visit(e.currentTarget.dataset.id)},
  visit(id){if(!id||id===this.data.id)return;(this.history||(this.history=[])).push({id:this.data.id,query:this.data.query,limit:this.data.limit,scrollTop:this.scrollTop||0});this.setData({id});this.scrollTop=0;this.refresh();wx.pageScrollTo({scrollTop:0,duration:0})},
  back(){const old=(this.history||[]).pop();if(!old)return;this.scrollTop=old.scrollTop;this.setData({id:old.id,query:old.query,limit:old.limit});this.refresh();wx.pageScrollTo({scrollTop:old.scrollTop,duration:0})},
  loadMore(){this.setData({limit:this.data.limit+30});this.refresh()},
  onReachBottom(){if(this.data.count>this.data.candidates.length)this.loadMore()},
  detail(){navigation.visit('pages/aw-vehicle/index',{id:this.data.id})},
  receiveNavigation(o){this.visit(o.id||this.data.id)}
})
