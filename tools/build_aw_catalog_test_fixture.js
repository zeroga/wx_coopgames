// Synthetic tests load historical public facts into a disposable database only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),p=require('../miniprogram/utils/aw/catalog-package')
const out=process.argv[2];if(!out)throw Error('Usage: node tools/build_aw_catalog_test_fixture.js <SQL output>')
const source=JSON.parse(cp.execFileSync('python',['-c',"import zipfile,sys;sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read('source/catalog_snapshot.json').decode())",path.join(__dirname,'../data/aw/AW_catalog_manual_data.zip')],{maxBuffer:16*1024*1024}))
let sql='-- TEST FIXTURE ONLY. Never apply this to an existing or production database.\nbegin;\n',remaining=p.names.slice(),done=new Set()
while(remaining.length){
 const ready=remaining.filter(n=>p.schema[n].references.every(r=>r.table===n||done.has(r.table)))
 if(!ready.length)throw Error('Circular fixture dependency')
 for(const n of ready){
  const rows=source.public_tables[n],columns=Object.keys(p.schema[n].columns).filter(f=>f!=='power_to_weight_hp_t')
  if(rows.length)sql+=`insert into public.${n} (${columns.join(',')}) select ${columns.join(',')} from jsonb_populate_recordset(null::public.${n},$fixture$${JSON.stringify(rows)}$fixture$::jsonb);\n`
  done.add(n)
 }
 remaining=remaining.filter(n=>!done.has(n))
}
sql+='commit;\n';fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,sql)
console.log('Disposable public fixture: '+out)
