const navigation = require('../../utils/aw/navigation')
Page({
  data: {},
  open(e) { navigation.visit('pages/aw-' + e.currentTarget.dataset.page + '/index') }
})
