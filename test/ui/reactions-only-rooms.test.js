'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),g=require('../../shared/game'),roomHarness=require('../helpers/browser-room-harness');
for(const lang of ['en','jp']){
 const h=roomHarness(lang);assert(h.app.querySelector('.project-footer'),'Home retains the disclosure footer');
 const player=(id,name)=>({id,name,coins:1,alive:true,connected:true,ready:true,influences:['lord','magistrate'],privateInvestigations:{}}),r=g.createGame('SAFE',player('host','Host'));r.players.push(player('guest','Guest'));
 for(const status of ['lobby','playing','finished']){
  r.status=status;
  for(const you of [g.privateState(r,'host'),g.privateState(r,'guest'),null]){
   h.paint(g.publicState(r),you);assert(!h.app.querySelector('#chatToggle,#chatWindow,#chatInput,#chatSend'));
   assert.equal(!!h.app.querySelector('.project-footer'),status==='lobby');
   assert.equal(!!h.app.querySelector('[data-reaction-toggle]'),status!=='lobby'&&!!you);
   assert(!h.app.querySelector('#kickModeToggle'));assert(!h.app.querySelector('[data-kick-id]'),'Connected players are not kickable');
  }
 }
 r.status='playing';r.players[1].connected=false;h.paint(g.publicState(r),g.privateState(r,'host'));assert(h.app.querySelector('[data-kick-id="guest"]'));h.paint(g.publicState(r),g.privateState(r,'guest'));assert(!h.app.querySelector('[data-kick-id]'));
 r.players[1].connected=true;h.paint(g.publicState(r),g.privateState(r,'host'));assert(!h.app.querySelector('[data-kick-id]'));
 const snapshot={...r,chat:[{message:'https://example.invalid/unsafe'}]};assert(!('chat' in g.publicState(snapshot)));assert(!h.app.textContent.includes('https://example.invalid/unsafe'));
}
const css=fs.readFileSync(require.resolve('../../public/css/game.css'),'utf8');assert(css.includes('grid-template-rows:repeat(8,minmax(32px,1fr))!important'));assert(css.includes('align-self:stretch!important'));assert(css.includes('height:100%!important;min-height:0!important;max-height:none!important'));
const audio=fs.readFileSync(require.resolve('../../public/js/audio.js'),'utf8');assert(!audio.includes('soundChat'));
console.log('EN/JP Home/lobby disclosures retained, match/finished footer removed, no chat in any phase/spectator view or snapshot, React preserved, offline owner kicks and action containment passed.');
