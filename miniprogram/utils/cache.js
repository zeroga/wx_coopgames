const PROFILE_ID_KEY = 'coopgame.remote.profileId'
const INVITE_CODE_KEY = 'coopgame.remote.inviteCode'

function key(gameKey) { return 'coopgame.state.' + gameKey }

module.exports = {
  get(gameKey) {
    try { return wx.getStorageSync(key(gameKey)) || null } catch (e) { return null }
  },
  set(gameKey, state) {
    try { wx.setStorageSync(key(gameKey), state); return true } catch (e) { return false }
  },
  getRemote() {
    try {
      return {
        profileId: wx.getStorageSync(PROFILE_ID_KEY) || '',
        inviteCode: wx.getStorageSync(INVITE_CODE_KEY) || ''
      }
    } catch (e) {
      return { profileId: '', inviteCode: '' }
    }
  },
  setRemote(profileId, inviteCode) {
    try {
      wx.setStorageSync(PROFILE_ID_KEY, profileId || '')
      wx.setStorageSync(INVITE_CODE_KEY, inviteCode || '')
    } catch (e) {}
  },
  clearRemote() {
    try {
      wx.removeStorageSync(PROFILE_ID_KEY)
      wx.removeStorageSync(INVITE_CODE_KEY)
    } catch (e) {}
  }
}