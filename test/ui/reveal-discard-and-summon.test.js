'use strict';
const assert=require('node:assert/strict'),{harness}=require('../tutorial/browser-harness'),g=require('../../server/game'),cards=require('../../public/js/components/role-cards'),feedback=require('../../public/js/components/game-feedback'),panels=require('../../public/js/components/game-panels');
function setup(){const animations=[],timers=[];const h=harness('en',({window,context,Element})=>{
 window.matchMedia=()=>({matches:false});context.setTimeout=(fn,ms)=>{const t={fn,ms};timers.push(t);return t;};context.clearTimeout=t=>{if(t)t.canceled=true;};
 Element.prototype.animate=function(frames,options){const a={element:this,frames,options};animations.push(a);return{cancel(){},finished:{then(finish,cancel){a.finish=finish;a.cancel=cancel;}}};};
 });h.window.URAMAKU_PRESENTATION.sync(h.app,{code:'TEST'});animations.length=0;timers.length=0;return{...h,animations,timers};}
const hold=h=>{const t=h.timers.findLast(t=>t.ms===180&&!t.canceled);assert(t);t.fn();t.canceled=true;};
const last=(h,className)=>h.animations.findLast(a=>a.element.classList.contains(className));
function fixture(){const p=(id,hand)=>({id,name:id,alive:true,coins:3,influences:hand,intrigueVisibility:[0,0],privateInvestigations:{}});const r=g.createGame('TEST',p('a',['magistrate','kingpin']));Object.assign(r,{status:'playing',challengeTimerEnabled:false,players:[p('a',['magistrate','kingpin']),p('b',['lord','assassin']),p('c',['courtesan','swordsman'])],deck:['assassin','swordsman']});return r;}
const view=r=>({room:JSON.parse(JSON.stringify(g.publicState(r))),you:JSON.parse(JSON.stringify(g.privateState(r,'a')))});
function board(v,preview=false){return '<div class="game-shell game-layout">'+v.room.players.map(p=>'<div class="player" data-player-id="'+p.id+'"><div class="player-roles">'+Array.from({length:p.influenceCount},(_,slot)=>p.id==='a'?cards.revealed({role:v.you.influences[slot],name:v.you.influences[slot],slot}):cards.hidden({slot})).join('')+v.room.revealedCards.filter(x=>x.playerId===p.id).map((x,revealIndex)=>cards.revealed({role:x.role,name:x.role,revealIndex,classes:['eliminated-role-card']})).join('')+'</div></div>').join('')+(preview?'<section class="action-flow">'+panels.summon({room:v.room,you:v.you})+'</section>'+panels.deck({room:v.room,you:v.you}):'')+'</div>';}

async function main(){
 // A hidden opponent's proved influence turns face-up, stays readable, then
 // discards. The incoming replacement remains hidden from the observer.
 {
  const h=setup(),motion=h.window.URAMAKU_CARD_MOTION;h.app.innerHTML='<div class="player" data-player-id="b">'+cards.hidden({slot:0})+'</div>';
  const target=h.app.querySelector('[data-influence-slot="0"]');let complete=0;
  assert(motion.animate(target,{kind:'replace',fromRole:'magistrate',revealDiscard:true,reveal:false,onComplete:()=>complete++}));
  assert(last(h,'card-flip-turner'));assert(!last(h,'card-discard'));assert(!h.sounds.includes('discard'));
  last(h,'card-flip-turner').finish();assert(!last(h,'card-discard'));hold(h);assert(last(h,'card-discard'));assert(h.sounds.includes('discard'));
  last(h,'card-discard').finish();assert(last(h,'card-arrival'));last(h,'card-arrival').finish();assert.equal(complete,1);assert(!target.querySelector('.card-flip-layer'));assert(target.classList.contains('hidden-role-card'));
 }
 // An unknown influence loss finishes its flip before the discard drop; the
 // final public eliminated card stays on the board and the survivor is still.
 {
  const h=setup(),r=fixture();r.players[0].coins=7;assert(g.performAction(r,'a','purge','b').ok);const before=view(r);assert(g.loseInfluence(r,'b',0).ok);const after=view(r);h.app.innerHTML=board(after);
  const effect=feedback.changes(before.room,after.room,before.you,after.you);h.window.URAMAKU_FEEDBACK.animate(effect,{container:h.app});
  assert(last(h,'card-flip-turner'));assert(!last(h,'card-discard'));let idle=0;h.window.URAMAKU_PRESENTATION.whenIdle(h.app,()=>idle++);
  last(h,'card-flip-turner').finish();assert.equal(idle,0);hold(h);assert(last(h,'card-discard'));assert.equal(last(h,'card-discard').options.duration,280);last(h,'card-discard').finish();assert.equal(idle,1);
  assert(h.app.querySelector('.eliminated-role-card'));assert(!h.app.querySelector('.eliminated-role-card .card-motion-layer'));assert(!h.app.querySelector('[data-player-id="b"] [data-influence-slot="0"]').classList.contains('card-flipping'));
 }
 // New Summon has no draw before the public loss; its preview waits for both
 // the proof replacement and the loss reveal/discard presentation to finish.
 {
  const h=setup(),flow=h.window.URAMAKU_PRESENTATION,motion=h.window.URAMAKU_CARD_MOTION,r=fixture();assert(g.performAction(r,'a','summon').ok);const declared=view(r);assert(g.challenge(r,'b').ok);const proof=view(r);assert.equal(proof.you.summonDrawnRole,null);assert.equal(proof.room.pending.kind,'lose');h.app.innerHTML=board(proof,true);assert(!h.app.querySelector('#summonTray'));
  h.window.URAMAKU_FEEDBACK.animate(feedback.changes(declared.room,proof.room,declared.you,proof.you),{container:h.app});
  const saved=motion.capture(h.app);assert(g.loseInfluence(r,'b',0).ok);const drawn=view(r);assert.equal(drawn.you.summonDrawnRole,'assassin');h.app.innerHTML=board(drawn,true);motion.restore(h.app,saved);
  const tray=h.app.querySelector('#summonTray');flow.presentSummon(h.app,tray,{key:'loss-first'});h.window.URAMAKU_FEEDBACK.animate(feedback.changes(proof.room,drawn.room,proof.you,drawn.you),{container:h.app});await Promise.resolve();assert(tray.hidden);
  const lossFlip=h.animations.findLast(a=>a.element.classList.contains('card-flip-turner')&&a.element.closest('[data-player-id="b"]'));assert(lossFlip);
  last(h,'card-discard').finish();last(h,'card-pile-motion').finish();last(h,'card-pile-motion').finish();last(h,'card-arrival').finish();last(h,'card-flip-turner').finish();assert(tray.hidden,'Loss is still being revealed');
  lossFlip.finish();hold(h);last(h,'card-discard').finish();assert(!tray.hidden,'Preview appears after proof and public loss finish');assert(!h.app.querySelector('[data-summon-controls]').hidden);assert.equal(g.publicState(r).pending.drawnRole,undefined);
 }
 {
  const h=setup(),motion=h.window.URAMAKU_CARD_MOTION;h.app.innerHTML=cards.hidden({slot:0});const el=h.app.querySelector('[data-influence-slot="0"]'),proto=Object.getPrototypeOf(el),animate=proto.animate;
  proto.animate=function(frames,options){if(this.classList.contains('card-flip-turner'))throw Error('no 3D support');return animate.call(this,frames,options);};
  let complete=0;assert(motion.animate(el,{kind:'replace',fromRole:'lord',revealDiscard:true,reveal:false,onComplete:()=>complete++}));hold(h);assert.equal(h.animations.filter(a=>a.element.classList.contains('card-discard')).length,1);last(h,'card-discard').finish();last(h,'card-arrival').finish();assert.equal(complete,1);proto.animate=animate;
 }
 // A canceled or obsolete inline preview never reappears after navigation.
 {
  const h=setup(),flow=h.window.URAMAKU_PRESENTATION;h.app.innerHTML='<section id="summonTray" hidden inert></section>';const tray=h.app.querySelector('#summonTray'),release=flow.hold(h.app);flow.presentSummon(h.app,tray);await Promise.resolve();flow.presentSummon(h.app,null);release();assert(tray.hidden);
  const finish=flow.hold(h.app);flow.presentSummon(h.app,tray);await Promise.resolve();flow.sync(h.app,{code:'OTHER'});finish();assert(tray.hidden);
  h.window.matchMedia=()=>({matches:true});flow.presentSummon(h.app,tray);assert(!tray.hidden,'Reduced motion needs no artificial wait');
 }
 console.log('Public proof/loss flip → readable hold → discard, untouched surviving card, persistent eliminated face, loss-first Summon tray ordering, rerender transfer, cancellation, privacy and reduced motion passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
