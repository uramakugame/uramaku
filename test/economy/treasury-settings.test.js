'use strict';
const assert=require('node:assert/strict'),g=require('../../server/game'),{validatePacket}=require('../../server/socket-input');
const seat=id=>({id,name:id,coins:0,influences:[],alive:true,connected:true,ready:true,privateInvestigations:{}});
function fixture(n=2){const room=g.createGame('COIN',seat('a'));room.players=Array.from({length:n},(_,i)=>seat(String.fromCharCode(97+i)));return room;}
const base=fixture();assert.equal(base.treasuryCoinsPerPlayer,6);assert.equal(g.publicState(base).treasuryCoinsPerPlayer,6);
for(const n of [2,3,4,5,6])for(const supply of [5,6,7])for(const faction of [false,true]){
 const room=fixture(n);assert(g.configureTreasuryMode(room,'a',{enabled:true,coinsPerPlayer:supply}).ok);room.revealFactions=faction;g.startGame(room);
 assert.equal(room.totalCoins,n*supply);assert.equal(room.treasuryCoins,n*(supply-1)-1);assert.equal(room.players.filter(p=>p.coins===1).length,n-1);assert.equal(room.players.filter(p=>p.coins===2).length,1);assert(g.treasuryInvariant(room));
 assert.equal(room.economyWinThreshold,n===2?10:n===3?12:14);assert.equal(g.publicState(room).treasuryCoinsPerPlayer,supply);
 const saved=JSON.stringify(room);assert.equal(g.configureTreasuryMode(room,'a',{coinsPerPlayer:5}).ok,false);assert.equal(JSON.stringify(room),saved,'No mid-match supply changes');
}
for(const coinsPerPlayer of [0,4,8,5.5,'6',null,true,{},[]]){
 const room=fixture(),saved=JSON.stringify(room);assert.equal(g.configureTreasuryMode(room,'a',{enabled:true,coinsPerPlayer}).ok,false);assert.equal(JSON.stringify(room),saved,'Invalid combined setting is atomic');assert.equal(validatePacket('setTreasuryMode',{coinsPerPlayer}),false);
}
for(const settings of [null,[],{}, {enabled:'yes'}]){const room=fixture(),saved=JSON.stringify(room);assert.equal(g.configureTreasuryMode(room,'a',settings).ok,false);assert.equal(JSON.stringify(room),saved);}
for(const actor of ['b','spectator']){const room=fixture(),saved=JSON.stringify(room);assert.equal(g.configureTreasuryMode(room,actor,{enabled:true,coinsPerPlayer:5}).ok,false);assert.equal(JSON.stringify(room),saved);}
for(const supply of [5,6,7])assert(validatePacket('setTreasuryMode',{coinsPerPlayer:supply}));
assert(validatePacket('setTreasuryMode',{enabled:true}));assert.equal(validatePacket('setChallengeTimer',{seconds:9}),false);assert(validatePacket('setChallengeTimer',{seconds:10}));assert(validatePacket('setChallengeTimer',{seconds:60}));assert.equal(validatePacket('setChallengeTimer',{seconds:61}),false);
{
 const room=fixture();g.configureTreasuryMode(room,'a',{coinsPerPlayer:5});g.configureTreasuryMode(room,'a',{enabled:true});g.configureTreasuryMode(room,'a',{enabled:false});assert.equal(room.treasuryCoinsPerPlayer,5);g.startGame(room);assert.equal(room.totalCoins,null);assert.equal(room.treasuryCoins,null);assert.equal(room.economyWinThreshold,null,'Classic rules stay unlimited');
}
console.log('Treasury 5/6/7 supply in 2–6 seats and both factions, default 6, exact 1-coin deals/Income, 10/12/14 wealth goals, owner/shape/locked guards, Classic passed.');
