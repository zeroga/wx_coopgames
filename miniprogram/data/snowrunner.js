function v(name) {
  return { id: 'v_' + slug(name), name, got: false, owner: null }
}
function g(text) { return { id: 'g_' + slug(text), text, done: false } }
function slug(s) { return String(s).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '_').replace(/^_+|_+$/g, '').slice(0,64) }

const seasons = {
  S1:{cn:'科拉半岛',en:'Search & Recover',vehicles:['Ford F 750','TUZ 16 Actaeon','TUZ 108 Warthog']},
  S2:{cn:'育空',en:'Explore & Expand',vehicles:['Caterpillar 770G','Caterpillar TH357']},
  S3:{cn:'威斯康星',en:'Locate & Deliver',vehicles:['International Paystar 5600TS','Pacific P512 PF']},
  S4:{cn:'阿穆尔',en:'New Frontiers',vehicles:['ZiKZ 605R','KHAN 317 Sentinel']},
  S5:{cn:'顿河',en:'Build & Dispatch',vehicles:['Tatra FORCE T815-7','Tatra PHOENIX']},
  S6:{cn:'缅因',en:'Haul & Hustle',vehicles:['Tayga 6455B','Aramatsu Forester']},
  S7:{cn:'田纳西',en:'Compete & Conquer',vehicles:['Azov 43-191 Sprinter','GOR BY-4']},
  S8:{cn:'别洛泽尔斯克草原',en:'Grand Harvest',vehicles:['Kirovets K-700','Kirovets K-7M','Step 39331 Pike']},
  S9:{cn:'安大略',en:'Renew & Rebuild',vehicles:['Derry Special 15C-177','ZiKZ 566A']},
  S10:{cn:'不列颠哥伦比亚',en:'Fix & Connect',vehicles:['Kenworth 963','Mack Defense M917']},
  S11:{cn:'斯堪的纳维亚',en:'Lights & Cameras',vehicles:['Burlak 6x6','Neo Falcon 2000']},
  S12:{cn:'北卡罗来纳',en:'Public Energy',vehicles:['FEMM 37-AT','MTB 8106 Rock Grinder']},
  S13:{cn:'阿拉木图',en:'Dig & Drill',vehicles:['PLAD 450','AAC-58DW']},
  S14:{cn:'奥地利',en:'Reap & Sow',vehicles:['EarthRoamer SX','EarthRoamer LTi','Futom 7290RA','Ankatra 1160']},
  S15:{cn:'魁北克',en:'Oil & Dirt',vehicles:['Sleiter ST 816 Elephant','Mercer K520']},
  S16:{cn:'华盛顿州',en:'High Voltage',vehicles:['HIB Billert 1980','PLAD 440 Buddy','Sleiter ST 833 Chimera']},
  S17:{cn:'祖尔达尼亚',en:'Repair & Rescue',vehicles:['Jangsu RX600','Voron G-5352']},
  S18:{cn:'恰帕斯',en:'Patch & Power',vehicles:['Mercer R230','HIB Billert M816']},
  S19:{cn:'瑞士',en:'Research & Restore',vehicles:['Wortek 250T','DERRY "SAVIOR"']},
  BASE_MI:{cn:'密歇根',en:'Michigan',vehicles:[]},
  BASE_AK:{cn:'阿拉斯加',en:'Alaska',vehicles:['CAT 745C']},
  BASE_TY:{cn:'泰梅尔',en:'Taymyr',vehicles:['Tayga 6436']}
}

function step(id, platform, season, title, sub, goals, vehicles, note) {
  return {
    id, platform, season, title, sub, note: note || '', creator: null,
    goals: goals.map(g), vehicles
  }
}

function clone(v) { return JSON.parse(JSON.stringify(v)) }

function createDefaultState() {
  const list = [
    step('pc_s16','pc','S16','华盛顿州','Washington',['取得 Sleiter ST 833 Chimera','完成液压升降拖具相关任务'],[v('Sleiter ST 833 Chimera'),v('HIB Billert 1980'),v('PLAD 440 Buddy')],'Chimera 先作为木材第二配置候选；Forester 未取得时由 73210 补位'),
    step('pc_s9','pc','S9','安大略','Ontario',['推进烧焦中木','完成地图主线'],[v('Derry Special 15C-177'),v('ZiKZ 566A')],'PC 此阶段不依赖主机 S5/S6 进度'),
    step('pc_s15','pc','S15','魁北克','Quebec',['取得 Chimera 高扭发动机 / 相关升级'],[v('Sleiter ST 816 Elephant'),v('Mercer K520')],'完成 Chimera 同路线复测条件'),
    step('pc_s10','pc','S10','不列颠哥伦比亚','British Columbia',['取得 Kenworth 963（高鞍主车）','取得 Mack Defense M917（救援主车）'],[v('Kenworth 963'),v('Mack Defense M917')],'全车队视角下 S10 必须早于 S17'),
    step('pc_s12','pc','S12','北卡罗来纳','North Carolina',['完成大批量物流','用既定车队验证现有体系'],[v('FEMM 37-AT'),v('MTB 8106 Rock Grinder')],''),
    step('pc_mi','pc','BASE_MI','密歇根','Michigan',['补齐本体发动机','补齐升高悬挂'],[],'按实际取得状态启用升级，不提前套用顶配'),
    step('pc_ak','pc','BASE_AK','阿拉斯加','Alaska',['取得 CAT 745C'],[v('CAT 745C')],'按实际取得状态启用升级，不提前套用顶配'),
    step('pc_ty','pc','BASE_TY','泰梅尔','Taymyr',['取得 Tayga 6436','校准所有当前配置'],[v('Tayga 6436')],'车辆与升级按实际取得状态启用'),
    step('pc_s17','pc','S17','祖尔达尼亚','Zurdania',['取得 Voron G-5352（低鞍备车）'],[v('Voron G-5352'),v('Jangsu RX600')],'只补低鞍备车，优先级低于 S10 两台主车'),
    step('pc_s3','pc','S3','威斯康星','Wisconsin',['处理长木区域','Chimera 切为木材第二配置'],[v('International Paystar 5600TS'),v('Pacific P512 PF')],'这一版顺序的最终站'),
    step('con_s5_start','console','S5','顿河 · 开局','Don',['用本体车建路','推进 Phoenix / FORCE 任务链'],[],'CAT 745C 只跑特定中木深泥线；P12 不进已实测失败的深泥路线'),
    step('con_s6_detour','console','S6','The Lowland 短途绕行','Maine',['只做 Abandoned Titan'],[v('Aramatsu Forester')],'Forester 接短 / 中木主职，无链胎、无长木能力'),
    step('con_s5_return','console','S5','返回顿河','Don',['完成 Tatra 对应任务后再换车'],[v('Tatra PHOENIX'),v('Tatra FORCE T815-7')],'Phoenix 接货运主职；FORCE 接高鞍主职'),
    step('con_s6_full','console','S6','缅因 · 完整推进','Maine',['取得 DAN 96320 主动悬挂','6455B 后续发动机 / 配置'],[v('Tayga 6455B')],'最终车队不依赖 6455B；车辆可见 ≠ 升级已取得')
  ]
  const steps = {}; const order = { pc: [], console: [] }
  list.forEach(s => { steps[s.id] = s; order[s.platform].push(s.id) })
  return { version: 4, collapseCompleted: true, userNames: { A: '用户A名称', B: '用户B名称' }, seasonCatalog: clone(seasons), order, steps }
}

function createSeasonStep(seasonKey, platform, catalog) {
  const source = catalog || seasons
  const s = source[seasonKey]
  const id = platform + '_' + seasonKey.toLowerCase() + '_' + Date.now()
  return step(id, platform, seasonKey, s.cn, s.en, [], s.vehicles.map(name => v(name)), '')
}

module.exports = { seasons, createDefaultState, createSeasonStep }