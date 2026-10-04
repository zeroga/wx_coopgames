const catalog = require('../../utils/aw/catalog')
const fleet = require('../../utils/aw/fleet')
const store = require('../../utils/aw/store')
const updates = require('../../utils/aw/catalog-update')
Component({
  properties:{vehicleId:String,memberId:String},
  data:{draft:null,stage:'known',query:'',limit:30,options:[],candidates:[],customNames:[],providers:[],saving:false,error:'',syncError:'',editable:false,keyboardHeight:0,contentHeight:380},
  lifetimes:{attached(){this.prepare()},detached(){updates.release(this)}},
  methods:{
    prepare(){
      updates.hold(this)
      const memberId=this.properties.memberId||store.currentMember(),s=store.load()
      this.memberId=memberId
      this.setData({draft:fleet.clone(fleet.prerequisiteConfig(s,memberId,this.properties.vehicleId)),editable:store.canEdit(memberId),name:(catalog.byId[this.properties.vehicleId]||{}).displayName||(catalog.byId[this.properties.vehicleId]||{}).name||'',options:fleet.prerequisiteOptions(this.properties.vehicleId)})
      this.keyboard({detail:{height:0}});this.refresh()
    },
    refresh(){
      const d=this.data.draft,option=this.data.options.find(p=>p.id===d.pathId)||(this.data.options.length===1?this.data.options[0]:null),all=this.data.stage==='custom'?catalog.filter({query:this.data.query}).filter(v=>v.id!==this.properties.vehicleId):[]
      this.setData({customNames:d.customVehicleIds.map(id=>({id,name:(catalog.byId[id]||{}).displayName||(catalog.byId[id]||{}).name||id})),candidates:all.slice(0,this.data.limit).map(v=>({id:v.id,name:v.displayName||v.name,tier:v.tier,selected:d.customVehicleIds.includes(v.id)})),count:all.length,providers:option?option.providers.map(r=>Object.assign({},r,{selected:d.mode!=='ignore'&&d.tokenSourceVehicleIds.includes(r.vehicleId)})):[]})
    },
    ignore(){if(this.data.saving||!this.data.editable)return;this.setData({draft:{mode:'ignore',pathId:'',customVehicleIds:[],tokenSourceVehicleIds:[]},error:''});this.refresh()},
    known(e){if(this.data.saving||!this.data.editable)return;const id=e.currentTarget.dataset.id;this.setData({draft:{mode:'known',pathId:id,customVehicleIds:[],tokenSourceVehicleIds:this.data.draft.pathId===id?this.data.draft.tokenSourceVehicleIds:[]},error:''});this.refresh()},
    provider(e){if(this.data.saving||!this.data.editable)return;const d=fleet.clone(this.data.draft),id=e.currentTarget.dataset.id;if(d.mode==='ignore'&&this.data.options.length===1){d.mode='known';d.pathId=this.data.options[0].id}d.tokenSourceVehicleIds=d.tokenSourceVehicleIds.includes(id)?d.tokenSourceVehicleIds.filter(x=>x!==id):d.tokenSourceVehicleIds.concat(id);this.setData({draft:d,error:''});this.refresh()},
    custom(){if(this.data.saving||!this.data.editable)return;this.setData({stage:'custom',query:'',limit:30,error:''});this.refresh()},
    back(){if(!this.data.saving){this.setData({stage:'known',keyboardHeight:0});this.keyboard({detail:{height:0}});this.refresh()}},
    search(e){this.setData({query:e.detail.value,limit:30});this.refresh()},
    more(){this.setData({limit:this.data.limit+30});this.refresh()},
    toggleCustom(e){if(this.data.saving||!this.data.editable)return;const d=fleet.clone(this.data.draft),id=e.currentTarget.dataset.id;d.mode='custom';if(!d.pathId&&this.data.options.length===1)d.pathId=this.data.options[0].id;d.customVehicleIds=d.customVehicleIds.includes(id)?d.customVehicleIds.filter(x=>x!==id):d.customVehicleIds.concat(id);this.setData({draft:d,error:''});this.refresh()},
    keyboard(e){const h=Number(e.detail.height)||0,win=wx.getWindowInfo?wx.getWindowInfo().windowHeight:680;this.setData({keyboardHeight:h,contentHeight:Math.max(100,Math.min(win*.64,win-h-220))})},
    cancel(){if(!this.data.saving){updates.release(this);this.triggerEvent('cancel')}},
    async save(){
      if(this.data.saving||!this.data.editable)return
      this.setData({saving:true,error:'',syncError:''})
      try{
        if(!store.canEdit(this.memberId))throw new Error('只能修改自己的前置配置')
        const next=fleet.clone(store.load());fleet.setPrerequisites(next,this.memberId,this.properties.vehicleId,this.data.draft)
        await store.saveAndSync(next);updates.release(this);this.triggerEvent('saved');wx.showToast({title:'前置配置已保存',icon:'success'})
      }catch(e){if(e.localSaved)this.setData({syncError:'已保存本地，同步未完成：'+e.message});else this.setData({error:e.message})}
      finally{this.setData({saving:false})}
    }
  }
})
