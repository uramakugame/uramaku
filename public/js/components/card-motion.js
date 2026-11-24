/* Shared discard, face-down arrival, then private flip. Presentation only. */
(function(root){
 'use strict';
 const node=typeof module==='object'&&module.exports;
 const cards=node?require('./role-cards'):root.URAMAKU_ROLE_CARDS;
 const flip=node?require('./card-flip'):root.URAMAKU_CARD_FLIP;
 const i18n=node?require('../../../shared/i18n'):root.URAMAKU_I18N;
 const active=new WeakMap();
 const reduced=()=>root?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function animate(element,{kind='deal',fromRole=null,oldFaction=null,faction=null,reveal=true,revealDiscard=false,lang='en',delay=0,onComplete=null}={}){
  if(!element?.animate||reduced())return false;
  active.get(element)?.cancel();flip.cancel?.(element);
  // Summon turns the top card in place; only dealt and replacement cards arrive from above.
  if(kind==='draw'){root?.UramakuAudio?.play('draw');return flip.animate(element,{faction,lang,delay,onComplete});}
  let notified=false;const complete=()=>{if(!notified){notified=true;onComplete?.();}};
  const doc=element.ownerDocument||document,height=element.getBoundingClientRect().height;
  let contents=Array.from(element.children);
  const layer=doc.createElement('div');layer.className='card-flip-layer card-motion-layer';layer.setAttribute('aria-hidden','true');layer.setAttribute('inert','');
  const arrival=doc.createElement('div');arrival.className='card-motion-card card-arrival';arrival.style.opacity='0';arrival.innerHTML=cards.hidden({faction});
  if(kind!=='loss')layer.appendChild(arrival);
  let leaving=null;
  if(kind==='replace'||kind==='loss'){
   leaving=doc.createElement('div');leaving.className='card-motion-card card-discard';leaving.style.opacity='0';
   leaving.innerHTML=kind==='loss'?cards.revealed({role:fromRole,name:i18n.role(fromRole,lang),status:i18n.get('eliminated',lang),classes:['eliminated-role-card']}):fromRole?cards.revealed({role:fromRole,name:i18n.role(fromRole,lang)}):cards.hidden({faction:oldFaction});layer.appendChild(leaving);
  }
  for(const child of contents)child.classList.add('card-flip-covered');element.classList.add('card-flipping');element.appendChild(layer);
  let done=false;const animations=[],timers=[];
  const cleanup=(notify=true)=>{
   if(done)return;done=true;for(const timer of timers)clearTimeout(timer);
   if(leaving)flip.cancel?.(leaving);
   for(const animation of animations)animation?.cancel?.();
   for(const child of contents)child.classList.remove('card-flip-covered');
   element.classList.remove('card-flipping');layer.remove();active.delete(element);if(notify)complete();
  };
  const entry={cancel:cleanup,rebind(next){
   if(done)return false;
   for(const child of contents)child.classList.remove('card-flip-covered');element.classList.remove('card-flipping');active.delete(element);
   element=next;contents=Array.from(next.children);reveal=!next.classList.contains('hidden-role-card');
   for(const child of contents)child.classList.add('card-flip-covered');next.classList.add('card-flipping');next.appendChild(layer);active.set(next,entry);return true;
  }};active.set(element,entry);
  const stage=(el,frames,duration,wait,next)=>{
   let advanced=false;
   const advance=()=>{if(advanced||done)return;advanced=true;if(element.isConnected===false){cleanup();return;}next();};
   try{const animation=el.animate(frames,{duration,delay:wait,easing:'ease-in-out',fill:'both'});animations.push(animation);animation?.finished?.then(advance,()=>cleanup());timers.push(setTimeout(advance,duration+wait+100));}
   catch(error){cleanup();}
  };
  const arrive=()=>{
   if(kind!=='deal'||reveal){if(delay)timers.push(setTimeout(()=>{if(!done&&element.isConnected!==false)root?.UramakuAudio?.play('draw');},delay));else root?.UramakuAudio?.play('draw');}
   stage(arrival,[{transform:`translateY(${-height-24}px)`,opacity:0},{transform:'translateY(0px)',opacity:1}],400,delay,()=>{
   cleanup(false);if(reveal&&element.isConnected!==false){if(!flip.animate(element,{faction,lang,onComplete:complete}))complete();}else complete();
  });};
  let discarding=false;
  const discard=()=>{
   if(done||discarding)return;discarding=true;
   root?.UramakuAudio?.play('discard');
   if(kind==='loss')stage(leaving,[{transform:'translateY(-12px)',opacity:1},{transform:'translateY(0px)',opacity:1}],280,0,()=>cleanup());
   else stage(leaving,[{transform:'translateY(0px)',opacity:1},{transform:`translateY(${height+24}px)`,opacity:0}],280,0,()=>{leaving.remove();arrive();});
  };
  if(leaving){
   if(kind==='loss')leaving.style.transform='translateY(-12px)';
   if(revealDiscard){
    leaving.style.opacity='1';
    const revealed=()=>{if(!done)timers.push(setTimeout(discard,180));};
    if(!flip.animate(leaving,{faction:oldFaction,lang,delay,onComplete:revealed}))discard();
   }else if(delay)timers.push(setTimeout(discard,delay));else discard();
  }else arrive();
  return true;
 }
 function previewRect(container){
  const el=container?.querySelector('#summonTray .summon-drawn-card');if(!el)return null;
  const rect=el.getBoundingClientRect();return{left:rect.left,top:rect.top,width:rect.width,height:rect.height};
 }
 function discardPreview({rect,fromRole,lang='en'}={}){
  if(!rect||!fromRole||reduced()||typeof document==='undefined')return false;
  root?.UramakuAudio?.play('discard');
  const ghost=document.createElement('div');ghost.className='game-shell card-discard-float';ghost.style.opacity='0';ghost.setAttribute('aria-hidden','true');ghost.setAttribute('inert','');
  Object.assign(ghost.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
  const layout=document.createElement('div');layout.className='game-layout';const roles=document.createElement('div');roles.className='player-roles';roles.innerHTML=cards.revealed({role:fromRole,name:i18n.role(fromRole,lang)});layout.appendChild(roles);ghost.appendChild(layout);document.body.appendChild(ghost);
  const remove=()=>ghost.remove();
  try{const animation=ghost.animate([{transform:'translateY(0px)',opacity:1},{transform:`translateY(${rect.height+24}px)`,opacity:0}],{duration:350,easing:'ease-in',fill:'forwards'});animation?.finished?.then(remove,remove);setTimeout(remove,450);}
  catch(error){remove();return false;}
  return true;
 }
 const signature=el=>el.className.match(/\bportrait-(lord|courtesan|swordsman|assassin|magistrate|kingpin)\b/)?.[0]||el.querySelector('.card-back-image')?.getAttribute('src')||'';
 function capture(container){
  const saved=[];
  for(const player of container.querySelectorAll('.player[data-player-id]'))for(const el of player.querySelectorAll('.room-role-card[data-influence-slot],.eliminated-role-card[data-reveal-index]'))if(el.classList.contains('card-flipping'))saved.push({id:player.dataset.playerId,slot:el.dataset.influenceSlot,revealIndex:el.dataset.revealIndex,el,signature:signature(el)});
  const preview=container.querySelector('#summonTray .summon-drawn-card');if(preview?.classList.contains('card-flipping'))saved.push({preview:true,el:preview,signature:signature(preview)});
  return saved;
 }
 function restore(container,saved=[]){
  const players=Array.from(container.querySelectorAll('.player[data-player-id]'));
  for(const item of saved){
   const next=item.preview?container.querySelector('#summonTray .summon-drawn-card'):players.find(p=>p.dataset.playerId===item.id)?.querySelector(item.revealIndex!==undefined?`.eliminated-role-card[data-reveal-index="${item.revealIndex}"]`:`.room-role-card[data-influence-slot="${item.slot}"]`);
   if(next&&signature(next)===item.signature){if(active.get(item.el)?.rebind(next)||flip.rebind?.(item.el,next))continue;}
   active.get(item.el)?.cancel();flip.cancel?.(item.el);
  }
 }
 const api={animate,previewRect,discardPreview,capture,restore};if(node)module.exports=api;if(root)root.URAMAKU_CARD_MOTION=api;
})(typeof window!=='undefined'?window:null);
