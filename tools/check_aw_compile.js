// Runs the WeChat wcc/wcsc binaries bundled in miniprogram-compiler.
// Install that build-only dependency outside miniprogram/, then supply its
// package path as the first argument (or make it available through NODE_PATH).
const path = require('node:path')
const compiler = require(process.argv[2] || 'miniprogram-compiler')
const root = path.join(__dirname, '../miniprogram')
for (const name of ['wxmlToJs', 'wxssToJs']) {
  const output = compiler[name](root, { maxBuffer: 16 * 1024 * 1024 })
  if (!output) throw new Error(name + ' returned no compiled output')
  console.log(name + ': all mini-program templates/styles compiled successfully')
}
