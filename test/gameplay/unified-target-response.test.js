'use strict';
const assert=require('node:assert/strict'),g=require('../../server/game');
const seat=(id,hand,coins=6)=>({id,name:id,influences:[...hand],coins,alive:true,connected:true,ready:true,intrigueVisibility:hand.map(()=>0),privateInvestigations:{}});
function fixture(treasury=false){const r=g.createGame('NEXT',seat('a',['courtesan','kingpin']));Object.assign(r,{status:'playing',players:[seat('a',['courtesan','kingpin']),seat('b',['magistrate','swordsman']),seat('c',['assassin','lord']),seat('d',['kingpin','lord'])],deck:['kingpin','swordsman','courtesan','assassin','magistrate'],challengeTimerEnabled:false,turnNumber:1,treasuryMode:treasury,treasuryCoins:4,totalCoins:28,economyWinThreshold:13});return r;}
const ok=result=>assert.equal(result.ok,true,result.error);
function finishLoss(r,id){if(g.lossDecision(r,id))ok(g.loseInfluence(r,id,0));}
function passes(r){const q=r.pending;for(const p of r.players)if(r.pending===q&&p.alive&&p.id!==q.claimantId&&!(q.passedBy||[]).includes(p.id))ok(g.passChallenge(r,p.id));}
const count=r=>r.deck.length+r.discard.length+r.revealedCards.length+r.players.reduce((n,p)=>n+p.influences.length,0)+(r.pending?.drawnRole?1:0);
for(const treasury of [false,true]){
 // Every legal counter is available immediately, including bluffs.
 for(const [action,role,counters] of [['intrigue','courtesan',['lord','courtesan']],['assassinate','assassin',['swordsman','assassin']],['extort','kingpin',['kingpin','magistrate']]])for(const counter of counters){
  const r=fixture(treasury);r.players[0].influences[0]=role;const before=r.players[1].coins;ok(g.performAction(r,'a',action,'b'));
  assert.deepEqual(g.publicState(r).pending.options,counters);assert.equal(g.chooseCounter(r,'c',counter).ok,false);
  ok(g.chooseCounter(r,'b',counter));assert.equal(r.pending.kind,'counterClaim');assert.equal(r.pending.claimantId,'b');assert.equal(r.players[1].coins,before-(counter==='swordsman'?5:0));
  assert.equal(g.chooseCounter(r,'b',counter).ok,false,'No repeated counter or double charge');assert(g.treasuryInvariant(r));
 }
 // A failed target challenge removes counter rights. Extort pays alongside loss;
 // Intrigue inspects only the surviving hand, and lethal actions retain double loss.
 for(const [action,role] of [['intrigue','courtesan'],['extort','kingpin'],['assassinate','assassin']]){
  const r=fixture(treasury);r.players[0].influences[0]=role;ok(g.performAction(r,'a',action,'b'));ok(g.challenge(r,'b'));
  assert.equal(g.chooseCounter(r,'b','magistrate').ok,false);assert.equal(g.chooseCounter(r,'b','courtesan').ok,false);
  if(action==='intrigue'){assert.equal(r.pending.kind,'lose');finishLoss(r,'b');assert.equal(r.pending.kind,'information');assert.equal(r.pending.unknownIndices.length,1);ok(g.chooseCounter(r,'b','revealAll'));}
  if(action==='extort'){assert.equal(r.players[0].coins,8);assert(g.lossDecision(r,'b'));finishLoss(r,'b');assert.equal(r.pending,null);}
  if(action==='assassinate')assert.equal(r.players[1].alive,false);
  assert(g.treasuryInvariant(r));
 }
 // Third-party loss is a public-information barrier before every defense choice.
 for(const [action,role] of [['intrigue','courtesan'],['extort','kingpin'],['assassinate','assassin']]){
  const r=fixture(treasury);r.players[0].influences[0]=role;ok(g.performAction(r,'a',action,'b'));ok(g.challenge(r,'c'));
  assert.equal(r.pending.kind,'lose');assert.equal(r.challengeLosses.length,0);assert.equal(g.chooseCounter(r,'b',action==='intrigue'?'courtesan':'kingpin').ok,false);assert.equal(g.declineCounter(r,'b').ok,false);
  finishLoss(r,'c');assert.equal(r.pending.kind,'counterOffer');assert.equal(r.revealedCards.at(-1).role,'assassin');
  ok(g.chooseCounter(r,'b',action==='intrigue'?'courtesan':action==='extort'?'kingpin':'assassin'));assert.equal(r.pending.kind,'counterClaim');assert(g.treasuryInvariant(r));
 }
 // Summon proves/replaces first, then waits to draw its action card until loss.
 {
  const r=fixture(treasury);r.players[0].influences[0]='magistrate';const total=count(r),length=r.deck.length;ok(g.performAction(r,'a','summon'));ok(g.challenge(r,'c'));
  assert.equal(r.pending.kind,'lose');assert.equal(r.deck.length,length-1);assert.equal(g.privateState(r,'a').summonDrawnRole,null);assert.equal(g.chooseSummon(r,'a','discard').ok,false);
  finishLoss(r,'c');assert.equal(r.pending.kind,'summon');assert.equal(r.deck.length,length-2);assert.equal(r.pending.drawnRole,'assassin');assert.equal(count(r),total);ok(g.chooseSummon(r,'a','replace',1));assert.equal(count(r),total);assert(g.treasuryInvariant(r));
 }
 // Once the target allows, automatic effects / unavoidable losses may overlap.
 for(const action of ['extort','assassinate'])for(const order of ['target-first','challenger-first']){
  const r=fixture(treasury);r.players[0].influences[0]=action==='extort'?'kingpin':'assassin';const turn=r.turnNumber;ok(g.performAction(r,'a',action,'b'));ok(g.declineCounter(r,'b'));assert.equal(g.chooseCounter(r,'b','magistrate').ok,false);assert.equal(g.challenge(r,'b').ok,false);
  ok(g.challenge(r,'c'));assert(g.lossDecision(r,'c'));
  if(action==='extort'){assert.equal(r.players[0].coins,8);assert.equal(r.pending,null);}
  else assert.equal(r.pending.loserId,'b');
  assert.equal(r.turnNumber,turn);const first=order==='target-first'?'b':'c',second=order==='target-first'?'c':'b';finishLoss(r,first);if(g.lossDecision(r,second))assert.equal(r.turnNumber,turn);finishLoss(r,second);assert.equal(r.turnNumber,turn+1);assert(g.treasuryInvariant(r));
 }
 // Concealment choices also wait even if the target already allowed Intrigue.
 {
  const r=fixture(treasury);ok(g.performAction(r,'a','intrigue','b'));ok(g.declineCounter(r,'b'));ok(g.challenge(r,'c'));assert.equal(r.pending.kind,'lose');finishLoss(r,'c');assert.equal(r.pending.kind,'information');
 }
 // A third player can challenge action and counter, but must reveal the first loss.
 {
  const r=fixture(treasury);r.players[1].influences[0]='courtesan';ok(g.performAction(r,'a','intrigue','b'));ok(g.challenge(r,'c'));assert.equal(g.challenge(r,'c').ok,false);finishLoss(r,'c');ok(g.chooseCounter(r,'b','courtesan'));ok(g.challenge(r,'c'));assert.equal(r.players[2].alive,false);assert.equal(r.challengeLosses.length,0);
 }
 // Mandatory attack losses can coexist with a third-party failed counter challenge.
 for(const counter of ['swordsman','magistrate'])for(const order of ['attacker-first','challenger-first']){
  const r=fixture(treasury);const action=counter==='swordsman'?'assassinate':'extort';r.players[0].influences[0]=counter==='swordsman'?'assassin':'kingpin';if(counter==='magistrate'){r.players[0].coins=1;if(treasury)r.treasuryCoins+=5;}
  ok(g.performAction(r,'a',action,'b'));ok(g.chooseCounter(r,'b',counter));ok(g.challenge(r,'c'));assert(g.lossDecision(r,'a'));assert(g.lossDecision(r,'c'));const turn=r.turnNumber;
  const ids=order==='attacker-first'?['a','c']:['c','a'];finishLoss(r,ids[0]);assert.equal(r.turnNumber,turn);finishLoss(r,ids[1]);assert.equal(r.turnNumber,turn+1);assert(g.treasuryInvariant(r));
 }
}
// Only the challenge clock expires: counter choice stays untimed afterwards.
{
 const real=Date.now;let now=1000;Date.now=()=>now;
 try{const r=fixture();r.challengeTimerEnabled=true;ok(g.performAction(r,'a','extort','b'));const old=r.pending.challengeDeadline;now=old;assert(g.expireChallenge(r));assert.equal(r.pending.kind,'counterOffer');assert.equal(r.pending.challengeDeadline,undefined);now+=600000;assert.equal(g.expireChallenge(r),false);ok(g.chooseCounter(r,'b','kingpin'));assert.equal(r.pending.challengeDeadline,now+15000);assert(r.pending.challengeDeadline>old);}
 finally{Date.now=real;}
}
console.log('Unified target responses: immediate/bluff counters, no counter after challenge, allow commitment, loss-first defenses/concealment/Summon, parallel forced losses, untimed offers, fresh counter clocks, both economies passed.');
