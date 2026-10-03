const config = require('../config')

function baseUrl() {
  return String(config.supabaseUrl || '').replace(/\/+$/, '')
}

function assertConfigured() {
  if (!baseUrl() || !config.supabasePublishableKey) {
    throw new Error('Supabase 尚未配置：请填写 config.js 中的 Project URL 和 Publishable key')
  }
}

function request(path, method, data) {
  assertConfigured()
  return new Promise((resolve, reject) => {
    wx.request({
      url: baseUrl() + path,
      method: method || 'GET',
      data: data === undefined ? undefined : data,
      header: {
        apikey: config.supabasePublishableKey,
        // Publishable keys are opaque API keys, not session JWTs.
        ...(String(config.supabasePublishableKey).startsWith('sb_publishable_') ? {} : { Authorization: 'Bearer ' + config.supabasePublishableKey }),
        'Content-Type': 'application/json'
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        const body = res.data || {}
        const message = body.message || body.error_description || body.error || ('Supabase 请求失败：HTTP ' + res.statusCode)
        reject(new Error(message))
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'))
      }
    })
  })
}

function rpc(name, args) {
  return request('/rest/v1/rpc/' + name, 'POST', args || {})
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 20)
}

module.exports = {
  awArchive(action, code, payload, version) {
    return rpc('aw_archive', { p_action: action, p_code: code || null, p_payload: payload || {}, p_expected_version: version === undefined ? null : version })
  },
  getLegacyAwPlan(profileId, inviteCode) {
    return rpc("get_aw_fleet_plan", { p_workspace_id: profileId, p_invite_code: normalizeCode(inviteCode) })
  },
  normalizeCode,

  createProfile(profileData) {
    return rpc('create_coop_profile', { p_profile_data: profileData })
  },

  openProfile(inviteCode) {
    return rpc('open_coop_profile', { p_invite_code: normalizeCode(inviteCode) })
  },

  patchProfile(profileId, inviteCode, path, value, remove) {
    return rpc('patch_coop_profile', {
      p_profile_id: profileId,
      p_invite_code: normalizeCode(inviteCode),
      p_path: path,
      p_value: remove ? null : value,
      p_delete: !!remove
    })
  },

  getGameState(profileId, inviteCode, gameKey) {
    return rpc('get_game_state', {
      p_profile_id: profileId,
      p_invite_code: normalizeCode(inviteCode),
      p_game_key: gameKey
    })
  },

  putGameState(profileId, inviteCode, gameKey, state, stateSchemaVersion) {
    return rpc('put_game_state', {
      p_profile_id: profileId,
      p_invite_code: normalizeCode(inviteCode),
      p_game_key: gameKey,
      p_state: state,
      p_state_schema_version: stateSchemaVersion || 1
    })
  },

  patchGameState(profileId, inviteCode, gameKey, path, value, remove) {
    return rpc('patch_game_state', {
      p_profile_id: profileId,
      p_invite_code: normalizeCode(inviteCode),
      p_game_key: gameKey,
      p_path: path,
      p_value: remove ? null : value,
      p_delete: !!remove
    })
  }
}