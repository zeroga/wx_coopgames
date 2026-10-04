const catalog = require('./catalog')
const verified = r => ['public_verified','ingame_verified'].includes(r.verification_status)
const quantity = n => n !== null && n !== '' && Number.isSafeInteger(Number(n)) && Number(n) >= 0
const rewardStates = ['unearned','ready','claimed']
function rewards(asset) {
  return catalog.rows('vehicle_token_rewards','vehicle_id',asset.vehicleId).map(r => Object.assign({},r,{state:(asset.tokenRewards||{})[r.id]||'unknown',tokenName:(catalog.byId[r.token_id]||{}).name||'Token'}))
}
function setReward(asset, rewardId, state) {
  if(!rewardStates.includes(state))throw new Error('奖励状态无效')
  if(!catalog.rows('vehicle_token_rewards','vehicle_id',asset.vehicleId).some(r=>r.id===rewardId))throw new Error('奖励不属于该车辆')
  if(asset.status!=='owned' && state!=='unearned')throw new Error('先登记为已拥有，再记录满经验或已领取')
  asset.tokenRewards=Object.assign({},asset.tokenRewards,{[rewardId]:state});asset.explicit=true
}
function hasRecordedUnlock(asset) {
  if(asset.tokenAcquisition==='other')return true
  if(!asset.tokenUnlockPathId)return false
  const p=catalog.tables.unlock_paths.find(p=>p.id===asset.tokenUnlockPathId&&p.vehicle_id===asset.vehicleId&&!p.target_upgrade_id),rs=p?catalog.rows('unlock_requirements','unlock_path_id',p.id).filter(r=>r.token_id):[]
  return !!(p&&p.is_complete&&rs.length&&rs.every(r=>verified(r)&&quantity(r.required_value)))
}
function setUnlock(asset, kind, pathId) {
  if(!['unknown','token','other'].includes(kind))throw new Error('获取方式无效')
  if(kind==='token'&&!hasRecordedUnlock(Object.assign({},asset,{tokenAcquisition:kind,tokenUnlockPathId:pathId})))throw new Error('请选择已核实消耗数量的完整 Token 解锁路线')
  asset.tokenAcquisition=kind;asset.tokenUnlockPathId=kind==='token'?pathId:''
}
function pathCards(vehicleId, selected) {
  return catalog.rows('unlock_paths','vehicle_id',vehicleId).filter(p=>!p.target_upgrade_id).map((p,_,ps)=>Object.assign({},p,{selected:p.id===(selected||(ps.filter(x=>x.is_complete).length===1?ps.find(x=>x.is_complete).id:'')),details:catalog.rows('unlock_requirements','unlock_path_id',p.id).map(r=>r.description||((catalog.byId[r.token_id]||{}).name||r.requirement_type)+' ×'+r.required_value).join('；')||'条件资料待补全'}))
}
function build(s,memberId,nodes,context) {
  const key=id=>memberId+'~'+id, budget={},warnings=context.warnings.slice(), steps=[], ownedAssets=Object.values(s.assets).filter(a=>a.memberId===memberId&&a.status==='owned'), assets=Object.values(s.assets).filter(a=>a.memberId===memberId)
  let complete=context.complete
  function warn(message){complete=false;warnings.push(message)}
  function bucket(id){return budget[id]||(budget[id]={id,name:(catalog.byId[id]||{}).name||'Token',claimed:0,historicalSpent:0,owned:0,gained:0,reachableGained:0,processShortfall:0,uncertain:0,unknownSources:0,consumed:0,balance:0,processOk:true,sources:[],consumers:[]})}
  function cost(r,label){if(!quantity(r.required_value)||!verified(r)){warn('Token 消耗待核实：'+label);return null}return Number(r.required_value)}
  // The balance is a ledger of recorded one-time claims and actual unlocks, never a manually invented holding.
  assets.forEach(a=>{
    rewards(a).forEach(r=>{if(r.state==='claimed'){
      const b=bucket(r.token_id)
      if(a.status!=='owned'||!verified(r)||!quantity(r.quantity)){warn('已领取奖励记录无效：'+(catalog.byId[a.vehicleId]||{}).name);return}
      b.claimed+=Number(r.quantity)
    }})
    if(a.tokenUnlockPathId){
      const p=catalog.tables.unlock_paths.find(p=>p.id===a.tokenUnlockPathId&&p.vehicle_id===a.vehicleId&&!p.target_upgrade_id)
      if(!hasRecordedUnlock(a)){warn('实际解锁路线待核实：'+(catalog.byId[a.vehicleId]||{}).name);return}
      catalog.rows('unlock_requirements','unlock_path_id',p.id).filter(r=>r.token_id).forEach(r=>{const n=cost(r,(catalog.byId[a.vehicleId]||{}).name);if(n!==null)bucket(r.token_id).historicalSpent+=n})
    }else if(a.tokenAcquisition==='token'){warn('请记录实际 Token 解锁路线：'+(catalog.byId[a.vehicleId]||{}).name)}else if(a.status==='owned'&&a.tokenAcquisition!=='other'&&catalog.rows('unlock_paths','vehicle_id',a.vehicleId).some(p=>catalog.rows('unlock_requirements','unlock_path_id',p.id).some(r=>r.token_id))){warn('请记录实际获取方式：'+(catalog.byId[a.vehicleId]||{}).name)}
  })
  const nodeIds=new Set(nodes.map(n=>n.vehicleId)),ignoredIds=new Set(nodes.filter(n=>n.ignored).map(n=>n.vehicleId)),sourceIds=new Set()
  // Owned sources are relevant even when outside the selected target's route.
  const sourceAssets=ownedAssets.concat(nodes.filter(n=>!n.owned).map(n=>s.assets[key(n.vehicleId)]||{vehicleId:n.vehicleId,status:'planned'}))
  sourceAssets.forEach(a=>rewards(a).forEach(r=>{
    if(sourceIds.has(r.id))return;sourceIds.add(r.id)
    const b=bucket(r.token_id),name=(catalog.byId[a.vehicleId]||{}).displayName||(catalog.byId[a.vehicleId]||{}).name
    const row=Object.assign({},r,{vehicleId:a.vehicleId,name,owned:a.status==='owned',planned:nodeIds.has(a.vehicleId),available:r.state==='ready',forecast:false})
    if(!verified(r)||!quantity(r.quantity)){b.unknownSources++;warn('奖励数量待核实：'+name)}
    else if(r.state!=='claimed'){
      if(a.status==='owned'&&r.state==='unknown'){b.uncertain+=Number(r.quantity);warn('请记录奖励进度：'+name)}
      else if(!ignoredIds.has(a.vehicleId)){row.forecast=true;b.gained+=Number(r.quantity)}
    }
    b.sources.push(row)
  }))
  nodes.forEach(n=>{
    const a=s.assets[key(n.vehicleId)]||{}, step={id:n.vehicleId,name:n.vehicle.displayName||n.vehicle.name_zh||n.vehicle.name,owned:n.owned,ignored:!!n.ignored,custom:!!n.custom,pathName:n.path&&n.path.name,routeKnown:!!(n.owned||hasRecordedUnlock(a)||!a.tokenUnlockPathId&&a.tokenAcquisition!=='token'&&(n.routeKnown === undefined ? n.path&&n.path.is_complete : n.routeKnown)),requirements:n.requirements.map(r=>Object.assign({},r,{confirmed:!!s.confirmedRequirements[key(r.id)]})),rewards:rewards(Object.assign({vehicleId:n.vehicleId},a)),changes:[],blocked:false,uncertain:false,costUnknown:false,costs:[]}
    if(!n.owned&&!hasRecordedUnlock(a))n.requirements.forEach(r=>{
      if(r.token_id){const b=bucket(r.token_id),amount=cost(r,step.name);if(amount===null){step.uncertain=true;step.costUnknown=true;return}b.consumed+=amount;b.consumers.push({vehicleId:n.vehicleId,name:step.name,quantity:amount});step.costs.push({tokenId:r.token_id,quantity:amount});step.changes.push(b.name+' 消耗 '+amount)}
      else if(r.requirement_type==='own_vehicle'&&r.source_vehicle_id&&!r.source_upgrade_id){}
      else if(!s.confirmedRequirements[key(r.id)]){step.uncertain=true;warn('解锁条件待确认：'+(r.description||step.name))}
    })
    steps.push(step)
  })
  Object.values(budget).forEach(b=>{b.owned=b.claimed-b.historicalSpent;b.balance=b.owned;if(b.owned<0)warn(b.name+' 领取记录少于实际消耗，请补齐历史领取记录')})
  const acquired=new Set(ownedAssets.map(a=>a.vehicleId)),earned=new Set()
  const actions=[]
  function earn(vid){Object.values(budget).forEach(b=>b.sources.filter(r=>r.vehicleId===vid&&r.forecast&&!earned.has(r.id)).forEach(r=>{earned.add(r.id);b.balance+=Number(r.quantity);b.reachableGained+=Number(r.quantity);actions.push({id:'reward:'+r.id,vehicleId:vid,name:r.name,kind:'reward',text:(r.available?'领取满经验奖励':'练满经验并领取')+' · '+b.name+' ×'+r.quantity})}))}
  ownedAssets.forEach(a=>earn(a.vehicleId))
  let pending=steps.filter(x=>!x.owned), attempts=0,limited=false
  const priority=new Set(),byStep={};steps.forEach(step=>byStep[step.id]=step)
  function prioritize(id){if(priority.has(id))return;priority.add(id);const step=byStep[id];if(step)step.requirements.filter(r=>r.source_vehicle_id).forEach(r=>prioritize(r.source_vehicle_id))}
  Object.values(budget).forEach(b=>b.sources.filter(r=>r.forecast).forEach(r=>prioritize(r.vehicleId)))
  pending.sort((a,b)=>Number(priority.has(b.id))-Number(priority.has(a.id)))
  const failed=new Set(),bs=Object.values(budget)
  const snapshot=()=>({actions:actions.slice(),acquired:new Set(acquired),earned:new Set(earned),values:bs.map(b=>({balance:b.balance,reachableGained:b.reachableGained}))})
  function restore(saved){actions.splice(0,actions.length,...saved.actions);acquired.clear();saved.acquired.forEach(id=>acquired.add(id));earned.clear();saved.earned.forEach(id=>earned.add(id));bs.forEach((b,i)=>Object.assign(b,saved.values[i]))}
  let best={remaining:pending.slice(),state:snapshot()}
  function enabled(step){
    const asset=s.assets[key(step.id)]||{},prerequisites=(hasRecordedUnlock(asset)?[]:step.requirements).filter(r=>r.source_vehicle_id&&!r.source_upgrade_id)
    return step.routeKnown&&!step.costUnknown&&!prerequisites.some(r=>!acquired.has(r.source_vehicle_id))&&!step.costs.some(c=>bucket(c.tokenId).balance<c.quantity)
  }
  function apply(step){step.costs.forEach(c=>{bucket(c.tokenId).balance-=c.quantity});acquired.add(step.id);actions.push({id:'unlock:'+step.id,vehicleId:step.id,name:step.name,kind:'unlock',text:step.costs.length?'消耗 Token 解锁，再获取车辆':'满足路线条件后获取车辆'});earn(step.id)}
  function search(remaining){
    if(remaining.length<best.remaining.length)best={remaining:remaining.slice(),state:snapshot()}
    if(!remaining.length)return true
    if(++attempts>3000){limited=true;return false}
    const fingerprint=remaining.map(x=>x.id).sort().join('|');if(failed.has(fingerprint))return false
    let choices=remaining.filter(enabled)
    // Free acquisitions cannot consume a competing resource, so they commute.
    const free=choices.find(step=>!step.costs.length);if(free)choices=[free]
    for(const step of choices){const saved=snapshot();apply(step);if(search(remaining.filter(x=>x.id!==step.id)))return true;restore(saved);if(limited)break}
    failed.add(fingerprint);return false
  }
  if(search(pending))pending=[];else{pending=best.remaining;restore(best.state)}
  if(limited)warn('路线顺序超过搜索上限，已展示可确认的部分；不能据此判定循环或无解')
  pending.forEach(step=>{step.blocked=true;step.costs.forEach(c=>{if(bucket(c.tokenId).balance<c.quantity){const b=bucket(c.tokenId);b.processOk=false;b.processShortfall=Math.max(b.processShortfall,c.quantity-b.balance)}})})
  const tokens=Object.values(budget).map(b=>{
    const final=b.owned+b.gained-b.consumed,shortfall=Math.max(0,-final),reserveShortfall=b.consumed?Math.max(0,1-final):0
    return Object.assign(b,{final,shortfall,reserveShortfall,totalOk:final>=0,bufferOk:!b.consumed||final>0,candidates:catalog.rows('vehicle_token_rewards','token_id',b.id).filter(r=>!sourceIds.has(r.id)).map(r=>Object.assign({},r,{vehicleId:r.vehicle_id,name:(catalog.byId[r.vehicle_id]||{}).displayName||(catalog.byId[r.vehicle_id]||{}).name,known:verified(r)&&quantity(r.quantity)}))})
  })
  const tokenOk=tokens.every(b=>b.totalOk&&b.processOk),bufferOk=tokens.every(b=>b.bufferOk)
  const blocked=pending.map(step=>({vehicleId:step.id,name:step.name,reason:step.costUnknown?'Token 用量未知，暂不能计算可支付数量':step.ignored?'需要前置':!step.routeKnown?'需要前置':step.costs.some(c=>bucket(c.tokenId).balance<c.quantity)?'此步骤 Token 不足；需先练已有来源或补充独立来源，未来奖励不能提前支付':'前置尚未获取；检查路线循环和前置条件'}))
  const status=!tokenOk||blocked.length?'Token 不足 / 路线受阻':!complete?'记录 / 条件待确认':!bufferOk?'可支付，需增加规划余量':'已知条件通过'
  return {steps,tokens,actions,blocked,choices:context.choices.filter((c,i)=>context.choices.findIndex(x=>x.vehicleId===c.vehicleId)===i),warnings:Array.from(new Set(warnings)),complete,status,executable:complete&&tokenOk&&bufferOk&&!blocked.length,ownedCount:nodes.filter(n=>n.owned).length,count:nodes.length,missing:steps.filter(x=>!x.owned).length,bufferOk}
}
module.exports={build,rewards,setReward,setUnlock,hasRecordedUnlock,pathCards,rewardStates}
