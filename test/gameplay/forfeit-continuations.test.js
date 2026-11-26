'use strict';
const assert=require('node:assert/strict'),g=require('../../server/game');
const seat=(id,hand=['lord','assassin'])=>({id,name:id,alive:true,ready:true,connected:true,coins:5,influences:hand.slice(),intrigueVisibility:[0,0],privateInvestigations:{}});
function fixture(mode=false){const r=g.createGame('QUIT',seat('a'));Object.assign(r,{players:['a','b','c','d','e'].map(id=>seat(id)),status:'playing',challengeTimerEnabled:false,deck:Array(10).fill('kingpin'),treasuryMode:mode,treasuryCoins:10,totalCoins:35,economyWinThreshold:14});return r;}
const ok=r=>assert.equal(r.ok,true,r.error),current=r=>g.publicState(r).turnPlayerId;
for(const mode of [false,true]){
 {const r=fixture(mode);ok(g.performAction(r,'a','tax'));ok(g.passChallenge(r,'b'));ok(g.forfeitPlayer(r,'b'));ok(g.passChallenge(r,'c'));ok(g.passChallenge(r,'d'));assert.equal(r.pending.kind,'claim');ok(g.passChallenge(r,'e'));assert.equal(r.players[0].coins,7);assert.equal(current(r),'c');assert(g.treasuryInvariant(r));}
 for(const departing of ['a','b','c','e']){
  const r=fixture(mode);ok(g.performAction(r,'a','tax'));ok(g.challenge(r,'c'));assert.equal(r.players[0].coins,7,'Tax already paid');ok(g.forfeitPlayer(r,departing));
  if(departing!=='c'){assert(g.lossDecision(r,'c'));assert.equal(r.turnNumber,0);ok(g.loseInfluence(r,'c',0));assert.equal(r.players[2].influences.length,1);}
  assert.equal(r.pending,null);assert.equal(r.challengeLosses.length,0);assert.equal(r.turnNumber,1);assert.equal(current(r),departing==='b'?'c':'b');assert(g.treasuryInvariant(r));
 }
 // A canceled main action does not cancel another player's established penalty.
 for(const departing of ['a','b']){
  const r=fixture(mode);ok(g.performAction(r,'a','assassinate','b'));ok(g.challenge(r,'c'));ok(g.forfeitPlayer(r,departing));assert(g.lossDecision(r,'c'));assert.equal(g.loseInfluence(r,'d',0).ok,false);ok(g.loseInfluence(r,'c',0));assert.equal(current(r),departing==='b'?'c':'b');assert.equal(r.turnNumber,1);assert.equal(r.players[2].influences.length,1);assert(g.treasuryInvariant(r));
 }
 // Summon's private held draw survives an unrelated/challenger departure, or is discarded when its owner leaves.
 for(const departing of ['a','b','e']){
  const r=fixture(mode);r.players[0].influences=['magistrate','lord'];ok(g.performAction(r,'a','summon'));ok(g.challenge(r,'c'));ok(g.forfeitPlayer(r,departing));assert(g.lossDecision(r,'c'));ok(g.loseInfluence(r,'c',0));
  if(departing!=='a'){assert.equal(r.pending.kind,'summon');ok(g.chooseSummon(r,'a','discard'));}else{assert(r.discard.includes('magistrate'));assert(!r.log.some(line=>line.includes('draws a card with Summon')),'Canceled Summon never draws its extra card');}
  assert.equal(r.turnNumber,1);assert.equal(current(r),departing==='b'?'c':'b');assert(g.treasuryInvariant(r));
 }
}
// Gossip already exchanged; a departure must not exchange it again or reveal its replacement.
{
 const r=fixture();r.players[0].influences=['courtesan','lord'];r.players[1].influences=['courtesan','magistrate'];ok(g.performAction(r,'a','intrigue','b'));for(const id of ['b','c','d','e'])ok(g.passChallenge(r,id));ok(g.chooseCounter(r,'b','courtesan'));ok(g.challenge(r,'c'));ok(g.forfeitPlayer(r,'c'));assert.equal(r.pending,null);assert.deepEqual(r.players[0].privateInvestigations.b,{1:'magistrate'});assert.equal(r.log.filter(s=>s.includes('uses Gossip with')).length,1);assert.equal(current(r),'b');
}
console.log('Forfeits preserve owed penalties, already-settled effects, Summon draw conservation, original turn anchors, voter eligibility and private Gossip in both economies.');
