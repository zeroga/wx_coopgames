const colors = ['#d96b27','#663171','#3f6fb5','#2d8e91','#b4567a']
const levels = {primary:'主力',backup:'备选',transition:'过渡'}
function scopeSummaries(summaries, scope) {
  const seen=new Set()
  return summaries.filter(a=>a&&!seen.has(a.id)&&seen.add(a.id)).map(a=>{
    const roles=(a.roles||[]).filter(r=>!scope||((!scope.roleId||r.roleId===scope.roleId)&&(!scope.level||r.level===scope.level)))
    return Object.assign({},a,{roles,planText:scope&&!roles.some(r=>r.id===a.planTargetId)?'':a.planText,roleText:roles.map(r=>r.name+'·'+(levels[r.level]||r.levelText||'')).join(' / ')||'暂无车队职责'})
  })
}
function markers(s, summaries) {
  const grouped=new Map()
  scopeSummaries(summaries).forEach(asset=>{
    ;(asset.roles||[]).filter(r=>r.source!=='tech_tree'&&levels[r.level]).forEach(r=>{
      const id=asset.memberId+':'+r.level
      if(!grouped.has(id))grouped.set(id,{id,memberId:asset.memberId,color:memberColor(s,asset.memberId),foreground:markerForeground(memberColor(s,asset.memberId)),label:levels[r.level],memberName:asset.memberName,roleNames:[]})
      const marker=grouped.get(id);if(!marker.roleNames.includes(r.name))marker.roleNames.push(r.name)
    })
  })
  return Array.from(grouped.values()).map(m=>Object.assign(m,{roleName:m.roleNames.join('、')}))
}
function markerForeground(color) {
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
  const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]
  return 1.05/(luminance+.05)>=4.5?'#fff':'#000000'
}
function memberColor(s, memberId) {
  const index=s.members.slice().sort((a,b)=>a.order-b.order).findIndex(m=>m.id===memberId)
  return colors[(index<0?0:index)%colors.length]
}
// Slots are fixed in rpx within each container-width band, independent of
// vehicle text or member count. 84 class + 2*20 gap + 132 trail = 256rpx.
function layout(width, unit, requestedMode) {
  const available=Math.max(0,width/unit-256)
  const mainWidthRpx=[448,320,256,192].find(w=>w<=available)||Math.floor(available)
  const mode=requestedMode==='auto'?(width/unit>=560?'details':'summary'):requestedMode||'none'
  return {mainWidthRpx,mode}
}
function markerPreview(markers, limit) {
  const all=new Set(markers.map(m=>m.memberId||m.memberName)),visible=[]
  // Do not show half of one player's multi-level summary.
  for(const id of all){const group=markers.filter(m=>(m.memberId||m.memberName)===id);if(visible.length+group.length>limit)break;visible.push(...group)}
  const shown=new Set(visible.map(m=>m.memberId||m.memberName))
  return {visibleMarkers:visible,hiddenMembers:all.size-shown.size}
}
module.exports = {colors,markers,memberColor,scopeSummaries,layout,markerPreview,markerForeground}
