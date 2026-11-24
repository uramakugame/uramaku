/* One tooltip renderer and event lifecycle for multiplayer and the tutorial. */
(function(root){
 'use strict';
 const i18n=typeof module==='object'&&module.exports?require('../../../shared/i18n'):root.URAMAKU_I18N;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const instances=new WeakMap();
 const selector='.room-role-card[data-tooltip],.game-actions-panel .action[data-tooltip],.game-actions-panel .action-slot[data-tooltip]';
 function content({raw,lang='en',revealFactions=false,unavailableReason=''}){
  const word=key=>i18n.get(key,lang),lines=String(raw||'').split('\n'),first=lines.shift()||'';
  const isGeneral=first.includes('General action')||first.includes('基本アクション');
  let title='',faction='',sections=[];
  if(isGeneral){title=first.split(' · ')[0];sections=[{label:word('action'),name:title,description:lines.join(' ').trim()}];}
  else{
   const separator=first.lastIndexOf(' · ');title=separator>=0?first.slice(0,separator):first;faction=separator>=0?first.slice(separator+3):'';
   sections=lines.map(line=>{
    const match=line.match(/^(Action|Counter|アクション|カウンター) — (.*)$/);if(!match)return null;
    const colon=match[2].indexOf(': ');
    return{label:match[1],name:colon>=0?match[2].slice(0,colon):match[2],description:colon>=0?match[2].slice(colon+2):''};
   }).filter(Boolean);
  }
  return (unavailableReason?`<div class="tooltip-unavailable" role="status">${esc(unavailableReason)}</div>`:'')+
   (isGeneral?'':`<div class="tooltip-heading">${esc(title)}</div>${revealFactions&&faction?`<div class="tooltip-faction"><span class="tooltip-label">${esc(word('roleTooltip'))}</span> ${esc(faction)}</div>`:''}`)+
   [word('action'),word('counter')].map(label=>{
    const section=sections.find(item=>item.label===label);if(!section||/^none$/i.test(section.name.trim()))return '';
    return `<div class="tooltip-section"><div class="tooltip-section-heading">${esc(label)}:</div><div class="tooltip-ability-name">${esc(section.name)}</div><div class="tooltip-description">${esc(section.description)}</div></div>`;
   }).join('');
 }
 function install({getState=()=>null,getLanguage=()=>i18n.getLanguage(),document:doc=root.document,window:win=root}={}){
  if(instances.has(doc))return instances.get(doc);
  const tip=doc.createElement('div');tip.className='role-quick-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;doc.body.appendChild(tip);
  let active=null;
  const hide=()=>{active=null;tip.hidden=true;};
  const position=()=>{
   if(!active||tip.hidden)return;
   if(!doc.body.contains(active)){hide();return;}
   const r=active.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
   tip.style.left=(r.right+w+24>win.innerWidth?Math.max(12,r.left-w-12):Math.min(win.innerWidth-w-12,Math.max(12,r.right+12)))+'px';
   tip.style.top=Math.max(12,Math.min(win.innerHeight-h-12,r.top))+'px';
  };
  const show=el=>{
   if(!el?.dataset.tooltip){hide();return;}active=el;
   tip.innerHTML=content({raw:el.dataset.tooltip,lang:getLanguage(),revealFactions:getState()?.revealFactions===true,unavailableReason:el.dataset.unavailableReason});
   tip.hidden=false;position();
  };
  doc.addEventListener('pointerover',event=>{const el=event.target.closest?.(selector);if(el!==active)show(el);});
  doc.addEventListener('pointerout',event=>{if(active&&!active.contains(event.relatedTarget))hide();});
  doc.addEventListener('focusin',event=>show(event.target.closest?.(selector)));
  doc.addEventListener('focusout',event=>{if(active&&!active.contains(event.relatedTarget))hide();});
  doc.addEventListener('scroll',position,true);win.addEventListener('resize',position);win.addEventListener('pageshow',hide);
  doc.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  const instance={hide,show,element:tip};instances.set(doc,instance);return instance;
 }
 const api={content,install};if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.URAMAKU_TOOLTIPS=api;
})(typeof window!=='undefined'?window:null);
