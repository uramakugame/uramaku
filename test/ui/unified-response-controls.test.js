'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),g=require('../../server/game'),panels=require('../../public/js/components/game-panels'),i18n=require('../../shared/i18n'),{harness}=require('../tutorial/browser-harness');
async function main(){
 const seat=(id,roles)=>({id,name:id,alive:true,coins:6,influences:roles,privateInvestigations:{}});
 for(const lang of ['en','jp'])for(const [action,role,counters] of [['intrigue','courtesan',['lord','courtesan']],['assassinate','assassin',['swordsman','assassin']],['extort','kingpin',['kingpin','magistrate']]]){
  const a=seat('a',[role,'lord']),b=seat('b',['lord','magistrate']),c=seat('c',['kingpin','assassin']),r=g.createGame('UI',a);Object.assign(r,{status:'playing',players:[a,b,c],challengeTimerEnabled:false,deck:['courtesan']});assert(g.performAction(r,'a',action,'b').ok);
  const view=g.publicState(r),target=panels.challenge({room:view,you:g.privateState(r,'b'),lang}),other=panels.challenge({room:view,you:g.privateState(r,'c'),lang});
  assert(target.includes('data-challenge'));assert(target.includes('data-decline'));assert(!target.includes('data-pass'));for(const counter of counters)assert(target.includes(`data-counter="${counter}"`));assert(!target.includes('cannot counter afterward'));assert(!target.includes('後からカウンター'));assert(!target.includes('undefined'));
  assert(target.includes(i18n.get('challengeChoice',lang)));assert.equal(i18n.get('challengeChoice','en'),'Challenge claim');
  for(const counter of counters){
   const role=view.roles[counter],label=i18n.get('claimCounter',lang,{role:i18n.role(counter,lang),counter:lang==='jp'?role.counterJp:role.counter});assert(target.includes(label));
   const tag=target.match(new RegExp('<button[^>]+data-counter="'+counter+'"[^>]*>'))[0];assert.equal(tag.includes(' held'),b.influences.includes(counter),'Only the viewer’s held counter receives a gold border');assert(target.indexOf('data-decline')>target.indexOf('data-counter="'+counter+'"'),'Allow action is last');
  }
  // An untimed post-window offer uses identical names, private held hints and order.
  const offered=panels.counter({room:{...view,pending:{kind:'counterOffer',options:counters}},you:g.privateState(r,'b'),lang});
  for(const counter of counters){const tag=offered.match(new RegExp('<button[^>]+data-counter="'+counter+'"[^>]*>'))[0];assert.equal(tag.includes(' held'),b.influences.includes(counter));assert(offered.indexOf('data-decline')>offered.indexOf('data-counter="'+counter+'"'));}
  assert(!panels.counter({room:{...view,pending:{options:counters}},you:{influences:[]},lang}).includes('counter-choice held'),'Other players’ held roles never affect the hint');
  assert(other.includes('data-pass'));assert(!other.includes('data-counter='));assert(!other.includes('data-decline'));
 }
 for(const lang of ['en','jp']){
  const h=harness(lang);assert(h.app.querySelector('#languageToggle'));assert.equal(h.document.documentElement.lang,lang==='jp'?'ja':'en');h.value("while(tutorial.step.id!=='gossip')handle(tutorial.step.input)");assert.equal(h.state().room.pending.kind,'claim');assert(h.app.querySelector('[data-challenge]'));assert(h.app.querySelector('[data-counter="courtesan"]'));assert(h.app.querySelector('[data-decline]'));assert(!h.app.querySelector('[data-pass]'));
  const before=h.state();h.click('[data-challenge]');assert.deepEqual(h.state(),before,'Guide rejects unrequested choices without advancing');h.click('[data-counter="courtesan"]');assert.equal(h.value('tutorial.step.id'),'gossip-result');
 }
 const css=fs.readFileSync(require.resolve('../../public/css/source/03-game-components.css'),'utf8');assert.match(css,/\.action\.held,\s*\.game-shell \.decision-buttons \.counter-choice\.held\{\s*border:2px solid #d8a354!important/,'Actions and held counters share the approved gold-border rule');
 for(const lang of ['en','jp']){
  const h=harness(lang);h.value("while(tutorial.step.id!=='gossip')handle(tutorial.step.input)");assert(h.app.querySelector('[data-counter="courtesan"]').classList.contains('held'));assert(!h.app.querySelector('[data-counter="lord"]').classList.contains('held'));h.click('[data-counter="courtesan"]');h.value("while(tutorial.step.id!=='bluff-gossip')handle(tutorial.step.input)");assert(!h.app.querySelector('[data-counter="courtesan"]').classList.contains('held'),'A bluff remains selectable without a held-role border');
 }
 // Follow-up controls remain hidden through a public loss animation and rerenders.
 const h=harness('en',({window})=>{window.matchMedia=()=>({matches:false});});const flow=h.window.URAMAKU_PRESENTATION;flow.sync(h.app,{code:'gate'});h.app.innerHTML='<div data-response-controls hidden inert></div>';const first=h.app.querySelector('[data-response-controls]'),release=flow.hold(h.app);
 flow.presentDecision(h.app,first,{key:'after-loss'});await Promise.resolve();assert(first.hidden);
 h.app.innerHTML='<div data-response-controls hidden inert></div>';const second=h.app.querySelector('[data-response-controls]');flow.presentDecision(h.app,second,{key:'after-loss'});assert(second.hidden);release();assert(!second.hidden);assert(!second.hasAttribute('inert'));assert(first.hidden,'Detached controls never reactivate');
 h.app.innerHTML='<div data-response-controls hidden inert></div>';const rerender=h.app.querySelector('[data-response-controls]');flow.presentDecision(h.app,rerender,{key:'after-loss'});assert(!rerender.hidden,'Language/render updates preserve completed presentation');
 console.log('Combined controls in EN/JP, legal bluff counters, observer-only challenge/pass, real tutorial selection and loss reveal gating across rerenders passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
