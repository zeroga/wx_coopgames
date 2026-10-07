// Offline deterministic publisher library. No database, RPC, or private archive access.
// Imported client modules are shared protocol code; review both sides for changes.
const fs = require('node:fs'), path = require('node:path')
const p = require('../miniprogram/utils/aw/catalog-package')
const sha256 = require('../miniprogram/utils/aw/checksum')
function full(content, version, publishedAt) {
  if (!/^\d{4}\.\d{2}\.\d{2}\.\d{1,4}$/.test(version || '') || !Number.isFinite(Date.parse(publishedAt))) throw Error('Expected YYYY.MM.DD.N and ISO publishedAt')
  const parts = version.split('.'), sequence = Number(parts.slice(0,3).join('')) * 10000 + Number(parts[3])
  const payload = p.canonicalPayload(content), hash = sha256(payload)
  const manifest = {schemaVersion:1,module:'aw',encoding:'stable-key-v1',version:'aw-'+version+'-'+hash.slice(0,12),sequence,publishedAt,sourceCheckedAt:content.catalog.checkedAt,sha256:hash,counts:Object.fromEntries(p.names.map(k=>[k,content.catalog.tables[k].rows.length])),patches:[]}
  const bundle = {manifest,payload}; p.validate(bundle); return bundle
}
function patch(from, to) {
  const before = p.validate(from), after = p.validate(to)
  if (to.manifest.sequence <= from.manifest.sequence || to.manifest.version === from.manifest.version) throw Error('Target release must advance the base version')
  if (to.payload !== p.canonicalPayload(after)) throw Error('Target must use stable-key-v1 canonical encoding; rebuild full')
  const old = p.decode(before.catalog), next = p.decode(after.catalog), upserts = {}, deletes = {}
  for (const name of p.names) {
    const a = new Map(old[name].map(r=>[p.key(name,r),r])), b = new Map(next[name].map(r=>[p.key(name,r),r]))
    const changed = [...b.keys()].sort().filter(k=>!a.has(k)||p.stringify(a.get(k))!==p.stringify(b.get(k))).map(k=>b.get(k))
    const removed = [...a.keys()].sort().filter(k=>!b.has(k)).map(k=>JSON.parse(k))
    if (changed.length) upserts[name] = changed
    if (removed.length) deletes[name] = removed
  }
  const changes = {generator:'stable-key-diff-v1',checkedAt:after.catalog.checkedAt,upserts,deletes}
  for (const section of ['ammoEvidence','presentation']) if (p.stringify(before[section]) !== p.stringify(after[section])) changes[section] = after[section]
  const payload = p.stringify(changes), descriptor = {schemaVersion:1,module:'aw',patchFormat:1,baseVersion:from.manifest.version,baseSha256:from.manifest.sha256,targetVersion:to.manifest.version,publishedAt:to.manifest.publishedAt,sourceCheckedAt:to.manifest.sourceCheckedAt,patchSha256:sha256(payload),resultSha256:to.manifest.sha256}
  const result = {descriptor,payload}; verify(from,to,result); return result
}
function verify(from,to,delta) {
  p.validate(to)
  const result = p.applyPatch(from,delta,to.manifest)
  if (result.payload !== to.payload) throw Error('Patch result does not exactly match target full bytes')
  return result
}
function read(file) { return JSON.parse(fs.readFileSync(file,'utf8')) }
function write(file, data) { fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,p.stringify(data)+'\n') }
function archive(dir,bundle) {
  p.validate(bundle)
  if (!/^aw-[a-zA-Z0-9.-]+$/.test(bundle.manifest.version)) throw Error('Unsafe archive version')
  const file = path.join(dir,bundle.manifest.version,'full.json')
  const saved = {manifest:bundle.manifest,payload:bundle.payload}
  if (fs.existsSync(file)) {
    const existing = read(file);p.validate(existing)
    if (p.stringify(existing) !== p.stringify(saved)) throw Error('Immutable release archive already differs: '+file)
  } else write(file,saved)
  return file
}
module.exports = {full,patch,verify,read,write,archive}
