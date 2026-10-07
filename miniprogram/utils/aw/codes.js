function parse(value, expected) {
  const code = String(value || '').trim().toUpperCase()
  const match = /^AW-([TM])-([A-F0-9]{32})$/.exec(code)
  if (!match) throw new Error('请输入完整的 AW-T-车队码或 AW-M-成员码（后接32位字符）')
  const type = match[1] === 'T' ? 'team' : 'member'
  if (expected && type !== expected) throw new Error(type === 'team' ? '这是车队码，请在车队存档入口使用' : '这是成员码，请在成员存档入口使用')
  return { code, type }
}
module.exports = { parse }
