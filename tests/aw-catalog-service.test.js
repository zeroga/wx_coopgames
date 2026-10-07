const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto')
test('public service reads atomic DB release, binds versions and never serves stale Git fallback',async()=>{
 const release=require('../supabase/functions/aw-catalog/release.json'),originalFetch=global.fetch
 let served,unavailable=false,calls=[]
 global.Deno={env:{get:k=>({SUPABASE_PUBLISHABLE_KEYS:'{"default":"synthetic-publishable"}',SUPABASE_URL:'https://synthetic-db.invalid',SUPABASE_ANON_KEY:'synthetic-anon'}[k])},serve:fn=>{served=fn}}
 global.fetch=async(url,options)=>{
  calls.push({url,options});if(unavailable)throw Error('offline')
  const b=JSON.parse(options.body)
  if(b.p_kind==='manifest')return Response.json(release.manifest)
  if(b.p_version!==release.manifest.version)return Response.json({message:'AW_RELEASE_CHANGED'},{status:400})
  if(b.p_kind==='full')return Response.json({manifest:release.manifest,payload:release.payload})
  const p=release.patches.find(p=>p.descriptor.baseVersion===b.p_base_version)
  return p?Response.json(p):Response.json({message:'AW_NO_DIRECT_PATCH'},{status:400})
 }
 try {
  const {handler}=await import('../supabase/functions/aw-catalog/index.ts');assert.equal(handler,served)
  const url='https://synthetic.example/functions/v1/aw-catalog'
  const req=(suffix='',method='GET',key='synthetic-publishable')=>new Request(url+suffix,{method,headers:key?{apikey:key}:{}})
  assert.equal((await handler(req('','GET',''))).status,401);assert.equal((await handler(req('','GET','wrong'))).status,401)
  assert.equal((await handler(req('','POST'))).status,405);assert.equal((await handler(req('','OPTIONS',''))).status,204);assert.equal(calls.length,0)
  const manifest=await (await handler(req())).json();assert.equal(manifest.counts.vehicles,298)
  assert.equal((await handler(req('?bundle=1&version=old'))).status,409)
  const bundle=await (await handler(req('?bundle=1&version='+manifest.version))).json()
  assert.equal(crypto.createHash('sha256').update(bundle.payload).digest('hex'),manifest.sha256)
  const d=manifest.patches[0]
  assert.equal((await handler(req('?patch=1&baseVersion='+d.baseVersion+'&version=old'))).status,409)
  assert.equal((await handler(req('?patch=1&baseVersion=missing&version='+manifest.version))).status,404)
  const patch=await (await handler(req('?patch=1&baseVersion='+d.baseVersion+'&version='+manifest.version))).json()
  assert.equal(require('../tools/aw_catalog_package').verify(require('../data/aw/releases/'+d.baseVersion+'/full.json'),bundle,patch).payload,bundle.payload)
  assert(calls.every(c=>c.options.headers.apikey==='synthetic-anon'))
  unavailable=true;assert.equal((await handler(req())).status,503)
 }finally {global.fetch=originalFetch}
})
test('generated Edge protocol matches client and Node publisher bytes',async()=>{
 const {protocol,publisher,checksum}=await import('../supabase/functions/_shared/aw-protocol.mjs')
 const client=require('../miniprogram/utils/aw/catalog-package'),node=require('../tools/aw_catalog_package'),base=require('../supabase/functions/aw-catalog/release.json')
 const content=client.validate(base)
 assert.equal(protocol.canonicalPayload(content),client.canonicalPayload(content))
 const target=node.full(content,'2026.10.06.9999','2026-10-06T00:00:00Z')
 assert.deepEqual(publisher.full(content,'2026.10.06.9999','2026-10-06T00:00:00Z'),target)
 assert.deepEqual(publisher.patch(base,target),node.patch(base,target))
 assert.equal(checksum('synthetic_key'),crypto.createHash('sha256').update('synthetic_key').digest('hex'))
})
