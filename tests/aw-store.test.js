const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const memory=new Map();let failStorage=false,store,serial,teams,members
const fleet=require('../miniprogram/utils/aw/fleet'),archives=require('../miniprogram/utils/aw/archives'),codes=require('../miniprogram/utils/aw/codes'),catalog=require('../miniprogram/utils/aw/catalog'),remote=require('../miniprogram/utils/supabase')
global.wx={getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>{if(failStorage)throw Error('full');memory.set(k,fleet.clone(v))},removeStorageSync:k=>memory.delete(k)}
function row(type,name,data){const n=++serial,id='00000000-0000-4000-8000-'+String(n).padStart(12,'0'),code='AW-'+type+'-'+n.toString(16).toUpperCase().padStart(32,'0');return {id,code,name,data,version:1,members:[]}}
function snapshot(t){return {...fleet.clone(t),members:t.members.map(m=>({...fleet.clone(members[m.id]),active:m.active,order:m.order,code:undefined}))}}
function freshStore(){delete require.cache[require.resolve('../miniprogram/utils/aw/store')];return require('../miniprogram/utils/aw/store')}
beforeEach(()=>{
  memory.clear();failStorage=false;serial=0;teams={};members={};store=freshStore()
  remote.awArchive=async(action,code,payload={},version)=>{
    if(action==='create_member'){const r=row('M',payload.name,payload.data||{assets:{},tokens:{},routes:{},confirmedRewards:{},confirmedRequirements:{}});members[r.id]=r;return fleet.clone(r)}
    if(action==='create_team'){const r=row('T',payload.name,{roles:[],assignments:{},dependencies:[],legacyAudit:[]});teams[r.id]=r;return fleet.clone(r)}
    const m=Object.values(members).find(m=>m.code===code),t=Object.values(teams).find(t=>t.code===code)
    if(action==='open_member'){if(!m)throw Error('MEMBER_NOT_FOUND');return fleet.clone(m)}
    if(action==='put_member'){if(version!==m.version)throw Error('AW_VERSION_CONFLICT');m.name=payload.name;m.data=fleet.clone(payload.data);m.version++;return fleet.clone(m)}
    if(!t)throw Error('TEAM_NOT_FOUND')
    if(action==='open_team')return snapshot(t)
    if(version!==t.version)throw Error('AW_VERSION_CONFLICT')
    if(action==='link_member'){const m=Object.values(members).find(m=>m.code===payload.memberCode);if(!t.members.some(x=>x.id===m.id))t.members.push({id:m.id,active:true,order:t.members.length});t.version++;return snapshot(t)}
    if(action==='unlink_member'){const actor=Object.values(members).find(m=>m.code===payload.memberCode);if(!actor||actor.id!==payload.memberId)throw Error('SELF_ONLY');t.members=t.members.filter(m=>m.id!==payload.memberId);t.version++;return snapshot(t)}
    if(action==='put_team'){const actor=Object.values(members).find(m=>m.code===payload.memberCode);if(!actor)throw Error('MEMBER_CODE_REQUIRED');t.data=fleet.clone(payload.data);t.name=payload.name;t.members=payload.members;t.version++;return snapshot(t)}
    throw Error('UNKNOWN_ACTION')
  }
})
function localMember(){const s=fleet.clone(store.load());s.members.push({id:'local',name:'Zero',active:true,order:0});s.roles.push({id:'role',name:'抗线',order:0});fleet.saveAsset(s,'local',catalog.tables.vehicles[0].id,'owned','备注',[{roleId:'role',level:'primary'}]);store.save(s);return s}
test('typed codes preserve all characters and reject wrong-entry and malformed codes',()=>{
 const t='AW-T-'+ 'A'.repeat(32),m='AW-M-'+ 'B'.repeat(32)
 assert.equal(codes.parse(t.toLowerCase(),'team').code,t);assert.equal(codes.parse(m,'member').type,'member')
 assert.throws(()=>codes.parse(m,'team'),/成员码/);assert.throws(()=>codes.parse(t,'member'),/车队码/);assert.throws(()=>codes.parse('B'.repeat(20)),/完整/)
})
test('publishing remaps every stable relation and separates member vehicles from team duties',async()=>{
 localMember();store.setCurrentMember('local');await store.createTeam('测试车队')
 const s=store.load(),id=s.members[0].id,m=members[id],t=Object.values(teams)[0]
 assert.notEqual(id,'local');assert.equal(store.currentMember(),id);assert.match(store.memberInfo(id).code,/^AW-M-/);assert.match(store.remoteInfo().teamCode,/^AW-T-/)
 assert.equal(Object.values(m.data.assets)[0].status,'owned');assert(!('roles' in m.data));assert(!('assets' in t.data));assert.equal(Object.values(t.data.assignments)[0].assetId.split('~')[0],id);assert.equal(store.dirty,false)
})
test('member attachment is idempotent and one member can belong to independent teams',async()=>{
 localMember();await store.createTeam('Team A');const id=store.load().members[0].id,mc=store.memberInfo(id).code,first=Object.values(teams)[0]
 await store.attachMember(mc);await store.push();assert.equal(store.load().members.length,1)
 store.localTeam();memory.delete('coopgame.state.aw.v2.local');memory.delete('coopgame.state.aw.v2.local.current');store=freshStore();await store.attachMember(mc);await store.createTeam('Team B');const second=Object.values(teams)[1]
 assert.equal(first.members[0].id,second.members[0].id);assert.equal(second.data.roles.length,0);assert.equal(first.data.roles[0].name,'抗线')
})
test('wrong code type fails before any remote request',async()=>{
 remote.awArchive=async()=>{throw Error('network should not be called')}
 await assert.rejects(store.openTeam('AW-M-'+'A'.repeat(32)),/成员码/)
 await assert.rejects(store.attachMember('AW-T-'+'A'.repeat(32)),/车队码/)
})
test('team version conflicts preserve local responsibilities and prevent stale writes',async()=>{
 localMember();await store.createTeam('Team');const t=Object.values(teams)[0],s=fleet.clone(store.load());s.roles[0].name='本地修改';store.save(s);t.version++
 await assert.rejects(store.push(),/云端存档已更新/);assert.equal(t.data.roles[0].name,'抗线');assert.equal(store.load().roles[0].name,'本地修改');assert(store.dirty)
})
test('member version conflict does not overwrite data or upload subsequent team changes',async()=>{
 localMember();await store.createTeam('Team');const id=store.load().members[0].id,s=fleet.clone(store.load());s.members[0].name='本地';store.save(s);members[id].version++
 await assert.rejects(store.push(),/云端存档已更新/);assert.equal(store.load().members[0].name,'本地');assert.equal(members[id].name,'Zero');assert(store.memberInfo(id).dirty)
})
test('team code stays read-only until the player code identifies self',async()=>{
 localMember();await store.createTeam('Team');const tc=store.remoteInfo().teamCode,id=store.load().members[0].id
 memory.delete('coopgame.state.aw.v2.members');memory.delete('coopgame.state.aw.v2.session');store=freshStore();await store.openTeam(tc)
 assert.equal(store.canEdit(id),false)
 const next=fleet.clone(store.load());next.members[0].name='不允许';assert.throws(()=>store.save(next),/自己的玩家码/);assert.equal(store.load().members[0].name,'Zero')
 const duties=fleet.clone(store.load());duties.roles[0].name='车队职责';assert.throws(()=>store.save(duties),/自己的玩家码/)
 await store.attachMember(members[id].code);assert.equal(store.canEdit(id),true);store.save(duties);await store.push();assert.equal(Object.values(teams)[0].data.roles[0].name,'车队职责')
})
test('unlink preserves the independent member archive and another team link',async()=>{
 localMember();await store.createTeam('A');const id=store.load().members[0].id,mc=store.memberInfo(id).code
 store.localTeam();await store.attachMember(mc);await store.createTeam('B');await store.unlinkMember(id)
 assert.equal(store.load().members.length,0);assert.equal(Object.values(teams)[0].members.length,1);assert.equal(Object.values(teams)[1].members.length,0);assert.equal(Object.values(members[id].data.assets)[0].status,'owned')
})
test('storage failure rolls back state and dirty flags',()=>{
 const before=store.exportText(),next=fleet.clone(store.load());next.members.push({id:'x',name:'新成员',active:true,order:0});failStorage=true
 assert.throws(()=>store.save(next),/本地存储失败/);failStorage=false;assert.equal(store.exportText(),before);assert.equal(store.dirty,false)
})
test('sync blocks edits and switching; failures preserve retryable personal versions',async()=>{
 localMember();await store.createTeam('Team');let calls=0;const original=remote.awArchive
 remote.awArchive=async(...args)=>{if(args[0]==='put_member'){calls++;assert.throws(()=>store.save(fleet.clone(store.load())),/正在同步/);assert.throws(()=>store.localTeam(),/正在同步/)}if(args[0]==='put_team')throw Error('network');return original(...args)}
 const next=fleet.clone(store.load());next.members[0].name='改名';next.roles[0].name='职责';store.save(next)
 await assert.rejects(store.push(),/network/);assert.equal(calls,1);assert.equal(store.memberInfo(next.members[0].id).dirty,false);assert(store.dirty)
 remote.awArchive=original;await store.push();assert.equal(calls,1);assert.equal(store.dirty,false)
})
test('legacy local v1 is backed up and converted without touching its original cache',()=>{
 const old=fleet.empty({A:'旧玩家'});memory.set('coopgame.state.aw.v1.local',{state:old,version:2,dirty:true});store=freshStore()
 assert.equal(store.load().members[0].name,'旧玩家');assert.equal(store.load().schemaVersion,2);assert.equal(memory.get('coopgame.state.aw.v1.local').state.schemaVersion,1);assert(memory.has('coopgame.state.aw.v2.legacy-backup'))
})
test('team projection excludes auto prerequisite assets and personal-only data',()=>{
 const s=localMember(),implicit=fleet.ensureAsset(s,'local',catalog.tables.vehicles[1].id)
 const personal=archives.personal(s,'local'),team=archives.team(s)
 assert(!personal.assets[implicit.vehicleId]);assert(!team.assets);assert(!team.tokens);assert.equal(Object.values(personal.assets).length,1)
})
test('entering a non-member code requires confirmation; cancellation makes no link',async()=>{
 localMember();await store.createTeam('Team');const tc=store.remoteInfo().teamCode,originalId=store.currentMember(),originalVersion=Object.values(teams)[0].version
 const other=await remote.awArchive('create_member',null,{name:'另一个测试者'})
 await store.openTeam(tc);assert.equal(store.currentMember(),'')
 const pending=await store.attachMember(other.code);assert.equal(pending.needsJoin,true)
 assert.equal(store.currentMember(),'');assert.equal(Object.values(teams)[0].members.length,1);assert.equal(Object.values(teams)[0].version,originalVersion)
 const joined=await store.attachMember(other.code,true);assert.equal(joined.needsJoin,false);assert.equal(store.currentMember(),other.id)
 assert.equal(store.canEdit(originalId),false);assert.equal(store.memberInfo(originalId).code,'')
 const version=Object.values(teams)[0].version;await store.attachMember(other.code);assert.equal(Object.values(teams)[0].version,version)
})
test('own identity cannot alter teammate duties, delete an occupied role or exit for teammate',async()=>{
 localMember();await store.createTeam('Team');const tc=store.remoteInfo().teamCode,first=store.currentMember(),other=await remote.awArchive('create_member',null,{name:'队友'})
 await store.openTeam(tc);await store.attachMember(other.code,true)
 const before=store.exportText(),next=fleet.clone(store.load());fleet.deleteRole(next,'role')
 assert.throws(()=>store.save(next),/其他成员/);assert.equal(store.exportText(),before)
 await assert.rejects(store.unlinkMember(first),/自己的车队/)
 await store.unlinkMember(other.id);assert.equal(store.currentMember(),'');assert.equal(store.dirty,false)
 assert.equal(Object.values(teams)[0].members[0].id,first);assert(members[other.id])
})

// Swap persisted device storage; the two store modules retain independent state.
function snapshotMemory(){return new Map([...memory].map(([k,v])=>[k,fleet.clone(v)]))}
function useMemory(values){memory.clear();for(const [k,v] of values)memory.set(k,fleet.clone(v))}
test('shared roles autosave and same-player second device reads add, rename, order and delete',async()=>{
 localMember();await store.createTeam('Shared');const a=store,tc=a.remoteInfo().teamCode,mc=a.memberInfo(a.currentMember()).code
 let am=snapshotMemory();memory.clear();const b=freshStore();await b.openTeam(tc);await b.attachMember(mc);let bm=snapshotMemory()
 useMemory(am);const added=fleet.clone(a.load());added.roles.push({id:'new',name:'支援',description:'描述',order:1});await a.saveSharedRoles(added);am=snapshotMemory()
 assert.equal(a.dirty,false);assert.equal(Object.values(teams)[0].data.roles.length,2)
 useMemory(bm);assert(await b.refreshIfClean());assert.equal(b.load().roles[1].name,'支援');assert.equal(b.currentMember(),a.currentMember());bm=snapshotMemory()
 useMemory(am);const changed=fleet.clone(a.load());changed.roles[1].name='远程支援';changed.roles[1].order=0;changed.roles[0].order=1;await a.saveSharedRoles(changed);am=snapshotMemory()
 useMemory(bm);await b.refreshIfClean();assert.equal(b.load().roles.find(r=>r.id==='new').name,'远程支援');assert.equal(b.load().roles.find(r=>r.id==='new').order,0);bm=snapshotMemory()
 useMemory(am);const removed=fleet.clone(a.load());fleet.deleteRole(removed,'new');await a.saveSharedRoles(removed)
 useMemory(bm);await b.refreshIfClean();assert(!b.load().roles.some(r=>r.id==='new'))
})
test('a different member maintains common role names without altering teammate duties',async()=>{
 localMember();await store.createTeam('Shared');const a=store,tc=a.remoteInfo().teamCode;let am=snapshotMemory()
 const other=await remote.awArchive('create_member',null,{name:'队友'});memory.clear();const b=freshStore();await b.openTeam(tc);await b.attachMember(other.code,true)
 const next=fleet.clone(b.load()),before=JSON.stringify(next.assignments);next.roles[0].name='共同职责';await b.saveSharedRoles(next)
 assert.equal(JSON.stringify(b.load().assignments),before)
 useMemory(am);await a.refreshIfClean();assert.equal(a.load().roles[0].name,'共同职责');assert.equal(JSON.stringify(a.load().assignments),before)
})
test('automatic refresh protects pending edits and failed role uploads retain retryable changes',async()=>{
 localMember();await store.createTeam('Shared');const original=remote.awArchive,next=fleet.clone(store.load());next.roles[0].name='离线改名'
 remote.awArchive=async(...args)=>{if(args[0]==='put_team')throw Error('offline');return original(...args)}
 await assert.rejects(store.saveSharedRoles(next),/offline/);assert(store.dirty);assert.equal(store.load().roles[0].name,'离线改名')
 remote.awArchive=async()=>{throw Error('refresh should not issue a request')};assert.equal(await store.refreshIfClean(),false);assert.equal(store.load().roles[0].name,'离线改名')
 remote.awArchive=original;await store.push();assert.equal(Object.values(teams)[0].data.roles[0].name,'离线改名');assert.equal(store.dirty,false)
})
test('all personal edits auto-upload and another device reads token progress, route, note and rename',async()=>{
 localMember();await store.createTeam('Shared');const a=store,tc=a.remoteInfo().teamCode,id=a.currentMember(),mc=a.memberInfo(id).code;let am=snapshotMemory()
 memory.clear();const b=freshStore();await b.openTeam(tc);await b.attachMember(mc);const bm=snapshotMemory()
 useMemory(am);const next=fleet.clone(a.load()),asset=Object.values(next.assets)[0];asset.note='自动上传备注';asset.tokenRewards={synthetic:'claimed'};asset.tokenAcquisition='token';asset.tokenUnlockPathId='synthetic-path';asset.tokenSupply=true;next.members[0].name='自动改名';next.routes[id+'~'+asset.vehicleId]='route';next.confirmedRequirements[id+'~condition']=true
 await a.saveAndSync(next);assert.equal(a.dirty,false)
 useMemory(bm);await b.refresh();const saved=Object.values(b.load().assets)[0];assert.equal(saved.note,'自动上传备注');assert.deepEqual(saved.tokenRewards,{synthetic:'claimed'});assert.equal(saved.tokenUnlockPathId,'synthetic-path');assert.equal(saved.tokenSupply,true);assert.equal(b.load().members[0].name,'自动改名');assert.equal(b.load().confirmedRequirements[id+'~condition'],true)
})
test('manual refresh uploads before download; failure/conflict never downloads over pending edits',async()=>{
 localMember();await store.createTeam('Shared');const next=fleet.clone(store.load());Object.values(next.assets)[0].note='离线草稿';store.save(next)
 const original=remote.awArchive,calls=[];remote.awArchive=async(...args)=>{calls.push(args[0]);if(args[0]==='put_member')throw Error('offline');return original(...args)}
 await assert.rejects(store.refresh(),/offline/);assert.deepEqual(calls,['put_member']);assert.equal(Object.values(store.load().assets)[0].note,'离线草稿');assert(store.dirty);assert.match(store.syncInfo().status,/失败/)
 calls.length=0;remote.awArchive=async(...args)=>{calls.push(args[0]);return original(...args)};await store.refresh();assert(calls.indexOf('put_member')<calls.lastIndexOf('open_team'));assert.equal(store.dirty,false);assert.equal(store.syncInfo().error,'')
 const changed=fleet.clone(store.load());changed.roles[0].name='冲突职责';store.save(changed);Object.values(teams)[0].version++;calls.length=0
 await assert.rejects(store.refresh(),/云端存档已更新/);assert.deepEqual(calls,['open_team']);assert.equal(store.load().roles[0].name,'冲突职责');assert(store.dirty)
})
test('published personal archive auto-syncs and refreshes without a connected team',async()=>{
 localMember();await store.publishMember(store.currentMember());const id=store.currentMember(),m=members[id],next=fleet.clone(store.load());Object.values(next.assets)[0].note='个人自动上传'
 await store.saveAndSync(next);assert.equal(Object.values(m.data.assets)[0].note,'个人自动上传');assert.equal(store.memberInfo(id).dirty,false)
 m.name='另一设备修改';m.version++;assert.equal(await store.refreshIfClean(),true);assert.equal(store.load().members[0].name,'另一设备修改');assert.equal(store.memberInfo(id).version,m.version)
})
