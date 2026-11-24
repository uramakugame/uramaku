/* Shared presentation sequencing; never delays or mutates server decisions. */
(function(root){
 'use strict';
 const sessions=new WeakMap();
 const text=(key,lang)=>root.URAMAKU_I18N.get(key,lang);
 function session(container){let value=sessions.get(container);if(!value){value={code:null,impacts:new Map(),jobs:new Set(),waiters:new Set(),intro:null,summon:null};sessions.set(container,value);}return value;}
 function sync(container,{code,lang='en'}={}){
  const s=session(container);
  if(code!==undefined&&code!==s.code){s.intro?.cancel();s.impacts.clear();s.jobs.clear();s.waiters.clear();s.summon=null;s.code=code;}
  if(!s.intro)return;
  s.intro.banner.textContent=text('matchStart',lang);
  for(const el of container.querySelectorAll('.player.active-player')){el.classList.remove('active-player');el.classList.add('dealing-turn');}
 }
 function beginDeal(container,{count,lang='en'}={}){
  const s=session(container);s.intro?.cancel();
  const banner=container.ownerDocument.createElement('div');banner.className='match-start-popup';banner.textContent=text('matchStart',lang);banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');container.ownerDocument.body.appendChild(banner);
  let remaining=count,closed=false,fade,timer;
  const intro={banner,turnCue:false,cancel(){finish(false);}};
  s.intro=intro;sync(container,{lang});
  function finish(announce){
   if(closed)return;closed=true;clearTimeout(timer);fade?.cancel?.();banner.remove();
   if(s.intro!==intro)return;s.intro=null;
   for(const el of container.querySelectorAll('.player.dealing-turn')){el.classList.remove('dealing-turn');el.classList.add('active-player');}
   if(announce&&intro.turnCue)root.UramakuAudio?.play('turn');
  }
  function complete(){
   if(closed||s.intro!==intro||--remaining>0)return;
   try{fade=banner.animate([{opacity:1},{opacity:0}],{duration:350,easing:'ease-out',fill:'forwards'});fade.finished?.then(()=>finish(true),()=>finish(true));timer=setTimeout(()=>finish(true),450);}
   catch(error){finish(true);}
  }
  if(!count)finish(true);
  return complete;
 }
 function deferTurn(container){const intro=session(container).intro;if(!intro)return false;intro.turnCue=true;return true;}
 function impact(container,id,duration){const s=session(container);s.impacts.set(id,Math.max(s.impacts.get(id)||0,Date.now()+duration+80));}
 function revealDelay(container,id){const impacts=session(container).impacts,until=impacts.get(id)||0,now=Date.now();if(until<=now){impacts.delete(id);return 0;}return until-now;}
 function hold(container){const s=session(container),job={};s.jobs.add(job);return()=>{if(!s.jobs.delete(job)||s.jobs.size)return;const callbacks=[...s.waiters];s.waiters.clear();for(const callback of callbacks)callback();};}
 function whenIdle(container,callback){const s=session(container);if(s.jobs.size)s.waiters.add(callback);else callback();}
 function presentSummon(container,element,{key='summon'}={}){
  const s=session(container);
  if(!element){s.summon=null;return;}
  let entry=s.summon;const wasOpen=entry?.key===key&&!entry.element.hidden;
  if(!entry||entry.key!==key){entry={key,element,callbacks:[],queued:false};s.summon=entry;}else entry.element=element;
  if(!element.hidden||entry.queued)return;
  const expose=()=>{entry.element.hidden=false;entry.element.removeAttribute('inert');for(const controls of container.querySelectorAll('[data-summon-controls]')){controls.hidden=false;controls.removeAttribute('inert');}};
  if(wasOpen||root?.matchMedia?.('(prefers-reduced-motion: reduce)').matches){expose();for(const callback of entry.callbacks.splice(0))callback(element);return;}
  entry.queued=true;
  // Wait until the current state handler has registered all card jobs.
  Promise.resolve().then(()=>{
   if(s.summon!==entry)return;
   whenIdle(container,()=>{
    entry.queued=false;
    if(s.summon!==entry||!container.contains(entry.element))return;
    expose();
    for(const callback of entry.callbacks.splice(0))callback(entry.element);
   });
  });
 }
 function whenSummonReady(container,callback){
  const entry=session(container).summon;
  if(!entry)return;
  if(!entry.element.hidden)callback(entry.element);else entry.callbacks.push(callback);
 }
 const api={sync,beginDeal,deferTurn,impact,revealDelay,hold,whenIdle,presentSummon,whenSummonReady};if(root)root.URAMAKU_PRESENTATION=api;
})(typeof window!=='undefined'?window:null);
