// One-time, inspectable SQL import. No database/network access and no ongoing source snapshot maintenance.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process')
const p=require('../miniprogram/utils/aw/catalog-package')
const root=path.resolve(__dirname,'..'), out=process.argv[2]
if(!out)throw Error('Usage: node tools/build_aw_catalog_bootstrap.js work/aw-bootstrap.sql')
const release=JSON.parse(fs.readFileSync(path.join(root,'supabase/functions/aw-catalog/release.json'),'utf8'))
const content=p.validate(release),target=p.decode(content.catalog)
const source=JSON.parse(cp.execFileSync('python',['-c',"import json,zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);sys.stdout.write(z.read('source/catalog_snapshot.json').decode())",path.join(root,'data/aw/AW_catalog_manual_data.zip')],{maxBuffer:16*1024*1024}))
const literal=v=>{const json=p.stringify(v);let tag='$aw_bootstrap$',i=0;while(json.includes(tag))tag='$aw_bootstrap_'+(++i)+'$';return tag+json+tag+'::jsonb'}
const sqlText=v=>"'"+String(v).replaceAll("'","''")+"'"
const operations=[]
for(const n of p.names){
 const old=new Map(source.public_tables[n].map(r=>[p.key(n,r),r]))
 if(old.size!==target[n].length)throw Error('Bootstrap cannot add/delete existing public facts')
 for(const row of target[n]){
  const before=old.get(p.key(n,row));if(!before)throw Error('Bootstrap stable key changed')
  const values=Object.fromEntries(Object.entries(row).filter(([f,v])=>p.stringify(v)!==p.stringify(before[f])))
  if(Object.keys(values).length)operations.push({table:n,op:'upsert',key:JSON.parse(p.key(n,row)),values})
 }
}
let sql=`-- Generated one-time bootstrap for ${release.manifest.version}. Review before running in SQL Editor.\n-- Imports ${operations.length} previously reviewed row corrections + evidence/presentation.\n-- Guard aborts on ANY unexpected database fact, or after initialization; no player/team rows touched.\nbegin;\nset local timezone='UTC';\nset local lock_timeout='5s';\nset local statement_timeout='120s';\ndo $bootstrap$\ndeclare actual jsonb; old_rows jsonb; reviewed_rows jsonb; n text;\nbegin\n perform 1 from private.aw_catalog_state where id for update;\n if (select initialized from private.aw_catalog_state where id) then raise exception 'AW_ALREADY_INITIALIZED'; end if;\n`
for(const n of p.names){sql+=`\n n:='${n}';\n select coalesce(jsonb_agg(v order by v::text),'[]') into old_rows from jsonb_array_elements(${literal(source.public_tables[n])}) v;\n select coalesce(jsonb_agg(v order by v::text),'[]') into reviewed_rows from jsonb_array_elements(${literal(target[n])}) v;\n select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') into actual from public.${n} t;\n if actual<>old_rows and actual<>reviewed_rows then raise exception 'AW_BOOTSTRAP_DATABASE_DIVERGED: %',n; end if;\n`}
sql+=`\n perform private.aw_catalog_apply(${literal({operations,sections:{ammoEvidence:content.ammoEvidence,presentation:content.presentation}})},now());\n update private.aw_catalog_state set checked_at=${sqlText(content.catalog.checkedAt)} where id;\n`
for(const n of p.names){sql+=`\n select coalesce(jsonb_agg(v order by v::text),'[]') into reviewed_rows from jsonb_array_elements(${literal(target[n])}) v;\n select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') into actual from public.${n} t;\n if actual<>reviewed_rows then raise exception 'AW_BOOTSTRAP_RESULT_MISMATCH: ${n}'; end if;\n`}
sql+=`\n insert into private.aw_catalog_releases(version,sequence,revision,release) values('${release.manifest.version}',${release.manifest.sequence},(select revision from private.aw_catalog_state where id),${literal(release)});\n update private.aw_catalog_state set current_version='${release.manifest.version}',initialized=true where id;\nend $bootstrap$;\ncommit;\n`
fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,sql)
console.log(out+': '+operations.length+' reviewed corrections, '+Buffer.byteLength(sql)+' bytes. Inspect before running; generated SQL is not the ongoing fact source.')
