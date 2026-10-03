const store=require('./store')
const fleet=require('./fleet')
function confirmJoin(name){return new Promise((resolve,reject)=>wx.showModal({title:'加入车队？',content:name+' 尚未加入此车队，是否加入？',success:r=>resolve(!!r.confirm),fail:reject}))}
async function connect(code){
  const result=await store.attachMember(code)
  if(result.needsJoin){if(!await confirmJoin(result.name))return false;await store.attachMember(code,true)}
  return true
}
async function create(name){
  name=String(name||'').trim();if(!name)throw new Error('请填写自己的名字')
  if(store.currentMember())throw new Error('已有自己的玩家档，请使用玩家码读取或修改名字')
  if(store.connected){
    const code=await store.createPersonalArchive(name)
    // Keep the newly issued credential recoverable even if the user cancels joining.
    wx.setClipboardData({data:code})
    return connect(code)
  }
  const next=fleet.clone(store.load()),id=fleet.id('member')
  next.members.push({id,name,active:true,order:next.members.length});store.save(next)
  return true
}
module.exports={connect,create}
