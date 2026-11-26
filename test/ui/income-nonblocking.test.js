'use strict';
const assert=require('node:assert/strict'),game=require('../../shared/game'),roomHarness=require('../helpers/browser-room-harness');
async function main(){
 for(const lang of ['en','jp']){
  const p=(id,roles)=>({id,name:id,coins:4,influences:roles,alive:true,connected:true,ready:true,privateInvestigations:{},intrigueVisibility:[0,0]}),r=game.createGame('FAST',p('a',['kingpin','lord']));Object.assign(r,{status:'playing',players:[p('a',['kingpin','lord']),p('b',['magistrate','assassin'])],challengeTimerEnabled:false,turnNumber:1});
  assert(game.performAction(r,'a','extort','b').ok);const before={room:game.publicState(r),you:game.privateState(r,'b')};assert(game.declineCounter(r,'b').ok);const after={room:game.publicState(r),you:game.privateState(r,'b')};
  const h=roomHarness(lang),animations=[];h.window.matchMedia=()=>({matches:false});Object.getPrototypeOf(h.app).animate=function(frames,options){const item={element:this,frames,options,done:false};animations.push(item);return{cancel(){if(!item.done){item.done=true;item.cancel?.();}},finished:{then(resolve,reject){item.complete=()=>{if(!item.done){item.done=true;resolve();}};item.cancel=reject;}}};};
  const flow=h.window.URAMAKU_PRESENTATION;h.paint(before.room,before.you);let completed=0;
  flow.enqueue(h.app,{code:r.code,run:(complete,current)=>h.window.URAMAKU_FEEDBACK.present({container:h.app,before:before.room,after:after.room,oldYou:before.you,you:after.you,lang,current,render:(room,you)=>h.paint(room,you),complete:()=>{h.paint(after.room,after.you);completed++;complete();}})});
  assert(flow.busy(h.app));assert.equal(h.value("send('action',{action:'earn'})"),false,'Outgoing Extort is still blocking');
  const tick=async()=>{for(let n=0;n<5;n++)await Promise.resolve();};
  for(const animation of animations.filter(a=>!a.done))animation.complete();await tick();assert(animations.some(a=>!a.done&&a.element.classList.contains('turn-handoff-ring')));
  for(const animation of animations.filter(a=>!a.done))animation.complete();await tick();
  const income=animations.find(a=>!a.done&&a.element.classList.contains('coin-gain')&&a.element.textContent==='+1');assert(income);assert.equal(income.options.duration,1475,'Income keeps its existing visible duration');assert.equal(completed,1);assert(!flow.busy(h.app));assert(!h.app.querySelector('.actions').hasAttribute('inert'));
  h.click('[data-action="earn"]');assert.equal(h.sent.at(-1)[0],'action');assert.equal(h.sent.at(-1)[1].action,'earn','The real sidebar submits a new action while Income is still floating');
  flow.cancel(h.app);assert(!h.document.body.querySelector('.coin-gain'),'Navigation still cleans up nonblocking Income tokens');
 }
 console.log('Real EN/JP controller: prior action and handoff wait, Income +1 keeps 1475 ms duration while sidebar actions submit immediately, and room cancellation cleans decorations.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
