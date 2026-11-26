/* Minimal DOM adapter for exercising the real browser controller and shared modules. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function harness(language='en',beforeScripts=()=>{}){
 const storage=new Map([['uramaku-language',language]]),sounds=[];
 function simple(el,selector){
  const tag=selector.match(/^[a-z][\w-]*/i)?.[0];if(tag&&el.tagName!==tag.toLowerCase())return false;
  for(const m of selector.matchAll(/\.([\w-]+)/g))if(!el.className.split(/\s+/).includes(m[1]))return false;
  const id=selector.match(/#([\w-]+)/)?.[1];if(id&&el.id!==id)return false;
  for(const m of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(!Object.hasOwn(el.attributes,m[1])||(m[2]!==undefined&&el.attributes[m[1]]!==m[2]))return false;
  return true;
 }
 function matches(el,selector){const parts=selector.trim().split(/\s+(?![^\[]*\])/);if(!simple(el,parts.pop()))return false;let parent=el.parentNode;while(parts.length){const part=parts.pop();while(parent&&!simple(parent,part))parent=parent.parentNode;if(!parent)return false;parent=parent.parentNode;}return true;}
 class Element{
  constructor(tag='div',attributes={}){this.tagName=tag;this.attributes={...attributes};this.children=[];this.style={};this.listeners={};this.dataset={};for(const [k,v] of Object.entries(attributes))if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;this.disabled=Object.hasOwn(attributes,'disabled');this.hidden=Object.hasOwn(attributes,'hidden');this.open=false;this._text='';this.classList={add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ')},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(n=>!names.includes(n)).join(' ')},toggle:(name,on)=>{on?this.classList.add(name):this.classList.remove(name)},contains:name=>this.className.split(/\s+/).includes(name)};}
  get id(){return this.attributes.id}set id(value){this.attributes.id=String(value)}get className(){return this.attributes.class||''}set className(v){this.attributes.class=v}
  setAttribute(k,v){this.attributes[k]=String(v)}getAttribute(k){return this.attributes[k]}hasAttribute(k){return Object.hasOwn(this.attributes,k)}
  get ownerDocument(){return document}
  removeAttribute(key){delete this.attributes[key];if(key.startsWith('data-'))delete this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]}
  cloneNode(deep){const copy=new Element(this.tagName,this.attributes);copy._text=this._text;copy._html=this._html;copy.style={...this.style};if(deep)for(const child of this.children)copy.appendChild(child.cloneNode(true));return copy}
  appendChild(el){el.remove();this.children.push(el);el.parentNode=this;return el}
  insertBefore(el,before){el.remove();const index=before?this.children.indexOf(before):this.children.length;this.children.splice(index,0,el);el.parentNode=this;return el}
  get firstChild(){return this.children[0]||null}get nextSibling(){const list=this.parentNode?.children||[];return list[list.indexOf(this)+1]||null}
  insertAdjacentHTML(position,html){const holder=new Element('div');holder.innerHTML=html;const nodes=[...holder.children];if(position==='beforeend')for(const node of nodes)this.appendChild(node);else if(position==='afterbegin')for(const node of nodes.reverse())this.insertBefore(node,this.firstChild);else if(position==='beforebegin')for(const node of nodes)this.parentNode.insertBefore(node,this);else if(position==='afterend'){const next=this.nextSibling;for(const node of nodes)this.parentNode.insertBefore(node,next);}}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}set textContent(v){this._text=String(v);this.children=[]}
  set innerHTML(html){this._html=html;this.children=[];this._text='';const stack=[this];for(const token of html.matchAll(/<\/?[^>]+>|[^<]+/g)){const text=token[0];if(text.startsWith('</')){if(stack.length>1)stack.pop();continue;}if(text.startsWith('<')){const tag=text.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const attrs={};for(const m of text.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){if(m[1]===tag&&m.index===1)continue;attrs[m[1]]=decode(m[2]??'');}const el=new Element(tag,attrs);stack.at(-1).appendChild(el);if(!['img','input','br','meta','link','hr'].includes(tag)&&!text.endsWith('/>'))stack.push(el);}else stack.at(-1)._text+=decode(text);}}
  get innerHTML(){return this._html||''}
  querySelectorAll(selector){const all=[];function walk(el){for(const child of el.children){if(selector.split(',').some(s=>matches(child,s)))all.push(child);walk(child)}}walk(this);return all}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null}
  closest(selector){let node=this;while(node){if(selector.split(',').some(s=>matches(node,s)))return node;node=node.parentNode;}return null}
  contains(el){while(el){if(el===this)return true;el=el.parentNode;}return false}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn)}
  click(){if(this.disabled)return;const event={target:this,currentTarget:this,preventDefault(){},stopPropagation(){}};this.onclick?.(event);for(const fn of this.listeners.click||[])fn(event)}
  focus(){document.activeElement=this}showModal(){this.open=true}getBoundingClientRect(){return{left:20,top:20,width:120,height:180,right:140,bottom:200}}get offsetWidth(){return 200}get offsetHeight(){return 150}
 }
 const body=new Element('body'),app=new Element('main',{id:'tutorial-app'});body.appendChild(app);
 const documentListeners={};
 const document={body,documentElement:{lang:language==='jp'?'ja':'en'},createElement:tag=>new Element(tag),getElementById:id=>body.querySelector('#'+id),querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),addEventListener(type,fn){(documentListeners[type]||=[]).push(fn)}};
 const window={document,innerWidth:1440,innerHeight:900,scrollTo(){},addEventListener(){},matchMedia:()=>({matches:true}),UramakuAudio:{play:kind=>sounds.push(kind),gameEvent:()=>null,renderToggle(){}}};
 const context={window,document,console,structuredClone,setTimeout(){},clearTimeout(){},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}};
 vm.createContext(context);
 beforeScripts({window,context,Element});
 for(const file of ['shared/i18n.js','shared/roles.js','shared/game.js','shared/tutorial.js','public/js/config/action-assets.js','public/js/components/presentation-flow.js','public/js/components/intel-effects.js','public/js/components/riot-state.js','public/js/components/game-feedback.js','public/js/components/role-cards.js','public/js/components/card-flip.js','public/js/components/card-motion.js','public/js/components/game-panels.js','shared/reactions.js','public/js/components/player-reactions.js','public/js/components/project-info.js','public/js/components/role-tooltips.js','public/js/tutorial.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 return{app,document,window,context,sounds,dispatchDocument(type,event){for(const fn of documentListeners[type]||[])fn(event)},value:expr=>vm.runInContext(expr,context),setLanguage(lang){vm.runInContext('tutorialLanguage='+JSON.stringify(lang)+";I18N.setLanguage(tutorialLanguage);render()",context);},click(selector){const el=app.querySelector(selector);if(!el)throw Error('Missing control '+selector);el.click();},state(){return JSON.parse(vm.runInContext('JSON.stringify(tutorial.view())',context))}};
}
module.exports={harness};
