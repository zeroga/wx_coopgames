// Deployment evidence is separate from immutable full archives. No network here.
const path = require('node:path'), pkg = require('./aw_catalog_package')
const p = require('../miniprogram/utils/aw/catalog-package')
function baseline(file, environment, from, root) {
  const ledger = pkg.read(file)
  if (ledger.formatVersion !== 1 || ledger.module !== 'aw') throw Error('Invalid deployment ledger')
  const record = ledger.environments && ledger.environments[environment]
  if (!record) throw Error('No confirmed deployment for '+environment+'; verify deployment or use --draft <reason> for local preparation')
  if (record.module !== 'aw' || record.version !== from.manifest.version || record.sha256 !== from.manifest.sha256 || record.sequence !== from.manifest.sequence || !Number.isFinite(Date.parse(record.confirmedAt)) || !/^[a-f0-9]{40}$/.test(record.gitCommit || '')) throw Error('--from does not match confirmed deployment evidence')
  const archived = pkg.read(path.resolve(root,record.fullFile))
  p.validate(archived)
  if (p.stringify(archived) !== p.stringify({manifest:from.manifest,payload:from.payload})) throw Error('Confirmed deployment archive differs from --from')
  return record
}
async function verify(release, url, apikey, fetcher=fetch) {
  p.validate(release)
  const endpoint = new URL(url)
  if (endpoint.protocol !== 'https:' || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) throw Error('Expected an HTTPS catalog endpoint without query/credentials')
  async function get(query) {
    const response = await fetcher(url+query,{method:'GET',headers:{apikey},signal:AbortSignal.timeout(15000),redirect:'error'})
    if (!response.ok) throw Error('Catalog verification HTTP '+response.status)
    return response.json()
  }
  const manifest = await get('')
  if (p.stringify(manifest) !== p.stringify(release.manifest)) throw Error('Deployed manifest differs from release')
  const full = await get('?bundle=1&version='+encodeURIComponent(manifest.version))
  p.validate(full)
  if (full.payload !== release.payload || p.stringify(full.manifest) !== p.stringify(manifest)) throw Error('Deployed full differs from release')
  const patches = release.patches || []
  if(p.stringify(patches.map(x=>x.descriptor))!==p.stringify(manifest.patches||[]))throw Error('Local release patch set differs from manifest')
  for (const expected of patches) {
    const served = await get('?patch=1&baseVersion='+encodeURIComponent(expected.descriptor.baseVersion)+'&version='+encodeURIComponent(manifest.version))
    if (p.stringify(served) !== p.stringify(expected)) throw Error('Deployed patch differs from release')
  }
  if (p.stringify(await get('')) !== p.stringify(manifest)) throw Error('Release changed during verification')
  return manifest
}
module.exports = {baseline,verify}
