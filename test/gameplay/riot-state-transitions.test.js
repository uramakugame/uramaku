'use strict';
const assert=require('node:assert/strict'),g=require('../../shared/game'),{cloneRoom,RoomStore}=require('../../server/room-store'),{RoomTransitions}=require('../../server/room-transitions');
const seat=(id,coins)=>({id,name:id,influences:['lord','assassin'],coins,alive:true,ready:true,connected:true,privateInvestigations:{}});
function fixture(){const r=g.createGame('RIOT',seat('a',4));Object.assign(r,{status:'playing',treasuryMode:true,treasuryCoins:1,totalCoins:18,economyWinThreshold:12,players:[seat('a',4),seat('b',6),seat('c',7)],deck:['magistrate'],challengeTimerEnabled:false});return r;}
const room=fixture();assert(g.performAction(room,'a','earn').ok);assert.equal(room.treasuryCoins,0);assert.equal(room.stateTransitions.length,1);assert.equal(room.stateTransitions[0].state,'chaos');assert.equal(g.publicState(room).riot,true);assert(g.treasuryInvariant(room));
const shown=g.publicState(room).log;assert(shown.findIndex(l=>l.includes('takes Earn'))<shown.indexOf('The treasury is empty. Order has collapsed.'),'Coin/action cause appears before its state consequence');
const count=room.stateTransitionNumber;g.publicState(room);g.publicState(room);assert.equal(room.stateTransitionNumber,count);assert.equal(room.log.filter(l=>l==='The treasury is empty. Order has collapsed.').length,1);
assert.equal(g.performAction(room,'b','overthrow','c').ok,true);assert.equal(room.stateTransitions.at(-1).state,'order');assert.equal(g.publicState(room).purgeCost,7);assert.equal(room.players.find(p=>p.id==='b').coins,1);assert(g.treasuryInvariant(room));
// The current player forfeits a single coin while Chaos is active. It restores
// Order, then the next Income consumes that coin within this one operation.
const fast=fixture();fast.treasuryCoins=0;fast.totalCoins=18;fast.players=[seat('a',1),seat('b',8),seat('c',9)];assert(g.forfeitPlayer(fast,'a').ok);assert.deepEqual(fast.stateTransitions.map(e=>e.state),['order','chaos']);assert.deepEqual(fast.stateTransitions.map(e=>e.id),[1,2]);assert.equal(fast.treasuryCoins,0);assert(g.treasuryInvariant(fast));
const store=new RoomStore(':memory:'),rooms=new Map(),transitions=new RoomTransitions(store,rooms);
try{const saved=cloneRoom(fast);saved.seatTokens=new Map();transitions.create(saved);const restored=store.loadAll()[0];assert.deepEqual(restored.stateTransitions,fast.stateTransitions);assert.equal(restored.stateTransitionNumber,2);assert.equal(g.publicState(restored).riot,true);}finally{store.close();}
const standard=fixture();standard.treasuryMode=false;assert(g.performAction(standard,'a','earn').ok);assert.equal(standard.stateTransitionNumber,0);assert.equal(standard.stateTransitions.length,0);
console.log('Riot transition records follow real coin crossings, costs/victories conserved, rapid reversal retained, no render replay, SQLite recovery and Classic unaffected passed.');
