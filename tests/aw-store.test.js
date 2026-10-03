const {test,beforeEach} = require('node:test')
const assert=require('node:assert/strict')
const memory=new Map();let failStorage=false
// Every test uses a new profile scope. No real network requests or credentials.
global.wx={getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>{if(failStorage)throw Error('full');memory.set(k,JSON.parse(JSON.stringify(v)))},removeStorageSync:k=>memory.delete(k)}
const cache=require('../miniprogram/utils/cache'),remote=require('../miniprogram/utils/supabase'),store=require('../miniprogram/utils/aw/store'),fleet=require('../miniprogram/utils/aw/fleet')
let version=0,cloud=null,puts=0,index=0
beforeEach(()=>{
 failStorage=false;version=0;cloud=null;puts=0
 cache.setRemote('synthetic-'+(++index),'A'.repeat(20));store.load()
 remote.openProfile=async()=>({profileData:{users:{A:'共享玩家'}}})
 remote.getGameState=async()=>({exists:!!cloud,state:cloud,version})
 remote.putGameState=async(_id,_code,_key,s)=>{cloud=fleet.clone(s);puts++;return {version:++version}}
 remote.patchProfile=async()=>({})
})
test('pull loads stable shared users and save/push persists one whole AW state',async()=>{
 await store.pull();assert.equal(store.load().members[0].id,'A')
 const next=fleet.clone(store.load());next.roles.push({id:'r',name:'职责',order:0});store.save(next)
 await store.push();assert.equal(puts,1);assert.equal(store.dirty,false);assert.equal(cloud.roles.length,1)
})
test('cloud version conflict prevents writes and preserves local changes',async()=>{
 await store.pull();const next=fleet.clone(store.load());next.members[0].name='本地改名';store.save(next);version=1
 await assert.rejects(store.push(),/团队数据已更新/);assert.equal(puts,0);assert.equal(store.load().members[0].name,'本地改名');assert(store.dirty)
})
test('edits during upload remain dirty and are not mistakenly marked synchronized',async()=>{
 await store.pull();const next=fleet.clone(store.load());next.members[0].name='第一版';store.save(next)
 remote.putGameState=async(_id,_code,_key,s)=>{cloud=fleet.clone(s);const newer=fleet.clone(store.load());newer.members[0].name='第二版';store.save(newer);return {version:++version}}
 await store.push();assert.equal(cloud.members[0].name,'第一版');assert.equal(store.load().members[0].name,'第二版');assert(store.dirty)
})
test('edits during download prevent replacing local state',async()=>{
 remote.getGameState=async()=>{const next=fleet.clone(store.load());next.members.push({id:'mine',name:'本地',active:true,order:0});store.save(next);return {exists:false,version:0}}
 await assert.rejects(store.pull(),/本地发生改动/);assert.equal(store.load().members[0].id,'mine')
})
test('storage failure rolls back state and reports failed save',()=>{
 const before=store.exportText(),next=fleet.clone(store.load());next.roles.push({id:'r',name:'职责',order:0});failStorage=true
 assert.throws(()=>store.save(next),/本地存储失败/);assert.equal(store.exportText(),before)
})
test('profile name partial failure retains retry status after game state succeeds',async()=>{
 await store.pull();store.save(fleet.clone(store.load()));remote.patchProfile=async()=>{throw Error('network')}
 await assert.rejects(store.push(),/玩家名称同步失败/);assert.equal(version,1);assert(store.dirty)
})
