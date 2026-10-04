const colors = ['#d96b27','#663171','#3f6fb5','#2d8e91','#b4567a']
const levels = {primary:'主力',backup:'备选',transition:'过渡'}
function markers(s, summaries) {
  const members=s.members.slice().sort((a,b)=>a.order-b.order)
  return summaries.reduce((out, asset)=>{
    if(asset.status!=='planned')return out
    const index=members.findIndex(m=>m.id===asset.memberId)
    asset.roles.filter(r=>r.source!=='tech_tree'&&levels[r.level]).forEach(r=>out.push({id:r.id,color:colors[(index<0?0:index)%colors.length],label:levels[r.level],memberName:asset.memberName,roleName:r.name}))
    return out
  },[])
}
function memberColor(s, memberId) {
  const index=s.members.slice().sort((a,b)=>a.order-b.order).findIndex(m=>m.id===memberId)
  return colors[(index<0?0:index)%colors.length]
}
module.exports = {colors,markers,memberColor}
