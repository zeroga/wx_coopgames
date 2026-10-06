// Run against a disposable PostgreSQL container; NEVER a live Supabase project.
// Bootstrap fixture instructions are in docs/aw/catalog-maintenance-admin.md.
const {test}=require('node:test'), assert=require('node:assert/strict'), crypto=require('node:crypto'),cp=require('node:child_process')
const container=process.env.AW_TEST_CONTAINER
const sqlLiteral=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb"
function sql(query,role='postgres'){
 const result=cp.spawnSync('docker',['--host=unix:///var/run/docker.sock','exec','-i',container,'psql','-d',process.env.AW_TEST_DATABASE||'aw_catalog_test','-U','postgres','-Atq','-v','ON_ERROR_STOP=1'],{input:'set role '+role+';\n'+query+'\n',encoding:'utf8',maxBuffer:20*1024*1024})
 if(result.status)throw Error(result.stderr)
 return result.stdout.trim()
}
const hash=key=>crypto.createHash('sha256').update(key).digest('hex')
const primary='synthetic_aw_primary_key_000000000000000000000000000000000000'
const rotated='synthetic_aw_rotated_key_000000000000000000000000000000000000'
const uuid=()=>crypto.randomUUID()
const admin=(action,body={},key=primary)=>JSON.parse(sql(`select public.aw_catalog_admin('${action}','${hash(key)}',${sqlLiteral(body)});`,'service_role'))
const facts=()=>JSON.parse(sql('select public.aw_catalog_facts();','anon'))
const change=operations=>({reason:'Synthetic integration verification; no production facts',evidence:[{source_type:'ingame',checked_at:'2026-10-06T00:00:00Z',note:'Isolated fixture'}],operations})
const upload=c=>admin('upload',{request_id:uuid(),change:c})
const fetchReview=()=>admin('fetch',{request_id:uuid()})
const bodyFor=r=>({review_id:r.review_id,list_sha256:r.list_sha256,decision:'publish'})
function http(req){return httpHandler(req)}
let httpHandler, getHandler
function request(path,body,key=primary,method='POST'){
 return new Request('https://synthetic.invalid/functions/v1/aw-catalog-maintenance/'+path,{method,headers:{apikey:'synthetic-publishable','x-aw-key':key,'content-type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined})
}
async function confirm(r,key=primary){const response=await http(request('confirm',bodyFor(r),key));const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result}
function rejectPending(reason='Discard synthetic test batch'){
 const r=fetchReview();if(r.review_id)admin('commit',{review_id:r.review_id,list_sha256:r.list_sha256,decision:'reject',reason})
}
// All subtests sequential: they deliberately exercise the same transaction history.
test('AW maintenance uses real PostgreSQL transactions and the deployed Edge handlers',{skip:!container},async t=>{
 global.Deno={env:{get:n=>({SUPABASE_PUBLISHABLE_KEYS:'{"default":"synthetic-publishable"}',SUPABASE_URL:'https://database.invalid',SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'}[n])},serve:()=>{}}
 const originalFetch=global.fetch
 global.fetch=async(url,options)=>{
  const name=new URL(url).pathname.split('/').pop(),b=JSON.parse(options.body)
  try{
   let data
   if(name==='aw_catalog_admin')data=JSON.parse(sql(`select public.aw_catalog_admin('${b.p_action}','${b.p_token_hash}',${sqlLiteral(b.p_body)});`,'service_role'))
   else if(name==='aw_catalog_read')data=JSON.parse(sql(`select public.aw_catalog_read('${b.p_kind}',${b.p_version?"'"+b.p_version+"'":'null'},${b.p_base_version?"'"+b.p_base_version+"'":'null'});`,'anon'))
   else throw Error('Unexpected RPC')
   return Response.json(data)
  }catch(e){return Response.json({message:e.message},{status:400})}
 }
 httpHandler=(await import('../supabase/functions/aw-catalog-maintenance/index.ts')).handler
 getHandler=(await import('../supabase/functions/aw-catalog/index.ts')).handler
 const info=facts(),vehicle=info.tables.vehicles[0],dealer=info.tables.dealers[0]
 const grant=JSON.parse(sql(`insert into private.aw_catalog_grants(label,task_id,environment,scopes,allowed_tables,allowed_sections,max_operations,max_uploads_per_day,max_reviews_per_day,max_publishes_per_day,expires_at) values('integration','fixture','production',array['changes.upload','reviews.fetch','reviews.confirm'],array(select name from private.aw_catalog_contract),array['ammoEvidence','presentation'],1000,1000,1000,100,now()+interval '1 day') returning to_jsonb(aw_catalog_grants);`))
 sql(`insert into private.aw_catalog_keys(grant_id,label,token_sha256,expires_at) values('${grant.id}','original','${hash(primary)}',now()+interval '1 day');`)
 await t.test('public facts are complete, hashed sections readable, configuration and internal helpers inaccessible',()=>{
  assert.equal(info.tables.vehicles.length,298);assert.equal(Object.keys(info.tables).length,26)
  assert.match(info.section_sha256.ammoEvidence,/^[0-9a-f]{64}$/)
  assert.throws(()=>sql('select token_sha256 from private.aw_catalog_keys;','anon'),/permission denied/)
  assert.throws(()=>sql('select token_sha256 from private.aw_catalog_keys;','service_role'),/permission denied/)
  assert.throws(()=>sql("select public.aw_catalog_admin('introspect','bad','{}');",'anon'),/permission denied/)
  assert.throws(()=>sql("update public.vehicles set name='forbidden';",'service_role'),/permission denied/)
  assert.equal(admin('introspect').task_id,'fixture')
 })
 await t.test('HTTP authorizes KEY, rejects client artifact and oversized request',async()=>{
  assert.equal((await http(request('changes',{},'invalid'))).status,401)
  assert.equal((await http(request('confirm',{artifact:{}},primary))).status,400)
  assert.equal((await http(request('changes',{padding:'x'.repeat(256*1024)}))).status,413)
 })
 await t.test('upload/fetch retries consume no additional quota and pulling never processes data',()=>{
  const b={request_id:uuid(),change:change([{table:'dealers',op:'upsert',key:[dealer.id],expected:{name:dealer.name},values:{name:dealer.name+' fixture'}}])}
  const first=admin('upload',b);assert.deepEqual(admin('upload',b),first)
  assert.throws(()=>admin('upload',{...b,change:{...b.change,reason:'Different'}}),/AW_IDEMPOTENCY_CONFLICT/)
  const req={request_id:uuid()},r=admin('fetch',req);assert.deepEqual(admin('fetch',req),r)
  assert.equal(r.changes.length,1);assert.equal(sql('select count(*) from private.aw_catalog_processed'), '0')
  assert.equal(facts().tables.dealers.find(x=>x.id===dealer.id).name,dealer.name)
  assert.equal(admin('introspect').usage.uploads,1)
 })
 await t.test('confirm freezes exact IDs, merges disjoint fields, publishes validated full/direct patch and preserves later upload',async()=>{
  rejectPending()
  const current=facts().tables.vehicles.find(x=>x.id===vehicle.id),beforeManifest=JSON.parse(sql('select public.aw_catalog_read();','anon'))
  const a=upload(change([{table:'vehicles',op:'upsert',key:[vehicle.id],expected:{name:current.name},values:{name:current.name+' fixture'}}]))
  const b=upload(change([{table:'vehicles',op:'upsert',key:[vehicle.id],expected:{source_note:current.source_note},values:{source_note:'Isolated review note'}}]))
  const review=fetchReview();assert.deepEqual(new Set(review.changes.map(x=>x.id)),new Set([a.change_id,b.change_id]))
  const late=upload(change([{table:'dealers',op:'upsert',key:[dealer.id],expected:{name:dealer.name},values:{name:dealer.name+' later'}}]))
  const beforeFacts=facts(),preview=admin('preview',bodyFor(review));assert.deepEqual(facts(),beforeFacts)
  assert(preview.snapshot.tables.vehicles.find(x=>x.id===vehicle.id).updated_at!==current.updated_at)
  const result=await confirm(review)
  const actual=facts();assert.equal(actual.tables.vehicles.find(x=>x.id===vehicle.id).source_note,'Isolated review note')
  assert.equal(actual.tables.vehicles.find(x=>x.id===vehicle.id).updated_at,preview.snapshot.tables.vehicles.find(x=>x.id===vehicle.id).updated_at)
  const manifest=JSON.parse(sql('select public.aw_catalog_read();','anon'))
  assert.equal(result.version,manifest.version);assert(manifest.sequence>beforeManifest.sequence)
  const bundle=JSON.parse(sql(`select public.aw_catalog_read('full','${manifest.version}');`,'anon'))
  assert.equal(hash(bundle.payload),manifest.sha256)
  const protocol=require('../miniprogram/utils/aw/catalog-package'),delta=JSON.parse(sql(`select public.aw_catalog_read('patch','${manifest.version}','${beforeManifest.version}');`,'anon'))
  assert.equal(protocol.applyPatch(preview.base,delta,manifest).payload,bundle.payload)
  assert.equal(protocol.canonicalPayload(protocol.validate(bundle)),bundle.payload)
  assert.deepEqual(await confirm(review),result)
  assert.deepEqual(fetchReview().changes.map(x=>x.id),[late.change_id])
  const response=await getHandler(new Request('https://synthetic.invalid/aw-catalog',{headers:{apikey:'synthetic-publishable'}}));assert.equal(response.status,200);assert.equal((await response.json()).version,result.version)
  const old=await getHandler(new Request('https://synthetic.invalid/aw-catalog?bundle=1&version=old',{headers:{apikey:'synthetic-publishable'}}));assert.equal(old.status,409)
  rejectPending()
 })
 await t.test('contradictory field writes fail atomically and stay pending until explicit rejection',async()=>{
  const v=facts().tables.vehicles.find(x=>x.id===vehicle.id)
  for(const note of ['a','b'])upload(change([{table:'vehicles',op:'upsert',key:[v.id],expected:{source_note:v.source_note},values:{source_note:note}}]))
  const r=fetchReview(),before=facts();const resp=await http(request('confirm',bodyFor(r)));assert.equal(resp.status,409);assert.equal((await resp.json()).error,'AW_BATCH_FIELD_CONFLICT')
  assert.deepEqual(facts(),before);assert.equal(fetchReview().changes.length,2);rejectPending()
 })
 await t.test('manual write to a table without updated_at invalidates review',async()=>{
  const d=facts().tables.dealers.find(x=>x.id===dealer.id)
  upload(change([{table:'dealers',op:'upsert',key:[d.id],expected:{name:d.name},values:{name:d.name+' update'}}]));const r=fetchReview()
  sql(`update public.ammo_traits set description=coalesce(description,'')||' fixture' where code=(select code from public.ammo_traits limit 1);`)
  const resp=await http(request('confirm',bodyFor(r)));assert.equal(resp.status,409);assert.equal((await resp.json()).error,'AW_BASE_CHANGED');rejectPending()
 })
 await t.test('expired/revoked keys fail; rotation preserves task review and grant quota',async()=>{
  const d=facts().tables.dealers.find(x=>x.id===dealer.id)
  upload(change([{table:'dealers',op:'upsert',key:[d.id],expected:{name:d.name},values:{name:d.name+' rotation'}}]));const r=fetchReview(),usage=admin('introspect').usage
  sql(`insert into private.aw_catalog_keys(grant_id,label,token_sha256,expires_at) values('${grant.id}','rotated','${hash(rotated)}',now()+interval '1 day');update private.aw_catalog_keys set revoked_at=now() where token_sha256='${hash(primary)}';`)
  assert.throws(()=>admin('introspect'),/AW_UNAUTHORIZED/)
  assert.deepEqual(admin('introspect',{},rotated).usage,usage)
  await confirm(r,rotated)
  sql(`update private.aw_catalog_keys set revoked_at=null where token_sha256='${hash(primary)}';update private.aw_catalog_keys set expires_at=now()-interval '1 second',issued_at=now()-interval '1 day' where token_sha256='${hash(rotated)}';`)
  assert.throws(()=>admin('introspect',{},rotated),/AW_UNAUTHORIZED/)
 })
 await t.test('type/foreign-key/package validation failure never changes public facts or publication pointer',async()=>{
  const v=facts().tables.vehicles.find(x=>x.id===vehicle.id)
  upload(change([{table:'vehicles',op:'upsert',key:[v.id],expected:{tier:v.tier},values:{tier:'not an integer'}}]));let r=fetchReview(),before=facts()
  assert.equal((await http(request('confirm',bodyFor(r)))).status,400);assert.deepEqual(facts(),before);rejectPending()
  upload(change([{table:'vehicles',op:'upsert',key:[v.id],expected:{dealer_id:v.dealer_id},values:{dealer_id:uuid()}}]));r=fetchReview();before=facts()
  assert.equal((await http(request('confirm',bodyFor(r)))).status,409);assert.deepEqual(facts(),before);rejectPending()
  upload({...change([]),sections:{ammoEvidence:{expected_sha256:facts().section_sha256.ammoEvidence,content:{entries:{[uuid()]:{warhead_type:'unknown',traits:[]}}}}}})
  r=fetchReview();before=facts();assert.equal((await http(request('confirm',bodyFor(r)))).status,422);assert.deepEqual(facts(),before);rejectPending()
 })
 await t.test('inserts reproduce defaults/generated fields and can be deleted using exact PK',async()=>{
  const id=uuid()
  upload(change([{table:'vehicles',op:'upsert',key:[id],expected:null,values:{name:'Synthetic new vehicle',slug:'synthetic_'+id,tier:1,vehicle_class:'MBT',weight_t:10,engine_power_hp:100}}]))
  const r=fetchReview();const result=await confirm(r),f=facts(),v=f.tables.vehicles.find(x=>x.id===id)
  assert.equal(v.power_to_weight_hp_t,10);assert(v.created_at);assert(v.updated_at);assert.equal(f.tables.vehicles.length,299)
  const saved=JSON.parse(sql(`select public.aw_catalog_read('full','${result.version}');`,'anon')),decoded=require('../miniprogram/utils/aw/catalog-package').decode(JSON.parse(saved.payload).catalog)
  assert.deepEqual(decoded.vehicles.find(x=>x.id===id),v)
  upload(change([{table:'vehicles',op:'delete',key:[id],expected:{name:v.name}}]));await confirm(fetchReview());assert.equal(facts().tables.vehicles.length,298)
 })
 await t.test('commit rejects changed after-image and mismatched fixed list without side effects',()=>{
  const d=facts().tables.dealers.find(x=>x.id===dealer.id)
  upload(change([{table:'dealers',op:'upsert',key:[d.id],expected:{name:d.name},values:{name:d.name+' guard'}}]));const r=fetchReview(),before=facts()
  assert.throws(()=>admin('preview',{...bodyFor(r),list_sha256:'0'.repeat(64)}),/AW_REVIEW_LIST_MISMATCH/)
  const preview=admin('preview',bodyFor(r));assert.throws(()=>admin('commit',{...bodyFor(r),snapshot:{...preview.snapshot,checkedAt:'different'},artifact:preview.base}),/AW_ARTIFACT_SNAPSHOT_MISMATCH/)
  assert.deepEqual(facts(),before);rejectPending()
 })
 await t.test('competing review lists process each change only once',async()=>{
  const d=facts().tables.dealers.find(x=>x.id===dealer.id)
  upload(change([{table:'dealers',op:'upsert',key:[d.id],expected:{name:d.name},values:{name:d.name+' competing'}}]))
  const a=fetchReview(),b=fetchReview();await confirm(a)
  const resp=await http(request('confirm',bodyFor(b)));assert.equal(resp.status,409);assert.equal((await resp.json()).error,'AW_REVIEW_ALREADY_PROCESSED')
 })
 await t.test('empty fetch retry cannot silently acquire uploads that arrived later',()=>{
  const request_id=uuid(),empty=admin('fetch',{request_id});assert.equal(empty.review_id,null)
  const d=facts().tables.dealers.find(x=>x.id===dealer.id)
  upload(change([{table:'dealers',op:'upsert',key:[d.id],expected:{name:d.name},values:{name:d.name+' late-empty'}}]))
  assert.deepEqual(admin('fetch',{request_id}),empty);rejectPending()
 })
 await t.test('actual write drift rolls back facts, quota, artifact and processing',async()=>{
  const v=facts().tables.vehicles.find(x=>x.id===vehicle.id)
  upload(change([{table:'vehicles',op:'upsert',key:[v.id],expected:{name:v.name},values:{name:v.name+' drift'}}]));const r=fetchReview()
  admin('preview',bodyFor(r));const before=facts(),usage=admin('introspect').usage
  sql("create function private.aw_test_drift() returns trigger language plpgsql as $$ begin new.source_note='drift';return new;end $$;create trigger zzz_test_drift before update on public.vehicles for each row execute function private.aw_test_drift();")
  try {const resp=await http(request('confirm',bodyFor(r)));assert.equal(resp.status,409);assert.equal((await resp.json()).error,'AW_ACTUAL_WRITE_DIFFERS_FROM_PREVIEW');assert.deepEqual(facts(),before);assert.deepEqual(admin('introspect').usage,usage)}
  finally {sql('drop trigger zzz_test_drift on public.vehicles;drop function private.aw_test_drift();')}
  rejectPending()
 })
 await t.test('vehicle deletion cannot cascade into a private archive',async()=>{
  const v=facts().tables.vehicles.find(x=>x.id===vehicle.id)
  sql(`create table private.aw_test_archive(vehicle_id uuid references public.vehicles(id) on delete cascade);insert into private.aw_test_archive values('${v.id}');`)
  upload(change([{table:'vehicles',op:'delete',key:[v.id],expected:{name:v.name}}]));const r=fetchReview(),before=facts()
  const resp=await http(request('confirm',bodyFor(r)));assert.equal(resp.status,409);assert.equal((await resp.json()).error,'AW_PRIVATE_ARCHIVE_REFERENCE');assert.deepEqual(facts(),before)
  assert.equal(sql('select count(*) from private.aw_test_archive'),'1');rejectPending();sql('drop table private.aw_test_archive;')
 })
 await t.test('scope, resource and environment boundaries apply to all credentials',async()=>{
  const restricted='synthetic_aw_restricted_key_000000000000000000000000000000'
  const gid=uuid()
  sql(`insert into private.aw_catalog_grants(id,label,task_id,environment,scopes,allowed_tables,expires_at) values('${gid}','restricted','different_task','production',array['changes.upload'],array['dealers'],now()+interval '1 day');insert into private.aw_catalog_keys(grant_id,label,token_sha256,expires_at) values('${gid}','restricted','${hash(restricted)}',now()+interval '1 day');`)
  assert.equal((await http(request('reviews',{request_id:uuid()},restricted))).status,403)
  const v=facts().tables.vehicles.find(x=>x.id===vehicle.id)
  assert.equal((await http(request('changes',{request_id:uuid(),change:change([{table:'vehicles',op:'upsert',key:[v.id],expected:{name:v.name},values:{name:'forbidden'}}])},restricted))).status,403)
  sql(`update private.aw_catalog_grants set environment='staging' where id='${gid}';`)
  assert.equal((await http(request('introspect',undefined,restricted,'GET'))).status,403)
  sql(`update private.aw_catalog_grants set environment='production',issued_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id='${gid}';`)
  assert.equal((await http(request('introspect',undefined,restricted,'GET'))).status,401)
 })
 await t.test('quota is shared across credentials, forbidden tables/readonly columns fail',()=>{
  assert.throws(()=>upload(change([{table:'aw_catalog_keys',op:'delete',key:[uuid()],expected:{id:'x'}}])),/AW_RESOURCE_DENIED/)
  assert.throws(()=>upload(change([{table:'vehicles',op:'upsert',key:[vehicle.id],expected:{updated_at:'x'},values:{updated_at:'x'}}])),/AW_READ_ONLY_OR_UNKNOWN_COLUMN/)
  const usage=admin('introspect').usage
  sql(`update private.aw_catalog_grants set max_uploads_per_day=${usage.uploads} where id='${grant.id}';`)
  assert.throws(()=>upload(change([{table:'dealers',op:'upsert',key:[dealer.id],expected:{name:'x'},values:{name:'y'}}])),/AW_QUOTA_EXCEEDED/)
 })
 global.fetch=originalFetch
})
