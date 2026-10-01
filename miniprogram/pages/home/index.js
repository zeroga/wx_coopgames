const games = require('../../data/games')
Page({
  data: { games },
  openGame(e) {
    const key = e.currentTarget.dataset.key
    const game = games.find(x => x.key === key)
    if (!game.enabled) {
      wx.showToast({ title: '入口已预留', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/game/index?game=' + key })
  }
})