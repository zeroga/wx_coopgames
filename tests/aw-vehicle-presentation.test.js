const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const presentation=require('../miniprogram/utils/aw/vehicle-presentation')
const catalog=require('../miniprogram/utils/aw/catalog')
function label(properties){
  let def;global.Component=d=>{def=d}
  const file='../miniprogram/components/aw-vehicle-label/index';delete require.cache[require.resolve(file)];require(file)
  const events=[],p=Object.assign({},def.methods,{properties:Object.assign({vehicleId:catalog.tables.vehicles[0].id,tags:[],markers:[],plans:[],planMode:'none'},properties),data:JSON.parse(JSON.stringify(def.data)),setData(update,cb){Object.assign(this.data,update);if(cb)cb()},triggerEvent(name,detail){events.push({name,detail})}})
  p.events=events;return p
}
const state={members:[{id:'A',order:0},{id:'B',order:1},{id:'C',order:2}]}
const plans=[{id:'one',memberId:'A',memberName:'玩家甲',status:'owned',statusText:'已拥有',roleText:'抗线·主力',roles:[{id:'r1',roleId:'tank',name:'抗线',level:'primary',source:'manual'},{id:'r2',roleId:'scout',name:'侦察',level:'primary',source:'manual'},{id:'r3',roleId:'support',name:'支援',level:'backup',source:'manual'}]}, {id:'two',memberId:'B',memberName:'玩家乙',status:'planned',statusText:'计划',needsPrerequisite:true,roleText:'抗线·备选',roles:[{id:'r4',roleId:'tank',name:'抗线',level:'backup',source:'manual'}]}, {id:'three',memberId:'C',memberName:'玩家丙',status:'planned',statusText:'计划',needsPrerequisite:true,roleText:'暂无车队职责',roles:[]}]
test('name slot follows container width bands, not class, name, markers or display mode',()=>{
  for(const unit of [.4267,.5,.56,1])for(const width of [450,500,560,620,740,1000]){
    const detail=presentation.layout(width*unit,unit,'details'),summary=presentation.layout(width*unit,unit,'summary')
    assert.equal(detail.mainWidthRpx,summary.mainWidthRpx)
    assert(detail.mainWidthRpx+256<=width+.01)
  }
  assert.equal(presentation.layout(310,.5,'auto').mainWidthRpx,320)
  assert.equal(presentation.layout(300,.5,'auto').mainWidthRpx,320)
  assert.equal(presentation.layout(279,.5,'auto').mode,'summary')
  assert.equal(presentation.layout(280,.5,'auto').mode,'details')
})
test('markers include owned duties, deduplicate same-player levels and retain all role names without mutation',()=>{
  const before=JSON.stringify(plans),markers=presentation.markers(state,plans)
  assert.equal(markers.length,3)
  assert.equal(markers[0].memberId,'A');assert.equal(markers[0].label,'主力');assert.equal(markers[0].roleName,'抗线、侦察')
  assert.equal(markers[1].label,'备选');assert.equal(markers[2].memberId,'B')
  assert.equal(JSON.stringify(plans),before)
  const automatic={...plans[0],roles:[{name:'过渡',level:'transition',source:'tech_tree'}]}
  assert.equal(presentation.markers(state,[automatic]).length,0)
})
test('group summaries remain scoped to role and level, with no duplicate player records',()=>{
  const subset=presentation.scopeSummaries([plans[0],plans[0],plans[1]],{roleId:'tank',level:'primary'})
  assert.equal(subset.length,2);assert.equal(subset[0].roleText,'抗线·主力');assert.equal(subset[0].roles.length,1)
  assert(!subset[0].roleText.includes('侦察'))
  const scoped={...plans[0],planTargetId:'r3',planText:'备选目标路线进度'}
  assert.equal(presentation.scopeSummaries([scoped],{roleId:'tank',level:'primary'})[0].planText,'')
  assert.equal(presentation.scopeSummaries([scoped],{roleId:'support',level:'backup'})[0].planText,scoped.planText)
})
test('compact summary counts distinct hidden players, including those without a manual duty',()=>{
  const p=label({plans,markers:presentation.markers(state,plans),planMode:'summary'});p.refresh()
  assert.equal(p.data.planMemberCount,3)
  assert.equal(p.data.visibleMarkers.length,2) // A's two levels remain together.
  assert.equal(p.data.hiddenMembers,2)
  const single={...plans[0],roles:plans[0].roles.slice(0,2)},q=label({plans:[single,plans[1],plans[2]],markers:presentation.markers(state,[single,plans[1],plans[2]]),planMode:'summary'});q.refresh()
  assert.equal(q.data.visibleMarkers.length,2);assert.equal(q.data.hiddenMembers,1)
  assert.equal(presentation.markerPreview(p.properties.markers,1).visibleMarkers.length,0)
})
test('actual-container resize changes planning mode while name width ignores marker count',()=>{
  const p=label({plans,markers:presentation.markers(state,plans),planMode:'auto'});p.refresh();let width=310
  p.createSelectorQuery=()=>({select(){return this},boundingClientRect(){return this},exec(fn){fn([{width},{width:42}])}})
  p.measureTags=()=>{};p.measureLayout();assert.equal(p.data.resolvedPlanMode,'details');const nameWidth=p.data.mainWidthRpx
  p.properties.markers=[];p.refresh();p.measureLayout();assert.equal(p.data.mainWidthRpx,nameWidth)
  width=240;p.measureLayout();assert.equal(p.data.resolvedPlanMode,'summary')
  width=310;p.measureLayout();assert.equal(p.data.resolvedPlanMode,'details')
  assert.deepEqual(p.events.filter(e=>e.name==='planlayout').map(e=>e.detail.mode),['details','summary','details'])
})
test('summary sheet preserves every player and dispatches configuration to the selected identity',()=>{
  const p=label({plans,markers:presentation.markers(state,plans),planMode:'summary'});p.refresh();const before=JSON.stringify(plans)
  p.showPlans();assert.equal(p.data.planSheet,true);p.closePlans();assert.equal(p.data.planSheet,false)
  p.showPrerequisites();assert.equal(p.data.planSheet,true)
  p.configurePlan({currentTarget:{dataset:{member:'C'}}})
  assert.equal(p.data.planSheet,false);assert.equal(p.events.at(-1).detail.memberId,'C');assert.equal(JSON.stringify(plans),before)
  p.properties.plans=[plans[1]];p.showPrerequisites();assert.equal(p.events.at(-1).detail.memberId,'B')
})
test('disclosure actions expose full long vehicle name and all hidden tags',()=>{
  const calls=[];global.wx={showModal:r=>calls.push(r)}
  try{const p=label({vehicleId:'historical',name:'完整历史车辆名称 · 不截断',tags:['ERA','烟幕','攻顶']});p.refresh();p.showIdentity();p.showTags();assert(calls[0].content.includes(p.properties.name));assert.equal(calls[1].content,'ERA、烟幕、攻顶')}
  finally{delete global.wx}
})
test('catalog detail overflow opens the same complete scrollable planning sheet',()=>{
  let page;global.Page=d=>{page=d}
  const file='../miniprogram/pages/aw-catalog/index';delete require.cache[require.resolve(file)];require(file)
  const p=label({plans});p.refresh();let selector
  page.selectComponent=id=>{selector=id;return p}
  page.showAllPlans({currentTarget:{dataset:{id:'vehicle-123'}}})
  assert.equal(selector,'#vehicle-label-vehicle-123');assert.equal(p.data.planSheet,true)
  assert.equal(p.properties.plans.length,plans.length)
})
test('planning detail and markers are mutually exclusive, and every shared-label handler resolves',()=>{
  const root=path.join(__dirname,'../miniprogram'),markup=fs.readFileSync(path.join(root,'components/aw-vehicle-label/index.wxml'),'utf8')
  const expr=markup.match(/wx:if="{{(resolvedPlanMode[^"\n]+)}}"/)[1]
  for(const mode of ['details','none'])assert.equal(!!vm.runInNewContext(expr,{resolvedPlanMode:mode,markers:[{}],planMemberCount:3}),false)
  assert.equal(!!vm.runInNewContext(expr,{resolvedPlanMode:'summary',markers:[{}],planMemberCount:3}),true)
  const p=label({});for(const binding of markup.matchAll(/(?:bind|catch)(?::)?tap="([A-Za-z]+)"/g))assert.equal(typeof p[binding[1]],'function',binding[1])
  for(const name of ['aw-catalog','aw-fleet']){
    const m=fs.readFileSync(path.join(root,'pages',name,'index.wxml'),'utf8');assert(m.includes("!== 'summary'"));assert(m.includes('plan-mode="auto"'));assert(m.includes('bind:configure="configurePrerequisites"'))
  }
})
test('member marker foreground meets normal-text contrast for the current identity palette',()=>{
  function lum(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]}
  for(const color of presentation.colors){const fg=presentation.markerForeground(color),a=lum(color),b=fg==='#fff'?1:lum(fg);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,color)}
})
