const {test,beforeEach,afterEach}=require('node:test')
const assert=require('node:assert/strict')
const fleet=require('../miniprogram/utils/aw/fleet')
const catalog=require('../miniprogram/utils/aw/catalog')
const memory=new Map(),messages=[]
let store,editor,confirmation,storageFailure=false
global.wx={getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>{if(storageFailure)throw Error('full');memory.set(k,fleet.clone(v))},showToast:r=>messages.push(r),showModal:r=>{confirmation=r;r.success({confirm:true})}}
beforeEach(()=>{
  memory.clear();messages.length=0;storageFailure=false;confirmation=null
  const storePath='../miniprogram/utils/aw/store',editorPath='../miniprogram/components/aw-asset-editor/index'
  delete require.cache[require.resolve(storePath)];store=require(storePath)
  const s=fleet.empty({me:'我',peer:'队友'});s.members=s.members.slice(0,1);store.save(s)
  let def;global.Component=d=>def=d;delete require.cache[require.resolve(editorPath)];require(editorPath)
  editor={...def.methods,data:fleet.clone(def.data),properties:{vehicleId:catalog.tables.vehicles[0].id},events:[]}
  editor.setData=update=>Object.assign(editor.data,update);editor.triggerEvent=name=>editor.events.push(name)
  wx.showModal=r=>{confirmation=r;r.success({confirm:true})}
})
afterEach(()=>editor.cancel())
function register(status){const next=fleet.clone(store.load());fleet.saveAsset(next,'me',editor.properties.vehicleId,status,'备注',[]);store.save(next);editor.prepare()}

for(const status of ['planned','owned'])test('editor confirms and cancels '+status+' registration',async()=>{
  register(status);assert.equal(editor.data.registered,true)
  assert.equal(editor.data.removeLabel,status==='owned'?'取消已获取':'取消计划')
  await editor.remove()
  assert.equal(fleet.getAsset(store.load(),'me',editor.properties.vehicleId),undefined)
  assert.deepEqual(editor.events,['saved']);assert.equal(editor.data.saving,false)
  assert.match(confirmation.content,/Token/)
  editor.prepare();assert.equal(editor.data.registered,false)
})
test('dismissed cancellation confirmation preserves saved records and unsaved editor draft',async()=>{
  register('planned');editor.note({detail:{value:'草稿'}});const before=store.exportText()
  wx.showModal=r=>r.success({confirm:false});await editor.remove()
  assert.equal(store.exportText(),before);assert.equal(editor.data.note,'草稿');assert.deepEqual(editor.events,[])
})
test('read-only identity and identity changed during confirmation cannot cancel registration',async()=>{
  register('owned');const before=store.exportText(),canEdit=store.canEdit
  store.canEdit=()=>false;await editor.remove();assert.equal(confirmation,null);assert.equal(store.exportText(),before)
  store.canEdit=canEdit
  wx.showModal=r=>{store.canEdit=()=>false;r.success({confirm:true})}
  try{await editor.remove();assert.equal(store.exportText(),before);assert.match(editor.data.fieldError,/自己的/)}finally{store.canEdit=canEdit}
})
test('failed sync retains cancellation and retry cannot recreate asset from stale draft',async()=>{
  register('owned');editor.note({detail:{value:'尚未保存的草稿'}})
  store.saveAndSync=async next=>{store.save(next);throw Object.assign(Error('offline'),{localSaved:true})}
  await editor.remove();assert.equal(fleet.getAsset(store.load(),'me',editor.properties.vehicleId),undefined)
  assert.equal(editor.data.pendingRemoval,true);assert.match(editor.data.syncError,/已取消登记，尚未同步/)
  await editor.save();assert.equal(fleet.getAsset(store.load(),'me',editor.properties.vehicleId),undefined)
  let retries=0;store.push=async()=>{retries++}
  await editor.retrySync();assert.equal(retries,1);assert.deepEqual(editor.events,['saved']);assert.equal(editor.data.syncError,'')
})
test('local storage failure preserves registered asset and exposes actionable error',async()=>{
  register('planned');const before=store.exportText();storageFailure=true
  await editor.remove();storageFailure=false
  assert.equal(store.exportText(),before);assert.match(editor.data.fieldError,/本地存储失败/);assert.deepEqual(editor.events,[])
})
test('confirmation in progress prevents duplicate removal and save',async()=>{
  register('planned');let dialog;wx.showModal=r=>{dialog=r}
  const pending=editor.remove();assert.equal(editor.data.saving,true)
  await editor.remove();await editor.save();assert.equal(confirmation,null)
  dialog.success({confirm:true});await pending;assert.deepEqual(editor.events,['saved'])
})
