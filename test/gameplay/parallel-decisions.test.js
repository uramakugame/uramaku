'use strict';
const assert=require('node:assert/strict'),g=require('../../server/game');
const seat=(id,hand,coins=3)=>({id,name:id,influences:hand.slice(),coins,alive:true,ready:true,connected:true,intrigueVisibility:hand.map(()=>0),privateInvestigations:{}});
function fixture(mode=false){const r=g.createGame('DUAL',seat('a',['magistrate','lord']));Object.assign(r,{players:[seat('a',['magistrate','lord']),seat('b',['kingpin','assassin']),seat('c',['courtesan','swordsman'])],status:'playing',challengeTimerEnabled:false,deck:['kingpin','swordsman','courtesan','assassin'],treasuryMode:mode,treasuryCoins:12,totalCoins:21,economyWinThreshold:12});return r;}
const ok=r=>assert.equal(r.ok,true,r.error);
function passes(r){for(const p of r.players)if(r.pending&&p.alive&&p.id!==r.pending.claimantId)ok(g.passChallenge(r,p.id));}
for(const mode of [false,true])for(const order of ['summon-first','loss-first'])for(const choice of ['discard','replace']){
 const r=fixture(mode),oldTurn=r.turnNumber;ok(g.performAction(r,'a','summon'));ok(g.challenge(r,'b'));
 assert.equal(r.pending.kind,'summon');assert.equal(r.pending.drawnRole,'courtesan');assert.equal(r.players[0].influences[0],'assassin');assert.equal(r.deck.length,2);
 assert.equal(g.lossDecision(r,'b').loserId,'b');assert.equal(g.privateState(r,'b').summonDrawnRole,null);assert.equal(g.publicState(r).pending.drawnRole,undefined);
 const loss=()=>ok(g.loseInfluence(r,'b',0)),summon=()=>ok(g.chooseSummon(r,'a',choice,1));
 const [first,second]=order==='summon-first'?[summon,loss]:[loss,summon];first();assert.equal(r.turnNumber,oldTurn);assert.equal(r.players[1].coins,3,'No next-turn Income before both choices');assert.equal(g.performAction(r,'a','earn').ok,false);
 second();assert.equal(r.turnNumber,oldTurn+1);assert.equal(r.players[1].coins,4);assert.equal(r.pending,null);assert.equal(r.challengeLosses.length,0);assert.equal(r.players[1].influences.length,1);
 assert.equal(g.chooseSummon(r,'a',choice,1).ok,false);assert.equal(g.loseInfluence(r,'b',0).ok,false);assert(g.treasuryInvariant(r));
}
// Tax pays immediately, but not before an automatic final-opponent victory.
{
 const r=fixture();ok(g.performAction(r,'a','tax'));ok(g.challenge(r,'b'));assert.equal(r.players[0].coins,5);assert.equal(r.turnNumber,0);ok(g.loseInfluence(r,'b',0));assert.equal(r.players[0].coins,5);assert.equal(r.turnNumber,1);
 const last=fixture();last.players=last.players.slice(0,2);last.players[1].influences=['kingpin'];ok(g.performAction(last,'a','tax'));ok(g.challenge(last,'b'));assert.equal(last.status,'finished');assert.equal(last.players[0].coins,3,'Final-opponent Tax behavior is unchanged');
}
// Intrigue waits for its target's failed-challenge loss, then uses surviving indices.
{
 const r=fixture();r.players[0].influences=['courtesan','lord'];ok(g.performAction(r,'a','intrigue','b'));ok(g.challenge(r,'b'));assert.equal(r.pending.kind,'lose');assert.equal(r.challengeLosses.length,0);ok(g.loseInfluence(r,'b',0));assert.equal(r.pending.kind,'counterOffer');assert.equal(r.players[1].influences.length,1);
}
// Extort does not bypass counters; allowing it can pay before the challenge loss.
for(const order of ['allow-first','loss-first']){
 const r=fixture();r.players[0].influences=['kingpin','lord'];ok(g.performAction(r,'a','extort','b'));ok(g.challenge(r,'b'));assert.equal(r.pending.kind,'counterOffer');assert(g.lossDecision(r,'b'));
 const allow=()=>{const q=r.pending;r.pending=null;ok(g.performDeferredAction(r,q));},loss=()=>ok(g.loseInfluence(r,'b',0));
 (order==='allow-first'?allow:loss)();assert.equal(r.turnNumber,0);(order==='allow-first'?loss:allow)();assert.equal(r.players[0].coins,5);assert.equal(r.players[1].coins,2);assert.equal(r.turnNumber,1);
}
// Losing an Enforce challenge and paying Enforce are separate obligations, even on a final card.
for(const mode of [false,true])for(const coins of [1,2,5])for(const last of [false,true]){
 const r=fixture(mode);r.players[0].coins=coins;r.players[0].influences=last?['kingpin']:['kingpin','lord'];r.players[1].influences=['magistrate','assassin'];if(mode)r.treasuryCoins=21-r.players.reduce((n,p)=>n+p.coins,0);
 ok(g.performAction(r,'a','extort','b'));passes(r);ok(g.chooseCounter(r,'b','magistrate'));ok(g.challenge(r,'a'));
 if(coins>=2){assert.equal(r.players[0].coins,last&&mode?0:coins-2);assert.equal(r.players[1].coins,last?6:5);if(!last){assert(g.lossDecision(r,'a'));ok(g.loseInfluence(r,'a',0));assert.equal(r.players[1].coins,6);}assert.equal(r.players[0].influences.length,last?0:1);}
 else{assert.equal(r.players[0].influences.length,0);assert.equal(r.players[1].coins,4);}
 assert.equal(r.turnNumber,1);assert(g.treasuryInvariant(r));assert.equal(r.log.filter(x=>x.includes('pays 2 coins to')).length,coins>=2?1:0);
}
// Overlapping action/counter challenges keep both debtors and the original turn anchor.
{
 const r=fixture();r.players[0].influences=['kingpin','lord'];r.players[1].influences=['magistrate','assassin'];ok(g.performAction(r,'a','extort','b'));ok(g.challenge(r,'c'));ok(g.chooseCounter(r,'b','magistrate'));ok(g.challenge(r,'a'));
 assert.deepEqual(r.challengeLosses.map(x=>x.loserId),['c','a']);assert.equal(r.players[0].coins,1);assert.equal(r.players[1].coins,5);ok(g.loseInfluence(r,'a',1));assert.equal(r.turnNumber,0);ok(g.loseInfluence(r,'c',0));assert.equal(r.turnNumber,1);assert.equal(g.publicState(r).turnPlayerId,'b');
}
// A wealth threshold must not erase a pending penalty, or pay again on completion.
{
 const r=fixture(true);r.players[0].coins=10;r.treasuryCoins=5;ok(g.performAction(r,'a','tax'));ok(g.challenge(r,'b'));assert.equal(r.status,'playing');assert(g.lossDecision(r,'b'));assert.equal(r.players[0].coins,12);ok(g.loseInfluence(r,'b',0));assert.equal(r.status,'finished');assert.equal(r.winner,'a');assert.equal(r.winType,'economy');assert.equal(r.players[0].coins,12);assert(g.treasuryInvariant(r));
}
// A second, failed counter claim cannot erase the previously owed challenge penalty or the Extort transfer.
for(const mode of [false,true]){
 const r=fixture(mode);r.players[0].influences=['kingpin','lord'];r.players[1].influences=['courtesan','assassin'];ok(g.performAction(r,'a','extort','b'));ok(g.challenge(r,'b'));ok(g.chooseCounter(r,'b','magistrate'));ok(g.challenge(r,'a'));
 assert.equal(r.players[1].alive,false);assert.equal(r.players[0].coins,5,'Original Extort still pays');assert.equal(r.players[1].coins,mode?0:1);assert.equal(r.challengeLosses.length,0);assert.equal(r.turnNumber,1);assert(g.treasuryInvariant(r));
}
console.log('Independent Summon/loss in both orders, atomic board replacement, immediate Tax and Enforce, Extort counters, dependent Intrigue, overlapping debts, final-card payment and deferred wealth victory passed.');
