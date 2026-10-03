const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const mini = path.resolve(__dirname, '../miniprogram')

// Deliberately do not use Node require: Node can load JSON, but the failing
// WeChat module registry in the supplied log contains only JavaScript modules.
function resolveScript(from, spec) {
  assert(spec.startsWith('.'), 'Only bundled relative modules are allowed: ' + spec)
  const target = path.resolve(path.dirname(from), spec.endsWith('.js') ? spec : spec + '.js')
  assert(target.startsWith(mini + path.sep), 'Module must stay inside miniprogram: ' + target)
  assert(fs.existsSync(target), 'Missing bundled JS module: ' + target)
  return target
}
function scripts(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? scripts(file) : entry.name.endsWith('.js') ? [file] : []
  })
}

test('all local require targets resolve to bundled JS without Node JSON fallback', () => {
  for (const file of scripts(mini)) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      resolveScript(file, match[1])
    }
  }
  assert.throws(() => resolveScript(path.join(mini, 'utils/aw/catalog.js'), '../../data/aw/ammo-classification.json'), /Missing bundled JS module/)
})

test('all app pages and AW editor register using a JS-only module loader', () => {
  const cache = new Map(), registrations = { app: 0, pages: [], components: [] }
  const context = vm.createContext({
    wx: { getStorageSync() {}, request() { throw new Error('Startup must not request network') } },
    App: def => { assert(def.globalData); registrations.app++ },
    Page: def => registrations.pages.push(def),
    Component: def => registrations.components.push(def)
  })
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const fn = new vm.Script('(function(require,module,exports){\n' + fs.readFileSync(file, 'utf8') + '\n})', { filename: file }).runInContext(context)
    fn(spec => load(resolveScript(file, spec)), module, module.exports)
    return module.exports
  }
  load(path.join(mini, 'app.js'))
  const routes = JSON.parse(fs.readFileSync(path.join(mini, 'app.json'), 'utf8')).pages
  for (const route of routes) load(path.join(mini, route + '.js'))
  load(path.join(mini, 'components/aw-asset-editor/index.js'))
  assert.equal(registrations.app, 1)
  assert.equal(registrations.pages.length, routes.length)
  assert.equal(registrations.components.length, 1)
  assert.equal(typeof registrations.components[0].methods.saveRole, 'function')
  const catalog = load(path.join(mini, 'utils/aw/catalog.js'))
  assert.equal(catalog.tables.vehicles.length, 298)
  const vehicle = catalog.tables.vehicles.find(v => catalog.ammoFor(v.id).some(a => a.name === '9M123F ATGM'))
  const ammo = catalog.ammoFor(vehicle.id).find(a => a.name === '9M123F ATGM')
  assert.equal(ammo.classification.warhead_type, 'thermobaric')
  assert.equal(catalog.ammoColor(ammo), 'he')
})
