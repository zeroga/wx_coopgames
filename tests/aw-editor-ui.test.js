const {test,beforeEach}=require('node:test'),assert=require('node:assert/strict')
const fleet=require('../miniprogram/utils/aw/fleet'),catalog=require('../miniprogram/utils/aw/catalog')
const memory=new Map()
let editor,store,dialogs
global.wx={getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>memory.set(k,fleet.clone(v)),getWindowInfo:()=>({windowWidth:390,windowHeight:724}),nextTick:cb=>cb(),showToast(){}}
beforeEach(()=>{
  memory.clear();dialogs=[];wx.showModal=d=>dialogs.push(d)
  delete require.cache[require.resolve('../miniprogram/utils/aw/store')];store=require('../miniprogram/utils/aw/store')
  const s=fleet.empty({me:'我'});s.members=s.members.slice(0,1);s.roles=[{id:'front',name:'前线',description:'',order:0}];store.save(s)
  let def;global.Component=d=>def=d;delete require.cache[require.resolve('../miniprogram/components/aw-asset-editor/index')];require('../miniprogram/components/aw-asset-editor/index')
  editor={...def.methods,data:fleet.clone(def.data),properties:{vehicleId:catalog.tables.vehicles[0].id},events:[]}
  editor.setData=(update,cb)=>{for(const [key,v] of Object.entries(update)){const parts=key.split('.');let target=editor.data;for(const p of parts.slice(0,-1))target=target[p];target[parts.at(-1)]=v}if(cb)cb()}
  editor.triggerEvent=name=>editor.events.push(name);editor.prepare()
})
function reply(confirm){const d=dialogs.pop();assert(d);d.success({confirm});d.complete()}
function editNote(value){editor.note({detail:{value}})}
test('clean close needs no confirmation; edited draft survives stay, and discard never writes',()=>{
  editor.cancel();assert.deepEqual(editor.events,['cancel']);assert.equal(dialogs.length,0);editor.events=[]
  const before=store.exportText();editNote('未保存备注');editor.cancel();editor.cancel();assert.equal(dialogs.length,1)
  reply(false);assert.deepEqual(editor.events,[]);assert.equal(editor.data.note,'未保存备注')
  editor.cancel();reply(true);assert.deepEqual(editor.events,['cancel']);assert.equal(store.exportText(),before)
})
test('reverting a status or note to its baseline closes without spurious confirmation',()=>{
  editNote('临时');editNote('');editor.pickStatus({currentTarget:{dataset:{value:0}}});editor.pickStatus({currentTarget:{dataset:{value:1}}})
  editor.cancel();assert.equal(dialogs.length,0);assert.deepEqual(editor.events,['cancel'])
})
test('returning or switching shared-role drafts confirms without losing vehicle draft',()=>{
  editNote('车辆草稿');editor.roleManager();editor.newRole();editor.roleField({currentTarget:{dataset:{key:'name'}},detail:{value:'未保存职责'}})
  const before=store.exportText();editor.roleManager();reply(false);assert.equal(editor.data.showRoleManager,true);assert.equal(editor.data.roleForm.name,'未保存职责')
  editor.editRole({currentTarget:{dataset:{id:'front'}}});reply(false);assert.equal(editor.data.roleForm.name,'未保存职责')
  editor.roleManager();reply(true);assert.equal(editor.data.showRoleManager,false);assert.equal(editor.data.note,'车辆草稿');assert.equal(store.exportText(),before)
})
test('saving a shared role preserves vehicle draft and permits clean role return',async()=>{
  editNote('车辆草稿');editor.roleManager();editor.newRole();editor.roleField({currentTarget:{dataset:{key:'name'}},detail:{value:'新增职责'}})
  await editor.saveRole();assert(store.load().roles.some(r=>r.name==='新增职责'));editor.roleManager();assert.equal(dialogs.length,0)
  assert.equal(editor.data.note,'车辆草稿');editor.cancel();assert.equal(dialogs.length,1);reply(false)
})
test('failed validation or local save retains input; confirmed dismissal leaves stored asset unchanged',async()=>{
  editNote('仍可恢复的输入');const before=store.exportText();store.saveAndSync=async()=>{throw Error('本地存储失败')}
  await editor.save();assert.equal(editor.data.note,'仍可恢复的输入');assert.equal(editor.data.fieldError,'本地存储失败');assert.equal(store.exportText(),before)
  editor.cancel();reply(false);assert.equal(editor.data.note,'仍可恢复的输入')
})
test('a locally saved draft is not treated as unsaved when sync fails',async()=>{
  editNote('已在本地保存');store.saveAndSync=async s=>{store.save(s);throw Object.assign(Error('offline'),{localSaved:true})}
  await editor.save();assert.match(editor.data.syncError,/已保存本地/);editor.cancel();assert.equal(dialogs.length,0);assert.deepEqual(editor.events,['cancel'])
})
test('busy identity operations prevent dismissal, and detached modal callbacks cannot close another editor',()=>{
  editor.data.identityBusy=true;editNote('草稿');editor.cancel();assert.equal(dialogs.length,0)
  editor.data.identityBusy=false;editor.cancel();editor._detached=true;reply(true);assert.deepEqual(editor.events,[])
})
test('rotation updates frame while a keyboard-only viewport resize is not subtracted twice',()=>{
  editor.keyboard({detail:{height:300}});assert.equal(editor.data.sheetHeight,412)
  editor.resize({size:{windowWidth:390,windowHeight:424}});assert.equal(editor.data.sheetHeight,412)
  editor.keyboard({detail:{height:0}});editor.resize({size:{windowWidth:724,windowHeight:390}});assert.equal(editor.data.sheetHeight,343)
  editor.resize({size:{windowWidth:390,windowHeight:724}});assert.equal(editor.data.sheetHeight,637)
})
test('focus is revealed again after measured keyboard resize, then blur releases scroll target',()=>{
  const updates=[],setData=editor.setData;editor.setData=(u,cb)=>{updates.push(u);setData(u,cb)}
  editor.focusField({currentTarget:{id:'vehicle-note'}})
  editor.createSelectorQuery=()=>({select(){return this},boundingClientRect(){return this},exec(cb){cb([{top:100,left:0,width:390,height:412},{left:12,width:366,bottom:135},{top:450}])}})
  editor.keyboard({detail:{height:300}});assert.equal(editor.data.focusedField,'vehicle-note');assert(editor.data.contentHeight>0)
  assert(updates.filter(u=>u.focusedField==='vehicle-note').length>=2);editor.blurField();assert.equal(editor.data.focusedField,'')
})
test('child identity slots are measured after zero-width body gets its native bounds',()=>{
  let measurements=0
  editor.selectAllComponents=()=>[{measureLayout(){assert(editor.data.contentWidth>0);measurements++}}]
  editor.createSelectorQuery=()=>({select(){return this},boundingClientRect(){return this},exec(cb){cb([{top:100,left:0,width:390,height:412},{left:12,width:366,bottom:135},{top:450}])}})
  assert.equal(editor.data.contentWidth,0);editor.measureLayout();assert.equal(measurements,1);assert.equal(editor.data.contentWidth,366)
})
