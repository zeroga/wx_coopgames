const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const memory = new Map(), messages=[]
global.wx={getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>memory.set(k,JSON.parse(JSON.stringify(v))),removeStorageSync:k=>memory.delete(k),showToast:r=>messages.push(r),showModal:r=>messages.push(r),setNavigationBarTitle(){},navigateTo(){},setClipboardData(){}}
function hydrate(def, component=false) {
  const p=Object.assign({},component?def.methods:def)
  p.data=JSON.parse(JSON.stringify(def.data));p.properties={vehicleId:'',memberId:''};p.setData=function(update,cb){for(const [key,v] of Object.entries(update)){const parts=key.split('.');let at=this.data;for(const field of parts.slice(0,-1)){if(!at[field])at[field]={};at=at[field]}at[parts[parts.length-1]]=v}if(cb)cb()};p.triggerEvent=()=>{};return p
}
function page(name){let def;global.Page=d=>{def=d};require('../miniprogram/pages/'+name+'/index');return hydrate(def)}
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
