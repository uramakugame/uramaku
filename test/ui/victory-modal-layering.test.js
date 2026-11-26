const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'public/css/source/04-component-overrides.css'), 'utf8');
const announcements = fs.readFileSync(path.join(root, 'public/css/source/05-announcements.css'), 'utf8');
const compiled = fs.readFileSync(path.join(root, 'public/css/game.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8');

function layer(css, name) {
  const match = css.match(new RegExp('\\.' + name + '\\s*\\{[^}]*z-index\\s*:\\s*(\\d+)'));
  assert.ok(match, `${name} must define an explicit layer`);
  return Number(match[1]);
}
const victoryLayer = layer(source, 'victory-backdrop');
const announcementLayer = layer(announcements, 'action-announcements');
assert.ok(victoryLayer > announcementLayer, 'Victory modal must be in front of final announcements');
assert.equal(layer(compiled, 'victory-backdrop'), victoryLayer, 'Compiled victory style must match source');
assert.equal(layer(compiled, 'action-announcements'), announcementLayer, 'Compiled announcement style must match source');
const victoryMethod = app.slice(app.indexOf('function showVictory('), app.indexOf('function show(s){'));
assert.match(victoryMethod, /document\.body\.appendChild\(backdrop\)/, 'Victory dialog must be attached to the document body');
assert.match(victoryMethod, /className='victory-backdrop'/);
console.log('Victory dialog stacking order above final announcements verified.');

// Actual multiplayer controls: the owner can return the group to its lobby
// from either the result dialog or the board after dismissing that dialog.
const g=require('../../shared/game'),roomHarness=require('../helpers/browser-room-harness'),{returnToLobby}=require('../../server/rematch'),i18n=require('../../shared/i18n');
for(const lang of ['en','jp']){
 const player=id=>({id,name:id,coins:3,ready:true,alive:true,connected:true,influences:['lord','magistrate'],privateInvestigations:{}});
 const r=g.createGame('BACK',player('host'));r.players.push(player('guest'));r.spectators=[{id:'viewer',name:'Viewer',connected:true}];r.status='finished';r.winner='host';r.seatTokens=new Map(r.players.concat(r.spectators).map(p=>[p.id,'a'.repeat(64)]));
 for(const id of ['host','guest','viewer']){
  const h=roomHarness(lang);h.paint(g.publicState(r),g.privateState(r,id));h.value('showVictory("host")');
  const buttons=h.document.body.querySelectorAll('[data-rematch]');assert.equal(buttons.length,id==='host'?2:0);assert.equal(!!h.document.body.querySelector('#victoryDialog'),true);
  if(id!=='host'){assert(h.document.getElementById('victoryDialog').textContent.includes(i18n.get('rematchWait',lang)));continue;}
  assert(buttons.every(b=>b.textContent===i18n.get('playAgain',lang)));buttons[0].click();assert.equal(h.sent.filter(e=>e[0]==='rematch').length,1);assert(h.document.body.querySelectorAll('[data-rematch]').every(b=>b.disabled));buttons[1].click();assert.equal(h.sent.filter(e=>e[0]==='rematch').length,1);
  h.value('show("The request could not be completed.")');assert(h.document.body.querySelectorAll('[data-rematch]').every(b=>!b.disabled),'Rejected rematch permits a retry');
  const next=require('../../server/room-store').cloneRoom(r);assert(returnToLobby(next,'host').ok);
  h.handlers.state({room:g.publicState(next),you:g.privateState(next,'host')});assert.equal(h.value('state.status'),'lobby');assert(!h.document.body.querySelector('#victoryDialog'));assert(!h.app.querySelector('[data-rematch]'));assert(!h.app.querySelector('.player-roles'));assert.equal(h.app.querySelectorAll('.lobby-seat').length,2);assert.deepEqual(JSON.parse(h.value('JSON.stringify(me.influences)')),[]);
  h.handlers.state({room:g.publicState(r),you:g.privateState(r,'host')});assert.equal(h.value('state.status'),'lobby','A delayed prior-match result cannot reopen the old game');
  g.startGame(next);h.handlers.state({room:g.publicState(next),you:g.privateState(next,'host')});assert.equal(h.value('state.status'),'playing');assert(!h.document.body.querySelector('#victoryDialog'));assert.equal(h.app.querySelectorAll('.player').length,2);
 }
}
for(const key of ['playAgain','rematchWait'])assert.notEqual(i18n.get(key,'en'),i18n.get(key,'jp'));
console.log('EN/JP owner-only Play again, dialog/board access, pending-click prevention, retry, synchronized clean lobby, new deal and stale-result rejection passed.');
