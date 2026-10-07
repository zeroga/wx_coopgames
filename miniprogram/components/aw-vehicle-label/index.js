const catalog = require('../../utils/aw/catalog')
const presentation = require('../../utils/aw/vehicle-presentation')
const classes = { MBT:'主战坦克', LT:'轻型坦克', TD:'坦克歼击车', AFV:'装甲战斗车', SPG:'自行火炮' }
Component({
  options:{virtualHost:true},
  properties:{ vehicleId:String, name:String, variant:String, catalogRevision:Number, tags:{type:Array,value:[]}, markers:{type:Array,value:[]}, plans:{type:Array,value:[]}, planMode:{type:String,value:'none'} },
  data:{ displayName:'', classCode:'', className:'', tierText:'', metaText:'', tagRows:[{id:'first',tags:[]},{id:'second',tags:[]}], hiddenTags:0, mainWidthRpx:0, resolvedPlanMode:'none', visibleMarkers:[], hiddenMembers:0, planMemberCount:0, needsPrerequisite:false,planSheet:false },
  observers:{ 'vehicleId, name, catalogRevision, tags, markers'(){this.refresh()}, 'plans, planMode'(){this.refresh()} },
  lifetimes:{ attached(){this.refresh()}, ready(){this.measureLayout()}, detached(){this._detached=true} },
  pageLifetimes:{ show(){this.refresh()}, resize(){this.measureLayout()} },
  methods:{
    refresh(){
      const v=catalog.byId[this.properties.vehicleId]||{}, code=v.vehicle_class||'', type=classes[code]||code||'车型未记录'
      const dealer=(catalog.byId[v.dealer_id]||{}).name||''
      const tags=this.properties.tags||[],plans=this.properties.plans||[],markers=this.properties.markers||[]
      const preview=presentation.markerPreview(markers,2)
      if(markers.length&&plans.length)preview.hiddenMembers=new Set(plans.map(p=>p.memberId)).size-new Set(preview.visibleMarkers.map(m=>m.memberId)).size
      const mode=this.properties.planMode==='auto'?(this.data.resolvedPlanMode==='summary'?'summary':'details'):this.properties.planMode||'none'
      this.setData(Object.assign({displayName:v.name_zh||v.name||this.properties.name||'车辆资料缺失',classCode:code||'—',className:type,tierText:v.is_legendary?'传奇':catalog.present(v.tier)?'T'+v.tier:'T—',metaText:[v.nation,dealer].filter(Boolean).join(' · '),tagRows:[{id:'first',tags:[]},{id:'second',tags:[]}],hiddenTags:tags.length,resolvedPlanMode:mode,planMemberCount:new Set(plans.map(p=>p.memberId)).size,needsPrerequisite:plans.some(p=>p.status==='planned'&&p.needsPrerequisite)},preview))
      if(typeof wx!=='undefined'&&wx.nextTick)wx.nextTick(()=>this.measureLayout())
    },
    measureLayout(){
      if(!this.createSelectorQuery||this._detached)return
      const query=this.createSelectorQuery()
      query.select('.vehicle-label').boundingClientRect();query.select('.vehicle-class').boundingClientRect()
      query.exec(rects=>{
        const row=rects&&rects[0],slot=rects&&rects[1]
        if(!row||!slot||!row.width||!slot.width||this._detached)return
        this._unit=slot.width/84
        const next=presentation.layout(row.width,this._unit,this.properties.planMode)
        this.setData({mainWidthRpx:next.mainWidthRpx,resolvedPlanMode:next.mode},()=>{if(typeof wx!=='undefined'&&wx.nextTick)wx.nextTick(()=>this.measureTags());else this.measureTags()})
        const reportKey=this.properties.vehicleId+':'+next.mode
        if(this._reportedMode!==reportKey){this._reportedMode=reportKey;this.triggerEvent('planlayout',{mode:next.mode,vehicleId:this.properties.vehicleId})}
      })
    },
    measureTags(){
      if(!this.createSelectorQuery||this._detached)return
      const tags=this.properties.tags||[],generation=(this._tagGeneration||0)+1;this._tagGeneration=generation
      const query=this.createSelectorQuery()
      query.select('.vehicle-tags').boundingClientRect();query.selectAll('.vehicle-tag-probe').boundingClientRect();query.select('.vehicle-overflow-probe').boundingClientRect()
      query.exec(rects=>{
        const row=rects&&rects[0],chips=rects&&rects[1],probe=rects&&rects[2]
        if(!row||!row.width||!chips||chips.length!==tags.length||this._detached||generation!==this._tagGeneration)return
        const gap=8*(this._unit||.5),overflow=probe&&probe.width||20
        const fit=presentation.tagPreview(chips.map(c=>c.width),row.width,gap,overflow)
        this.setData({tagRows:[{id:'first',tags:tags.slice(0,fit.firstCount)},{id:'second',tags:tags.slice(fit.firstCount,fit.visibleCount)}],hiddenTags:fit.hiddenCount})
      })
    },
    showIdentity(){wx.showModal({title:'车辆信息',content:[this.data.displayName,this.data.className+' · '+this.data.tierText,this.data.metaText].filter(Boolean).join('\n'),showCancel:false,confirmText:'关闭'})},
    closePlans(){this.setData({planSheet:false})},
    keepSheetOpen(){},
    configurePlan(e){const memberId=e.currentTarget.dataset.member;this.setData({planSheet:false});this.triggerEvent('configure',{vehicleId:this.properties.vehicleId,memberId})},
    showTags(){wx.showModal({title:this.data.displayName,content:(this.properties.tags||[]).join('、'),showCancel:false,confirmText:'关闭'})},
    showPlans(){
      const plans=this.properties.plans||[],markers=this.properties.markers||[]
      if(plans.length){this.setData({planSheet:true});return}
      const content=markers.map(m=>m.memberName+' · '+m.label+' · '+m.roleName).join('\n')
      wx.showModal({title:'车辆规划',content:content||'暂无车队规划',showCancel:false,confirmText:'关闭'})
    },
    showPrerequisites(){
      const plans=(this.properties.plans||[]).filter(p=>p.status==='planned'&&p.needsPrerequisite)
      const select=p=>this.triggerEvent('configure',{vehicleId:this.properties.vehicleId,memberId:p.memberId})
      if(plans.length===1)select(plans[0])
      else if(plans.length>1)this.setData({planSheet:true})
    }
  }
})
