const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto')
const {execFile}=require('node:child_process'),run=require('node:util').promisify(execFile)
const p=require('../miniprogram/utils/aw/catalog-package'),pkg=require('../tools/aw_catalog_package')
const {baseline,verify}=require('../tools/aw_catalog_deployment'),{fixture,clone}=require('./fixtures/aw-new-vehicle')
const root=path.join(__dirname,'..'),script=path.join(root,'tools/build_aw_catalog_release.js')
test('bundled modules exactly match bundled manifest and current release, with independent SHA-256',()=>{
  const bundled=require('../miniprogram/data/aw/release'),release=require('../supabase/functions/aw-catalog/release.json')
  const payload=p.canonicalPayload({catalog:require('../miniprogram/data/aw/catalog'),ammoEvidence:require('../miniprogram/data/aw/ammo-classification'),presentation:require('../miniprogram/data/aw/presentation')})
  assert.equal(crypto.createHash('sha256').update(payload,'utf8').digest('hex'),bundled.sha256)
  // This committed immutable release also serves as a canonical-encoding golden fixture.
  const archived=require('../data/aw/releases/aw-2026.10.06.1-e8874cd8a93d/full.json')
  assert.equal(p.canonicalPayload(p.validate(archived)),archived.payload)
  if(bundled.version===release.manifest.version)assert.equal(payload,release.payload)
})
test('external --to cannot relabel different bundled bytes; rejection precedes any archive writes',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aw-release-')),f=fixture()
  const files=['miniprogram/data/aw/release.js','supabase/functions/aw-catalog/release.json'],before=files.map(x=>fs.readFileSync(path.join(root,x)))
  try {
    pkg.write(path.join(dir,'new.json'),f.target)
    await assert.rejects(run(process.execPath,[script,'2026.10.07.1','2026-10-07T00:00:00Z','--to',path.join(dir,'new.json'),'--from',path.join(root,'data/aw/releases',f.base.manifest.version,'full.json'),'--draft','synthetic verification','--archive',path.join(dir,'archives')]),/differs from bundled source/)
    assert(!fs.existsSync(path.join(dir,'archives')))
    files.forEach((x,i)=>assert.deepEqual(fs.readFileSync(path.join(root,x)),before[i]))
  } finally {fs.rmSync(dir,{recursive:true,force:true})}
})
test('formal releases require confirmed exact baseline; drafts are explicit and preserve bundled metadata',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aw-baseline-')),f=fixture()
  try {
    const old=path.join(dir,'old.json'),next=path.join(dir,'next.json'),ledger=path.join(dir,'deployed.json'),out=path.join(dir,'release.json'),archives=path.join(dir,'archives')
    pkg.write(old,{manifest:f.base.manifest,payload:f.base.payload});pkg.write(next,f.target);pkg.write(ledger,{formatVersion:1,module:'aw',environments:{production:null}})
    const options=[script,'2026.10.07.1','2026-10-07T00:00:00Z','--from',old,'--to',next,'--deployed',ledger,'--environment','production','--output',out,'--archive',archives]
    await assert.rejects(run(process.execPath,options),/No confirmed deployment/)
    assert(!fs.existsSync(out));assert(!fs.existsSync(archives))
    await run(process.execPath,[...options,'--draft','local synthetic preparation'])
    assert.equal(pkg.read(out).payload,f.target.payload)
    const record={module:'aw',version:f.base.manifest.version,sha256:f.base.manifest.sha256,sequence:f.base.manifest.sequence,gitCommit:'a'.repeat(40),confirmedAt:'2026-10-06T00:00:00Z',fullFile:old}
    pkg.write(ledger,{formatVersion:1,module:'aw',environments:{production:record}})
    assert.equal(baseline(ledger,'production',f.base,root).version,f.base.manifest.version)
    const wrong=clone(f.base);wrong.manifest.sha256='b'.repeat(64)
    assert.throws(()=>baseline(ledger,'production',wrong,root),/does not match/)
    await run(process.execPath,options)
  } finally {fs.rmSync(dir,{recursive:true,force:true})}
})
test('deployment verifier checks manifest/full/patch and rechecks manifest before confirmation',async()=>{
  const f=fixture(),release={...f.target,patches:[f.patch]},calls=[]
  const fetcher=async(url,options)=>{assert.equal(options.method,'GET');calls.push(url);return {ok:true,json:async()=>clone(url.includes('?patch')?f.patch:url.includes('?bundle')?f.target:f.target.manifest)}}
  assert.equal((await verify(release,'https://catalog.example/aw-catalog','public-key',fetcher)).version,f.target.manifest.version)
  assert.equal(calls.length,4)
  const corrupt=async url=>({ok:true,json:async()=>url.includes('?bundle')?{...f.target,payload:f.target.payload+' '}:clone(f.target.manifest)})
  await assert.rejects(verify(release,'https://catalog.example/aw-catalog','public-key',corrupt),/校验值/)
  const changed=async url=>({ok:true,json:async()=>url.includes('?patch')?{...f.patch,payload:f.patch.payload+' '}:clone(url.includes('?bundle')?f.target:f.target.manifest)})
  await assert.rejects(verify(release,'https://catalog.example/aw-catalog','public-key',changed),/patch differs/)
})
