const store = require('./store')
const updates = require('./catalog-update')
module.exports = async function refreshAll() {
  // Archive refresh keeps upload-before-download; public data is independent.
  const tasks = [store.syncInfo().ready ? store.refresh() : Promise.resolve(false), updates.check(true)]
  const outcomes = await Promise.all(tasks.map(p=>p.then(value=>({value}),error=>({error}))))
  return {error:outcomes.map((r,i)=>r.error?(i?'资料更新：':'存档同步：')+r.error.message:'').filter(Boolean).join('；'),updated:!!(outcomes[1].value||{}).updated}
}
