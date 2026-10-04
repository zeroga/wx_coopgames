const navigation = require('../../utils/aw/navigation')
const updates = require('../../utils/aw/catalog-update')
const refreshAll = require('../../utils/aw/refresh-all')
Page({
  data: {catalogInfo:null,busy:false,refreshError:''},
  onLoad(){updates.init();this.refresh()},
  refresh(){this.setData({catalogInfo:updates.info()})},
  async onShow(){const task=updates.check(false);this.refresh();try{await task}catch(_){}finally{this.refresh()}},
  async refreshCloud(){
    if(this.data.busy)return
    this.setData({busy:true,refreshError:''})
    const task=refreshAll();this.refresh()
    try{const result=await task;this.setData({refreshError:result.error});if(!result.error)wx.showToast({title:result.updated?'资料已更新':'已刷新',icon:'success'})}
    finally{this.setData({busy:false});this.refresh()}
  },
  open(e) { navigation.visit('pages/aw-' + e.currentTarget.dataset.page + '/index') }
})
