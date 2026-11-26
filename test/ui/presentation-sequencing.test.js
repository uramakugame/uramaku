'use strict';
const assert=require('node:assert/strict');
const {harness}=require('../tutorial/browser-harness');
const cards=require('../../public/js/components/role-cards'),game=require('../../server/game'),feedback=require('../../public/js/components/game-feedback');
function setup(lang='en'){
 const animations=[],timers=[];let now=0;
 const h=harness(lang,({window,context,Element})=>{
  window.matchMedia=()=>({matches:false});context.Date={now:()=>now};
  context.setTimeout=(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;};context.clearTimeout=timer=>{if(timer)timer.canceled=true;};
  Element.prototype.animate=function(frames,options){const a={element:this,frames,options};animations.push(a);return{cancel(){},finished:{then(finish,cancel){a.finish=finish;a.cancel=cancel;}}};};
  Element.prototype.getBoundingClientRect=function(){return{left:this.dataset.playerId==='b'?320:20,top:20,width:120,height:180,right:440,bottom:200};};
 });return{...h,animations,timers,time(value){now=value;}};
}
async function main(){
const tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
for(const lang of ['en','jp']){
 const h=setup(lang),flow=h.window.URAMAKU_PRESENTATION;
 const banner=()=>h.document.body.querySelector('.match-start-popup');
 assert(!banner());assert.equal(h.animations.length,0);assert(h.app.querySelector('[data-reaction-toggle]'));h.click('#startTutorial');assert(banner());assert.equal(banner().textContent,lang==='en'?'Match Start':'対戦開始');
 const welcome=h.state();h.click('#continueLesson');assert.deepEqual(h.state(),welcome,'The welcome cannot advance during the deal');assert(h.window.URAMAKU_PRESENTATION.busy(h.app));
 assert(!h.app.querySelector('.player.active-player'),'No turn outline while cards are dealing');assert(!h.sounds.includes('turn'),'First turn sound waits too');
 for(const a of h.animations.filter(a=>a.element.classList.contains('card-pile-motion')))a.finish();
 const arrivals=h.animations.filter(a=>a.element.classList.contains('card-arrival'));assert.equal(arrivals.length,8);for(const a of arrivals)a.finish();
 assert(!h.animations.some(a=>a.element.classList.contains('match-start-popup')),'Arrival is not completion: own cards still have to flip');
 const turns=h.animations.filter(a=>a.element.classList.contains('card-flip-turner'));assert.equal(turns.length,2);turns[0].finish();assert(!h.app.querySelector('.player.active-player'));turns[1].finish();
 const fade=h.animations.find(a=>a.element.classList.contains('match-start-popup'));assert(fade);assert(!h.app.querySelector('.player.active-player'),'Outline also waits for the popup fade');
 h.setLanguage(h.document.documentElement.lang==='ja'?'en':'jp');assert.equal(banner().textContent,lang==='en'?'対戦開始':'Match Start');assert(!h.app.querySelector('.player.active-player'),'Rerender cannot bypass the opening queue');
 fade.finish();await tick();assert(!banner());assert(!flow.busy(h.app));assert.equal(h.state().you.coins,1);assert.equal(h.value('tutorial.step.id'),'welcome');assert(!h.app.querySelector('.player.active-player'));
 const beforeIncome=h.animations.length;h.click('#continueLesson');await tick();assert.equal(h.app.querySelector('.player.active-player').dataset.playerId,'you');assert.equal(h.sounds.filter(s=>s==='turn').length,1);assert.equal(h.state().you.coins,2);
 const income=h.animations.slice(beforeIncome).filter(a=>a.element.classList.contains('coin-gain')&&a.element.textContent==='+1');assert.equal(income.length,1,'The first Income uses the same +1 badge as later turns');assert.equal(income[0].options.duration,1475);assert(!flow.busy(h.app),'First Income animation is nonblocking');assert(h.document.body.querySelector('.coin-gain'));
 h.value('render();render()');assert.equal(h.animations.slice(beforeIncome).filter(a=>a.element.classList.contains('coin-gain')).length,1,'Rerender does not replay the first Income');h.click('#continueLesson');await tick();assert.equal(h.value('tutorial.step.id'),'abilities','The next lesson is usable while +1 is still visible');assert.equal(h.state().you.coins,2);
 h.click('#restart');assert(banner());flow.sync(h.app,{code:null});assert(!banner(),'Leaving cancels the introduction');for(const a of h.animations.slice(-8))a.finish?.();assert(!banner(),'Old callbacks cannot revive a removed popup');
}
const person=(id,hand)=>({id,name:id,coins:7,alive:true,ready:true,influences:hand,intrigueVisibility:[0,0],privateInvestigations:{}});
function room(){const r=game.createGame('QUEUE',person('a',['assassin','lord']));Object.assign(r,{status:'playing',challengeTimerEnabled:false,deck:['kingpin','magistrate'],players:[person('a',['assassin','lord']),person('b',['swordsman','assassin']),person('c',['courtesan','kingpin'])]});return r;}
const snapshot=r=>JSON.parse(JSON.stringify(game.publicState(r)));
function board(){return '<div class="game-shell"><div class="game-layout"><div class="game-players-panel">'+['a','b','c'].map(id=>'<div class="player" data-player-id="'+id+'"><div class="player-roles">'+(id==='b'?cards.revealed({role:'swordsman',name:'Swordsman',revealIndex:0,classes:['eliminated-role-card']}):cards.hidden({slot:0}))+'</div></div>').join('')+'</div></div></div>';}
for(const action of ['purge','overthrow']){
 const h=setup(),flow=h.window.URAMAKU_PRESENTATION;flow.sync(h.app,{code:'QUEUE'});h.app.innerHTML=board();h.animations.length=0;
 const r=room();if(action==='overthrow')Object.assign(r,{treasuryMode:true,totalCoins:21,treasuryCoins:0,economyWinThreshold:14});
 const before=snapshot(r);assert(game.performAction(r,'a',action,'b').ok);const declared=snapshot(r);h.window.URAMAKU_FEEDBACK.animate(feedback.changes(before,declared,null,null),{container:h.app});
 const duration=action==='purge'?600:560;assert.equal(flow.revealDelay(h.app,'b'),duration+80);
 h.time(100);assert(game.loseInfluence(r,'b',0).ok);const effects=feedback.changes(declared,snapshot(r),null,null);h.window.URAMAKU_FEEDBACK.animate(effects,{container:h.app});
 const flip=h.animations.find(a=>a.element.classList.contains('card-flip-turner'));assert(flip);assert.equal(flip.options.delay,duration-20,'A quick influence choice still waits for the attack flight');assert.equal(flip.options.fill,'both','Face-down frame covers the new face during the delay');
 assert(!h.animations.some(a=>a.element.classList.contains('card-discard')),'The discard drop must wait until the reveal has finished');
 const saved=h.window.URAMAKU_CARD_MOTION.capture(h.app),count=h.animations.length;h.app.innerHTML=board();h.window.URAMAKU_CARD_MOTION.restore(h.app,saved);assert.equal(h.animations.length,count);assert(h.app.querySelector('.eliminated-role-card .card-flip-layer'),'A state render preserves the delayed loss reveal');
 let completed=0;flow.whenIdle(h.app,()=>completed++);h.window.URAMAKU_FEEDBACK.playSounds({sounds:['victory']},[],{container:h.app});assert.equal(completed,0);assert(!h.sounds.includes('victory'));
 h.animations.find(a=>a.element.classList.contains('attack-flight')).finish();assert.equal(completed,0,'Victory cannot cover the loss card while it is still turning');flip.finish();assert.equal(completed,0,'The revealed card remains readable before the drop');h.timers.findLast(t=>t.ms===180&&!t.canceled).fn();const drop=h.animations.findLast(a=>a.element.classList.contains('card-discard'));assert(drop);assert.equal(completed,0);drop.finish();for(const animation of h.animations.filter(a=>a.element.classList.contains('player')||a.element.classList.contains('feedback-token')||a.element.classList.contains('attack-trail')))animation.finish?.();assert.equal(completed,1);assert(h.sounds.includes('victory'));assert(!h.app.querySelector('.card-flip-layer'));
 h.time(1000);assert.equal(flow.revealDelay(h.app,'b'),0);
}
for(const [role,action] of [['swordsman','hireGuard'],['assassin','falseTrail']]){
 const r=room();assert(game.performAction(r,'a','assassinate','b').ok);for(const id of ['b','c'])assert(game.passChallenge(r,id).ok);const before=snapshot(r);assert(game.chooseCounter(r,'b',role).ok);const after=snapshot(r),effects=feedback.changes(before,after,null,null);assert.deepEqual(effects.attacks,[{from:'b',to:'a',action}]);assert.deepEqual(feedback.changes(after,after,null,null).attacks,[]);
 const h=setup();h.window.URAMAKU_PRESENTATION.sync(h.app,{code:'QUEUE'});h.app.innerHTML=board();h.animations.length=0;h.window.URAMAKU_FEEDBACK.animate(effects,{container:h.app});
 const flights=h.document.body.querySelectorAll('.attack-flight');assert.equal(flights.length,action==='hireGuard'?1:0,'Hire Guard flies; False Trail only nudges');
 const nudge=h.animations.find(a=>a.element.dataset.playerId==='b');assert(nudge);assert(nudge.frames[1].transform.includes('translate(-'),'The counter moves toward the original attacker');assert.equal(nudge.frames.at(-1).transform,'translate(0,0)');
}
console.log('Opening deal → popup fade → turn outline/cue; delayed Purge/Overthrow reveals across renders; Hire Guard flight and False Trail nudge passed in EN/JP.');
// An unavailable flip falls back once; it cannot finish the whole deal early.
{
 const h=setup();h.click('#startTutorial');
 const prototype=Object.getPrototypeOf(h.app),animate=prototype.animate;prototype.animate=function(frames,options){if(this.classList.contains('card-flip-turner'))throw Error('animation unavailable');return animate.call(this,frames,options);};
 for(const a of h.animations.filter(a=>a.element.classList.contains('card-pile-motion')))a.finish();
 const arrivals=h.animations.filter(a=>a.element.classList.contains('card-arrival'));
 for(const a of arrivals.slice(0,-1))a.finish();assert(!h.animations.some(a=>a.element.classList.contains('match-start-popup')),'Failed flips do not double-count completion');arrivals.at(-1).finish();assert(h.animations.some(a=>a.element.classList.contains('match-start-popup')));prototype.animate=animate;
}
// A final-influence Purge resolves immediately on the server, but still stages its reveal.
{
 const r=room();r.players=r.players.slice(0,2);r.players[1].influences=['swordsman'];const before=snapshot(r);assert(game.performAction(r,'a','purge','b').ok);const after=snapshot(r);assert.equal(after.status,'finished');const effects=feedback.changes(before,after,null,null);assert.equal(effects.attacks.length,1);assert.equal(effects.flips.filter(f=>f.kind==='loss').length,1);
 const h=setup(),flow=h.window.URAMAKU_PRESENTATION;flow.sync(h.app,{code:'QUEUE'});h.app.innerHTML=board();h.animations.length=0;h.window.URAMAKU_FEEDBACK.animate(effects,{container:h.app});assert.equal(h.animations.find(a=>a.element.classList.contains('card-flip-turner')).options.delay,680);
 let stale=0;flow.whenIdle(h.app,()=>stale++);flow.sync(h.app,{code:null});for(const a of h.animations)a.finish?.();assert.equal(stale,0,'Leaving clears queued end-of-match callbacks');
}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
