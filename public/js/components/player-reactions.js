/* One preset-reaction menu/bubble renderer for live rooms and tutorial preview. */
(function(root){
 'use strict';
 const presets=root.URAMAKU_REACTIONS,i18n=root.URAMAKU_I18N,instances=new WeakMap();
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const word=(key,lang)=>i18n.get(key,lang);
 const eligible=(room,you,preview=false)=>(['playing','finished'].includes(room?.status)||preview&&room?.status==='lobby')&&room.players.some(p=>p.id===you?.id);
 function controls({room,you,lang='en',preview=false}){
  if(!eligible(room,you,preview))return '';
  return `<div class="reaction-tools"><button type="button" class="small" data-reaction-toggle aria-expanded="false" aria-controls="reactionChoices">${esc(word('react',lang))}</button><div id="reactionChoices" class="reaction-menu" role="group" aria-label="${esc(word('reactionMenu',lang))}" hidden>${presets.ids.map(id=>`<button type="button" class="small" data-reaction="${id}">${esc(word(presets.keys[id],lang))}</button>`).join('')}</div></div>`;
 }
 function install({container,document=container.ownerDocument,window=root,socket=null,getRoom,getYou,getLanguage,report=()=>{},clock=()=>Date.now(),preview=false}){
  if(instances.has(container))return instances.get(container);
  const bubbles=new Map();let code=null,match=null,open=false,nextAt=0,inFlight=false,cooldownTimer,generation=0;
  const find=id=>Array.from(container.querySelectorAll('.player[data-player-id]')).find(el=>el.dataset.playerId===id);
  function remove(entry){clearTimeout(entry.timer);entry.animation?.cancel?.();entry.element.remove();if(bubbles.get(entry.id)===entry)bubbles.delete(entry.id);}
  function reset(){generation++;open=false;nextAt=0;inFlight=false;clearTimeout(cooldownTimer);for(const entry of [...bubbles.values()])remove(entry);}
  function place(entry){
   const target=find(entry.id);if(!target)return remove(entry);
   const box=target.getBoundingClientRect(),vw=window.innerWidth||1024,vh=window.innerHeight||768;
   entry.element.hidden=box.bottom<0||box.top>vh;if(entry.element.hidden)return;
   const width=Math.min(210,Math.max(100,box.width),vw-24),height=entry.element.offsetHeight||44;
   const below=box.top<height+20;
   entry.element.classList.toggle('bubble-below',below);
   Object.assign(entry.element.style,{width:width+'px',left:Math.max(12,Math.min(vw-width-12,box.left+box.width/2-width/2))+'px',top:Math.max(10,Math.min(vh-height-10,below?box.bottom+8:box.top-height-8))+'px'});
  }
  function sync(){
   const room=getRoom(),roomCode=room?.code??null,matchNumber=room?.matchNumber||1;
   if(code!==roomCode||match!==matchNumber){reset();code=roomCode;match=matchNumber;}
   const toggle=container.querySelector('[data-reaction-toggle]'),menu=container.querySelector('.reaction-menu');
   const cooling=nextAt>Date.now(),disabled=inFlight||cooling||(socket&&!socket.connected);
   if(toggle){toggle.disabled=!!disabled;toggle.title=cooling?word('reactionCooldown',getLanguage()):'';toggle.setAttribute('aria-expanded',String(open));toggle.onclick=()=>{if(!eligible(getRoom(),getYou(),preview&&!socket)||disabled)return;open=!open;sync();};}
   if(menu){menu.hidden=!open;menu.onkeydown=event=>{if(event.key==='Escape'){open=false;sync();toggle?.focus();}};}
   for(const button of container.querySelectorAll('[data-reaction]')){button.disabled=!!disabled;button.onclick=()=>choose(button.dataset.reaction);}
   for(const entry of [...bubbles.values()]){
    if(entry.until<=Date.now()||!room?.players.some(p=>p.id===entry.id)){remove(entry);continue;}
    const label=word(presets.keys[entry.reaction],getLanguage());entry.element.textContent=label;entry.element.setAttribute('aria-label',(room.players.find(p=>p.id===entry.id)?.name||'')+': '+label);place(entry);
   }
  }
  function receive(event){
   const room=getRoom(),remaining=Math.min(presets.duration,event?.expiresAt-clock());
   if(event?.roomCode!==room?.code||(event.matchNumber||1)!==(room.matchNumber||1)||!presets.valid(event?.reaction)||!Number.isFinite(remaining)||remaining<=0||!room.players.some(p=>p.id===event.playerId)||!find(event.playerId))return;
   sync();const previous=bubbles.get(event.playerId);if(previous?.expiresAt===event.expiresAt&&previous.reaction===event.reaction)return;
   if(previous)remove(previous);
   const element=document.createElement('div');element.className='player-reaction-bubble';element.setAttribute('role','status');element.setAttribute('aria-live','polite');element.setAttribute('data-player-reaction',event.playerId);document.body.appendChild(element);
   const entry={id:event.playerId,reaction:event.reaction,expiresAt:event.expiresAt,until:Date.now()+remaining,element};bubbles.set(entry.id,entry);sync();
   entry.timer=setTimeout(()=>remove(entry),remaining);
   if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){try{entry.animation=element.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)',offset:.08},{opacity:1,offset:.9},{opacity:0}],{duration:remaining,easing:'ease-out',fill:'forwards'});entry.animation.finished?.then(()=>remove(entry),()=>{});}catch{}}
  }
  function choose(reaction){
   const room=getRoom(),you=getYou();
   if(!presets.valid(reaction)||!eligible(room,you,preview&&!socket)||inFlight||nextAt>Date.now()||socket&&!socket.connected)return;
   const roomCode=room.code,matchNumber=room.matchNumber||1,version=generation;open=false;inFlight=true;nextAt=Date.now()+presets.cooldown;
   clearTimeout(cooldownTimer);cooldownTimer=setTimeout(sync,presets.cooldown);sync();
   if(!socket){inFlight=false;receive({roomCode,matchNumber,playerId:you.id,reaction,expiresAt:clock()+presets.duration});sync();return;}
   socket.timeout(3000).emit('reaction',{reaction,expectedMatch:matchNumber},(error,result)=>{
    if(generation!==version||getRoom()?.code!==roomCode)return;
    inFlight=false;
    if(error||result?.error){nextAt=0;report(error?word('reactionFailed',getLanguage()):i18n.translate(result.error,getLanguage()));}
    else{nextAt=Date.now()+presets.cooldown;clearTimeout(cooldownTimer);cooldownTimer=setTimeout(sync,presets.cooldown);}
    sync();
   });
  }
  document.addEventListener('pointerdown',event=>{if(open&&!event.target.closest?.('.reaction-tools')){open=false;sync();}});
  window.addEventListener('resize',sync);window.addEventListener('scroll',()=>{for(const entry of [...bubbles.values()])place(entry);},true);
  socket?.on('reaction',receive);socket?.on('disconnect',sync);
  const api={sync,reset,receive};instances.set(container,api);return api;
 }
 root.URAMAKU_PLAYER_REACTIONS={controls,install};
})(typeof window!=='undefined'?window:null);
