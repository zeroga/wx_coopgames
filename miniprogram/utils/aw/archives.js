const fleet = require('./fleet')
const personalKeys = ['assets','tokens','routes','confirmedRewards','confirmedRequirements']
function personal(s, memberId) {
  const result = { assets: {}, tokens: {}, routes: {}, confirmedRewards: {}, confirmedRequirements: {} }
  Object.values(s.assets).filter(a => a.memberId === memberId && a.explicit).forEach(a => {
    result.assets[a.vehicleId] = Object.assign({},fleet.clone(a),{status:a.status,note:a.note||'',explicit:true})
    delete result.assets[a.vehicleId].id;delete result.assets[a.vehicleId].memberId;delete result.assets[a.vehicleId].vehicleId
  })
  personalKeys.slice(1).forEach(key => Object.keys(s[key]).filter(k => k.startsWith(memberId + '~')).forEach(k => { result[key][k.slice(memberId.length+1)] = s[key][k] }))
  return result
}
function team(s) {
  const assignments = {}, dependencies = s.dependencies.filter(d => d.source === 'manual')
  Object.values(s.assignments).filter(a => a.source !== 'tech_tree').forEach(a => { assignments[a.id] = a })
  return { roles: fleet.clone(s.roles), assignments: fleet.clone(assignments), dependencies: fleet.clone(dependencies), legacyAudit: fleet.clone(s.legacyAudit) }
}
function memberInto(s, row) {
  const data=row.data || {}, member=s.members.find(m=>m.id===row.id)
  if(member)member.name=row.name
  Object.keys(s.assets).filter(k=>s.assets[k].memberId===row.id).forEach(k=>delete s.assets[k])
  Object.keys(data.assets || {}).forEach(vehicleId=>{
    const key=fleet.assetKey(row.id,vehicleId),a=data.assets[vehicleId]
    s.assets[key]=Object.assign({},fleet.clone(a),{id:key,memberId:row.id,vehicleId,status:a.status,note:a.note||'',explicit:true})
  })
  personalKeys.slice(1).forEach(key=>{
    Object.keys(s[key]).filter(k=>k.startsWith(row.id+'~')).forEach(k=>delete s[key][k])
    Object.keys(data[key] || {}).forEach(k=>s[key][fleet.assetKey(row.id,k)]=data[key][k])
  })
  return s
}
function hydrateTeam(row) {
  const s=fleet.empty({}), data=row.data || {}
  s.schemaVersion=2;s.roles=data.roles || [];s.assignments=data.assignments || {};s.dependencies=data.dependencies || [];s.legacyAudit=data.legacyAudit || []
  s.members=(row.members || []).map(m=>({id:m.id,name:m.name,active:m.active,order:m.order}))
  ;(row.members || []).forEach(m=>memberInto(s,m))
  // A team may plan a vehicle that is absent from the independent personal inventory.
  Object.values(s.assignments).forEach(a=>{
    const [memberId,vehicleId]=a.assetId.split('~');fleet.ensureAsset(s,memberId,vehicleId)
  })
  return fleet.recompute(s)
}
function remapMember(s, from, to) {
  if(from===to)return s
  const next=fleet.clone(s),replace=x=>typeof x==='string' && (x===from || x.startsWith(from+'~'))?to+x.slice(from.length):x
  const m=next.members.find(x=>x.id===from);if(m)m.id=to
  const assets={};Object.values(next.assets).forEach(a=>{a.id=replace(a.id);a.memberId=replace(a.memberId);assets[a.id]=a});next.assets=assets
  const assignments={};Object.values(next.assignments).forEach(a=>{a.id=replace(a.id);a.assetId=replace(a.assetId);assignments[a.id]=a});next.assignments=assignments
  next.dependencies.forEach(d=>{d.id=replace(d.id);d.assignmentId=replace(d.assignmentId);d.targetId=replace(d.targetId)})
  personalKeys.slice(1).forEach(key=>{const out={};Object.keys(next[key]).forEach(k=>out[replace(k)]=next[key][k]);next[key]=out})
  return fleet.recompute(next)
}
module.exports={personal,team,memberInto,hydrateTeam,remapMember}
