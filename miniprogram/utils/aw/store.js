const cache = require('../cache')
const remote = require('../supabase')
const fleet = require('./fleet')
const catalog = require('./catalog')
const codes = require('./codes')
const archives = require('./archives')
let state=null,scope='',version=0,teamDirty=false,memberDirty={},busy=false,session=cache.get('aw.v2.session')||{},vault=cache.get('aw.v2.members')||{},teamName='我的车队'
function key(){return 'aw.v2.'+(session.teamId||'local')}
function write(k,v){if(!cache.set(k,v))throw new Error('本地存储失败，改动未保存')}
function persist(){write(scope,{state,version,teamDirty,memberDirty,teamName})}
function persistSession(){write('aw.v2.members',vault);write('aw.v2.session',session)}
function load(){
  if(!state||scope!==key()){
    scope=key();const saved=cache.get(scope),r=cache.getRemote()
    const old=!saved&&!session.teamId?cache.get('aw.v1.'+(r.profileId||'local')):null
    state=fleet.clone(saved&&saved.state || old&&old.state || fleet.empty({}));state.schemaVersion=2
    version=saved&&saved.version||0;teamDirty=!!(saved&&saved.teamDirty);memberDirty=saved&&saved.memberDirty||{};teamName=saved&&saved.teamName||'我的车队'
    if(old){write('aw.v2.legacy-backup',old);teamDirty=true;state.members.forEach(m=>memberDirty[m.id]=true);persist()}
  }
  return state
}
function canEdit(memberId){load();return !!memberId && memberId===currentMember() && (!session.teamId || !!vault[memberId])}
function otherDuties(s,id){const t=archives.team(s);return {assignments:Object.fromEntries(Object.entries(t.assignments).filter(([,a])=>a.assetId.split('~')[0]!==id)),dependencies:t.dependencies.filter(d=>d.assignmentId.split('~')[0]!==id)}}
function save(next){
  if(busy)throw new Error('正在同步，请稍后编辑');
  load();const previous=state,oldTeamDirty=teamDirty,oldMemberDirty=fleet.clone(memberDirty),nextMemberDirty=fleet.clone(memberDirty)
  next=fleet.recompute(next)
  const added=next.members.filter(m=>!previous.members.some(x=>x.id===m.id)),current=currentMember(),first=!current&&!session.teamId&&added.length===1?added[0].id:''
  if(added.length && (session.teamId || current || added.length!==1))throw new Error('只能建立自己的玩家档；入队请使用玩家码')
  if(session.teamId && !canEdit(current))throw new Error('请先输入自己的玩家码')
  if(JSON.stringify(otherDuties(previous,current||first))!==JSON.stringify(otherDuties(next,current||first)))throw new Error('只能修改自己的职责；该操作会影响其他成员')
  previous.members.forEach(m=>{const n=next.members.find(x=>x.id===m.id);if(!n || (m.id!==current && JSON.stringify(m)!==JSON.stringify(n)))throw new Error('只能修改自己的玩家信息')})
  next.members.forEach(m=>{
    const before=previous.members.find(x=>x.id===m.id)
    const changed=!before||before.name!==m.name||JSON.stringify(archives.personal(previous,m.id))!==JSON.stringify(archives.personal(next,m.id))
    if(changed){if(m.id!==first&&!canEdit(m.id))throw new Error('成员资料只读，请先输入自己的 AW-M-玩家码');nextMemberDirty[m.id]=true}
  })
  memberDirty=nextMemberDirty
  teamDirty=teamDirty||JSON.stringify(archives.team(previous))!==JSON.stringify(archives.team(next))||JSON.stringify(previous.members.map(m=>({id:m.id,active:m.active,order:m.order})))!==JSON.stringify(next.members.map(m=>({id:m.id,active:m.active,order:m.order})))
  state=next
  try{persist()}catch(e){state=previous;teamDirty=oldTeamDirty;memberDirty=oldMemberDirty;throw e}
  if(first)setCurrentMember(first)
  return state
}
function currentMember(){load();const id=cache.get(scope+'.current');return id&&id.id||''}
function setCurrentMember(id){load();write(scope+'.current',{id})}
function remoteInfo(){return {teamId:session.teamId||'',teamCode:session.teamCode||'',name:teamName}}
function memberInfo(id){load();return {code:id===currentMember()&&vault[id]&&vault[id].code||'',editable:canEdit(id),dirty:!!memberDirty[id],version:vault[id]&&vault[id].version||0}}
function error(e){
  if(/AW_VERSION_CONFLICT/.test(e.message))return new Error('云端存档已更新，本地改动已保留。请复制备份，再选择载入云端')
  const labels={SELF_ONLY:'只能修改自己的成员信息和职责',MEMBER_NOT_LINKED:'请先确认加入车队',MEMBER_CODE_REQUIRED:'请输入自己的 AW-M 玩家码',TEAM_NOT_FOUND:'没有找到该车队，请核对完整车队码',MEMBER_NOT_FOUND:'没有找到该成员存档，请核对完整成员码',INVALID_NAME:'名称需要1至60个字符',TEAM_MEMBER_LIMIT:'车队最多关联100名成员',INVALID_AW_CODE:'存档码格式不正确'}
  for(const key of Object.keys(labels))if(e.message.includes(key))return new Error(labels[key])
  return e
}
async function locked(fn){if(busy)throw new Error('正在同步，请稍后重试');busy=true;try{return await fn()}catch(e){throw error(e)}finally{busy=false}}
async function publishMember(id){
  load();if(vault[id])return vault[id].code
  const m=state.members.find(x=>x.id===id);if(!m)throw new Error('成员不存在')
  const sent={name:m.name,data:archives.personal(state,id)},row=await remote.awArchive('create_member',null,sent)
  vault[row.id]={code:row.code,version:row.version};persistSession()
  state=archives.remapMember(state,id,row.id);if(currentMember()===id)setCurrentMember(row.id)
  delete memberDirty[id];delete memberDirty[row.id];if(JSON.stringify(sent)!==JSON.stringify({name:state.members.find(x=>x.id===row.id).name,data:archives.personal(state,row.id)}))memberDirty[row.id]=true;teamDirty=true;persist()
  return row.code
}
async function attachMember(code,confirmJoin=false){
  const normalized=codes.parse(code,'member').code
  return locked(async()=>{
    load();const row=await remote.awArchive('open_member',normalized)
    if(state.members.some(m=>m.id===row.id)&&memberDirty[row.id])throw new Error('该成员有本地改动，请先上传或复制备份后载入云端')
    if(session.teamId){
      let cloud=await remote.awArchive('open_team',session.teamCode)
      if(teamDirty||Object.keys(memberDirty).length)throw new Error('请先上传当前改动，再读取玩家码')
      if(!cloud.members.some(m=>m.id===row.id)){
        if(!confirmJoin)return {needsJoin:true,name:row.name}
        cloud=await remote.awArchive('link_member',session.teamCode,{memberCode:normalized},cloud.version)
      }
      state=archives.hydrateTeam(cloud);version=cloud.version;teamName=cloud.name
    }
    if(!state.members.some(m=>m.id===row.id))state.members.push({id:row.id,name:row.name,active:true,order:state.members.length})
    archives.memberInto(state,row);fleet.recompute(state);vault[row.id]={code:normalized,version:row.version};delete memberDirty[row.id]
    if(!session.teamId)teamDirty=true;persistSession();persist();setCurrentMember(row.id);return {needsJoin:false}
  })
}
async function updateMembers(){
  for(const m of state.members.slice()){
    if(!vault[m.id]&&m.id===currentMember())await publishMember(m.id)
  }
  for(const id of Object.keys(memberDirty)){
    const m=state.members.find(x=>x.id===id),v=vault[id];if(!m)continue
    if(!v || id!==currentMember())throw new Error('只能上传自己的个人资料，请先输入玩家码')
    const data=archives.personal(state,id),name=m.name,before=JSON.stringify({name,data})
    const row=await remote.awArchive('put_member',v.code,{name,data},v.version)
    v.version=row.version
    if(before===JSON.stringify({name:(state.members.find(x=>x.id===id)||{}).name,data:archives.personal(state,id)}))delete memberDirty[id]
    persistSession();persist()
  }
}
async function push(){return locked(async()=>{
  load();await updateMembers()
  if(!session.teamId)return state
  // Ensure every independent save is linked before uploading this team's responsibilities.
  let cloud=await remote.awArchive('open_team',session.teamCode)
  if(cloud.version!==version)throw new Error('AW_VERSION_CONFLICT')
  for(const m of state.members){if(!cloud.members.some(x=>x.id===m.id)){
    if(!vault[m.id] || m.id!==currentMember())throw new Error('只能关联自己的玩家档：'+m.name)
    cloud=await remote.awArchive('link_member',session.teamCode,{memberCode:vault[m.id].code},version);version=cloud.version;persist()
  }}
  if(teamDirty){
    const data=archives.team(state),members=state.members.map(m=>({id:m.id,active:m.active,order:m.order})),name=teamName
    const actor=vault[currentMember()];if(!actor)throw new Error('请先输入自己的玩家码')
    const before=JSON.stringify({data,members,name}),row=await remote.awArchive('put_team',session.teamCode,{name,data,members,memberCode:actor.code},version)
    version=row.version;teamDirty=before!==JSON.stringify({data:archives.team(state),members:state.members.map(m=>({id:m.id,active:m.active,order:m.order})),name:teamName});persist()
  }
  return state
})}
async function createTeam(name){
  const clean=String(name||'').trim();if(!clean)throw new Error('请填写车队名称')
  await locked(async()=>{
    load();if(session.teamId)throw new Error('请先切换到本地车队，再创建新车队')
    if(!currentMember())throw new Error('请先建立或读取自己的玩家档')
    await updateMembers();const current=currentMember(),row=await remote.awArchive('create_team',null,{name:clean}),local=fleet.clone(state)
    session={teamId:row.id,teamCode:row.code};teamName=clean;version=row.version;scope=key();state=local;teamDirty=true;persistSession();persist();if(current)setCurrentMember(current)
  })
  return push()
}
async function openTeam(code){
  const normalized=codes.parse(code,'team').code
  return locked(async()=>{
    load();if(session.teamId&&(teamDirty||Object.keys(memberDirty).length))throw new Error('当前车队有未同步改动，请先上传，或切换到本地后再加入车队')
    const old=scope,before=JSON.stringify(state),row=await remote.awArchive('open_team',normalized)
    if(scope!==old||JSON.stringify(state)!==before)throw new Error('载入期间本地发生改动，已保留本地版本')
    session={teamId:row.id,teamCode:normalized};scope=key();state=archives.hydrateTeam(row);teamName=row.name;version=row.version;teamDirty=false;memberDirty={}
    row.members.forEach(m=>{if(vault[m.id])vault[m.id].version=m.version});persistSession();persist();setCurrentMember('');return state
  })
}
async function pull(discard){return locked(async()=>{
  load();if(!session.teamId)throw new Error('请先创建或加入车队')
  if(!discard&&(teamDirty||Object.keys(memberDirty).length))throw new Error('本地有未同步改动，请先上传或复制备份')
  const before=JSON.stringify(state),oldScope=scope,row=await remote.awArchive('open_team',session.teamCode)
  if(scope!==oldScope||JSON.stringify(state)!==before)throw new Error('载入期间本地发生改动，已保留本地版本')
  state=archives.hydrateTeam(row);version=row.version;teamName=row.name;teamDirty=false;memberDirty={}
  row.members.forEach(m=>{if(vault[m.id])vault[m.id].version=m.version});persistSession();persist();return state
})}
// Opening a page must read the shared team, while preserving unsent local edits.
async function refreshIfClean(){
  load();if(!session.teamId||busy||teamDirty||Object.keys(memberDirty).length)return false
  await pull();return true
}
async function saveSharedRoles(next){
  save(next)
  if(session.teamId){try{await push()}catch(e){e.localSaved=true;throw e}}
  return state
}
function localTeam(){if(busy)throw new Error('正在同步，请稍后切换');load();persist();session={};persistSession();state=null;load();return state}
async function unlinkMember(id){return locked(async()=>{
  load();if(id!==currentMember()||!canEdit(id))throw new Error('只能退出自己的车队');if(teamDirty||Object.keys(memberDirty).length)throw new Error('有未上传改动，请先上传后再退出');if(session.teamId){const row=await remote.awArchive('unlink_member',session.teamCode,{memberId:id,memberCode:vault[id].code},version);state=archives.hydrateTeam(row);version=row.version;teamDirty=false;persist();setCurrentMember('');return state}
  state.members=state.members.filter(m=>m.id!==id);Object.keys(state.assets).forEach(k=>{if(state.assets[k].memberId===id)delete state.assets[k]})
  Object.keys(state.assignments).forEach(k=>{if(k.startsWith(id+'~'))delete state.assignments[k]})
  ;['tokens','routes','confirmedRewards','confirmedRequirements'].forEach(k=>Object.keys(state[k]).forEach(x=>{if(x.startsWith(id+'~'))delete state[k][x]}))
  delete memberDirty[id];fleet.recompute(state);teamDirty=true;persist();return state
})}
async function importOld(){
  load();const r=cache.getRemote();if(!r.profileId||!r.inviteCode)throw new Error('没有连接旧合作存档')
  if(state.members.length||state.roles.length)throw new Error('请在空白本地车队导入，避免覆盖现有记录')
  const game=await remote.getGameState(r.profileId,r.inviteCode,'aw')
  if(game.exists&&game.state&&Array.isArray(game.state.members)){
    write('aw.v2.legacy-backup',game);return save(fleet.clone(game.state))
  }
  const rows=await remote.getLegacyAwPlan(r.profileId,r.inviteCode),profile=await remote.openProfile(r.inviteCode)
  return save(fleet.importLegacy(fleet.clone(state),rows,profile.profileData.users||{}))
}
module.exports={load,save,pull,push,refreshIfClean,saveSharedRoles,currentMember,setCurrentMember,remoteInfo,memberInfo,canEdit,createTeam,openTeam,attachMember,unlinkMember,createPersonalArchive(name){return locked(async()=>{const row=await remote.awArchive('create_member',null,{name:String(name||'').trim()});vault[row.id]={code:row.code,version:row.version};persistSession();return row.code})},publishMember(id){if(id!==currentMember())return Promise.reject(new Error('只能发布自己的玩家档'));return locked(()=>publishMember(id))},localTeam,importOld,
  get dirty(){load();return teamDirty||Object.keys(memberDirty).length>0},get connected(){return !!session.teamId},get busy(){return busy},
  exportText(){return JSON.stringify({team:remoteInfo(),members:vault,state:load()},null,2)},discardAndPull(){return pull(true)}
}
