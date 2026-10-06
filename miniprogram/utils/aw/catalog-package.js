// Shared pure protocol for the mini-program and offline publisher.
const schema = require('../../data/aw/schema')
const sha256 = require('./checksum')
const names = Object.keys(schema).sort(), maxBytes = 8 * 1024 * 1024
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k)
function invalid(message) { throw new Error('资料包校验失败：' + message) }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) }
function stringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stringify).join(',') + ']'
  if (object(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stringify(value[k])).join(',') + '}'
  const result = JSON.stringify(value)
  if (result === undefined) invalid('内容包含非 JSON 值')
  return result
}
function key(name, row) {
  const values = schema[name].primaryKey.map(k => row[k])
  if (values.some(v => typeof v !== 'string' || !v)) invalid(name+' 主键无效')
  return JSON.stringify(values)
}
function validateManifest(m) {
  if (m && m.schemaVersion !== 1) invalid('schemaVersion 不兼容：数据结构需要升级小程序')
  if (!m || m.schemaVersion !== 1 || (m.module !== undefined && m.module !== 'aw') || !Number.isSafeInteger(m.sequence) || m.sequence < 0 || !Number.isFinite(Date.parse(m.publishedAt)) || !Number.isFinite(Date.parse(m.sourceCheckedAt))) invalid('版本格式不兼容')
  if (!/^[a-f0-9]{64}$/.test(m.sha256 || '') || typeof m.version !== 'string' || !m.version.endsWith('-'+m.sha256.slice(0,12))) invalid('版本校验值无效')
  if (!object(m.counts) || Object.keys(m.counts).length !== names.length || names.some(k => !Number.isSafeInteger(m.counts[k]) || m.counts[k] < 0 || m.counts[k] > 30000) || !m.counts.vehicles) invalid('表清单不完整')
  // Malformed optional patch advertisements are ignored; the full path remains available.
  return m
}
function decode(pack) {
  const tables = {}
  if (!pack || !object(pack.tables) || !Array.isArray(pack.strings) || pack.strings.length > 100000 || pack.strings.some(s=>typeof s !== 'string') || Object.keys(pack.tables).length !== names.length) invalid('目录格式错误')
  for (const name of names) {
    const t = pack.tables[name], columns = Object.keys(schema[name].columns)
    if (!t || !Array.isArray(t.columns) || !Array.isArray(t.rows) || t.rows.length > 30000 || new Set(t.columns).size !== t.columns.length || t.columns.some(c=>!own(schema[name].columns,c)) || ((t.rows.length || t.columns.length) && (columns.length !== t.columns.length || columns.some(c=>!t.columns.includes(c))))) invalid(name+' 字段或数量不完整')
    tables[name] = t.rows.map(r => {
      if (!Array.isArray(r) || r.length !== t.columns.length) invalid(name+' 行格式错误')
      const row = {}
      t.columns.forEach((c,i) => {
        let v = r[i]
        if (typeof v === 'string' && v[0] === '@') {
          if (!/^@\d+$/.test(v) || Number(v.slice(1)) >= pack.strings.length) invalid(name+' 字符串索引错误')
          v = pack.strings[Number(v.slice(1))]
        }
        row[c] = v
      })
      return row
    })
  }
  return tables
}
function validateTables(tables) {
  const indexes = new Map()
  function index(table, fields) {
    const id = table+':'+fields.join(',')
    if (!indexes.has(id)) indexes.set(id,new Set(tables[table].map(r=>stringify(fields.map(f=>r[f])))))
    return indexes.get(id)
  }
  for (const name of names) {
    const spec = schema[name], keys = new Set(), uniques = spec.unique.map(()=>new Set())
    tables[name].forEach(row => {
      for (const [field,c] of Object.entries(spec.columns)) {
        const v = row[field]
        if (v == null) { if (c.required) invalid(name+' 必填字段缺失：'+field); continue }
        const valid = c.type === 'boolean' ? typeof v === 'boolean' : /^(smallint|integer)/.test(c.type) ? Number.isSafeInteger(v) : c.type === 'numeric' ? typeof v === 'number' && Number.isFinite(v) : c.type === 'jsonb' ? true : typeof v === 'string'
        if (!valid) invalid(name+' 字段类型错误：'+field)
      }
      const id = key(name,row)
      if (keys.has(id)) invalid(name+' ID 重复或无效'); keys.add(id)
      spec.unique.forEach((fields,i) => {
        if (fields.some(f=>row[f] == null)) return
        const id = stringify(fields.map(f=>row[f]))
        if (uniques[i].has(id)) invalid(name+' 唯一键重复'); uniques[i].add(id)
      })
    })
  }
  for (const name of names) for (const ref of schema[name].references) {
    const target = index(ref.table,ref.target)
    tables[name].forEach(row => {
      const values = ref.fields.map(f=>row[f])
      // PostgreSQL MATCH SIMPLE: a nullable composite FK is checked only when all values exist.
      if (values.every(v=>v != null) && !target.has(stringify(values))) invalid(name+' 关联缺失')
    })
  }
  // Visual labels may degrade to raw text; unfamiliar accounting rules must never be guessed.
  tables.unlock_requirements.forEach(r=>{
    if (r.token_id && (r.requirement_type !== 'dealer_token' || r.operator !== '>=')) invalid('Token 机制需要客户端升级')
  })
}
function validate(bundle) {
  if (!bundle || typeof bundle.payload !== 'string' || bundle.payload.length > maxBytes) invalid('内容不完整或过大')
  const m = validateManifest(bundle.manifest)
  if (sha256(bundle.payload) !== m.sha256) invalid('内容校验值不一致')
  let content
  try { content = JSON.parse(bundle.payload) } catch (_) { invalid('内容无法解析') }
  if (!object(content) || Object.keys(content).sort().join(',') !== 'ammoEvidence,catalog,presentation' || !object(content.catalog) || content.catalog.checkedAt !== m.sourceCheckedAt) invalid('目录格式错误')
  const tables = decode(content.catalog)
  if (names.some(k=>tables[k].length !== m.counts[k])) invalid('字段或数量不完整')
  validateTables(tables)
  const ammoIds = new Set(tables.vehicle_ammo.map(r=>r.id)), vehicleIds = new Set(tables.vehicles.map(r=>r.id))
  const evidence = content.ammoEvidence
  if (!object(evidence) || !object(evidence.entries)) invalid('弹头分类缺失')
  Object.keys(evidence.entries).forEach(id => {
    const e = evidence.entries[id]
    // Classification affects appearance; schema-compatible unfamiliar labels use default styling.
    if (!ammoIds.has(id) || !object(e) || typeof e.warhead_type !== 'string' || !e.warhead_type || !Array.isArray(e.traits) || e.traits.some(t=>typeof t!=='string')) invalid('弹头分类关联错误')
  })
  const presentation = content.presentation
  if (!object(presentation) || !Array.isArray(presentation.exclusiveWeaponGroups)) invalid('武器分组缺失')
  presentation.exclusiveWeaponGroups.forEach(g => {
    if (!vehicleIds.has(g.vehicleId) || !Array.isArray(g.weaponIds) || g.weaponIds.some(id=>!tables.vehicle_weapons.some(w=>w.id===id && w.vehicle_id===g.vehicleId)) || typeof g.sourceNote !== 'string') invalid('武器分组关联错误')
  })
  return content
}
function encode(tables, checkedAt) {
  const allStrings = new Set()
  names.forEach(k=>tables[k].forEach(r=>Object.values(r).forEach(v=>{if(typeof v==='string')allStrings.add(v)})))
  const strings = Array.from(allStrings).sort()
  const dictionary = new Map(strings.map((s,i)=>[s,'@'+i])), packed = {}
  for (const name of names) {
    const columns = Object.keys(schema[name].columns).sort()
    packed[name] = {columns,rows:tables[name].slice().sort((a,b)=>key(name,a)<key(name,b)?-1:key(name,a)>key(name,b)?1:0).map(r=>columns.map(c=>typeof r[c]==='string'?dictionary.get(r[c]):r[c]))}
  }
  return {checkedAt,tables:packed,strings}
}
function canonicalPayload(content) {
  return stringify({catalog:encode(decode(content.catalog),content.catalog.checkedAt),ammoEvidence:content.ammoEvidence,presentation:content.presentation})
}
function applicable(d, base, target) {
  return d && d.schemaVersion === 1 && d.module === 'aw' && d.patchFormat === 1 && d.baseVersion === base.version && d.baseSha256 === base.sha256 && d.targetVersion === target.version && d.resultSha256 === target.sha256 && d.publishedAt === target.publishedAt && d.sourceCheckedAt === target.sourceCheckedAt && /^[a-f0-9]{64}$/.test(d.patchSha256 || '')
}
function applyPatch(base, patch, target) {
  const source = validate(base)
  validateManifest(target)
  if (!patch || !applicable(patch.descriptor,base.manifest,target) || target.sequence <= base.manifest.sequence) invalid('patch baseVersion / targetVersion 不匹配')
  if (typeof patch.payload !== 'string' || patch.payload.length > maxBytes || sha256(patch.payload) !== patch.descriptor.patchSha256) invalid('patch 校验值不一致')
  let changes
  try { changes = JSON.parse(patch.payload) } catch (_) { invalid('patch 无法解析') }
  if (!object(changes) || !object(changes.upserts) || !object(changes.deletes) || changes.checkedAt !== target.sourceCheckedAt || Object.keys(changes).some(k=>!['upserts','deletes','checkedAt','ammoEvidence','presentation','generator','reason'].includes(k))) invalid('patch 格式错误')
  if (changes.generator !== 'stable-key-diff-v1' && !(changes.generator === 'manual' && typeof changes.reason === 'string' && changes.reason.trim())) invalid('patch 生成方式未标记')
  const tables = decode(source.catalog)
  const touched = new Set(Object.keys(changes.upserts).concat(Object.keys(changes.deletes)))
  for (const name of touched) {
    if (!own(schema,name)) invalid('patch 非公共表')
    const upserts = changes.upserts[name] || [], deletes = changes.deletes[name] || [], spec = schema[name]
    if (!Array.isArray(upserts) || !Array.isArray(deletes) || upserts.length > 30000 || deletes.length > 30000) invalid('patch 操作格式错误')
    const records = new Map(tables[name].map(r=>[key(name,r),r])), seen = new Set()
    for (const tuple of deletes) {
      if (!Array.isArray(tuple) || tuple.length !== spec.primaryKey.length) invalid('patch 删除主键错误')
      const id = key(name,Object.fromEntries(spec.primaryKey.map((f,i)=>[f,tuple[i]])))
      if (seen.has(id) || !records.has(id)) invalid('patch 删除重复或不存在')
      seen.add(id); records.delete(id)
    }
    for (const row of upserts) {
      if (!object(row) || Object.keys(row).length !== Object.keys(spec.columns).length || Object.keys(spec.columns).some(c=>!own(row,c))) invalid('patch 行字段不完整')
      const id = key(name,row)
      if (seen.has(id)) invalid('patch 操作主键重复')
      seen.add(id); records.set(id,row)
    }
    tables[name] = Array.from(records.values())
  }
  const content = {catalog:encode(tables,changes.checkedAt),ammoEvidence:own(changes,'ammoEvidence')?changes.ammoEvidence:source.ammoEvidence,presentation:own(changes,'presentation')?changes.presentation:source.presentation}
  const bundle = {manifest:target,payload:stringify(content)}
  if (sha256(bundle.payload) !== patch.descriptor.resultSha256) invalid('resultSha256 校验值不一致')
  validate(bundle)
  return bundle
}
module.exports = {schema,names,key,stringify,decode,encode,canonicalPayload,validate,validateManifest,applicable,applyPatch}
