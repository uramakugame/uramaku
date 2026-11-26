/* Riot state cues share the presentation queue but never hold controls/timers. */
(function(root){
 'use strict';
 const sessions=new WeakMap();
 const word=(key,lang)=>root.URAMAKU_I18N.get(key,lang);
 function entry(container){let s=sessions.get(container);if(!s){s={code:null,event:0,notice:null,timer:null,animation:null};sessions.set(container,s);}return s;}
 function clear(container){const s=entry(container);clearTimeout(s.timer);s.animation?.cancel?.();s.animation=null;s.notice=null;const notice=container.querySelector('[data-mode-state-notice]');if(notice)notice.textContent='';}
 function sync(container,{room,lang='en'}={}){
  const s=entry(container),code=room?.code??null;
  if(s.code!==code){clear(container);s.code=code;s.event=room?.stateTransitionNumber||0;}
  if(s.notice&&(room?.stateTransitionNumber||0)>s.event)clear(container);
  const shell=container.querySelector('.game-shell');
  shell?.classList.toggle('riot-mode',!!room?.treasuryMode);
  shell?.classList.toggle('state-chaos',!!room?.treasuryMode&&!!room.riot);
  shell?.classList.toggle('state-order',!!room?.treasuryMode&&!room.riot);
  if(s.notice){const el=container.querySelector('[data-mode-state-notice]');if(el)el.textContent=label(s.notice,lang);}
 }
 function label(states,lang){return states.length>1?states.map(state=>word(state==='chaos'?'modeStateChaos':'modeStateOrder',lang)).join(' → '):word(states[0]==='chaos'?'chaosStarted':'orderRestored',lang);}
 function events(before,after){
  if(!before||before.code!==after?.code||!before.treasuryMode||!after.treasuryMode)return [];
  return (after.stateTransitions||[]).filter(e=>e.id>(before.stateTransitionNumber||0));
 }
 function announce(container,{before,after,lang='en'}={}){
  const changes=events(before,after),s=entry(container);if(!changes.length)return;
  const last=changes.at(-1);if(s.code!==after.code||last.id<=s.event)return;s.event=last.id;
  const show=()=>{
   if(s.code!==after.code||s.event!==last.id||after.status==='finished')return;
   clear(container);s.notice=changes.map(e=>e.state);
   const el=container.querySelector('[data-mode-state-notice]'),info=container.querySelector('.table-match-info');
   if(!el||!info)return;el.textContent=label(s.notice,lang);
   const message=changes.length>1?changes.map(change=>word(change.state==='chaos'?'modeStateChaos':'modeStateOrder','en')).join(' → '):word(last.state==='chaos'?'stateChaosNotice':'stateOrderNotice','en');
   root.URAMAKU_ANNOUNCEMENTS?.show(message,{state:last.state});
   const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   if(!reduced){
    const color=last.state==='chaos'?'#8d3236':'#a9854e';
    try{s.animation=info.animate([{boxShadow:'inset 0 0 0 2px '+color},{boxShadow:'inset 0 0 0 0 transparent'}],{duration:700,easing:'ease-out'});}catch{}
    const actions=last.state==='chaos'?['loot','overthrow']:['earn','purge'];
    for(const action of actions){const button=container.querySelector(`[data-action="${action}"]`);try{button?.animate([{outline:'2px solid '+color,outlineOffset:'1px'},{outline:'0 solid transparent',outlineOffset:'3px'}],{duration:700,easing:'ease-out'});}catch{}}
   }
   s.timer=setTimeout(()=>clear(container),2200);
  };
  const flow=root.URAMAKU_PRESENTATION;if(flow)flow.whenIdle(container,show);else show();
 }
 const api={sync,events,announce,clear};if(root)root.URAMAKU_RIOT_STATE=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
