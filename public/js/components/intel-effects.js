/* Viewer-authorized information effects; shared by the room and tutorial. */
(function(root){
 'use strict';
 const node=typeof module==='object'&&module.exports,i18n=node?require('../../../shared/i18n'):root.URAMAKU_I18N;
 const active=new WeakMap();
 const publicSlots=(room,id)=>{const record=room.sharedInvestigations?.find(x=>x.playerId===id);return new Map((record?.indices||[]).map((slot,index)=>[slot,{role:record.roles[index],by:record.investigatorName}]));};
 function events(before,after,oldYou,you){
  if(!before||before.code!==after?.code||before.status!=='playing')return [];
  const found=new Map(),add=event=>found.set(event.id+':'+event.slot,{code:after.code,...event});
  for(const p of after.players||[]){
   const old=before.players?.find(x=>x.id===p.id);if(!old||old.influenceCount!==p.influenceCount)continue;
   const oldPublic=publicSlots(before,p.id),nextPublic=publicSlots(after,p.id);
   for(const [slot,known] of nextPublic)if(slot<p.influenceCount&&oldPublic.get(slot)?.role!==known.role)add({id:p.id,slot,type:'public',role:known.role,own:p.id===you?.id,by:known.by});
   if(!you||you.id!==oldYou?.id)continue;
   if(p.id===you.id){
    if(oldYou.influences?.length!==you.influences?.length)continue;
    you.influences.forEach((role,slot)=>{const was=oldYou.intelKnownBy?.[slot]||[],now=you.intelKnownBy?.[slot]||[];if(!nextPublic.has(slot)&&oldYou.influences[slot]===role&&now.some(id=>!was.includes(id)))add({id:p.id,slot,type:'private',role});});
   }else{
    for(const [slot,role] of Object.entries(you.privateInvestigations?.[p.id]||{}))if(Number(slot)<p.influenceCount&&!nextPublic.has(Number(slot))&&oldYou.privateInvestigations?.[p.id]?.[slot]!==role)add({id:p.id,slot:Number(slot),type:'private',role});
   }
  }
  return [...found.values()];
 }
 const icons={private:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',public:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9m9-9a6.4 6.4 0 0 1 0 9M4.5 4.5a10.6 10.6 0 0 0 0 15m15-15a10.6 10.6 0 0 1 0 15"/></svg>'};
 const entries=container=>{let set=active.get(container);if(!set){set=new Set();active.set(container,set);}return set;};
 function target(container,event){const player=Array.from(container.querySelectorAll('.player[data-player-id]')).find(p=>p.dataset.playerId===event.id);return {player,card:player?.querySelector(`.room-role-card[data-influence-slot="${event.slot}"]`)};}
 function sync(container,{code,lang='en'}={}){
  for(const entry of [...entries(container)]){
   const {player,card}=target(container,entry.event);
   if(code!==undefined&&entry.event.code!==code||!card||!card.classList.contains('portrait-'+entry.event.role)){entry.remove();continue;}
   card.appendChild(entry.overlay);
   entry.overlay.setAttribute('aria-label',i18n.get(entry.event.type==='public'?'intelMadePublic':'intelPrivateShared',lang)+': '+i18n.role(entry.event.role,lang));
   if(entry.notice){entry.notice.textContent=i18n.get('intelYourCardPublic',lang,{player:entry.event.by,role:i18n.role(entry.event.role,lang)});player.appendChild(entry.notice);}
  }
 }
 function animate(changes,{container,lang='en'}={}){
  if(!root)return;
  const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for(const event of changes){
   const {card}=target(container,event);if(!card||!card.classList.contains('portrait-'+event.role))continue;
   for(const previous of [...entries(container)])if(previous.event.id===event.id&&previous.event.slot===event.slot)previous.remove();
   const document=card.ownerDocument,overlay=document.createElement('span');overlay.className='intel-effect intel-'+event.type;overlay.setAttribute('role','status');overlay.innerHTML='<span class="intel-ripple"></span><span class="intel-icon">'+icons[event.type]+'</span>';
   const entry={event,overlay};if(event.type==='public'&&event.own&&event.by){entry.notice=document.createElement('span');entry.notice.className='intel-owner-notice';entry.notice.setAttribute('role','status');}
   let closed=false,timer,animation;const release=reduced?null:root.URAMAKU_PRESENTATION?.hold(container,()=>entry.remove());
   entry.remove=()=>{if(closed)return;closed=true;clearTimeout(timer);animation?.cancel?.();overlay.remove();entry.notice?.remove();entries(container).delete(entry);release?.();};entries(container).add(entry);sync(container,{code:event.code,lang});
   if(reduced){timer=setTimeout(entry.remove,1000);continue;}
   try{animation=overlay.animate([{opacity:0},{opacity:1,offset:.18},{opacity:1,offset:.72},{opacity:0}],{duration:1000,easing:'ease-out',fill:'forwards'});animation.finished?.then(entry.remove,entry.remove);timer=setTimeout(entry.remove,1100);}catch{entry.remove();}
  }
 }
 function cancel(container){for(const entry of [...entries(container)])entry.remove();}
 const api={events,animate,sync,cancel};if(node)module.exports=api;if(root)root.URAMAKU_INTEL=api;
})(typeof window!=='undefined'?window:null);
