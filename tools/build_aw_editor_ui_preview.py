from pathlib import Path
import json, re, subprocess

root = Path(__file__).resolve().parents[1]
out = root / 'work/ui-audit'
out.mkdir(parents=True, exist_ok=True)
# Real editor and identity data, with an isolated in-memory store and no network.
fixture_source = r"""
const fleet=require('./miniprogram/utils/aw/fleet'),catalog=require('./miniprogram/utils/aw/catalog'),memory=new Map();
global.wx={getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>memory.set(k,fleet.clone(v)),getWindowInfo:()=>({windowHeight:724,windowWidth:390})};
const store=require('./miniprogram/utils/aw/store'),s=fleet.empty({me:'Zero'}),vehicle=catalog.tables.vehicles.find(v=>v.name==='AbramsX');
s.members=s.members.slice(0,1);s.roles=[{id:'front',name:'前线拆火',description:'',order:0},{id:'range',name:'远程火力',description:'',order:1}];
fleet.saveAsset(s,'me',vehicle.id,'planned','',[{roleId:'front',level:'primary',targetIds:[]}]);store.save(s);
let def;global.Component=d=>def=d;require('./miniprogram/components/aw-asset-editor/index');
const editor={...def.methods,data:fleet.clone(def.data),properties:{vehicleId:vehicle.id},setData(u){Object.assign(this.data,u)}};editor.prepare();
require('./miniprogram/components/aw-vehicle-label/index');const label={...def.methods,data:fleet.clone(def.data),properties:{vehicleId:vehicle.id},setData(u){Object.assign(this.data,u)}};label.refresh();
process.stdout.write(JSON.stringify({editor:{...editor.data,vehicleId:vehicle.id},label:{...label.data,vehicleId:vehicle.id}}));
"""
fixture = json.loads(subprocess.check_output(['node', '-e', fixture_source], cwd=root, text=True))
fixture['label']={'variant':'','tags':[],'markers':[],'plans':[],'planMode':'none',**fixture['label']}
label_template = (root / 'miniprogram/components/aw-vehicle-label/index.wxml').read_text()
sample = (root / 'docs/design/ui-design-system-sample.html').read_text()
fonts = '\n'.join(re.findall(r'@font-face\{[^}]+\}', sample))

def styles(file):
    source = file.read_text()
    source = re.sub(r'@import "([^"]+)";', lambda m: styles((file.parent / m[1]).resolve()), source)
    return re.sub(r'(-?[\d.]+)rpx', r'calc(\1 * var(--rpx))', source)

renderer = r'''
const fixture=FIXTURE,assets=ASSETS,template=TEMPLATE,labelTemplate=LABEL,presentation=(()=>{const module={exports:{}};PRESENTATION;return module.exports})(),layout=(()=>{const module={exports:{}};LAYOUT;return module.exports})();
function evaluate(expression,scope){try{return new Function('s','with(s){return ('+expression+')}')(scope)}catch(e){throw Error(expression+': '+e.message)}}
function value(text,scope){const only=text.match(/^{{([\s\S]*?)}}$/);return only&&!only[1].includes('}}')?evaluate(only[1],scope):text.replace(/{{([\s\S]*?)}}/g,(_,e)=>evaluate(e,scope)??'')}
function children(nodes,scope){const result=document.createDocumentFragment();let matched=false;
 for(const node of nodes){
  if(node.nodeType===3){result.append(document.createTextNode(value(node.textContent,scope)));continue}
  if(node.nodeType!==1)continue;
  if(node.hasAttribute('wx:for')){const list=value(node.getAttribute('wx:for'),scope)||[];list.forEach((item,index)=>{const copy=node.cloneNode(true);copy.removeAttribute('wx:for');const next={...scope,[node.getAttribute('wx:for-item')||'item']:item,[node.getAttribute('wx:for-index')||'index']:index};result.append(children([copy],next))});matched=false;continue}
  if(node.hasAttribute('wx:if')){matched=!!value(node.getAttribute('wx:if'),scope);if(!matched)continue}
  else if(node.hasAttribute('wx:elif')){if(matched)continue;matched=!!value(node.getAttribute('wx:elif'),scope);if(!matched)continue}
  else if(node.hasAttribute('wx:else')){if(matched)continue;matched=true}
  else matched=false;
  const tag=node.tagName.toLowerCase();
  if(tag==='block'){result.append(children(node.childNodes,scope));continue}
  if(tag==='aw-vehicle-label'){result.append(render(labelTemplate,fixture.label));continue}
  const element=document.createElement(({view:'div',text:'span','scroll-view':'div',image:'img',checkbox:'input','checkbox-group':'div'})[tag]||tag);
  for(const attribute of node.attributes){
   if(attribute.name.startsWith('wx:'))continue;
   if(/^(bind|catch)/.test(attribute.name)){element.dataset.handler=attribute.value;continue}
   let v=value(attribute.value,scope);
   if(attribute.name==='disabled'){element.disabled=!!v;continue} if(attribute.name==='checked'){element.checked=!!v;continue}
   if(attribute.name==='src'&&v.startsWith('/assets/'))v=assets[v];
   element.setAttribute(attribute.name,String(v??''));
  }
  if(tag==='scroll-view')element.classList.add('native-scroll');if(tag==='checkbox')element.type='checkbox';
  element.append(children(node.childNodes,scope));result.append(element);
 }
 return result;
}
function render(text,scope){const t=document.createElement('template');t.innerHTML=text.replace(/<([a-z-]+)([^>]*?)\/>/g,'<$1$2></$1>');return children(t.content.childNodes,scope)}
function bounds(){const sheet=document.querySelector('.sheet').getBoundingClientRect(),head=document.querySelector('.sheet-head').getBoundingClientRect(),footer=document.querySelector('.sheet-footer').getBoundingClientRect();return layout.contentBounds(sheet,head,footer,8*innerWidth/375)}
window.showCase=(variant='normal',keyboard=0,inset=0,zoom=1)=>{
 document.documentElement.style.setProperty('--rpx',innerWidth/750+'px');
 const data=structuredClone(fixture.editor);data.focusedField='';fixture.label.displayName='AbramsX';fixture.label.classCode='MBT';fixture.label.tierText='T10';fixture.label.metaText='USA · Sophie Wölfli';
 if(variant==='identity'){data.members=[];data.editable=false}
 if(variant==='readonly'){data.editable=false}
 if(variant==='empty'){data.rows=[];data.registered=false}
 if(variant==='owned'){data.statusIndex=0;data.removeLabel='取消已获取'}
 if(variant==='automatic'){data.registered=false;data.rows[0].index=0;data.rows[0].automatic=true;data.rows[0].automaticVehicles=[{id:data.vehicleId,name:data.vehicleName}]}
 if(variant==='role-list'){data.showRoleManager=true}
 if(variant==='new-role'){data.showRoleManager=true;data.roleForm={id:'',name:'',description:''};data.fieldError='请填写职责名称'}
 if(variant==='sync-error'){data.syncError='已取消登记，尚未同步：网络连接失败，输入和本地结果会保留';data.pendingRemoval=true}
 if(variant==='save-error'){data.fieldError='本地存储失败，请清理空间后重试'}
 if(variant==='saving'){data.saving=true}
 if(variant==='token'){data.statusIndex=0;data.tokenRewards=[{id:'t1',tokenName:'示例 Token',quantity:2,state:'ready'}];data.unlockPaths=[{id:'p1',name:'实际消耗路线',details:'示例说明：仅用于审查布局'}];data.tokenAcquisition='token';data.unlockPathId='p1'}
 if(variant==='long-vehicle'){fixture.label.displayName='Very Long Vehicle Name Extended Variant with UnbrokenNameABCDEFGHIJKLMNOPQRSTUVWXYZ';fixture.label.classCode='AFV';fixture.label.tierText='传奇'}
 if(variant==='missing'){fixture.label.displayName='历史车辆';fixture.label.classCode='SPG';fixture.label.tierText='T—';fixture.label.metaText=''}

 if(variant==='roles'){data.showRoleManager=true;data.roleForm={id:'front',name:'前线拆火',description:''}}
 if(variant==='long'){data.rows[0].name='长职责名称用于核对容器换行与按钮边界';data.rows[0].index=3;data.rows[0].targets=[{id:'target',vehicleId:data.vehicleId,checked:true}]}
 Object.assign(data,layout.frame({windowHeight:innerHeight},keyboard));
 document.querySelector('#mount').replaceChildren(render(template,data));

 for(const element of document.querySelectorAll('.sheet-footer'))element.style.bottom=(26*innerWidth/750+inset)+'px';
 if(zoom!==1)for(const element of document.querySelectorAll('.sheet *:not(img)'))element.style.fontSize=parseFloat(getComputedStyle(element).fontSize)*zoom+'px';
 const b=bounds(),scroll=document.querySelector('.sheet-content');
 for(const [key,val] of Object.entries(b))scroll.style[({contentLeft:'left',contentWidth:'width',contentTop:'top',contentHeight:'height'})[key]]=val+'px';
 for(const row of document.querySelectorAll('.vehicle-label')){const unit=row.querySelector('.vehicle-class').getBoundingClientRect().width/84;row.querySelector('.vehicle-main').style.width=presentation.layout(row.getBoundingClientRect().width,unit,'none').mainWidthRpx*unit+'px'}
 scroll.scrollTop=0;const head=document.querySelector('.sheet-head').getBoundingClientRect(),footer=document.querySelector('.sheet-footer').getBoundingClientRect(),body=scroll.getBoundingClientRect();
 const checks=[...scroll.querySelectorAll('.segments,.row,.notes,.tags,.field')].map(el=>{const r=el.getBoundingClientRect();return {className:el.className,left:r.left,right:r.right,contained:r.left>=head.left-.5&&r.right<=head.right+.5}});
 const buttons=[...document.querySelectorAll('.sheet-footer button')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent.trim(),width:r.width,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('button')===el}});
 const panel=document.querySelector('.sheet').getBoundingClientRect();const last=scroll.lastElementChild;scroll.scrollTop=scroll.scrollHeight;const lastBox=last?.getBoundingClientRect();const footerBox=document.querySelector('.sheet-footer').getBoundingClientRect();const lastReachable=!lastBox||lastBox.bottom<=body.bottom+1;
 const identities=[...document.querySelectorAll('.vehicle-label')].map(row=>{const r=row.getBoundingClientRect(),cls=row.querySelector('.vehicle-class').getBoundingClientRect(),main=row.querySelector('.vehicle-main').getBoundingClientRect(),tier=row.querySelector('.vehicle-tier').getBoundingClientRect();return{rowLeft:r.left,rowRight:r.right,mainWidth:main.width,mainLeft:main.left,tierRight:tier.right,tierTop:tier.top,rowTop:r.top,expectedMain:presentation.layout(r.width,cls.width/84,'none').mainWidthRpx*cls.width/84,name:row.querySelector('.vehicle-name').textContent}});const styles={button:[...document.querySelectorAll('.sheet-footer button')].map(el=>{const c=getComputedStyle(el);return{fontSize:c.fontSize,padding:c.padding,borderRadius:c.borderRadius,background:c.backgroundColor,color:c.color}}),notes:[...document.querySelectorAll('.notes')].map(el=>{const c=getComputedStyle(el);return{fontSize:c.fontSize,lineHeight:c.lineHeight,color:c.color,height:c.height}})};
 return {width:innerWidth,height:innerHeight,variant,keyboard,inset,zoom,lastReachable,styles,identities,panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom},bodyHeight:body.height,headBottom:head.bottom,footerBottom:footerBox.bottom,head:{left:head.left,right:head.right},body:{left:body.left,right:body.right,bottom:body.bottom},footer:{left:footer.left,right:footer.right,top:footer.top},checks,buttons};
};
document.fonts.ready.then(()=>window.showCase());
'''

file = root / 'miniprogram/components/aw-asset-editor/index.wxml'
template = file.read_text()
file = root / 'miniprogram/utils/aw/sheet-layout.js'
helper = file.read_text()
css = styles(root / 'miniprogram/components/aw-asset-editor/index.wxss') + styles(root / 'miniprogram/components/aw-vehicle-label/index.wxss')
import base64
assets={'/assets/icons/'+f.name:'data:image/svg+xml;base64,'+base64.b64encode(f.read_bytes()).decode() for f in (root/'miniprogram/assets/icons').glob('*.svg')}
script = renderer.replace('ASSETS', json.dumps(assets)).replace('PRESENTATION',(root/'miniprogram/utils/aw/vehicle-presentation.js').read_text()).replace('FIXTURE', json.dumps(fixture)).replace('TEMPLATE', json.dumps(template)).replace('LABEL', json.dumps(label_template)).replace('LAYOUT', helper).replace('ROOT', json.dumps(str(root)))
html = '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + fonts + '\nbody{margin:0;background:#f1f0f2;font-family:"Noto Review",sans-serif}button,input,textarea{font-family:inherit}.native-scroll{width:100%;overflow-y:auto}img{width:13px;height:13px}#background{margin:14px;padding:18px;border-radius:12px;background:#1c1a1e;color:white}\n' + css + '</style><div id="background">ARMORED WARFARE · TEAM<h1>车队管理</h1></div><div id="mount"></div><script>' + script + '</script>'
(out / 'after.html').write_text(html)
