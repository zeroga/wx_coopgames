const navigation = require('../../utils/aw/navigation')
const catalog = require('../../utils/aw/catalog')
const fleet = require('../../utils/aw/fleet')
const store = require('../../utils/aw/store')
const identity = require('../../utils/aw/identity')
function error(e) { wx.showModal({title:'操作未完成',content:e.message||String(e),showCancel:false}) }
Page({
  data:{syncError:'',tab:'overview',memberId:'',targetId:'',editor:false,editVehicleId:'',editMemberId:'',memberForm:null,roleForm:null,busy:false,teamCodeInput:'',teamNameInput:'',memberCodeInput:''},
  onLoad(o){this.setData({tab:o.tab||'overview',memberId:o.member||store.currentMember(),targetId:o.target||''});this.refresh()},
  async onShow(){this.refresh();this.setData({busy:store.connected});try{await store.refreshIfClean();this.setData({syncError:''})}catch(e){this.setData({syncError:'未能读取车队最新信息：'+e.message})}finally{this.setData({busy:false});this.refresh()}},
  receiveNavigation(o){this.setData({tab:o.tab||this.data.tab,memberId:o.member||this.data.memberId,targetId:o.target||''});this.refresh()},
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
    this.setData({archive:store.remoteInfo(),selfName:(members.find(m=>m.id===store.currentMember())||{}).name||'',selfArchive:store.memberInfo(store.currentMember()),memberArchive:store.memberInfo(memberId),canEditMember:store.canEdit(memberId),members,memberId,member,memberIndex:members.findIndex(m=>m.id===memberId),playerAssets:assets,roles:s.roles.slice().sort((a,b)=>a.order-b.order),overview:fleet.overview(s),targets,targetId,plan,unionPlan,choices,routeOptions,
      memberTokens:catalog.tables.tokens.map(t=>({id:t.id,name:t.name,quantity:s.tokens[fleet.assetKey(memberId,t.id)]||0})),currentId:store.currentMember(),connected:store.connected,dirty:store.dirty,legacyCount:s.legacyAudit.length})
  },
  mutate(fn){try{if(store.busy)throw new Error('正在同步，请稍后编辑');const s=fleet.clone(store.load());fn(s);store.save(s);this.refresh();return true}catch(e){error(e);return false}},
  async mutateRoles(fn){
    if(store.busy)return error(new Error('正在同步，请稍后编辑'));const next=fleet.clone(store.load());this.setData({busy:true})
    try{fn(next);await store.saveSharedRoles(next);wx.showToast({title:store.connected?'职责已同步':'职责已保存本地',icon:'success'});return true}
    catch(e){error(new Error((e.localSaved?'职责已保存本地，尚未同步：':'')+e.message));return !!e.localSaved}
    finally{this.setData({busy:false});this.refresh()}
  },
  tab(e){this.setData({tab:e.currentTarget.dataset.tab});this.refresh()},
  awHome(){navigation.visit('pages/aw-home/index')},
  selectMember(e){this.setData({memberId:e.currentTarget.dataset.id,targetId:''});this.refresh()},
  pickMember(e){const m=this.data.members[Number(e.detail.value)];this.setData({memberId:m.id,targetId:''});this.refresh()},
  newMember(){if(store.currentMember())return error(new Error('已经有自己的玩家档'));this.setData({memberForm:{id:'',name:''}})},
  renameMember(){if(!store.canEdit(this.data.memberId))return error(new Error('只能修改自己的玩家信息'));if(this.data.member)this.setData({memberForm:{id:this.data.member.id,name:this.data.member.name}})},
  memberName(e){this.setData({'memberForm.name':e.detail.value})},
  cancelForm(){this.setData({memberForm:null,roleForm:null})},
  async saveMember(){
    const form=this.data.memberForm,name=form.name.trim();if(!name)return error(new Error('请填写成员名称'))
    if(form.id){if(!store.canEdit(form.id))return error(new Error('只能修改自己的名字'));if(this.mutate(s=>{s.members.find(m=>m.id===form.id).name=name}))this.cancelForm();return}
    return this.runArchive(async()=>{if(await identity.create(name)){this.setData({memberId:store.currentMember()});this.cancelForm()}})
  },
  reorder(key,id,dir){return this.mutateRoles(s=>{const items=s[key].slice().sort((a,b)=>a.order-b.order),i=items.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=items.length)return;[items[i],items[j]]=[items[j],items[i]];items.forEach((x,k)=>{x.order=k});s[key]=items})},
  newRole(){this.setData({roleForm:{id:'',name:'',description:''}})},
  editRole(e){const r=store.load().roles.find(x=>x.id===e.currentTarget.dataset.id);this.setData({roleForm:fleet.clone(r)})},
  roleField(e){this.setData({['roleForm.'+e.currentTarget.dataset.key]:e.detail.value})},
  async saveRole(){const f=this.data.roleForm,name=f.name.trim();if(!name)return error(new Error('请填写职责名称'));const saved=await this.mutateRoles(s=>{if(f.id){Object.assign(s.roles.find(x=>x.id===f.id),{name,description:f.description.trim()})}else{s.roles.push({id:fleet.id('role'),name,description:f.description.trim(),order:s.roles.length})}});if(saved)this.cancelForm()},
  deleteRole(e){const id=e.currentTarget.dataset.id,count=Object.values(store.load().assignments).filter(a=>a.roleId===id).length;wx.showModal({title:'删除职责？',content:'将移除 '+count+' 条职责关联，玩家车辆仍保留。',success:r=>{if(r.confirm)this.mutateRoles(s=>fleet.deleteRole(s,id))}})},
  moveRole(e){return this.reorder('roles',e.currentTarget.dataset.id,Number(e.currentTarget.dataset.dir))},
  roleDragStart(e){this.dragRole=e.currentTarget.dataset.id;this.setData({draggingRole:this.dragRole})},
  roleDragEnd(e){
    const id=this.dragRole;this.dragRole='';this.setData({draggingRole:''});if(!id)return
    const y=e.changedTouches[0].clientY
    this.createSelectorQuery().selectAll('.role-sort').boundingClientRect(rects=>{
      const index=rects.findIndex(r=>y>=r.top&&y<=r.bottom);if(index<0)return
      this.mutateRoles(s=>{const rows=s.roles.slice().sort((a,b)=>a.order-b.order),old=rows.findIndex(r=>r.id===id);if(old<0)return;const row=rows.splice(old,1)[0];rows.splice(index,0,row);rows.forEach((r,i)=>{r.order=i});s.roles=rows})
    }).exec()
  },
  roleDragMove(){},
  editAsset(e){const member=e.currentTarget.dataset.member||this.data.memberId;if(member!==store.currentMember())return wx.showToast({title:'只能登记自己的车辆',icon:'none'});this.setData({editor:true,editVehicleId:e.currentTarget.dataset.id})},
  cancel(){this.setData({editor:false})},
  saved(){this.setData({editor:false});this.refresh()},
  removeAsset(e){const id=e.currentTarget.dataset.asset;if((store.load().assets[id]||{}).memberId!==store.currentMember())return error(new Error('只能移除自己的车辆'));wx.showModal({title:'移除我的车辆？',content:'移除该车辆及手工职责。若仍被目标路线引用，将重新建立计划前置。',success:r=>{if(r.confirm)this.mutate(s=>fleet.removeAsset(s,id))}})},
  tree(e){navigation.visit('pages/aw-tree/index',{id:e.currentTarget.dataset.id})},
  detail(e){navigation.visit('pages/aw-vehicle/index',{id:e.currentTarget.dataset.id})},
  addVehicle(){navigation.visit('pages/aw-catalog/index')},
  token(e){if(!store.canEdit(this.data.memberId))return error(new Error('请先关联成员存档码'));const v=e.detail.value;if(!/^\d+$/.test(v))return error(new Error('Token 数量必须为非负整数'));const value=Number(v);if(!Number.isSafeInteger(value))return error(new Error('Token 数量过大'));this.mutate(s=>{s.tokens[fleet.assetKey(this.data.memberId,e.currentTarget.dataset.id)]=value})},
  target(e){this.setData({targetId:e.currentTarget.dataset.id});this.refresh()},
  pickRoute(e){const {vehicle}=e.currentTarget.dataset,list=fleet.paths(vehicle),selected=list[Number(e.detail.value)];this.mutate(s=>{s.routes[fleet.assetKey(this.data.memberId,vehicle)]=selected.id})},
  routeChoice(e){const c=this.data.choices[Number(e.currentTarget.dataset.index)],p=c.paths[Number(e.detail.value)];this.mutate(s=>{s.routes[fleet.assetKey(this.data.memberId,c.vehicleId)]=p.id})},
  confirmRequirement(e){this.mutate(s=>{s.confirmedRequirements[fleet.assetKey(this.data.memberId,e.currentTarget.dataset.id)]=e.detail.value})},
  confirmReward(e){this.mutate(s=>{s.confirmedRewards[fleet.assetKey(this.data.memberId,e.currentTarget.dataset.id)]=e.detail.value})},
  archiveField(e){this.setData({[e.currentTarget.dataset.key]:e.detail.value})},
  async runArchive(fn){this.setData({busy:true});try{const result=await fn();if(result!==false)wx.showToast({title:'操作完成',icon:'success'})}catch(e){error(e)}finally{this.setData({busy:false});this.refresh()}},
  createTeam(){return this.runArchive(()=>store.createTeam(this.data.teamNameInput||'我的车队'))},
  joinTeam(){return this.runArchive(async()=>{await store.openTeam(this.data.teamCodeInput);this.setData({memberId:'',memberCodeInput:'',tab:'players'})})},
  joinMember(){return this.runArchive(async()=>{const joined=await identity.connect(this.data.memberCodeInput);if(joined)this.setData({memberId:store.currentMember(),memberCodeInput:''});return joined})},
  publishMember(){return this.runArchive(async()=>{await store.publishMember(store.currentMember());this.setData({memberId:store.currentMember()})})},
  copyTeam(){wx.setClipboardData({data:store.remoteInfo().teamCode})},
  copyMember(){const code=store.memberInfo(store.currentMember()).code;if(code)wx.setClipboardData({data:code})},
  switchLocal(){wx.showModal({title:'切换到本地车队？',content:'当前车队及未上传改动会留在本机缓存中，个人存档不会删除。',success:r=>{if(r.confirm){store.localTeam();this.setData({memberId:'',targetId:''});this.refresh()}}})},
  unlinkMember(){const id=store.currentMember();if(!id)return;wx.showModal({title:'退出车队？',content:'移除你在此车队的职责安排，保留自己的玩家码、车辆和其他车队记录。',success:r=>{if(r.confirm)this.runArchive(async()=>{await store.unlinkMember(id);this.setData({memberId:'',memberCodeInput:''})})}})},
  async push(){this.setData({busy:true});try{await store.push();wx.showToast({title:'已同步',icon:'success'})}catch(e){error(e)}finally{this.setData({busy:false});this.refresh()}},
  async pull(){this.setData({busy:true});try{await store.pull()}catch(e){error(e)}finally{this.setData({busy:false});this.refresh()}},
  replaceCloud(){wx.showModal({title:'重新载入云端？',content:'备份包含存档码，请妥善保存。继续将用云端替换当前车队及成员资料的本地未同步版本。',success:async r=>{if(!r.confirm)return;this.setData({busy:true});try{await store.discardAndPull()}catch(e){error(e)}finally{this.setData({busy:false});this.refresh()}}})},
  backup(){wx.setClipboardData({data:store.exportText()})},

})
