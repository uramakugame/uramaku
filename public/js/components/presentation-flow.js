/* Shared presentation sequencing; never delays or mutates server decisions. */
(function(root){
 'use strict';
 const sessions=new WeakMap();
 const text=(key,lang)=>root.URAMAKU_I18N.get(key,lang);
 function session(container){let value=sessions.get(container);if(!value){value={code:null,impacts:new Map(),jobs:new Set(),decorations:new Set(),waiters:new Set(),intro:null,summon:null,decision:null,queue:[],current:null};sessions.set(container,value);}return value;}
 const selectors='.game-actions-panel .actions,.player-decision-overlay,.t-decision,.t-choices,[data-lose],[data-summon-replace],[data-intrigue-reveal],[data-share-private-target],.selectable-target';
 function lock(container){
  const busy=!!session(container).current;
  container.classList.toggle('presentation-busy',busy);
  for(const el of container.querySelectorAll(selectors)){
   if(busy&&!el.hasAttribute('inert')){el.setAttribute('inert','');el.setAttribute('data-presentation-lock','');}
   else if(!busy&&el.hasAttribute('data-presentation-lock')){el.removeAttribute('inert');el.removeAttribute('data-presentation-lock');}
  }
 }
 function cancel(container){const s=session(container);s.current=null;s.queue=[];s.waiters.clear();for(const job of [...s.jobs,...s.decorations])job.cancel?.();s.jobs.clear();s.decorations.clear();s.intro?.cancel();s.impacts.clear();s.summon=null;s.decision=null;lock(container);}
 function enqueue(container,{code,run}){
  sync(container,{code});const s=session(container);s.queue.push(run);pump();
  function pump(){
   if(s.current||!s.queue.length)return;
   const entry={};s.current=entry;lock(container);
   const current=()=>s.current===entry;
   const finish=()=>{if(!current())return;s.current=null;lock(container);pump();};
   try{s.queue.shift()(finish,current);}catch(error){finish();throw error;}
  }
 }
 function busy(container){return !!session(container).current;}
 function settled(container,callback){
  if(root?.matchMedia?.('(prefers-reduced-motion: reduce)').matches){callback();return;}
  // Rendering may register a private draw after exposing the deck-top card.
  Promise.resolve().then(()=>whenIdle(container,callback));
 }
 function sync(container,{code,lang='en'}={}){
  const s=session(container);
  if(code!==undefined&&code!==s.code){cancel(container);s.code=code;}
  lock(container);
  if(!s.intro)return;
  s.intro.banner.textContent=text('matchStart',lang);
  for(const el of container.querySelectorAll('.player.active-player')){el.classList.remove('active-player');el.classList.add('dealing-turn');}
 }
 function beginDeal(container,{count,lang='en'}={}){
  const s=session(container);s.intro?.cancel();
  const banner=container.ownerDocument.createElement('div');banner.className='match-start-popup';banner.textContent=text('matchStart',lang);banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');container.ownerDocument.body.appendChild(banner);
  let remaining=count,closed=false,fade,timer;const release=hold(container);
  const intro={banner,turnCue:false,cancel(){finish(false);}};
  s.intro=intro;sync(container,{lang});
  function finish(announce){
   if(closed)return;closed=true;clearTimeout(timer);fade?.cancel?.();banner.remove();
   if(s.intro!==intro){release();return;}s.intro=null;
   for(const el of container.querySelectorAll('.player.dealing-turn')){el.classList.remove('dealing-turn');el.classList.add('active-player');}
   if(announce&&intro.turnCue)root.UramakuAudio?.play('turn');
   release();
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
 function hold(container,onCancel,{blocking=true}={}){
  const s=session(container),collection=blocking?s.jobs:s.decorations,job={cancel:onCancel};collection.add(job);
  return()=>{
   if(!collection.delete(job)||!blocking||s.jobs.size)return;
   const callbacks=[...s.waiters];s.waiters.clear();for(const callback of callbacks){if(s.jobs.size)s.waiters.add(callback);else callback();}
  };
 }
 function whenIdle(container,callback){const s=session(container);if(s.jobs.size)s.waiters.add(callback);else callback();}
 function presentSummon(container,element,{key='summon'}={}){
  const s=session(container);
  if(!element){s.summon=null;return;}
  let entry=s.summon;const wasOpen=entry?.key===key&&!entry.element.hidden;
  if(!entry||entry.key!==key){entry={key,element,callbacks:[],queued:false};s.summon=entry;}else entry.element=element;
  if(!element.hidden||entry.queued)return;
  const expose=()=>{entry.element.hidden=false;entry.element.removeAttribute('inert');for(const controls of container.querySelectorAll('[data-summon-controls]')){controls.hidden=false;controls.removeAttribute('inert');}lock(container);};
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
 // Counter/concealment choices wait for the preceding public loss animation.
 function presentDecision(container,element,{key}={}){
  const s=session(container);
  if(!element){s.decision=null;return;}
  let entry=s.decision;
  if(!entry||entry.key!==key){entry={key,element,open:false,queued:false};s.decision=entry;}else entry.element=element;
  const expose=()=>{if(s.decision!==entry||!container.contains(entry.element))return;entry.open=true;entry.element.hidden=false;entry.element.removeAttribute('inert');lock(container);};
  if(entry.open||root?.matchMedia?.('(prefers-reduced-motion: reduce)').matches){expose();return;}
  if(entry.queued)return;entry.queued=true;
  Promise.resolve().then(()=>{if(s.decision!==entry)return;whenIdle(container,()=>{entry.queued=false;expose();});});
 }
 function whenSummonReady(container,callback){
  const entry=session(container).summon;
  if(!entry)return;
  if(!entry.element.hidden)callback(entry.element);else entry.callbacks.push(callback);
 }
 const api={sync,cancel,enqueue,busy,settled,beginDeal,deferTurn,impact,revealDelay,hold,whenIdle,presentDecision,presentSummon,whenSummonReady};if(root)root.URAMAKU_PRESENTATION=api;
})(typeof window!=='undefined'?window:null);
