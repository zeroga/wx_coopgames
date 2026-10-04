// SHA-256 over UTF-8; no Node / WebCrypto dependency in the mini-program.
const constants = [], initial = []
for (let n = 2; constants.length < 64; n++) {
  let prime = true
  for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break }
  if (!prime) continue
  if (initial.length < 8) initial.push((Math.sqrt(n) % 1 * 4294967296) | 0)
  constants.push((Math.pow(n, 1 / 3) % 1 * 4294967296) | 0)
}
function rotate(x, n) { return (x >>> n) | (x << (32 - n)) }
function sha256(text) {
  const bytes = unescape(encodeURIComponent(text)), words = [], length = bytes.length
  for (let i = 0; i < length; i++) words[i >> 2] = (words[i >> 2] || 0) | bytes.charCodeAt(i) << (24 - (i % 4) * 8)
  words[length >> 2] = (words[length >> 2] || 0) | 0x80 << (24 - (length % 4) * 8)
  const total = (((length + 8) >> 6) + 1) * 16
  words[total - 2] = Math.floor(length / 536870912); words[total - 1] = length * 8
  const hash = initial.slice(), schedule = []
  for (let offset = 0; offset < total; offset += 16) {
    for (let i = 0; i < 64; i++) {
      if (i < 16) schedule[i] = words[offset + i] | 0
      else {
        const a = schedule[i - 15], b = schedule[i - 2]
        schedule[i] = (schedule[i - 16] + (rotate(a,7)^rotate(a,18)^(a>>>3)) + schedule[i - 7] + (rotate(b,17)^rotate(b,19)^(b>>>10))) | 0
      }
    }
    let [a,b,c,d,e,f,g,h] = hash
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotate(e,6)^rotate(e,11)^rotate(e,25)) + ((e&f)^(~e&g)) + constants[i] + schedule[i]) | 0
      const t2 = ((rotate(a,2)^rotate(a,13)^rotate(a,22)) + ((a&b)^(a&c)^(b&c))) | 0
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0
    }
    ;[a,b,c,d,e,f,g,h].forEach((x,i) => { hash[i]=(hash[i]+x)|0 })
  }
  return hash.map(x => ('00000000'+(x>>>0).toString(16)).slice(-8)).join('')
}
module.exports = sha256
