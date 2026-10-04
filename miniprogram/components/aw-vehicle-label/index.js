const catalog = require('../../utils/aw/catalog')
// Shared presentation only: class/tier come from the installed catalog.
const classes = { MBT:['mbt','主战坦克'], LT:['lt','轻型坦克'], TD:['td','坦克歼击车'], AFV:['afv','装甲战斗车'], SPG:['spg','自行火炮'] }
Component({
  options:{virtualHost:true},
  properties:{ vehicleId:String, name:String, variant:String, catalogRevision:Number },
  data:{ displayName:'', classCode:'', className:'', shape:'', tierText:'' },
  observers:{ 'vehicleId, name, catalogRevision'(){this.refresh()} },
  lifetimes:{ attached(){this.refresh()} },
  pageLifetimes:{ show(){this.refresh()} },
  methods:{
    refresh(){
      const v=catalog.byId[this.properties.vehicleId]||{}, code=v.vehicle_class||'', type=classes[code]||['unknown', '车型未记录']
      this.setData({displayName:v.name_zh||v.name||this.properties.name||'车辆资料缺失',classCode:code||'—',className:type[1],shape:type[0],tierText:v.is_legendary?'传奇':catalog.present(v.tier)?'T'+v.tier:'T—'})
    }
  }
})
