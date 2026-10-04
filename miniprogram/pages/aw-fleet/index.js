const navigation = require('../../utils/aw/navigation')
const catalog = require('../../utils/aw/catalog')
const fleet = require('../../utils/aw/fleet')
const store = require('../../utils/aw/store')
const identity = require('../../utils/aw/identity')
const tokenPlan = require('../../utils/aw/token-plan')
const updates = require('../../utils/aw/catalog-update')
const refreshAll = require('../../utils/aw/refresh-all')
function error(e) { wx.showModal({title:'操作未完成',content:e.message||String(e),showCancel:false}) }
Page({
  data:{prerequisiteForm:null,syncError:'',tab:'overview',memberId:'',targetId:'',editor:false,editVehicleId:'',editMemberId:'',memberForm:null,roleForm:null,busy:false,teamCodeInput:'',teamNameInput:'',memberCodeInput:'',showArchives:false,memberSearch:'',expandedSteps:{},expandedTokens:{},fieldError:'',keyboardHeight:0},
  configurePrerequisites(e){const d=e.currentTarget.dataset;this.setData({prerequisiteForm:{vehicleId:d.vehicle||d.id||this.data.id,memberId:d.member||store.currentMember()}})},
  closePrerequisites(){this.setData({prerequisiteForm:null});this.refresh()},
  prerequisitesSaved(){this.closePrerequisites()},
  onLoad(o){updates.init();this.setData({tab:o.tab||'overview',memberId:o.member||store.currentMember(),targetId:o.target||''});this.refresh()},
  async onShow(){if(this.data.editor||this.data.prerequisiteForm||this.data.memberForm||this.data.roleForm)return;this.refresh();this.setData({busy:store.connected});await Promise.all([updates.check(false).catch(()=>{}),(async()=>{try{await store.refreshIfClean();this.setData({syncError:''})}catch(e){this.setData({syncError:'未能读取车队最新信息：'+e.message})}})()]);this.setData({busy:false});this.refresh()},
  receiveNavigation(o){this.setData({tab:o.tab||this.data.tab,memberId:o.member||this.data.memberId,targetId:o.target||''});this.refresh()},
  refresh(){
    const s=store.load(), members=s.members.slice().sort((a,b)=>a.order-b.order).map(m=>{
      const a=Object.values(s.assets).filter(x=>x.memberId===m.id&&(x.explicit||Object.values(s.assignments).some(a=>a.assetId===x.id)))
      return Object.assign({},m,{owned:a.filter(x=>x.status==='owned').length,planned:a.filter(x=>x.status==='planned').length})
    })
    let memberId=this.data.memberId
    if(!members.some(m=>m.id===memberId)) memberId=(members.find(m=>m.active)||members[0]||{}).id||''
    const member=members.find(m=>m.id===memberId)||null
    const assets=Object.values(s.assets).filter(a=>a.memberId===memberId&&(a.explicit||Object.values(s.assignments).some(x=>x.assetId===a.id))).map(a=>{
      const v=catalog.byId[a.vehicleId]||{name:'资料待补全'}
      return Object.assign({},fleet.summary(s,a.vehicleId).find(x=>x.id===a.id),{name:v.name_zh||v.name})
    }).sort((a,b)=>a.name.localeCompare(b.name))
    const targets=fleet.planningTargets(s,memberId).map(t=>Object.assign({},t,{vehicleId:s.assets[t.assetId].vehicleId,prerequisite:fleet.prerequisiteStatus(s,memberId,s.assets[t.assetId].vehicleId),name:(catalog.byId[s.assets[t.assetId].vehicleId]||{}).name,roleName:(s.roles.find(r=>r.id===t.roleId)||{}).name||'车辆计划',levelText:t.level==='planned'?'未分配职责':catalog.label(t.level)}))
    let targetId=this.data.targetId
    if(!targets.some(t=>t.id===targetId))targetId=''
    const unionPlan=memberId?fleet.memberPlan(s,memberId):null
    const plan=targetId?fleet.memberPlan(s,memberId,targetId):unionPlan
    this.setData({archive:store.remoteInfo(),selfName:(members.find(m=>m.id===store.currentMember())||{}).name||'',selfArchive:store.memberInfo(store.currentMember()),memberArchive:store.memberInfo(memberId),canEditMember:store.canEdit(memberId),members,memberId,member,memberIndex:members.findIndex(m=>m.id===memberId),playerAssets:assets,roles:s.roles.slice().sort((a,b)=>a.order-b.order),overview:fleet.overview(s),targets,targetId,plan,unionPlan,planningWarnings:unionPlan?unionPlan.warnings.filter(x=>!x.includes('需要前置')).map(x=>x.replace(/待核实/g,'暂不可计算')):[],
      sync:store.syncInfo(),catalogInfo:updates.info(),visibleMembers:members.filter(m=>m.name.toLowerCase().includes(this.data.memberSearch.toLowerCase())),currentId:store.currentMember(),connected:store.connected,dirty:store.dirty,legacyCount:s.legacyAudit.length})
  },
  async mutate(fn){
    if(store.busy||this.data.busy)return false
    this.setData({busy:true,syncError:'',fieldError:''})
    try{const next=fleet.clone(store.load());fn(next);await store.saveAndSync(next);return true}
    catch(e){if(e.localSaved){this.setData({syncError:'已保存本地，同步未完成：'+e.message});return true}this.setData({fieldError:e.message});return false}
    finally{this.setData({busy:false});this.refresh()}
  },
  mutateRoles(fn){return this.mutate(fn)},
  archives(){this.setData({showArchives:!this.data.showArchives})},
  memberSearch(e){this.setData({memberSearch:e.detail.value});this.refresh()},
  step(e){const id=e.currentTarget.dataset.id;this.setData({['expandedSteps.'+id]:!this.data.expandedSteps[id]})},
  tokenDetails(e){const id=e.currentTarget.dataset.id;this.setData({['expandedTokens.'+id]:!this.data.expandedTokens[id]})},
  keyboard(e){this.setData({keyboardHeight:Number(e.detail.height)||0})},
  tab(e){this.setData({tab:e.currentTarget.dataset.tab});this.refresh()},
  awHome(){navigation.visit('pages/aw-home/index')},
  selectMember(e){this.setData({memberId:e.currentTarget.dataset.id,targetId:''});this.refresh()},
  pickMember(e){const m=this.data.members[Number(e.detail.value)];this.setData({memberId:m.id,targetId:''});this.refresh()},
  newMember(){if(store.currentMember())return error(new Error('已经有自己的玩家档'));this.setData({fieldError:'',memberForm:{id:'',name:''}})},
  renameMember(){if(!store.canEdit(this.data.memberId))return error(new Error('只能修改自己的玩家信息'));if(this.data.member)this.setData({memberForm:{id:this.data.member.id,name:this.data.member.name}})},
  memberName(e){this.setData({'memberForm.name':e.detail.value})},
  cancelForm(){if(this.data.busy)return;this.setData({memberForm:null,roleForm:null,fieldError:'',keyboardHeight:0})},
  async saveMember(){
    if(this.data.busy)return
    const form=this.data.memberForm,name=form.name.trim();if(!name)return this.setData({fieldError:'请填写成员名称'})
    if(form.id){if(!store.canEdit(form.id))return error(new Error('只能修改自己的名字'));if(await this.mutate(s=>{s.members.find(m=>m.id===form.id).name=name}))this.cancelForm();return}
    return this.runArchive(async()=>{if(await identity.create(name)){this.setData({memberId:store.currentMember()});this.cancelForm()}})
  },
  reorder(key,id,dir){return this.mutateRoles(s=>{const items=s[key].slice().sort((a,b)=>a.order-b.order),i=items.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=items.length)return;[items[i],items[j]]=[items[j],items[i]];items.forEach((x,k)=>{x.order=k});s[key]=items})},
  newRole(){this.setData({fieldError:'',roleForm:{id:'',name:'',description:''}})},
  editRole(e){const r=store.load().roles.find(x=>x.id===e.currentTarget.dataset.id);this.setData({roleForm:fleet.clone(r)})},
  roleField(e){this.setData({['roleForm.'+e.currentTarget.dataset.key]:e.detail.value})},
  async saveRole(){if(this.data.busy)return;const f=this.data.roleForm,name=f.name.trim();if(!name)return this.setData({fieldError:'请填写职责名称'});const saved=await this.mutateRoles(s=>{if(f.id){Object.assign(s.roles.find(x=>x.id===f.id),{name,description:f.description.trim()})}else{s.roles.push({id:fleet.id('role'),name,description:f.description.trim(),order:s.roles.length})}});if(saved)this.cancelForm()},
  deleteRole(e){const id=e.currentTarget.dataset.id,count=Object.values(store.load().assignments).filter(a=>a.roleId===id).length;wx.showModal({title:'删除职责？',content:'将移除 '+count+' 条职责关联，玩家车辆仍保留。',success:r=>{if(r.confirm)this.mutateRoles(s=>fleet.deleteRole(s,id))}})},
  moveRole(e){return this.reorder('roles',e.currentTarget.dataset.id,Number(e.currentTarget.dataset.dir))},
  roleDragStart(e){this.dragRole=e.currentTarget.dataset.id;this.setData({draggingRole:this.dragRole})},
  roleDragEnd(e){
    const id=this.dragRole;this.dragRole='';this.setData({draggingRole:''});if(!id)return
    const y=e.changedTouches[0].clientY
    this.createSelectorQuery().selectAll('.role-sort').boundingClientRect(rects=>{
      const index=rects.findIndex(r=>y>=r.top&&y<=r.bottom);if(index<0)return
      this.mutateRoles(s=>{const rows=s.roles.slice().sort((a,b)=>a.order-b.order),old=rows.findIndex(r=>r.id===id);if(old<0||old===index)return;const row=rows.splice(old,1)[0];rows.splice(index,0,row);rows.forEach((r,i)=>{r.order=i});s.roles=rows})
    }).exec()
  },
  roleDragMove(){},
  editAsset(e){const member=e.currentTarget.dataset.member||this.data.memberId;if(member!==store.currentMember())return wx.showToast({title:'只能登记自己的车辆',icon:'none'});this.setData({editor:true,editVehicleId:e.currentTarget.dataset.id})},
  cancel(){this.setData({editor:false});this.refresh()},
  saved(){this.setData({editor:false});this.refresh()},
  removeAsset(e){const id=e.currentTarget.dataset.asset;if((store.load().assets[id]||{}).memberId!==store.currentMember())return error(new Error('只能移除自己的车辆'));wx.showModal({title:'移除我的车辆？',content:'移除该车辆及手工职责。若仍被目标路线引用，将重新建立计划前置。',success:r=>{if(r.confirm)this.mutate(s=>fleet.removeAsset(s,id))}})},
  tree(e){navigation.visit('pages/aw-tree/index',{id:e.currentTarget.dataset.id})},
  detail(e){navigation.visit('pages/aw-vehicle/index',{id:e.currentTarget.dataset.id})},
  addVehicle(){navigation.visit('pages/aw-catalog/index')},
  target(e){this.setData({targetId:e.currentTarget.dataset.id||''});this.refresh()},
  confirmRequirement(e){return this.mutate(s=>{s.confirmedRequirements[fleet.assetKey(this.data.memberId,e.currentTarget.dataset.id)]=e.currentTarget.dataset.value==='yes'})},
  rewardState(e){return this.mutate(s=>{const {vehicle,id,state}=e.currentTarget.dataset;const a=fleet.ensureAsset(s,this.data.memberId,vehicle);tokenPlan.setReward(a,id,state)})},
  addTokenSource(e){return this.mutate(s=>{const a=fleet.ensureAsset(s,this.data.memberId,e.currentTarget.dataset.id);a.explicit=true;a.tokenSupply=true;a.prerequisites={mode:'ignore',pathId:'',customVehicleIds:[],tokenSourceVehicleIds:[]}})},
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
  async refreshCloud(){
    if(this.data.editor||this.data.prerequisiteForm||this.data.memberForm||this.data.roleForm){this.setData({syncError:'请先保存或取消编辑，再刷新'});return}
    this.setData({busy:true,syncError:''})
    try{const result=await refreshAll();this.setData({syncError:result.error});if(!result.error)wx.showToast({title:result.updated?'资料已更新':'已刷新',icon:'success'})}
    catch(e){this.setData({syncError:e.message})}finally{this.setData({busy:false});this.refresh()}
  },
  replaceCloud(){wx.showModal({title:'重新载入云端？',content:'备份包含存档码，请妥善保存。继续将用云端替换当前车队及成员资料的本地未同步版本。',success:async r=>{if(!r.confirm)return;this.setData({busy:true});try{await store.discardAndPull()}catch(e){error(e)}finally{this.setData({busy:false});this.refresh()}}})},
  backup(){wx.setClipboardData({data:store.exportText()})},

})
