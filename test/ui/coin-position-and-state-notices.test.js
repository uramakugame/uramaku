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
 // A six-seat board is rebuilt immediately after nonblocking Income. The
 // old tile becomes detached, and the final board/scroll position can differ.
 // Both ordinary coin changes and Income must follow the same live slot.
 for(const lang of ['en','jp'])for(const nonBlockingCoins of [false,true])for(const row of [0,1]){
  const h=harness(lang),frames=new Map(),finished=[];let frameId=0,offset=90;
  h.window.matchMedia=()=>({matches:false});h.window.URAMAKU_PRESENTATION.cancel(h.app);
  h.window.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};
  h.window.cancelAnimationFrame=id=>frames.delete(id);
  const proto=Object.getPrototypeOf(h.app);
  proto.getBoundingClientRect=function(){const tile=this.classList.contains('player')?this:this.closest('.player');if(!tile)return{left:0,top:0,width:0,height:0};const n=Number(tile.dataset.playerId.slice(1)),left=40+n%3*250,top=offset+Math.floor(n/3)*280;return{left,top:top+(this.classList.contains('player-coins')?38:0),width:this.classList.contains('player')?230:50,height:240};};
  proto.animate=function(){return{finished:{then(resolve){finished.push(resolve);}},cancel(){}};};
  const paint=()=>{h.app.innerHTML=Array.from({length:6},(_,i)=>'<div class="player" data-player-id="p'+i+'"><div class="player-coins">Coins: 3</div></div>').join('');};
  const tick=()=>{const pending=[...frames.values()];frames.clear();for(const callback of pending)callback();};
  paint();h.window.URAMAKU_FEEDBACK.animate({coins:[{id:'p'+row*3,delta:1},{id:'p'+row*3,delta:-2}]},{container:h.app,lang,nonBlockingCoins});
  const tokens=h.document.body.querySelectorAll('.coin-gain,.coin-loss');assert.equal(tokens.length,2);
  for(const token of tokens){assert.equal(token.style.left,'155px');assert.equal(token.style.top,(offset+row*280+38)+'px');}
  const old=h.app.querySelector('[data-player-id="p'+row*3+'"]');offset=150;paint();assert.notEqual(h.app.querySelector('[data-player-id="p'+row*3+'"]'),old);tick();
  for(const token of tokens)assert.equal(token.style.top,(offset+row*280+38)+'px','Rerender anchors feedback to its original row in the new board');
  offset-=110;tick();for(const token of tokens)assert.equal(token.style.top,(offset+row*280+38)+'px','Scrolling tracks the same player card');
  let idle=false;h.window.URAMAKU_PRESENTATION.whenIdle(h.app,()=>idle=true);assert.equal(idle,nonBlockingCoins,'Position updates must not change Income interactivity');
  for(const complete of finished)complete();assert.equal(frames.size,0,'Finishing cancels positioning callbacks');assert(!h.document.body.querySelector('.coin-gain,.coin-loss'));
  h.window.URAMAKU_FEEDBACK.animate({coins:[{id:'p'+row*3,delta:1}]},{container:h.app,lang,nonBlockingCoins});h.window.URAMAKU_PRESENTATION.cancel(h.app);assert.equal(frames.size,0,'Navigation cancels positioning callbacks');
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
 console.log('Top-center first/second-row coin feedback follows rerenders and scrolling with preserved timing/Income interactivity; real EN/JP Order/Chaos notifications, reduced motion, effect ordering, locale changes, latest-state replacement, no replay and pending-choice visibility passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
