const catalog = require('../../utils/aw/catalog')
// Shared presentation only: class/tier come from the installed catalog.
const classes = { MBT:'主战坦克', LT:'轻型坦克', TD:'坦克歼击车', AFV:'装甲战斗车', SPG:'自行火炮' }
Component({
  options:{virtualHost:true},
  properties:{ vehicleId:String, name:String, variant:String, catalogRevision:Number, tags:{type:Array,value:[]}, markers:{type:Array,value:[]} },
  data:{ displayName:'', classCode:'', className:'', tierText:'', metaText:'', visibleTags:[], hiddenTags:0 },
  observers:{ 'vehicleId, name, catalogRevision, tags, markers'(){this.refresh()} },
  lifetimes:{ attached(){this.refresh()}, ready(){this.measureTags()} },
  pageLifetimes:{ show(){this.refresh()} },
  methods:{
    refresh(){
      const v=catalog.byId[this.properties.vehicleId]||{}, code=v.vehicle_class||'', type=classes[code]||'车型未记录'
      const dealer=(catalog.byId[v.dealer_id]||{}).name||''
      const tags=this.properties.tags||[]
      this.setData({displayName:v.name_zh||v.name||this.properties.name||'车辆资料缺失',classCode:code||'—',className:type,tierText:v.is_legendary?'传奇':catalog.present(v.tier)?'T'+v.tier:'T—',metaText:[v.nation,dealer].filter(Boolean).join(' · '),visibleTags:[],hiddenTags:tags.length})
      if(tags.length && typeof wx!=='undefined' && wx.nextTick)wx.nextTick(()=>this.measureTags())
    },
    measureTags(){
      if(!this.createSelectorQuery)return
      const tags=this.properties.tags||[],query=this.createSelectorQuery()
      query.select('.vehicle-tags').boundingClientRect()
      query.selectAll('.vehicle-tag-probe').boundingClientRect()
      query.exec(rects=>{
        const row=rects&&rects[0],chips=rects&&rects[1]
        if(!row||!chips||chips.length!==tags.length)return
        const gap=4,overflow=20
        let used=0,count=0
        for(let i=0;i<chips.length;i++){
          const remaining=tags.length-i-1,reserve=remaining?overflow+gap:0,next=used+(i?gap:0)+chips[i].width
          if(next+reserve>row.width)break
          used=next;count++
        }
        this.setData({visibleTags:tags.slice(0,count),hiddenTags:tags.length-count})
      })
    }
  }
})
