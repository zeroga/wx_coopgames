// Browser geometry checks for real WXML/WXSS. Not a WeChat runtime emulator.
const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const dir=path.resolve(__dirname,'../work/ui-audit'),pending=new Map(),results=[]
let serial=0,buffer=''
const chrome=cp.spawn(process.env.CHROMIUM_BIN||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-pipe','--user-data-dir='+path.join(dir,'chrome-profile')],{stdio:['ignore','ignore','pipe','pipe','pipe']})
chrome.stderr.on('data',()=>{})
chrome.stdio[4].on('data',data=>{buffer+=data.toString();let n;while((n=buffer.indexOf('\0'))>=0){const item=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);if(item.id){const p=pending.get(item.id);pending.delete(item.id);if(item.error)p.reject(Error(JSON.stringify(item.error)));else p.resolve(item.result)}}})
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,sessionId})+'\0')})}
async function evaluate(sessionId,expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
async function run(){
 const viewports=[[320,568],[375,724],[390,724],[768,1024],[320,480],[724,390],[768,390],[1024,768]]
 const variants=['normal','long','roles','role-list','new-role','identity','readonly','empty','owned','automatic','sync-error','save-error','saving','token','long-vehicle','missing']
 for(const [width,height] of viewports){
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});await send('Page.enable',{},sessionId)
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true},sessionId)
  const {frameTree}=await send('Page.getFrameTree',{},sessionId)
  await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html:fs.readFileSync(path.join(dir,'after.html'),'utf8')},sessionId)
  await evaluate(sessionId,"new Promise(resolve=>{if(document.readyState==='complete')resolve();else addEventListener('load',resolve,{once:true})}).then(()=>document.fonts.ready)")
  for(const variant of variants)for(const keyboard of [0,width>height?160:300])for(const inset of keyboard?[0]:[0,34]){
   const r=await evaluate(sessionId,'window.showCase('+JSON.stringify(variant)+','+keyboard+','+inset+')');results.push(r)
   for(const [ok,label] of [[Math.abs(r.body.left-r.head.left)<.5,'left'],[Math.abs(r.body.right-r.head.right)<.5,'right'],[r.body.bottom<=r.footer.top,'footer overlap'],[r.identities.every(i=>i.mainWidth>0&&Math.abs(i.mainWidth-i.expectedMain)<.5&&i.mainLeft>i.rowLeft&&i.tierRight<=i.rowRight+.5),'identity slots'],[r.bodyHeight>0,'positive body height'],[r.headBottom<=r.footer.top,'header overlap'],[r.lastReachable,'last input reachable'],[r.checks.every(c=>c.contained),'controls contained'],[r.buttons.every(b=>b.hit),'button hit'],[r.panel.top>=-.5&&r.panel.right<=width+.5&&r.panel.left>=-.5,'panel contained']])assert(ok,label+': '+JSON.stringify(r))
   if(r.buttons.length===2)assert(Math.abs(r.buttons[0].width-r.buttons[1].width)<.1,'equal widths: '+JSON.stringify(r))
   if(width===390&&keyboard===0&&inset===34&&['normal','roles','token','sync-error'].includes(variant)){
    await evaluate(sessionId,"document.querySelector('.sheet-content').scrollTop=0;new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))")
    const {data}=await send('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync(path.join(dir,'full-'+variant+'-390.png'),Buffer.from(data,'base64'))
   }
  }
  for(const variant of ['normal','long','roles']){
   const r=await evaluate(sessionId,'window.showCase('+JSON.stringify(variant)+',0,34,1.3)');results.push(r)
   assert(r.bodyHeight>0&&r.lastReachable&&r.checks.every(c=>c.contained)&&r.buttons.every(b=>b.hit),'font scaling: '+JSON.stringify(r))
  }
  console.log('PASS viewport '+width+'x'+height)
  await send('Target.closeTarget',{targetId})
 }
 fs.writeFileSync(path.join(dir,'full-browser-checks.json'),JSON.stringify(results,null,2))
 console.log('PASS: '+results.length+' editor layout scenarios, exact equal footer widths, end-of-form reachability, safe inset and font scaling')
}
run().then(()=>chrome.kill()).catch(error=>{console.error(error);chrome.kill();process.exitCode=1})
setTimeout(()=>{chrome.kill();process.exit(2)},55000).unref()
