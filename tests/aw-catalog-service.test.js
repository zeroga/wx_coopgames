const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto')
test('public catalog service checks API key, is read only, binds bundle version and returns reviewed data only',async()=>{
  let served
  global.Deno={env:{get:k=>k==='SUPABASE_PUBLISHABLE_KEYS'?JSON.stringify({default:'synthetic-publishable'}):undefined},serve:fn=>{served=fn}}
  const {handler}=await import('../supabase/functions/aw-catalog/index.ts')
  assert.equal(handler,served)
  const url='https://synthetic.example/functions/v1/aw-catalog'
  const req=(suffix='',method='GET',key='synthetic-publishable')=>new Request(url+suffix,{method,headers:key?{apikey:key}:{}})
  assert.equal(handler(req('','GET','')).status,401);assert.equal(handler(req('','GET','wrong')).status,401)
  assert.equal(handler(req('','POST')).status,405);assert.equal(handler(req('','OPTIONS','')).status,204)
  const manifest=await handler(req()).json();assert.equal(manifest.counts.vehicles,298);assert.equal(manifest.schemaVersion,1)
  assert.equal(handler(req('?bundle=1&version=old')).status,409)
  const bundle=await handler(req('?bundle=1&version='+manifest.version)).json()
  assert.equal(bundle.manifest.version,manifest.version);assert.equal(crypto.createHash('sha256').update(bundle.payload).digest('hex'),manifest.sha256)
  const content=JSON.parse(bundle.payload)
  assert(!('patches' in bundle))
  const d=manifest.patches[0]
  assert.equal(handler(req('?patch=1&baseVersion='+d.baseVersion+'&version=old')).status,409)
  assert.equal(handler(req('?patch=1&baseVersion=missing&version='+manifest.version)).status,404)
  const patch=await handler(req('?patch=1&baseVersion='+d.baseVersion+'&version='+manifest.version)).json()
  assert.deepEqual(patch.descriptor,d)
  assert.equal(crypto.createHash('sha256').update(patch.payload).digest('hex'),d.patchSha256)
  const previous=require('../data/aw/releases/'+d.baseVersion+'/full.json')
  assert.equal(require('../tools/aw_catalog_package').verify(previous,bundle,patch).payload,bundle.payload)
  assert(Object.keys(content.catalog.tables).every(k=>!/^aw_(members|teams|fleet)|private|profile|session/.test(k)))
  assert.deepEqual(Object.keys(content).sort(),['ammoEvidence','catalog','presentation'])
})
