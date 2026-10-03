const catalog = require('../../utils/aw/catalog')
const fleet = require('../../utils/aw/fleet')
const store = require('../../utils/aw/store')
function error(e) { wx.showModal({title:'操作未完成',content:e.message||String(e),showCancel:false}) }
Page({
  data:{tab:'overview',memberId:'',targetId:'',editor:false,editVehicleId:'',editMemberId:'',memberForm:null,roleForm:null,busy:false,teamCodeInput:'',teamNameInput:'',memberCodeInput:''},
  onLoad(o){this.setData({tab:o.tab||'overview',memberId:o.member||store.currentMember(),targetId:o.target||''});this.refresh()},
  onShow(){this.refresh()},
  refresh(){
    const s=store.load(), members=s.members.slice().sort((a,b)=>a.order-b.order).map(m=>{
      const a=Object.values(s.assets).filter(x=>x.memberId===m.id)
      return Object.assign({},m,{owned:a.filter(x=>x.status==='owned').length,planned:a.filter(x=>x.status==='planned').length})
    })
    let memberId=this.data.memberId
    if(!members.some(m=>m.id===memberId)) memberId=(members.find(m=>m.active)||members[0]||{}).id||''
    const member=members.find(m=>m.id===memberId)||null
    const assets=Object.values(s.assets).filter(a=>a.memberId===memberId).map(a=>{
      const v=catalog.byId[a.vehicleId]||{name:'资料待补全'}
      return Object.assign({},fleet.summary(s,a.vehicleId).find(x=>x.id===a.id),{name:v.name_zh||v.name})
    }).sort((a,b)=>a.name.localeCompare(b.name))
    const targets=fleet.targets(s,memberId).map(t=>Object.assign({},t,{name:(catalog.byId[s.assets[t.assetId].vehicleId]||{}).name,roleName:(s.roles.find(r=>r.id===t.roleId)||{}).name,levelText:catalog.label(t.level)}))
    let targetId=this.data.targetId
    if(!targets.some(t=>t.id===targetId))targetId=targets[0]&&targets[0].id||''
    const plan=targetId?fleet.memberPlan(s,memberId,targetId):null
    const unionPlan=targets.length?fleet.memberPlan(s,memberId):null
    const choices=plan?plan.choices.map(c=>({vehicleId:c.vehicleId,name:c.name,paths:c.paths,index:-1})):[]
    const routeOptions=plan?plan.steps.map(step=>{
      const ps=fleet.paths(step.id)
      if(ps.length<2)return null
      const picked=s.routes[fleet.assetKey(memberId,step.id)]
      return {vehicleId:step.id,name:step.name,paths:ps,index:ps.findIndex(p=>p.id===picked)}
    }).filter(Boolean).filter(c=>!choices.some(x=>x.vehicleId===c.vehicleId)):[]
    this.setData({archive:store.remoteInfo(),memberArchive:store.memberInfo(memberId),canEditMember:store.canEdit(memberId),memberChoices:members.map(m=>({id:m.id,name:m.name,code:store.memberInfo(m.id).code,editable:store.canEdit(m.id)})),members,memberId,member,memberIndex:members.findIndex(m=>m.id===memberId),playerAssets:assets,roles:s.roles.slice().sort((a,b)=>a.order-b.order),overview:fleet.overview(s),targets,targetId,plan,unionPlan,choices,routeOptions,
      memberTokens:catalog.tables.tokens.map(t=>({id:t.id,name:t.name,quantity:s.tokens[fleet.assetKey(memberId,t.id)]||0})),currentId:store.currentMember(),connected:store.connected,dirty:store.dirty,legacyCount:s.legacyAudit.length})
  },
  mutate(fn){try{if(store.busy)throw new Error('正在同步，请稍后编辑');const s=fleet.clone(store.load());fn(s);store.save(s);this.refresh();return true}catch(e){error(e);return false}},
  tab(e){this.setData({tab:e.currentTarget.dataset.tab});this.refresh()},
  nav(e){wx.navigateTo({url:'/pages/aw-'+e.currentTarget.dataset.page+'/index'})},
  selectMember(e){this.setData({memberId:e.currentTarget.dataset.id,targetId:''});this.refresh()},
  pickMember(e){const m=this.data.members[Number(e.detail.value)];this.setData({memberId:m.id,targetId:''});this.refresh()},
  setCurrent(){if(!this.data.member||!this.data.member.active)return;store.setCurrentMember(this.data.memberId);this.refresh();wx.showToast({title:'已设为当前玩家',icon:'success'})},
  newMember(){this.setData({memberForm:{id:'',name:''}})},
  renameMember(){if(!store.canEdit(this.data.memberId))return error(new Error('请先关联成员存档码'));if(this.data.member)this.setData({memberForm:{id:this.data.member.id,name:this.data.member.name}})},
  memberName(e){this.setData({'memberForm.name':e.detail.value})},
  cancelForm(){this.setData({memberForm:null,roleForm:null})},
  saveMember(){
    const form=this.data.memberForm,name=form.name.trim();if(!name)return error(new Error('请填写成员名称'))
    let newId=''
    const saved=this.mutate(s=>{if(form.id){s.members.find(m=>m.id===form.id).name=name}else{newId=fleet.id('member');s.members.push({id:newId,name,active:true,order:s.members.length})}})
    if(saved){if(newId){this.setData({memberId:newId});store.setCurrentMember(newId);this.refresh()}this.cancelForm()}
  },
  activeMember(){const m=this.data.member;if(!m)return;wx.showModal({title:m.active?'停用玩家？':'恢复玩家？',content:m.active?'保留所有车辆和历史关系，停用后不能新增车辆编辑。':'恢复后可继续编辑车辆。',success:r=>{if(r.confirm)this.mutate(s=>{s.members.find(x=>x.id===m.id).active=!m.active})}})},
  moveMember(e){this.reorder('members',e.currentTarget.dataset.id,Number(e.currentTarget.dataset.dir))},
  reorder(key,id,dir){this.mutate(s=>{const items=s[key].slice().sort((a,b)=>a.order-b.order),i=items.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=items.length)return;[items[i],items[j]]=[items[j],items[i]];items.forEach((x,k)=>{x.order=k});s[key]=items})},
  newRole(){this.setData({roleForm:{id:'',name:'',description:''}})},
  editRole(e){const r=store.load().roles.find(x=>x.id===e.currentTarget.dataset.id);this.setData({roleForm:fleet.clone(r)})},
  roleField(e){this.setData({['roleForm.'+e.currentTarget.dataset.key]:e.detail.value})},
  saveRole(){const f=this.data.roleForm,name=f.name.trim();if(!name)return error(new Error('请填写职责名称'));const saved=this.mutate(s=>{if(f.id){Object.assign(s.roles.find(x=>x.id===f.id),{name,description:f.description.trim()})}else{s.roles.push({id:fleet.id('role'),name,description:f.description.trim(),order:s.roles.length})}});if(saved)this.cancelForm()},
  deleteRole(e){const id=e.currentTarget.dataset.id,count=Object.values(store.load().assignments).filter(a=>a.roleId===id).length;wx.showModal({title:'删除职责？',content:'将移除 '+count+' 条职责关联，玩家车辆仍保留。',success:r=>{if(r.confirm)this.mutate(s=>fleet.deleteRole(s,id))}})},
  moveRole(e){this.reorder('roles',e.currentTarget.dataset.id,Number(e.currentTarget.dataset.dir))},
  roleDragStart(e){this.dragRole=e.currentTarget.dataset.id;this.setData({draggingRole:this.dragRole})},
  roleDragEnd(e){
    const id=this.dragRole;this.dragRole='';this.setData({draggingRole:''});if(!id)return
    const y=e.changedTouches[0].clientY
    this.createSelectorQuery().selectAll('.role-sort').boundingClientRect(rects=>{
      const index=rects.findIndex(r=>y>=r.top&&y<=r.bottom);if(index<0)return
      this.mutate(s=>{const rows=s.roles.slice().sort((a,b)=>a.order-b.order),old=rows.findIndex(r=>r.id===id);if(old<0)return;const row=rows.splice(old,1)[0];rows.splice(index,0,row);rows.forEach((r,i)=>{r.order=i});s.roles=rows})
    }).exec()
  },
  roleDragMove(){},
  editAsset(e){this.setData({editor:true,editVehicleId:e.currentTarget.dataset.id,editMemberId:e.currentTarget.dataset.member||this.data.memberId})},
  cancel(){this.setData({editor:false})},
  saved(){this.setData({editor:false});this.refresh()},
  removeAsset(e){const id=e.currentTarget.dataset.asset;wx.showModal({title:'移除玩家车辆？',content:'移除该车辆及手工职责。若仍被目标路线引用，将重新建立计划前置。',success:r=>{if(r.confirm)this.mutate(s=>fleet.removeAsset(s,id))}})},
  tree(e){wx.navigateTo({url:'/pages/aw-tree/index?id='+e.currentTarget.dataset.id})},
  detail(e){wx.navigateTo({url:'/pages/aw-vehicle/index?id='+e.currentTarget.dataset.id})},
  addVehicle(){wx.navigateTo({url:'/pages/aw-catalog/index'})},
  token(e){if(!store.canEdit(this.data.memberId))return error(new Error('请先关联成员存档码'));const v=e.detail.value;if(!/^\d+$/.test(v))return error(new Error('Token 数量必须为非负整数'));const value=Number(v);if(!Number.isSafeInteger(value))return error(new Error('Token 数量过大'));this.mutate(s=>{s.tokens[fleet.assetKey(this.data.memberId,e.currentTarget.dataset.id)]=value})},
  target(e){this.setData({targetId:e.currentTarget.dataset.id});this.refresh()},
  route(e){const {vehicle}=e.currentTarget.dataset,list=fleet.paths(vehicle),selected=list[Number(e.detail.value)];this.mutate(s=>{s.routes[fleet.assetKey(this.data.memberId,vehicle)]=selected.id})},
  routeChoice(e){const c=this.data.choices[Number(e.currentTarget.dataset.index)],p=c.paths[Number(e.detail.value)];this.mutate(s=>{s.routes[fleet.assetKey(this.data.memberId,c.vehicleId)]=p.id})},
  confirmRequirement(e){this.mutate(s=>{s.confirmedRequirements[fleet.assetKey(this.data.memberId,e.currentTarget.dataset.id)]=e.detail.value})},
  confirmReward(e){this.mutate(s=>{s.confirmedRewards[fleet.assetKey(this.data.memberId,e.currentTarget.dataset.id)]=e.detail.value})},
  archiveField(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value})},
  async runArchive(fn){this.setData({busy:true});try{await fn();wx.showToast({title:'操作完成',icon:'success'})}catch(e){error(e)}finally{this.setData({busy:false});this.refresh()}},
  createTeam(){return this.runArchive(()=>store.createTeam(this.data.teamNameInput||'我的车队'))},
  joinTeam(){return this.runArchive(()=>store.openTeam(this.data.teamCodeInput))},
  joinMember(){return this.runArchive(()=>store.attachMember(this.data.memberCodeInput))},
  publishMember(){return this.runArchive(async()=>{const code=await store.publishMember(this.data.memberId),m=store.load().members.find(x=>store.memberInfo(x.id).code===code);if(m)this.setData({memberId:m.id})})},
  copyTeam(){wx.setClipboardData({data:store.remoteInfo().teamCode})},
  copyMember(){const code=store.memberInfo(this.data.memberId).code;if(code)wx.setClipboardData({data:code})},
  switchLocal(){wx.showModal({title:'切换到本地车队？',content:'当前车队及未上传改动会留在本机缓存中，个人存档不会删除。',success:r=>{if(r.confirm){store.localTeam();this.setData({memberId:'',targetId:''});this.refresh()}}})},
  unlinkMember(){const id=this.data.memberId;wx.showModal({title:'解除成员关联？',content:'移除此车队的职责安排，保留成员独立存档和车辆资料。',success:r=>{if(r.confirm)this.runArchive(()=>store.unlinkMember(id))}})},
  async push(){this.setData({busy:true});try{await store.push();wx.showToast({title:'已同步',icon:'success'})}catch(e){error(e)}finally{this.setData({busy:false});this.refresh()}},
  async pull(){this.setData({busy:true});try{await store.pull()}catch(e){error(e)}finally{this.setData({busy:false});this.refresh()}},
  replaceCloud(){wx.showModal({title:'重新载入云端？',content:'备份包含存档码，请妥善保存。继续将用云端替换当前车队及成员资料的本地未同步版本。',success:async r=>{if(!r.confirm)return;this.setData({busy:true});try{await store.discardAndPull()}catch(e){error(e)}finally{this.setData({busy:false});this.refresh()}}})},
  backup(){wx.setClipboardData({data:store.exportText()})},
  async importLegacy(){wx.showModal({title:'读取旧车队计划？',content:'只复制有效资产状态，保留全部原始记录。不修改旧表；旧职责与优先级留待人工映射。',success:async r=>{if(!r.confirm)return;this.setData({busy:true});try{await store.importOld()}catch(e){error(e)}finally{this.setData({busy:false});this.refresh()}}})}
})
