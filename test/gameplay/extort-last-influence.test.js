'use strict';
const assert=require('node:assert/strict'),g=require('../../server/game');
function room(treasury,seats,coins=5,wealth=false){const players=Array.from({length:seats},(_,n)=>({id:'p'+n,name:'P'+n,alive:true,coins:n===1?coins:1,influences:n===0?['kingpin','lord']:['courtesan'],intrigueVisibility:[],privateInvestigations:{}}));const r=g.createGame('LAST',players[0]);Object.assign(r,{players,status:'playing',turnNumber:1,deck:['magistrate'],challengeTimerEnabled:false,treasuryMode:treasury,totalCoins:7*seats,economyWinThreshold:(seats===2?10:seats===3?12:14)});if(wealth)players[0].coins=r.economyWinThreshold-2;r.treasuryCoins=r.totalCoins-players.reduce((n,p)=>n+p.coins,0);return r;}
for(const mode of [false,true])for(const seats of [2,3,4])for(const coins of [1,2,5]){
 const r=room(mode,seats,coins),before=r.players[0].coins;assert(g.performAction(r,'p0','extort','p1').ok);assert(g.challenge(r,'p1').ok);
 assert.equal(r.players[1].alive,false);assert.equal(r.players[0].coins,before+Math.min(2,coins));assert.equal(r.players[1].coins,mode?0:Math.max(0,coins-2));assert(g.treasuryInvariant(r));assert.equal(r.pending,null);
 assert.equal(r.status,seats===2?'finished':'playing');assert.equal(r.log.filter(x=>x.includes('through Extort')).length,1);assert(r.log.findIndex(x=>x.includes('loses an influence'))<r.log.findIndex(x=>x.includes('through Extort')));
 const state=JSON.stringify(r);assert(!g.challenge(r,'p1').ok);assert.equal(JSON.stringify(r),state);
 const publicView=g.publicState(r);assert(!JSON.stringify(publicView).includes('drawnRole'));assert.equal(publicView.players[0].influences,undefined);
}
{
 const r=room(true,3,5,true);assert(g.performAction(r,'p0','extort','p1').ok);assert(g.challenge(r,'p1').ok);assert.equal(r.status,'finished');assert.equal(r.winType,'economy');assert.equal(r.winner,'P0');assert(g.treasuryInvariant(r));assert.equal(r.pending,null);
}
{
 const r=room(true,2,5,true);assert(g.performAction(r,'p0','extort','p1').ok);assert(g.challenge(r,'p1').ok);assert.equal(r.players[0].coins,10);assert.equal(r.winType,'elimination');assert.equal(r.wealthVictoryEntry,null);assert(g.treasuryInvariant(r));
}
// A surviving target who challenged cannot counter, and a false claimant
// never takes coins. Other actions keep their existing elimination guards.
{
 const r=room(false,3);r.players[1].influences=['courtesan','magistrate'];assert(g.performAction(r,'p0','extort','p1').ok);assert(g.challenge(r,'p1').ok);assert(g.loseInfluence(r,'p1',0).ok);assert.equal(r.pending,null);assert.equal(r.players[0].coins,3);assert.equal(g.chooseCounter(r,'p1','magistrate').ok,false);
 const bad=room(false,3);bad.players[0].influences=['lord'];assert(g.performAction(bad,'p0','extort','p1').ok);assert(g.challenge(bad,'p1').ok);assert.equal(bad.players[1].coins,6);assert(!bad.log.some(x=>x.includes('through Extort')));
}
console.log('Extort after last-influence challenge: 2–4 seats, Classic/Treasury, 1/2/5 coins, exact once transfer before refunds/victory, wealth win and challenging targets forfeit counters passed.');
