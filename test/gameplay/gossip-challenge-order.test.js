'use strict';
const assert=require('node:assert/strict'),g=require('../../server/game');
const seat=(id,hand)=>({id,name:id,influences:hand.slice(),coins:3,alive:true,ready:true,connected:true,intrigueVisibility:hand.map(()=>0),privateInvestigations:{}});
function fixture(hand=['courtesan','kingpin'],treasuryMode=false){const r=g.createGame('GOSSIP',seat('a',['courtesan','lord']));Object.assign(r,{players:[seat('a',['courtesan','lord']),seat('b',hand),seat('c',['swordsman','assassin'])],status:'playing',challengeTimerEnabled:false,deck:['swordsman','magistrate'],treasuryMode,treasuryCoins:12,totalCoins:21,economyWinThreshold:12});return r;}
const ok=r=>assert.equal(r.ok,true,r.error),known=(r,viewer,target)=>g.privateState(r,viewer).privateInvestigations[target]||{};
function declare(r){ok(g.performAction(r,'a','intrigue','b'));for(const id of ['b','c'].filter(id=>r.players.some(p=>p.id===id)))ok(g.passChallenge(r,id));ok(g.chooseCounter(r,'b','courtesan'));}
const exchanges=r=>r.log.filter(s=>s.includes('uses Gossip with')).length;
const count=r=>r.deck.length+r.discard.length+r.revealedCards.length+r.players.reduce((n,p)=>n+p.influences.length,0);
for(const mode of [false,true])for(const hand of [['courtesan','kingpin'],['kingpin','courtesan'],['courtesan'],['courtesan','courtesan']])for(const challenger of ['a','c']){
 const r=fixture(hand,mode),total=count(r),slot=hand.indexOf('courtesan');declare(r);ok(g.challenge(r,challenger));
 assert.equal(r.players[1].influences[slot],'magistrate');assert.equal(r.discard[0],'courtesan');assert.equal(exchanges(r),1);
 assert.deepEqual(known(r,'b','a'),{0:'courtesan',1:'lord'},'Exchange happens before the challenger chooses any loss');
 const untouched=Object.fromEntries(hand.flatMap((role,index)=>index===slot?[]:[[index,role]]));
 assert.deepEqual(known(r,'a','b'),untouched,'The new proof replacement stays hidden; the other old influence stays known');
 assert.equal(g.privateState(r,'b').intrigueVisibility[slot],0);assert.equal(g.sharePrivateIntel(r,'a','b',slot).ok,false);
 assert(g.privateState(r,'a').intrigueEligibleTargets.includes('b'),'The hidden replacement is available for future investigation');
 assert.deepEqual(known(r,'c','a'),{});assert.deepEqual(known(r,'c','b'),{});assert.equal(g.privateState(r,'spectator'),null);
 assert(!JSON.stringify(g.publicState(r)).includes('privateInvestigations'));assert.equal(r.turnNumber,0);assert(g.lossDecision(r,challenger));
 ok(g.loseInfluence(r,challenger,0));assert.equal(r.turnNumber,1);assert.equal(r.pending,null);assert.equal(exchanges(r),1);assert.equal(count(r),total);assert(g.treasuryInvariant(r));
 assert.deepEqual(known(r,'a','b'),untouched);if(challenger==='a')assert.deepEqual(known(r,'b','a'),{0:'lord'},'Lost card knowledge is removed and surviving indices shift');
 assert.equal(g.loseInfluence(r,challenger,0).ok,false,'No replay');
 const exchange=r.log.findIndex(s=>s.includes('uses Gossip with')),proof=r.log.findIndex(s=>s.includes('discards the proved')),loss=r.log.findIndex(s=>s.includes('loses an influence'));const failure=r.log.findIndex(s=>s.includes("challenge fails."));assert(failure<exchange&&exchange<proof&&proof<loss);
}
// A same-role replacement is a new hidden physical card, including deck recycling.
for(const recycle of [false,true]){
 const r=fixture();r.deck=recycle?[]:['courtesan'];declare(r);ok(g.challenge(r,'a'));assert.equal(r.players[1].influences[0],'courtesan');assert.deepEqual(known(r,'a','b'),{1:'kingpin'});ok(g.loseInfluence(r,'a',1));assert.deepEqual(known(r,'a','b'),{1:'kingpin'});
}
// Automatic last-card penalties still follow the exchange, even for the final opponent.
for(const twoPlayers of [false,true]){
 const r=fixture();if(twoPlayers)r.players.pop();r.players[0].influences=['courtesan'];declare(r);ok(g.challenge(r,'a'));assert.equal(r.players[0].alive,false);assert.equal(exchanges(r),1);assert.deepEqual(known(r,'a','b'),{1:'kingpin'});assert.deepEqual(known(r,'b','a'),{});assert.equal(r.status,twoPlayers?'finished':'playing');
}
// Prior public intel for the exchanged slot is invalidated; other knowledge survives.
{
 const r=fixture();r.players[1].intrigueVisibility=[3,0];r.players[0].privateInvestigations.b={0:'courtesan'};r.sharedInvestigations=[{playerId:'b',indices:[0],roles:['courtesan']}];declare(r);ok(g.challenge(r,'a'));assert.equal(r.sharedInvestigations.length,0);assert.deepEqual(known(r,'a','b'),{1:'kingpin'});
}
// Unchallenged bluffs and genuine claims exchange normally; a caught bluff does not.
for(const hand of [['courtesan','kingpin'],['swordsman','kingpin']]){
 const r=fixture(hand);declare(r);ok(g.passChallenge(r,'a'));ok(g.passChallenge(r,'c'));assert.equal(exchanges(r),1);assert.deepEqual(known(r,'a','b'),{0:hand[0],1:hand[1]});assert.deepEqual(known(r,'b','a'),{0:'courtesan',1:'lord'});
}
{
 const r=fixture(['swordsman','kingpin']);declare(r);const deck=r.deck.slice();ok(g.challenge(r,'a'));assert.equal(exchanges(r),0);assert.equal(r.pending.loserId,'b');ok(g.loseInfluence(r,'b',0));assert.equal(r.pending.kind,'information');assert.deepEqual(r.deck,deck);ok(g.chooseCounter(r,'b','revealAll'));assert.deepEqual(known(r,'a','b'),{0:'kingpin'});assert.deepEqual(known(r,'b','a'),{});
}
console.log('Proved Gossip: exchange before proof replacement and loss, hidden replacement, unchanged-slot intel, both challengers/slots, recycling, elimination, privacy, normal bluffs and Treasury passed.');
