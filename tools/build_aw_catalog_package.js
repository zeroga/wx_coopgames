// Independent full / patch / validate CLI. All inputs are local Git artifacts.
const pkg = require('./aw_catalog_package')
function args(argv) {
  const options = {}
  for(let i=0;i<argv.length;i+=2){
    if(!argv[i].startsWith('--')||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Expected --option value')
    options[argv[i].slice(2)] = argv[i+1]
  }
  return options
}
function required(options,key) { if(!options[key])throw Error('Missing --'+key);return options[key] }
function main() {
  const command = process.argv[2], a = args(process.argv.slice(3))
  if (command === 'full') {
    const content = a.content ? pkg.read(a.content) : {catalog:require('../miniprogram/data/aw/catalog'),ammoEvidence:require('../miniprogram/data/aw/ammo-classification'),presentation:require('../miniprogram/data/aw/presentation')}
    pkg.write(required(a,'output'),pkg.full(content,required(a,'version'),required(a,'published-at')))
  } else if (command === 'patch') {
    pkg.write(required(a,'output'),pkg.patch(pkg.read(required(a,'from')),pkg.read(required(a,'to'))))
  } else if (command === 'validate') {
    pkg.verify(pkg.read(required(a,'from')),pkg.read(required(a,'to')),pkg.read(required(a,'patch')))
  } else throw Error('Usage: full --version YYYY.MM.DD.N --published-at ISO --output full.json [--content content.json] | patch --from old/full.json --to new/full.json --output patch.json | validate --from old/full.json --to new/full.json --patch patch.json')
  console.log(command+' verified; local artifacts only')
}
if(require.main===module)main()
module.exports = {args,required}
