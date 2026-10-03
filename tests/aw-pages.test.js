const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const memory = new Map(), messages=[]
global.wx={getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>memory.set(k,JSON.parse(JSON.stringify(v))),removeStorageSync:k=>memory.delete(k),showToast:r=>messages.push(r),showModal:r=>messages.push(r),setNavigationBarTitle(){},navigateTo(){},setClipboardData(){}}
function hydrate(def, component=false) {
  const p=Object.assign({},component?def.methods:def)
  p.data=JSON.parse(JSON.stringify(def.data));p.properties={vehicleId:'',memberId:''};p.setData=function(update,cb){for(const [key,v] of Object.entries(update)){const parts=key.split('.');let at=this.data;for(const field of parts.slice(0,-1)){if(!at[field])at[field]={};at=at[field]}at[parts[parts.length-1]]=v}if(cb)cb()};p.triggerEvent=()=>{};return p
}
function page(name){let def;global.Page=d=>{def=d};const script='../miniprogram/pages/'+name+'/index';delete require.cache[require.resolve(script)];require(script);return hydrate(def)}
function event(dataset,value){return {currentTarget:{dataset},detail:{value}}}
const c=require('../miniprogram/utils/aw/catalog'),s=require('../miniprogram/utils/aw/store')
test('create member and role, edit asset with two roles, cancel without mutation, reload every AW page',()=>{
  const p=page('aw-fleet');p.onLoad({});p.newMember();p.memberName(event({},'测试玩家'));p.saveMember()
  assert.equal(s.load().members.length,1)
  p.newRole();p.roleField(event({key:'name'},'抗线'));p.saveRole()
  p.newRole();p.roleField(event({key:'name'},'侦察'));p.saveRole()
  assert.equal(s.load().roles.length,2)
  const vid=c.tables.vehicles.find(v=>v.name==='Boxer RIWP').id
  let def;global.Component=d=>{def=d};require('../miniprogram/components/aw-asset-editor/index')
  const editor=hydrate(def,true);editor.properties={vehicleId:vid,memberId:p.data.memberId};editor.prepare()
  editor.pickStatus(event({},1));editor.pickLevel(event({index:0},1));editor.pickLevel(event({index:1},2));editor.note(event({},'测试备注'));editor.save()
  const asset=s.load().assets[Object.keys(s.load().assets)[0]];assert.equal(asset.status,'planned');assert.equal(asset.note,'测试备注')
  const before=s.exportText();editor.prepare();editor.note(event({},'不保存'));editor.cancel();assert.equal(s.exportText(),before)
  p.refresh();assert.equal(p.data.playerAssets[0].roles.length,2)
  p.renameMember();p.memberName(event({},'改名玩家'));p.saveMember();assert.equal(p.data.playerAssets[0].memberName,'改名玩家')
  const catalogPage=page('aw-catalog');catalogPage.onLoad();assert.equal(catalogPage.data.count,298)
  catalogPage.input(event({key:'query'},'Boxer'));assert(catalogPage.data.results.length>0)
  catalogPage.toggle(event({key:'classes',value:'AFV'}));assert(catalogPage.data.results.every(v=>v.vehicle_class==='AFV'))
  const vpage=page('aw-vehicle');vpage.onLoad({id:vid});assert.equal(vpage.data.vehicle.configs.length,5)
  vpage.weapon(event({id:vpage.data.vehicle.configs[0].weapons[0].id}));vpage.allTeam();assert.equal(vpage.data.team.length,1)
  const tree=page('aw-tree');tree.onLoad({id:vid});assert.equal(tree.data.vehicle.id,vid)
  p.setData({tab:'plans'});p.refresh();assert.equal(p.data.targets.length,2);assert.equal(p.data.plan.complete,false)
  assert.equal(messages.filter(r=>r.title==='操作未完成'||r.title==='无法保存').length,0)
})
test('all AW event bindings and referenced routes resolve',()=>{
  const dirs=['pages/aw-catalog','pages/aw-vehicle','pages/aw-tree','pages/aw-fleet','components/aw-asset-editor']
  for(const dir of dirs){const file=path.join(__dirname,'../miniprogram',dir,'index.wxml'),text=fs.readFileSync(file,'utf8');let def
    if(dir.startsWith('components'))global.Component=d=>{def=d};else global.Page=d=>{def=d}
    const script=path.join(path.dirname(file),'index.js');delete require.cache[require.resolve(script)];require(script)
    const methods=def.methods||def
    for(const m of text.matchAll(/\b(?:bind|catch)(?::)?(?:tap|input|blur|change|touchstart|touchmove|touchend|saved|cancel)="([A-Za-z]+)"/g))assert.equal(typeof methods[m[1]],'function',dir+' '+m[1])
  }
  const app=require('../miniprogram/app.json');for(const route of app.pages)assert(fs.existsSync(path.join(__dirname,'../miniprogram',route+'.wxml')))
})
test('WXML bindings use raw operators and pagination/plan conditions evaluate correctly',()=>{
  const vm=require('node:vm'),mini=path.join(__dirname,'../miniprogram')
  for(const dir of ['pages','components'])for(const name of fs.readdirSync(path.join(mini,dir)).filter(x=>x.startsWith('aw-'))){
    const markup=fs.readFileSync(path.join(mini,dir,name,'index.wxml'),'utf8')
    for(const binding of markup.matchAll(/{{([\s\S]*?)}}/g)){
      assert.doesNotMatch(binding[1], /&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/, name+' binding contains XML entity')
      new vm.Script('('+binding[1]+')')
    }
  }
  function condition(markup,contains){const bindings=[...markup.matchAll(/wx:if="{{([^"\n]+)}}"/g)];return bindings.find(x=>x[1].includes(contains))[1]}
  const catalog=fs.readFileSync(path.join(mini,'pages/aw-catalog/index.wxml'),'utf8')
  const more=condition(catalog,'count')
  assert.equal(vm.runInNewContext(more,{count:31,results:new Array(30)}),true)
  assert.equal(vm.runInNewContext(more,{count:30,results:new Array(30)}),false)
  const fleet=fs.readFileSync(path.join(mini,'pages/aw-fleet/index.wxml'),'utf8')
  const assignment=condition(fleet,'assignment.roleId')
  assert.equal(!!vm.runInNewContext(assignment,{assignment:{roleId:'A',targetNames:'车'},role:{id:'A'}}),true)
  assert.equal(!!vm.runInNewContext(assignment,{assignment:{roleId:'B',targetNames:'车'},role:{id:'A'}}),false)
  const confirm=condition(fleet,"item.requirement_type")
  assert.equal(vm.runInNewContext(confirm,{step:{owned:false},item:{requirement_type:'mission'}}),true)
  assert.equal(vm.runInNewContext(confirm,{step:{owned:true},item:{requirement_type:'mission'}}),false)
  assert.equal(vm.runInNewContext(confirm,{step:{owned:false},item:{token_id:'T',requirement_type:'mission'}}),false)
})
test('vehicle editor visibility follows open/cancel events and member empty state',()=>{
  const vm=require('node:vm')
  function visible(expression,data){
    assert(expression.startsWith('{{') && expression.endsWith('}}'), 'wx:if requires a data binding')
    return !!vm.runInNewContext(expression.slice(2,-2),data)
  }
  const markup=fs.readFileSync(path.join(__dirname,'../miniprogram/components/aw-asset-editor/index.wxml'),'utf8')
  const emptyCondition=markup.match(/<view wx:if="([^"]+)" class="empty"/)[1]
  let def;global.Component=d=>{def=d}
  const script='../miniprogram/components/aw-asset-editor/index';delete require.cache[require.resolve(script)];require(script)
  for(const name of ['aw-vehicle','aw-fleet']){
    const parent=page(name),template=fs.readFileSync(path.join(__dirname,'../miniprogram/pages',name,'index.wxml'),'utf8')
    const tag=template.match(/<aw-asset-editor\b[^>]+/)[0]
    const condition=tag.match(/wx:if="([^"]+)"/)[1],handler=tag.match(/bind:cancel="([^"]+)"/)[1]
    assert.equal(visible(condition,parent.data),false)
    if(name==='aw-vehicle')parent.edit(event({member:'A'}));else parent.editAsset(event({id:c.tables.vehicles[0].id,member:'A'}))
    assert.equal(visible(condition,parent.data),true)
    const editor=hydrate(def,true),before=s.exportText()
    editor.triggerEvent=eventName=>{assert.equal(eventName,'cancel');parent[handler]()}
    editor.note(event({},'取消不保存'));editor.cancel()
    assert.equal(visible(condition,parent.data),false)
    assert.equal(s.exportText(),before)
  }
  assert.equal(visible(emptyCondition,{members:[]}),true)
  assert.equal(visible(emptyCondition,{members:[{id:'A',name:'Zero',active:true}]}),false)
})

test('filter panel opens, switches and closes while retaining conditions; factory chip resets',()=>{
  const p=page('aw-catalog');p.onLoad()
  assert.equal(p.data.filterTab,'')
  p.showFilters(event({tab:'base'}));assert.equal(p.data.filterTab,'base')
  p.toggle(event({key:'tiers',value:'10'}));p.switchFilters(event({tab:'cap'}));assert.equal(p.data.filterTab,'cap')
  p.factory(event({},true));assert(p.data.selected.some(x=>x.key==='factory'))
  p.closeFilters();assert.equal(p.data.filterTab,'');assert.equal(p.data.filters.tiers[0],'10');assert.equal(p.data.filters.factory,true)
  p.remove(event({key:'factory',value:true}));assert.equal(p.data.filters.factory,false)
  p.clear();assert.equal(p.data.selected.length,0)
})
test('responsibility-only editing keeps implicit personal assets implicit',()=>{
  const s0=require('../miniprogram/utils/aw/store'),fleet=require('../miniprogram/utils/aw/fleet')
  const next=fleet.clone(s0.load()),member=next.members[0],vid=c.tables.vehicles[1].id
  const a=fleet.ensureAsset(next,member.id,vid);a.explicit=false;s0.save(next)
  let def;global.Component=d=>def=d;const script='../miniprogram/components/aw-asset-editor/index';delete require.cache[require.resolve(script)];require(script)
  const p=hydrate(def,true),editable=s0.canEdit;p.properties={vehicleId:vid,memberId:member.id}
  s0.canEdit=()=>false
  try{p.prepare();p.pickLevel(event({index:0},2));p.save();assert.equal(fleet.getAsset(s0.load(),member.id,vid).explicit,false)}finally{s0.canEdit=editable}
})
