const snapshot = require('../../data/aw/catalog')
const presentation = require('../../data/aw/presentation')
const ammoEvidence = require('../../data/aw/ammo-classification.json')
const labels = {
  default: '默认', research: '研发', upgrade: '升级', unknown: '待确认', absent: '确认不具备',
  public_verified: '公开资料已核验', needs_ingame_check: '待游戏内核实', ingame_verified: '游戏内已核验',
  progression: '研发线', premium: '高级车', event: '活动', special: '特殊获取', other: '其他',
  self_guided: '自导', fire_and_forget: '射后不理', primary: '主力', backup: '备选', transition: '过渡',
  owned: '已拥有', planned: '计划', gun: '火炮', autocannon: '机炮', atgm: '反坦克导弹',
  cannon: '火炮', missile: '导弹', missile_launcher: '导弹发射器', atgm_launcher: '反坦克导弹',
  wiki: 'Wiki', official: '官方', manual: '手工', tech_tree: '科技树自动'
}
function label(k) { return labels[k] || k || '未知' }
function present(v) { return v !== null && v !== undefined && v !== '' }
function rows(table, field, value) { return (tables[table] || []).filter(x => x[field] === value) }
let tables = {}, checkedAt = '', byId = {}, capByCode = {}, traitByCode = {}
function install(data, stamp) {
  tables = data; checkedAt = stamp
  byId = {}; Object.keys(tables).forEach(k => (tables[k] || []).forEach(r => { if (r.id) byId[r.id] = r }))
  capByCode = {}; (tables.capabilities || []).forEach(r => { capByCode[r.code] = r })
  traitByCode = {}; (tables.ammo_traits || []).forEach(r => { traitByCode[r.code] = r })
}
function decode(pack) {
  const t = {}; Object.keys(pack.tables).forEach(k => {
    const x = pack.tables[k]; t[k] = x.rows.map(a => { const r = {}; x.columns.forEach((c, i) => { r[c] = typeof a[i] === 'string' && a[i][0] === '@' && pack.strings ? pack.strings[Number(a[i].slice(1))] : a[i] }); return r })
  }); return t
}
install(decode(snapshot), snapshot.checkedAt)
function capabilities(vehicleId) {
  const result = rows('vehicle_capabilities', 'vehicle_id', vehicleId).map(c => Object.assign({}, c, {
    name: (capByCode[c.capability_code] || {}).name_zh || c.capability_code,
    statusText: label(c.availability), era: rows('vehicle_era', 'capability_id', c.id),
    infantry: rows('vehicle_infantry', 'capability_id', c.id)
  }))
  return result
}
function capabilityMatch(vehicleId, code, factory) {
  const allowed = factory ? ['default'] : ['default', 'research', 'upgrade']
  return capabilities(vehicleId).some(c => {
    let current = c.capability_code, seen = {}
    while (current && !seen[current]) {
      seen[current] = true
      if (current === code && allowed.indexOf(c.availability) >= 0) return true
      current = (capByCode[current] || {}).parent_code
    }
    return false
  })
}
function ammoFor(vehicleId) {
  return rows('vehicle_weapons', 'vehicle_id', vehicleId).reduce((out, w) => out.concat(rows('vehicle_ammo', 'weapon_id', w.id).map(a => Object.assign({}, a, {
    weaponName: w.name,
    classification: ammoEvidence.entries[a.id] || null,
    traits: Array.from(new Set(rows('ammo_trait_links', 'ammo_id', a.id).map(x => x.trait_code).concat(rows('ammo_guidance_modes', 'ammo_id', a.id).map(x => x.mode_code), (ammoEvidence.entries[a.id] || {}).traits || [])))
  }))), [])
}
function ammoMatch(a, f) {
  return (!(f.ammoTypes || []).length || f.ammoTypes.indexOf(a.ammo_type) >= 0) &&
    (f.ammoTraits || []).every(c => a.traits.indexOf(c) >= 0) &&
    (!present(f.penetration) || (present(a.penetration) && Number(a.penetration) >= Number(f.penetration)))
}
function filter(f) {
  const group = (key, value) => !(f[key] || []).length || f[key].indexOf(value) >= 0
  return (tables.vehicles || []).filter(v => {
    if (f.query && (v.name + ' ' + (v.name_zh || '')).toLowerCase().indexOf(f.query.toLowerCase().trim()) < 0) return false
    if (!group('tiers', v.is_legendary ? 'legendary' : String(v.tier)) || !group('classes', v.vehicle_class) || !group('dealers', v.dealer_id) || !group('acquisition', v.acquisition_type)) return false
    if (present(f.premium) && v.is_premium !== (f.premium === 'yes')) return false
    if (present(f.researchable) && v.is_currently_researchable !== (f.researchable === 'yes')) return false
    if (!(f.capabilities || []).every(c => capabilityMatch(v.id, c, f.factory))) return false
    for (const pair of [['speed', 'top_speed'], ['view', 'view_range'], ['camo', 'camouflage']]) {
      if (present(f[pair[0]]) && (!present(v[pair[1]]) || Number(v[pair[1]]) < Number(f[pair[0]]))) return false
    }
    if ((f.ammoTypes || []).length || (f.ammoTraits || []).length || present(f.penetration)) {
      if (!ammoFor(v.id).some(a => ammoMatch(a, f))) return false
    }
    return true
  }).sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name))
}
const fields = {
  hp: ['生命值', ''], top_speed: ['最高速度', ' km/h'], view_range: ['视野', ' m'], camouflage: ['隐蔽', '%'],
  reverse_speed: ['倒车速度', ' km/h'], hull_traverse: ['车体转速', ' °/s'], turret_traverse: ['炮塔转速', ' °/s'],
  acceleration_0_32_seconds: ['0–32 km/h', ' s'], weight_t: ['重量', ' t'], engine_power_hp: ['发动机功率', ' hp'], power_to_weight_hp_t: ['推重比', ' hp/t'],
  damage: ['伤害', ''], penetration: ['穿深', ' mm'], velocity: ['初速', ' m/s'], range: ['射程', ' m'],
  reload_seconds: ['装填', ' s'], magazine_size: ['弹匣容量', ''], rate_of_fire: ['射速', ' 发/分'], intra_clip_reload: ['弹间装填', ' s'],
  accuracy_deg: ['精度', '°'], aim_time: ['瞄准时间', ' s'], module_damage: ['模块伤害', ''], module_damage_bonus_pct: ['模块伤害加成', '%'],
  explosion_radius_m: ['爆炸半径', ' m'], penetration_reference_m: ['穿深参考距离', ' m'], caliber_mm: ['口径', ' mm'],
  elevation_deg: ['仰角', '°'], depression_deg: ['俯角', '°'], xp_cost: ['XP', ''], credit_cost: ['银币', ''], hp_bonus: ['生命加成', ''],
  top_speed_kmh: ['最高速度', ' km/h'], reverse_speed_kmh: ['倒车速度', ' km/h'],
  era_name: ['ERA 名称', ''], era_type: ['类型', ''], generation: ['代数', ''], layer_count: ['层数', ''], ap_reduction_pct: ['AP 减伤', '%'], heat_reduction_pct: ['HEAT 减伤', '%'],
  infantry_type: ['步兵类型', ''], squad_count: ['班数量', ''], trooper_count: ['人数', ''], deployment_cooldown_seconds: ['部署冷却', ' s'],
  location: ['位置', ''], thickness_mm: ['厚度', ' mm'], effective_ap_mm: ['AP 等效', ' mm'], effective_heat_mm: ['HEAT 等效', ' mm'], composition: ['材质', '']
}
function metrics(row, keys, fallback) {
  return keys.filter(k => present(row[k]) || (fallback && present(fallback[k]))).map(k => ({ key: k, name: (fields[k] || [k])[0], value: (present(row[k]) ? row[k] : fallback[k]) + ((fields[k] || ['', ''])[1] || '') }))
}
function tagName(c) { return (traitByCode[c] || {}).name_zh || label(c) }
function ammoColor(type) {
  if (typeof type === 'object') {
    const warhead = type.classification && type.classification.warhead_type
    if (warhead && warhead !== 'unknown') return ({kinetic:'ap',heat:'heat',tandem_heat:'heat',thermobaric:'he',he:'he',hesh:'hesh',pele:'hesh',smoke:'smoke'})[warhead] || 'unknown'
    type = type.ammo_type
  }
  if (['ap','apfsds','apds','apcr'].includes(type)) return 'ap'
  if (type === 'heat') return 'heat'
  if (type === 'he') return 'he'
  if (type === 'hesh') return 'hesh'
  // ATGM is a delivery mechanism, not evidence of a HEAT warhead.
  return 'unknown'
}
function weaponGroups(vehicleId, weapons, evidence) {
  const used = {}, groups = []
  ;(evidence || presentation.exclusiveWeaponGroups).filter(g => g.vehicleId === vehicleId).forEach(g => {
    const ids = Array.from(new Set(g.weaponIds || []))
    if (ids.length < 2 || !g.sourceNote || ids.some(id => used[id] || !weapons.some(w => w.id === id))) return
    ids.forEach(id => { used[id] = true })
    groups.push({ id:g.id, exclusive:true, label:ids.length === 2 ? '二选一' : '仅可选择其中一种', sourceNote:g.sourceNote, weapons:ids.map(id => weapons.find(w => w.id === id)) })
  })
  weapons.filter(w => !used[w.id]).forEach(w => groups.push({ id:w.id, exclusive:false, weapons:[w] }))
  return groups
}
function card(v, f) {
  const caps = capabilities(v.id).filter(c => c.availability !== 'absent').slice(0, 5).map(c => c.name + (c.availability === 'default' ? '' : ' · ' + label(c.availability)))
  const match = f && ammoFor(v.id).find(a => ammoMatch(a, f))
  const constrained = f && ((f.ammoTypes || []).length || (f.ammoTraits || []).length || present(f.penetration))
  return Object.assign({}, v, { displayName: v.name_zh || v.name, caps, performance: metrics(v, ['top_speed', 'view_range', 'camouflage']).map(x => x.value).join(' · '),
    ammoSummary: constrained && match ? match.name + (present(match.penetration) ? ' · ' + match.penetration + ' mm' : '') : '',
    quality: label(v.verification_status) })
}
function detail(id) {
  const v = byId[id]; if (!v) return null
  const configs = {}, ws = rows('vehicle_weapons', 'vehicle_id', id)
  ws.forEach(w => {
    const key = w.configuration_key || 'unknown'; if (!configs[key]) configs[key] = []
    const ammo = ammoFor(id).filter(a => a.weapon_id === w.id).map(a => Object.assign({}, a, {
      colorClass: ammoColor(a), typeLabel: (a.ammo_type || '未知').toUpperCase(),
      warheadLabel: a.classification ? ({kinetic:'动能',heat:'HEAT',tandem_heat:'串联 HEAT',thermobaric:'温压',he:'HE',hesh:'HESH / HEP',pele:'PELE',smoke:'烟幕',unknown:'弹头待核实'})[a.classification.warhead_type] : '',
      tagNames: a.traits.map(tagName), params: metrics(a, ['damage', 'penetration', 'velocity', 'range', 'reload_seconds', 'magazine_size', 'rate_of_fire', 'intra_clip_reload', 'accuracy_deg', 'module_damage', 'module_damage_bonus_pct', 'explosion_radius_m', 'penetration_reference_m'], w),
      guidance: rows('ammo_guidance_modes', 'ammo_id', a.id).filter(x => present(x.lock_time_seconds)).map(x => tagName(x.mode_code) + ' · 锁定 ' + x.lock_time_seconds + ' s'),
      quality: label(a.verification_status), availabilityText: a.requires_research === true ? '研发' : a.requires_research === false ? '默认' : '待确认'
    }))
    configs[key].push(Object.assign({}, w, { typeText: label(w.weapon_type), ammo, params: metrics(w, ['caliber_mm', 'reload_seconds', 'magazine_size', 'rate_of_fire', 'accuracy_deg', 'aim_time', 'elevation_deg', 'depression_deg']), quality: label(w.verification_status) }))
  })
  const caps = capabilities(id).map(c => Object.assign({}, c, { params: c.era.concat(c.infantry).reduce((out, r) => out.concat(metrics(r, Object.keys(fields).filter(k => present(r[k])))), []) }))
  return Object.assign(card(v), { dealerName: (byId[v.dealer_id] || {}).name || '', acquisitionText: label(v.acquisition_type),
    core: metrics(v, ['hp', 'top_speed', 'view_range', 'camouflage']), more: metrics(v, ['reverse_speed', 'hull_traverse', 'turret_traverse', 'acceleration_0_32_seconds', 'weight_t', 'engine_power_hp', 'power_to_weight_hp_t']),
    basis: (v.performance_basis && v.performance_basis.tags || []).join(' · ') || '性能口径待核实',
    basisDetails: [['指挥官加成', 'commander_included'], ['乘员加成', 'crew_included'], ['改装加成', 'retrofits_included'], ['来源版本', 'source_version']].map(([name, key]) => ({ name, value: !present((v.performance_basis || {})[key]) ? '待确认' : v.performance_basis[key] === true ? '包含' : v.performance_basis[key] === false ? '不包含' : v.performance_basis[key] })),
    configs: Object.keys(configs).map((key, i) => ({ key, name: key === 'unresolved' ? '配置待确认' : key === 'announced' ? '公布配置' : '配置 ' + (i + 1), weapons: configs[key] })),
    weaponGroups: weaponGroups(id, Object.keys(configs).reduce((out,key,i) => out.concat(configs[key].map(w => Object.assign({},w,{configurationText:Object.keys(configs).length > 1 ? '资料分组 ' + (i + 1) : ''}))), [])),
    capabilities: caps, upgradeGroups: ['default', 'research', 'upgrade', 'unknown'].map(a => ({ name: label(a), items: rows('vehicle_upgrades', 'vehicle_id', id).filter(u => u.availability === a).map(u => Object.assign({}, u, { params: metrics(u, ['xp_cost', 'credit_cost', 'hp_bonus', 'top_speed_kmh', 'reverse_speed_kmh', 'engine_power_hp']), quality: label(u.verification_status) })) })).filter(g => g.items.length),
    armor: rows('vehicle_armor', 'vehicle_id', id).map(a => ({ id: a.id, params: metrics(a, ['location', 'composition', 'thickness_mm', 'effective_ap_mm', 'effective_heat_mm']), source_url: a.source_url })),
    rewards: rows('vehicle_token_rewards', 'vehicle_id', id).map(r => Object.assign({}, r, { tokenName: (byId[r.token_id] || {}).name || 'Token' })),
    paths: rows('unlock_paths', 'vehicle_id', id).filter(p => !p.target_upgrade_id).map(p => Object.assign({}, p, { requirements: rows('unlock_requirements', 'unlock_path_id', p.id) })),
    related: (tables.vehicle_progression_edges || []).filter(e => e.from_vehicle_id === id || e.to_vehicle_id === id).map(e => ({ id: e.from_vehicle_id === id ? e.to_vehicle_id : e.from_vehicle_id, direction: e.from_vehicle_id === id ? '后续' : '前置', name: (byId[e.from_vehicle_id === id ? e.to_vehicle_id : e.from_vehicle_id] || {}).name || '待补全' }))
  })
}
module.exports = { label, present, rows, filter, detail, card, metrics, capabilityMatch, ammoFor, ammoMatch, tagName, ammoColor, weaponGroups, install,
  get tables() { return tables }, get checkedAt() { return checkedAt }, get byId() { return byId } }
