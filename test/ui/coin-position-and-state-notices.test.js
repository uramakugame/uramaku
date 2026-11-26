'use strict';
const assert=require('node:assert/strict'),g=require('../../shared/game'),roomHarness=require('../helpers/browser-room-harness'),{harness}=require('../tutorial/browser-harness');
async function main(){
 // Coin text can remain left-aligned while feedback uses the complete tile's
 // center. Keep its vertical position, timing and nonblocking Income behavior.
 for(const lang of ['en','jp']){
  const h=harness(lang),animations=[];h.window.matchMedia=()=>({matches:false});h.window.URAMAKU_PRESENTATION.cancel(h.app);
  const proto=Object.getPrototypeOf(h.app);proto.getBoundingClientRect=function(){return this.classList.contains('player')?{left:100,top:70,width:240,height:260}:{left:112,top:98,width:40,height:16};};proto.animate=function(frames,options){animations.push({element:this,frames,options});return{cancel(){},finished:{then(){}}};};
  h.app.innerHTML='<div class="player" data-player-id="a"><div class="player-coins">Coins: 2</div></div>';
  h.window.URAMAKU_FEEDBACK.animate({coins:[{id:'a',delta:1},{id:'a',delta:-2}]},{container:h.app,lang,nonBlockingCoins:true});
  const tokens=h.document.body.querySelectorAll('.coin-gain,.coin-loss');assert.equal(tokens.length,2);for(const token of tokens){assert.equal(token.style.left,'220px');assert.equal(token.style.top,'98px');}
  assert(animations.every(a=>a.options.duration===1475));let idle=false;h.window.URAMAKU_PRESENTATION.whenIdle(h.app,()=>idle=true);assert(idle);h.window.URAMAKU_PRESENTATION.cancel(h.app);assert(!h.document.body.querySelector('.coin-gain,.coin-loss'));
 }
 // Real multiplayer snapshots reach the ordinary announcement system after
 // effects settle; rerenders and reconnects never replay a transition.
 for(const lang of ['en','jp'])for(const reduced of [true,false]){
  const p=id=>({id,name:id,coins:4,influences:['lord','magistrate'],alive:true,ready:true,connected:true,privateInvestigations:{}}),r=g.createGame('CUES',p('a'));Object.assign(r,{status:'playing',players:[p('a'),p('b')],treasuryMode:true,totalCoins:12,treasuryCoins:1,economyWinThreshold:10,turnNumber:1});r.players[1].coins=7;
  const h=roomHarness(lang),animations=[];h.window.matchMedia=()=>({matches:reduced});Object.getPrototypeOf(h.app).animate=function(frames,options){const item={element:this,done:false};animations.push(item);return{cancel(){},finished:{then(finish){item.finish=()=>{if(!item.done){item.done=true;finish();}}}}};};
  h.paint(g.publicState(r),g.privateState(r,'a'));assert(!h.document.body.querySelector('.state-transition-notice'));
  const drain=async()=>{for(let n=0;n<15;n++){for(const a of animations.filter(a=>!a.done))a.finish?.();for(let i=0;i<5;i++)await Promise.resolve();}};
  assert(g.performAction(r,'a','earn').ok);const chaos={room:g.publicState(r),you:g.privateState(r,'a')};h.handlers.state(chaos);
  if(!reduced)assert(!h.document.body.querySelector('.state-transition-notice'),'The announcement waits for the action and handoff');await drain();
  let toast=h.document.body.querySelector('.state-transition-notice');assert(toast);assert(toast.classList.contains('state-chaos'));assert.equal(toast.textContent,h.window.URAMAKU_I18N.get('stateChaosNotice',lang));assert(!h.window.URAMAKU_PRESENTATION.busy(h.app));
  h.handlers.state(chaos);await drain();assert.equal(h.document.body.querySelectorAll('.state-transition-notice').length,1);assert.equal(h.document.body.querySelector('.state-transition-notice'),toast);
  h.value('render()');assert.equal(h.document.body.querySelector('.state-transition-notice'),toast);const switched=lang==='en'?'jp':'en';h.value('changeLanguage('+JSON.stringify(switched)+')');assert.equal(toast.textContent,h.window.URAMAKU_I18N.get('stateChaosNotice',switched));
  assert(g.performAction(r,'b','overthrow','a').ok);h.handlers.state({room:g.publicState(r),you:g.privateState(r,'a')});await drain();toast=h.document.body.querySelector('.state-transition-notice');assert(toast.classList.contains('state-order'));assert.equal(h.document.body.querySelectorAll('.state-transition-notice').length,1,'A newer state replaces its old state notice');assert.equal(toast.textContent,h.window.URAMAKU_I18N.get('stateOrderNotice',switched));assert(h.app.querySelector('[data-lose]'),'An outstanding influence decision remains available');
  const spectator=roomHarness(lang);spectator.paint(g.publicState(r),null);spectator.handlers.state({room:g.publicState(r),you:null});await Promise.resolve();assert(!spectator.document.body.querySelector('.state-transition-notice'),'An initial/reconnected observer receives no historical announcement');
 }
 console.log('Top-center coin feedback with preserved y/timing/Income interactivity; real EN/JP Order/Chaos notifications, reduced motion, effect ordering, locale changes, latest-state replacement, no replay and pending-choice visibility passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
