'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');const {harness}=require('./browser-harness');
for(const lang of ['en','jp']){
 const h=harness(lang);const initial=h.state();h.click('#languageToggle');assert.equal(h.document.documentElement.lang,lang==='en'?'ja':'en');h.click('#languageToggle');assert.deepEqual(h.state(),initial,'Language buttons preserve lesson and game state');assert.deepEqual(h.state().room.players.map(p=>p.coins),[1,1,1,1]);assert(h.app.querySelector('.t-empty-room'));assert(!h.app.innerHTML.includes('undefined'));
 assert.equal(h.app.querySelectorAll('.game-actions-panel [data-action]').length,8);
 assert.deepEqual(h.app.querySelectorAll('.player[data-player-id]').map(p=>p.dataset.playerId),['you','mei','akira','sora']);
 let guard=0;
 while(h.value('tutorial.step.input.type')!=='end'&&guard++<100){
  const expected=JSON.parse(h.value('JSON.stringify(tutorial.step.input)'));
  const before=h.state();h.value('render();render()');assert.deepEqual(h.state(),before,'Render never advances the match');
  switch(expected.type){
   case 'next':h.click('#continueLesson');break;
   case 'action':{
    assert(!h.app.querySelector('#continueLesson'),'Guide cannot substitute for learner actions');
    h.click(`[data-action="${expected.action}"]`);
    if(expected.targetId){assert.deepEqual(h.state(),before,'Selecting an action waits for the board target');h.click(`[data-player-id="${expected.targetId}"]`);}break;
   }
   case 'loss':h.click(`[data-lose="${expected.cardIndex}"]`);break;
   case 'challenge':h.click('[data-challenge]');break;
   case 'share':h.click(`[data-share-private-target="${expected.targetId}"][data-share-private-slot="${expected.slot}"]`);break;
   case 'pass':h.click('[data-pass]');break;
   case 'counter':h.click(`[data-counter="${expected.counter}"]`);break;
   case 'decline':h.click('[data-decline]');break;
   case 'information':h.click(`[data-counter="${expected.choice}"]`);break;
   case 'summon':assert(h.app.querySelector('#summonDialog').open);h.click(`[data-summon-choice="${expected.choice}"]`);break;
   case 'replace':h.click(`[data-summon-replace="${expected.cardIndex}"]`);break;
   default:throw Error(expected.type);
  }
 }
 assert(guard<100);assert.equal(h.state().room.status,'finished');assert.equal(h.state().room.winner,'You');assert.equal(h.state().you.coins,2);
 assert.equal(h.document.documentElement.lang,lang==='jp'?'ja':'en');assert(!h.app.innerHTML.includes('undefined'));
 h.click('#backStep');assert.equal(h.value('tutorial.step.id'),'sora-final-extort');assert.equal(h.state().you.coins,2);h.click('#restart');assert.deepEqual(h.state().room.players.map(p=>p.coins),[1,1,1,1]);
}
const html=fs.readFileSync(require.resolve('../../public/tutorial.html'),'utf8');assert(html.includes('/shared/game.js'));assert(html.includes('/shared/tutorial.js'));assert(html.includes('/js/components/game-panels.js'));
console.log('Actual sidebar, target/player-card, influence-loss, counter, board Summon and replacement clicks complete the tutorial in EN/JP; back/restart passed.');
