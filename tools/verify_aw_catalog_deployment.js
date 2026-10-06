// Remote GET verification; writes the local ledger only after every check passes.
const path = require('node:path'), fs = require('node:fs')
const pkg = require('./aw_catalog_package'), {verify} = require('./aw_catalog_deployment')
const p = require('../miniprogram/utils/aw/catalog-package')
const {args,required} = require('./build_aw_catalog_package')
async function main() {
  const a=args(process.argv.slice(2)),root=path.join(__dirname,'..')
  const environment=required(a,'environment'),gitCommit=required(a,'git-commit')
  if(!/^[a-z][a-z0-9-]*$/.test(environment)||!/^[a-f0-9]{40}$/.test(gitCommit))throw Error('Expected environment and full Git commit')
  const release=pkg.read(required(a,'release')),fullFile=required(a,'full'),full=pkg.read(fullFile)
  if(p.stringify(full)!==p.stringify({manifest:release.manifest,payload:release.payload}))throw Error('Archive differs from release')
  const config=require('../miniprogram/config'),url=a.url||config.supabaseUrl+'/functions/v1/aw-catalog'
  const apikey=a['apikey-env']?process.env[a['apikey-env']]:config.supabasePublishableKey
  if(!apikey)throw Error('Missing catalog apikey')
  const manifest=await verify(release,url,apikey)
  const file=path.resolve(a.record||path.join(root,'data/aw/deployed.json')),ledger=pkg.read(file)
  if(ledger.formatVersion!==1||ledger.module!=='aw'||!ledger.environments)throw Error('Invalid deployment ledger')
  ledger.environments[environment]={module:'aw',version:manifest.version,sha256:manifest.sha256,sequence:manifest.sequence,confirmedAt:new Date().toISOString(),gitCommit,fullFile:path.relative(root,path.resolve(fullFile)),url}
  const temporary=file+'.tmp'
  pkg.write(temporary,ledger);fs.renameSync(temporary,file)
  console.log('Verified deployed manifest/full/patch; local evidence recorded for '+environment)
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
