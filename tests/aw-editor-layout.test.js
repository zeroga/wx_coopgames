const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
const layout=require('../miniprogram/utils/aw/sheet-layout')
global.wx={getStorageSync(){},setStorageSync(){},getWindowInfo:()=>({windowHeight:724,windowWidth:390}),nextTick:cb=>cb()}
let def;global.Component=d=>def=d;require('../miniprogram/components/aw-asset-editor/index')
function editor(){const p={...def.methods,data:JSON.parse(JSON.stringify(def.data)),_windowInfo:{windowHeight:724,windowWidth:390}};p.setData=(update,cb)=>{Object.assign(p.data,update);if(cb)cb()};return p}

test('sheet stays within pre-keyboard viewport on small, iPhone and tablet windows',()=>{
  for(const windowHeight of [280,480,568,724,844,1024])for(const keyboard of [0,216,300,400,1200]){
    const bounds=layout.frame({windowHeight},keyboard)
    assert(bounds.keyboardHeight>=0);assert(bounds.sheetHeight>=0)
    assert(bounds.keyboardHeight+bounds.sheetHeight<=windowHeight)
    assert(bounds.sheetHeight<=windowHeight*.88)
  }
  // The old 230px minimum would extend above this available viewport.
  assert.equal(layout.frame({windowHeight:480},300).sheetHeight,168)
})
test('scroll region never overlaps measured actions for varying headers, safe areas and keyboards',()=>{
  for(const height of [168,356,637])for(const headHeight of [75,165,240])for(const footerHeight of [38,62,100]){
    const sheet={top:42,left:0,width:390,height},head={left:12.48,width:365.04,bottom:42+headHeight},footer={left:12.48,width:365.04,top:42+height-footerHeight}
    const bounds=layout.contentBounds(sheet,head,footer,8)
    assert(bounds.contentTop>=0);assert(bounds.contentHeight>=0)
    if(bounds.contentHeight){assert(42+bounds.contentTop+bounds.contentHeight<=footer.top-8)}
    else assert(bounds.contentTop<=height)
  }
  assert.equal(layout.contentBounds(null,{}, {},8),null)
})
test('native scroll-view gets measured width for phone, tablet and narrow embedded sheet containers',()=>{
  for(const viewportWidth of [320,375,390,768])for(const sheetWidth of [viewportWidth,Math.min(320,viewportWidth)]){
    const inset=24*viewportWidth/750,left=53,width=sheetWidth-2*inset
    const sheet={top:42,left,width:sheetWidth,height:400},head={left:left+inset,width,bottom:180},footer={left:left+inset,width,top:400}
    const bounds=layout.contentBounds(sheet,head,footer,8)
    assert.equal(bounds.contentWidth,width)
    assert(Math.abs(bounds.contentLeft-inset)<.00001)
    assert(Math.abs(sheet.left+bounds.contentLeft+bounds.contentWidth-(head.left+head.width))<.00001)
    assert(bounds.contentLeft+bounds.contentWidth<=sheet.width)
  }
})
test('editor uses native header and footer positions and ignores stale or detached measurements',()=>{
  const p=editor(),callbacks=[]
  p.createSelectorQuery=()=>({select(){return this},boundingClientRect(){return this},exec(cb){callbacks.push(cb)}})
  p.measureLayout();p.measureLayout()
  callbacks[1]([{top:100,left:0,width:390,height:500},{left:12.48,width:365.04,bottom:270},{left:12.48,width:365.04,top:530}])
  const actual={contentLeft:p.data.contentLeft,contentWidth:p.data.contentWidth,contentTop:p.data.contentTop,contentHeight:p.data.contentHeight}
  assert(actual.contentTop+actual.contentHeight<430)
  callbacks[0]([{top:0,left:0,width:768,height:900},{left:24.576,width:718.848,bottom:0},{left:24.576,width:718.848,top:800}])
  assert.deepEqual({contentLeft:p.data.contentLeft,contentWidth:p.data.contentWidth,contentTop:p.data.contentTop,contentHeight:p.data.contentHeight},actual)
  p.measureLayout();p._detached=true;callbacks[2]([{top:0,left:0,width:768,height:900},{left:24.576,width:718.848,bottom:0},{left:24.576,width:718.848,top:800}])
  assert.deepEqual({contentLeft:p.data.contentLeft,contentWidth:p.data.contentWidth,contentTop:p.data.contentTop,contentHeight:p.data.contentHeight},actual)
})
test('keyboard shrink and dismiss remeasure against original viewport instead of subtracting twice',()=>{
  const p=editor(),old=wx.getWindowInfo
  p.createSelectorQuery=()=>({select(){return this},boundingClientRect(){return this},exec(cb){cb([{top:0,left:0,width:390,height:p.data.sheetHeight},{left:12.48,width:365.04,bottom:145},{left:12.48,width:365.04,top:p.data.sheetHeight-65}])}})
  try{
    p.keyboard({detail:{height:0}});const full=p.data.sheetHeight
    wx.getWindowInfo=()=>({windowHeight:424,windowWidth:390})
    p.keyboard({detail:{height:300}});assert.equal(p.data.sheetHeight,412);assert(p.data.contentHeight>0)
    assert(p.data.contentTop+p.data.contentHeight<347)
    p.keyboard({detail:{height:0}});assert.equal(p.data.sheetHeight,full)
  }finally{wx.getWindowInfo=old}
})
test('parent scroll lock follows editor lifecycle and releases when overlays close',()=>{
  for(const name of ['aw-vehicle','aw-fleet']){
    const markup=fs.readFileSync('miniprogram/pages/'+name+'/index.wxml','utf8')
    const expression=markup.match(/^<page-meta page-style="{{(.+?)}}"/)[1]
    const state={editor:false,prerequisiteForm:null,memberForm:null,roleForm:null}
    const evaluate=()=>vm.runInNewContext(expression,state)
    assert.equal(evaluate(),'');state.editor=true;assert.equal(evaluate(),'overflow:hidden;')
    state.editor=false;state.prerequisiteForm={};assert.equal(evaluate(),'overflow:hidden;')
    state.prerequisiteForm=null;assert.equal(evaluate(),'')
  }
})
test('native fixed textareas and footer touches stay separated from the form scroll-view',()=>{
  const markup=fs.readFileSync('miniprogram/components/aw-asset-editor/index.wxml','utf8')
  assert(markup.startsWith('<view class="editor-overlay">'))
  for(const tag of markup.matchAll(/<textarea\b[^>]+>/g))assert.match(tag[0],/fixed="{{true}}"/)
  assert.match(markup,/<view class="backdrop"[^>]*catchtouchmove="blockTouch"/)
  assert.match(markup,/class="actions sheet-footer" catchtouchmove="blockTouch"/)
  const scroll=markup.match(/<scroll-view\b[^>]+>/)[0]
  assert.doesNotMatch(scroll,/catchtouchmove/);assert.match(scroll,/height:{{contentHeight}}px/)
  // Native scroll-view defaults to width:100%; left/right alone do not constrain it.
  assert.match(scroll,/left:{{contentLeft}}px;width:{{contentWidth}}px/)
  assert(markup.lastIndexOf('bindtap="save"')>markup.lastIndexOf('</scroll-view>'))
  const styles=fs.readFileSync('miniprogram/components/aw-asset-editor/index.wxss','utf8')
  assert.match(styles,/\.sheet-footer\s*\{[^}]*position:absolute/)
  assert.doesNotMatch(styles,/\.sheet-content\s*\{[^}]*flex:/)
})
