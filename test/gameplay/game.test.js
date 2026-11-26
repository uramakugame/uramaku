const assert = require('node:assert/strict');
const g = require('../../server/game');
function roomWith(players) {
  const room = g.createGame('TEST', players[0]);
  room.players = players;
  room.status = 'playing'; room.turn = 0; room.deck = Array(30).fill('lord'); room.discard=[]; room.pending=null; room.log=[];
  return room;
}
const p=(id,influences,coins=3)=>({id,name:id,coins,influences,alive:true,ready:true,connected:true});
// Counter metadata is what UI should present.
assert.equal(g.ROLES.lord.counter,'Authority');
assert.equal(g.ROLES.kingpin.counter,'Intimidate');
assert.equal(g.ROLES.magistrate.action,'Summon');
// Kingpin target can claim Kingpin counter after everyone passes Extort.
{
 const a=p('a',['kingpin','lord']), b=p('b',['kingpin','magistrate']), c=p('c',['assassin','swordsman']);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','extort','b').ok);
 assert(g.passChallenge(r,'b').ok); assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer'); assert(r.pending.options.includes('kingpin'));
 assert(g.chooseCounter(r,'b','kingpin').ok); assert.equal(r.pending.kind,'counterClaim');
 assert(g.passChallenge(r,'a').ok); assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending,null); assert.equal(a.coins,3); assert.equal(b.coins,4);
 assert(r.log.some(x=>x.includes('Intimidate')));
}
// Swordsman Hire Guard must open a counterclaim challenge window before Assassin loses influence.
{
 const a=p('a',['assassin','lord']), b=p('b',['swordsman','magistrate'],5), c=p('c',['courtesan','kingpin']);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','assassinate','b').ok);
 assert(g.passChallenge(r,'b').ok); assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert(g.chooseCounter(r,'b','swordsman').ok); assert.equal(r.pending.kind,'counterClaim');
 assert(g.passChallenge(r,'a').ok); assert.equal(r.pending.kind,'counterClaim');
 assert(g.passChallenge(r,'c').ok); assert.equal(r.pending.kind,'lose');
 assert.equal(r.pending.loserId,'a'); assert.equal(a.influences.length,2);
}
// Summon is a challengeable Magistrate action with no target.
{
 const a=p('a',['magistrate','lord'],3), b=p('b',['kingpin','swordsman'],0);
 const r=roomWith([a,b]);
 assert(g.performAction(r,'a','summon').ok);
 assert.equal(r.pending.targetId,null);
 assert(g.passChallenge(r,'b').ok);
 assert.equal(r.pending.kind,'summon');
 assert.equal(r.pending.stage,'preview');
 assert.equal(b.coins,0);
 assert(g.chooseSummon(r,'a','discard').ok);
 assert.equal(r.pending,null);
 assert.equal(r.turn,1);
 assert.equal(b.coins,1);
}
// Gossip keeps discoveries private until explicitly published from a role card.
{
 const a=p('a',['courtesan','lord']), b=p('b',['swordsman','magistrate'],0);
 const r=roomWith([a,b]);
 assert(g.performAction(r,'a','intrigue','b').ok);
 assert(g.passChallenge(r,'b').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert.deepEqual(r.pending.options,['lord','courtesan']);
 {const pending=r.pending;r.pending=null;assert(g.performDeferredAction(r,pending).ok);}
 assert.equal(r.pending,null);
 assert.deepEqual(a.privateInvestigations.b,{'0':'swordsman','1':'magistrate'});
 assert.equal(r.sharedInvestigations.length,0);
 assert(g.sharePrivateIntel(r,'a','b',1).ok);
 assert.deepEqual(r.sharedInvestigations[0].roles,['magistrate']);
}
// A player who passed cannot pass twice.
{
 const a=p('a',['kingpin','lord']), b=p('b',['swordsman','magistrate']), c=p('c',['assassin','courtesan']);
 const r=roomWith([a,b,c]); g.performAction(r,'a','extort','b');
 assert(g.passChallenge(r,'b').ok);
 assert.equal(g.passChallenge(r,'b').ok,false);
}
console.log('All targeted game-flow tests passed.');
// Counter claim can be challenged by the original attacker before Hire Guard resolves.
{
 const a=p('a',['assassin','lord']), b=p('b',['swordsman','magistrate'],5), c=p('c',['courtesan','kingpin']);
 const r=roomWith([a,b,c]);
 g.performAction(r,'a','assassinate','b'); g.passChallenge(r,'b'); g.passChallenge(r,'c');
 g.chooseCounter(r,'b','swordsman');
 assert.equal(g.challenge(r,'a').ok,true); // Assassin challenges Hire Guard claim
 assert.equal(a.alive,false); // Failed challenge and Hire Guard resolve together.
 assert.equal(a.influences.length,0);
 assert.notEqual(r.pending?.kind,'lose');

}
// Assassin challenging a genuine Swordsman with two influences loses both
// automatically, with no intermediate selection prompt.
{
 const a=p('a',['assassin','lord']), b=p('b',['swordsman','magistrate'],5), c=p('c',['courtesan','kingpin']);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','assassinate','b').ok);
 assert(g.passChallenge(r,'b').ok); assert(g.passChallenge(r,'c').ok);
 assert(g.chooseCounter(r,'b','swordsman').ok);
 assert(g.challenge(r,'a').ok);
 assert.equal(a.alive,false);
 assert.equal(a.influences.length,0);
 assert.notEqual(r.pending?.kind,'lose');
 assert.equal(r.revealedCards.filter(x=>x.playerId==='a'&&x.reason==='Failed challenge and Hire Guard').length,2);
}
// Authority and Gossip are offered after the Intrigue claim.
{
 const a=p('a',['courtesan','lord']), b=p('b',['lord','magistrate'],2);
 const r=roomWith([a,b]);
 assert(g.performAction(r,'a','intrigue','b').ok);
 assert(g.passChallenge(r,'b').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert.deepEqual(g.publicState(r).pending.options,['lord','courtesan']);
 assert.equal(g.ROLES.lord.counter,'Authority');
}
// The counter claim is a separate challenge window for Magistrate's Enforce too.
{
 const a=p('a',['kingpin','lord']), b=p('b',['magistrate','swordsman']);
 const r=roomWith([a,b]);
 g.performAction(r,'a','extort','b');
 g.passChallenge(r,'b');
 assert.equal(r.pending.kind,'counterOffer');
 assert(r.pending.options.includes('magistrate'));
 g.chooseCounter(r,'b','magistrate');
 assert.equal(r.pending.kind,'counterClaim');
 assert.equal(g.ROLES[r.pending.role].counter,'Enforce');
}
console.log('Privacy and Magistrate counter regression tests passed.');
// End-to-end counter offers are sent to the targeted player after every other
// living player passes the original action claim, for both Enforce and Hire Guard.
{
 const a=p('a',['kingpin','lord']), b=p('b',['magistrate','swordsman']), c=p('c',['courtesan','assassin']);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','extort','b').ok);
 assert(g.passChallenge(r,'b').ok);
 assert.equal(r.pending.kind,'claim');
 assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert.equal(r.pending.targetId,'b');
 assert.deepEqual(r.pending.options,['kingpin','magistrate']);
 const pub=g.publicState(r);
 assert.equal(pub.pending.kind,'counterOffer');
 assert.equal(pub.pending.targetName,'b');
 assert.equal(g.privateState(r,'b').id,'b');
 assert(g.chooseCounter(r,'b','magistrate').ok);
 assert.equal(r.pending.kind,'counterClaim');
 assert.equal(r.pending.claimantId,'b');
 assert.equal(r.pending.targetId,'a');
 assert(g.passChallenge(r,'a').ok);
 assert.equal(r.pending.kind,'counterClaim');
 assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending,null);
 assert.equal(a.coins,1); // Starts at 3 and pays Enforce 2.
 assert.equal(b.coins,6); // Enforce payment and next-turn Income.
}
{
 const a=p('a',['assassin','lord']), b=p('b',['swordsman','magistrate'],5), c=p('c',['courtesan','kingpin']);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','assassinate','b').ok);
 assert(g.passChallenge(r,'b').ok);
 assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert.equal(r.pending.targetId,'b');
 assert.deepEqual(r.pending.options,['swordsman','assassin']);
 const pub=g.publicState(r);
 assert.equal(pub.pending.targetName,'b');
 assert(g.chooseCounter(r,'b','swordsman').ok);
 assert.equal(r.pending.kind,'counterClaim');
 assert(g.passChallenge(r,'a').ok);
 assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'lose');
 assert.equal(r.pending.loserId,'a');
}
console.log('Targeted-player Enforce and Hire Guard prompt tests passed.');
// Counter claims can be bluffed: the target is always offered legal counters,
// even when they do not actually hold Magistrate or Swordsman.
{
 const a=p('a',['kingpin','lord']), b=p('b',['courtesan','assassin']), c=p('c',['lord','kingpin']);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','extort','b').ok);
 assert(g.passChallenge(r,'b').ok); assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert.deepEqual(r.pending.options,['kingpin','magistrate']);
 assert(g.chooseCounter(r,'b','magistrate').ok);
 assert.equal(r.pending.kind,'counterClaim');
 assert.equal(r.pending.role,'magistrate');
}
{
 const a=p('a',['assassin','lord']), b=p('b',['courtesan','magistrate'],5), c=p('c',['kingpin','lord']);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','assassinate','b').ok);
 assert(g.passChallenge(r,'b').ok); assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert.deepEqual(r.pending.options,['swordsman','assassin']);
 assert(g.chooseCounter(r,'b','swordsman').ok);
 assert.equal(r.pending.kind,'counterClaim');
}
console.log('Bluffable counter-offer tests passed.');

// Player seating order is randomized at game start and remains the turn order.
{
 const a=p('a',['lord','magistrate']), b=p('b',['kingpin','assassin']), c=p('c',['swordsman','courtesan']);
 const r=g.createGame('ORDER',a); r.players=[a,b,c]; g.startGame(r);
 assert.deepEqual(new Set(r.players.map(x=>x.id)),new Set(['a','b','c']));
 assert.equal(r.players.length,3);
 assert.equal(g.publicState(r).turnPlayerId,r.players[0].id);
 assert.equal(g.publicState(r).nextTurnPlayerId,r.players[1].id);
 const first=r.players[0]; g.finishTurn(r,first.id);
 assert.equal(g.publicState(r).turnPlayerId,r.players[1].id);
}
// Spectators can join a live room without becoming players or receiving private state.
{
 const a=p('a',['lord','magistrate']), b=p('b',['kingpin','assassin']);
 const r=roomWith([a,b]); r.spectators=[];
 assert(g.addSpectator(r,'s1','Observer').ok);
 assert.equal(g.publicState(r).spectators[0].name,'Observer');
 assert.equal(g.privateState(r,'s1'),null);
 assert.equal(g.publicState(r).players.length,2);
 assert.equal(g.addSpectator(r,'s2','observer').ok,false);
 assert(!('chat' in g.publicState(r)));
 assert.equal(g.addChatMessage,undefined);
}
console.log('Seating order, spectator, and public-state privacy tests passed.');

// Failed challenge against a true claim automatically removes the final influence.
{
 const a=p('a',['kingpin','lord']), b=p('b',['swordsman']), c=p('c',['magistrate','assassin']);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','extort','c').ok);
 assert.equal(g.publicState(r).pending.targetName,'c');
 const result=g.challenge(r,'b');
 assert.equal(result.ok,true);
 assert.equal(b.influences.length,0);
 assert.equal(b.alive,false);
 assert.notEqual(r.pending?.kind,'lose');
}
// Failed claim challenged by a player with a single influence also resolves automatically.
{
 const a=p('a',['lord']), b=p('b',['swordsman','magistrate']), c=p('c',['assassin','courtesan']);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','extort','b').ok);
 assert(g.challenge(r,'b').ok);
 assert.equal(a.influences.length,0);
 assert.equal(a.alive,false);
 assert.notEqual(r.pending?.kind,'lose');
}
console.log('Final-influence challenge regressions passed.');

// Successful Enforce pays 2 coins to the defender.
{
 const attacker=p('attacker',['kingpin','lord'],5), defender=p('defender',['magistrate','swordsman'],1);
 const r=roomWith([attacker,defender]);
 assert(g.performAction(r,'attacker','extort','defender').ok);
 assert(g.passChallenge(r,'defender').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert(g.chooseCounter(r,'defender','magistrate').ok);
 assert(g.passChallenge(r,'attacker').ok);
 assert.equal(attacker.coins,3);
 assert.equal(defender.coins,4); // Enforce payment and next-turn Income.
 assert(r.log.some(line=>line.includes('pays 2 coins to defender')));
}
// Insufficient coins under Enforce cause influence loss, not partial transfer.
{
 const attacker=p('attacker',['kingpin','lord'],0), defender=p('defender',['magistrate','swordsman'],4);
 const r=roomWith([attacker,defender]);
 assert(g.performAction(r,'attacker','extort','defender').ok);
 assert(g.passChallenge(r,'defender').ok);
 assert(g.chooseCounter(r,'defender','magistrate').ok);
 assert(g.passChallenge(r,'attacker').ok);
 assert.equal(attacker.coins,0);
 assert.equal(defender.coins,4);
 assert.equal(r.pending.kind,'lose');
 assert.equal(r.pending.loserId,'attacker');
}
console.log('Magistrate Enforce payment tests passed.');

// Gossip disclosure distinguishes identical roles by slot, without an immediate share decision.
{
 const a=p('a',['courtesan','lord'],3), b=p('b',['swordsman','swordsman'],0), c=p('c',['magistrate','kingpin'],3);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','intrigue','b').ok);
 assert(g.passChallenge(r,'b').ok);
 assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 {const pending=r.pending;r.pending=null;assert(g.performDeferredAction(r,pending).ok);}
 assert.equal(r.pending,null);
 assert.deepEqual(g.privateState(r,'b').intrigueVisibility,[1,1]);
 assert.deepEqual(a.privateInvestigations.b,{'0':'swordsman','1':'swordsman'});
 assert.equal(r.sharedInvestigations.length,0);
 assert(g.sharePrivateIntel(r,'a','b',0).ok);
 assert.deepEqual(g.privateState(r,'b').intrigueVisibility,[3,1]);
 assert.deepEqual(r.sharedInvestigations[0].indices,[0]);
 r.pending={kind:'lose',loserId:'b',claimantId:'c',targetId:'b',reason:'test',after:'finish'};
 assert(g.loseInfluence(r,'b',0).ok);
 assert.deepEqual(g.privateState(r,'b').intrigueVisibility,[1]);
 assert.equal(r.sharedInvestigations.length,0);
}
console.log('Per-card Gossip visibility and duplicate-role tests passed.');
// Faction-only backs reveal faction per slot, never the underlying role.
{
 const a=p('a',['lord','assassin']), b=p('b',['swordsman','kingpin']);
 const r=roomWith([a,b]);
 assert.equal(g.publicState(r).revealFactions,false);
 assert.equal(g.publicState(r).players[0].influenceFactions,undefined);
 r.revealFactions=true;
 const state=g.publicState(r);
 assert.deepEqual(state.players[0].influenceFactions,['order','underworld']);
 assert.deepEqual(state.players[1].influenceFactions,['order','underworld']);
 assert.equal(state.players[0].influences,undefined);
 assert.equal(state.players[1].influences,undefined);
 assert.equal(state.players[0].influenceFactions.includes('lord'),false);
}
console.log('Faction-only hidden card visibility tests passed.');
// Intrigue concealment payments go to the investigator, never the treasury.
for(const [choice,targetRoles,targetCoins,expectedPayment] of [
 ['keepOne',['swordsman','magistrate'],3,1],
 ['keepOne',['swordsman'],3,1],
 ['concealAll',['swordsman','magistrate'],3,2],
 ['revealAll',['swordsman','magistrate'],3,0]
]){
 const investigator=p('investigator',['courtesan','lord'],4);
 const target=p('target',targetRoles,targetCoins);
 const room=roomWith([investigator,target]);
 assert(g.performAction(room,'investigator','intrigue','target').ok);
 assert(g.passChallenge(room,'target').ok);
 assert.equal(room.pending.kind,'counterOffer');
 room.pending={kind:'information',claimantId:'investigator',targetId:'target',stage:'choice',unknownIndices:target.influences.map((_,i)=>i)};
 assert.equal(room.pending.kind,'information');
 const before=investigator.coins+target.coins;
 room.status='lobby'; // Suppress next-turn passive income in transfer-only assertions.
 assert(g.chooseCounter(room,'target',choice).ok);
 assert.equal(investigator.coins,4+expectedPayment);
 assert.equal(target.coins,targetCoins-expectedPayment);
 assert.equal(investigator.coins+target.coins,before);
 if(expectedPayment) assert(room.log.some(x=>x.includes(`to investigator`)));
}
// Invalid payments must not transfer coins or change the pending state.
{
 const investigator=p('investigator',['courtesan','lord'],4);
 const target=p('target',['swordsman','magistrate'],1);
 const room=roomWith([investigator,target]);
 room.pending={kind:'information',claimantId:'investigator',targetId:'target',stage:'choice',unknownIndices:target.influences.map((_,i)=>i)};
 assert.equal(g.chooseCounter(room,'target','concealAll').ok,false);
 assert.equal(investigator.coins,4);
 assert.equal(target.coins,1);
 assert.equal(room.pending.stage,'choice');
}
assert.equal(g.ROLES.lord.counterEffect,'Block Intrigue.');
assert.equal(g.ROLES.kingpin.counterEffect,'Block Extort.');
assert(g.ROLES.magistrate.counterEffect.includes('Target must pay you 2 coins')); 
console.log('Intrigue payment transfers and rule-reference regressions passed.');

// Rules reference: localized action/counter labels and updated counter descriptions.
{
 const roles=g.ROLES;
 assert.equal(roles.swordsman.counterEffect,'Pay 5 coins; Counter Assassinate; Target loses an influence.');
 assert.equal(roles.magistrate.counterEffect,'Counter Extort; Target must pay you 2 coins or lose an influence.');
 for(const role of Object.values(roles)){
   if(role.action && role.action!=='—') assert(role.actionJp);
   if(role.counter && role.counter!=='—') assert(role.counterJp);
   if(role.effect && role.effect!=='—') assert(role.effectJp);
   if(role.counterEffect && role.counterEffect!=='—') assert(role.counterEffectJp);
 }
}
console.log('Bilingual rule-reference tests passed.');

for (const [key, role] of Object.entries(g.ROLES)) {
  const room = roomWith([p("a",["lord","magistrate"]),p("b",["swordsman","kingpin"])]);
  const published = g.publicState(room).roles[key];
  assert.equal(published.effectJp, role.effectJp);
  assert.equal(published.counterEffectJp, role.counterEffectJp);
}
console.log("Japanese effect metadata serialization tests passed.");

// Assassinate target loses BOTH influences automatically after challenging
// a genuine Assassin. No pending choice and no duplicate assassinate.
{
 const a=p('a',['assassin','lord'],5), b=p('b',['swordsman','magistrate'],3), c=p('c',['kingpin','courtesan'],3);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','assassinate','b').ok);
 assert(g.challenge(r,'b').ok);
 assert.equal(b.influences.length,0);
 assert.equal(b.alive,false);
 assert.notEqual(r.pending?.kind,'lose');
 assert.equal(r.revealedCards.filter(x=>x.playerId==='b').length,2);
 assert.equal(r.revealedCards.filter(x=>x.playerId==='b'&&x.reason==='Failed challenge and Assassinate').length,2);
 assert.equal(a.influences.length,2);
 assert.equal(a.coins,2); // Assassinate cost is still paid exactly once.
 assert.equal(g.loseInfluence(r,'b',0).ok,false);
 assert.equal(r.status,'playing');
}
// A target with just one remaining influence also resolves automatically.
{
 const a=p('a',['assassin','lord'],5), b=p('b',['swordsman'],3), c=p('c',['kingpin','courtesan'],3);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','assassinate','b').ok);
 assert(g.challenge(r,'b').ok);
 assert.equal(b.alive,false);
 assert.equal(r.revealedCards.filter(x=>x.playerId==='b').length,1);
 assert.notEqual(r.pending?.kind,'lose');
}
// A THIRD-PARTY challenger loses only one influence, and the Assassinate action
// target still gets their normal counter opportunity.
{
 const a=p('a',['assassin','lord'],5), b=p('b',['swordsman','magistrate'],3), c=p('c',['kingpin','courtesan'],3);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','assassinate','b').ok);
 assert(g.challenge(r,'c').ok);
 assert.equal(g.lossDecision(r,'c').kind,'lose');
 assert.equal(g.lossDecision(r,'c').loserId,'c');
 assert.equal(g.lossDecision(r,'c').lossCount||1,1);
 assert.equal(r.pending.kind,'lose','The other target waits for the public loss reveal');
 assert(g.loseInfluence(r,'c',0).ok);
 assert.equal(c.influences.length,1);
 assert.equal(b.influences.length,2);
 assert.equal(r.pending.kind,'counterOffer');
 assert.equal(r.pending.targetId,'b');
 assert.deepEqual(r.pending.options,['assassin']);
}
// A false assassinate claim still costs the claimant one influence and
// cancels the Assassinate action without penalizing the target.
{
 const a=p('a',['lord','kingpin'],5), b=p('b',['swordsman','magistrate'],3), c=p('c',['courtesan','assassin'],3);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','assassinate','b').ok);
 assert(g.challenge(r,'b').ok);
 assert.equal(r.pending.kind,'lose');
 assert.equal(r.pending.loserId,'a');
 assert.equal(r.pending.lossCount,undefined);
 assert(g.loseInfluence(r,'a',0).ok);
 assert.equal(b.influences.length,2);
}
console.log('Assassinate double-loss and challenge regressions passed.');
// Bluffing Swordsman against a genuine assassinate: the attacker successfully
// challenges the counter. The target loses both influences automatically.
{
 const a=p('a',['assassin','lord'],5), b=p('b',['kingpin','magistrate'],5), c=p('c',['courtesan','swordsman']);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','assassinate','b').ok);
 assert(g.passChallenge(r,'b').ok); assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert(g.chooseCounter(r,'b','swordsman').ok);
 assert(g.challenge(r,'a').ok);
 assert.equal(b.alive,false);
 assert.equal(b.influences.length,0);
 assert.notEqual(r.pending?.kind,'lose');
 assert.equal(r.revealedCards.filter(x=>x.playerId==='b'&&x.reason==='Failed Swordsman claim and Assassinate').length,2);
 assert.equal(a.influences.length,2);
 assert(r.log.some(x=>x.includes('Failed Swordsman claim and Assassinate')));
}

// Repeated Intrigue: publicly exposed cards cannot be paid to conceal again.
{
 const investigator=p('spy',['courtesan','lord'],3);
 const target=p('subject',['swordsman','magistrate'],3);
 target.intrigueVisibility=[2,0];
 const room=roomWith([investigator,target]);
 assert(g.performAction(room,'spy','intrigue','subject').ok);
 assert(g.passChallenge(room,'subject').ok);
 // Authority is offered whenever the target can pay one coin.
 assert.equal(room.pending.kind,'counterOffer');
 const pending=room.pending; room.pending=null; assert(g.performDeferredAction(room,pending).ok);
 assert.equal(room.pending.kind,'information');
 assert.equal(g.chooseCounter(room,'subject','concealAll').ok,false);
 assert.equal(target.coins,3);
 assert.equal(investigator.coins,3);
 assert.equal(g.chooseCounter(room,'subject','keepOne').ok,true);
 assert.equal(room.pending,null); // Only one unknown card: the payment hides it directly.
 assert.equal(g.revealIntrigue(room,'subject',0).ok,false);
 assert.equal(g.revealIntrigue(room,'subject',1).ok,false);
 assert.equal(target.coins,3); // 3 - 1 paid + 1 income on the next turn.
 assert.equal(investigator.coins,4);
}
{
 const investigator=p('spy',['courtesan','lord'],3);
 const target=p('subject',['swordsman','magistrate'],3);
 target.intrigueVisibility=[2,2];
 const room=roomWith([investigator,target]);
 assert.equal(g.performAction(room,'spy','intrigue','subject').ok,false);
 assert.equal(room.pending,null);
 assert.equal(target.coins,3);
}
console.log('Repeat Intrigue public-influence payment regressions passed.');

// Intrigue eligibility: public knowledge applies to everybody; private
// investigations apply ONLY to the investigator that learned each card.
{
 const a=p('a',['courtesan','lord'],4), b=p('b',['courtesan','magistrate'],4), c=p('c',['swordsman','kingpin'],0);
 const r=roomWith([a,b,c]);
 c.intrigueVisibility=[2,2];
 assert.equal(g.performAction(r,'a','intrigue','c').ok,false);
 assert.equal(r.pending,null);
 assert.equal(g.privateState(r,'a').intrigueEligibleTargets.includes('c'),false);
 c.intrigueVisibility=[0,0];
 // A privately knows c[0], but B has never seen either card.
 a.privateInvestigations={c:{0:'swordsman'}};
 c.intrigueVisibility=[1,0];
 assert.deepEqual(g.privateState(r,'a').intrigueEligibleTargets,['b','c']);
 assert(g.performAction(r,'a','intrigue','c').ok);
 assert(g.passChallenge(r,'b').ok);
 assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 {const pending=r.pending;r.pending=null;assert(g.performDeferredAction(r,pending).ok);} // Decline the optional Gossip counter.
 assert.equal(r.pending,null);
 assert.deepEqual(a.privateInvestigations.c,{'0':'swordsman','1':'kingpin'});
 assert.equal(g.privateState(r,'a').intrigueEligibleTargets.includes('c'),false);
 assert.equal(g.privateState(r,'b').intrigueEligibleTargets.includes('c'),true);
 // Server refuses replay even when explicitly addressed to a fully known target.
 r.turn=r.players.findIndex(x=>x.id==='a');
 assert.equal(g.performAction(r,'a','intrigue','c').ok,false);
 assert.equal(r.pending,null);
}
// No available target: error instead of starting an unresolvable claim.
{
 const a=p('a',['courtesan','lord'],4), b=p('b',['swordsman','magistrate'],2);
 const r=roomWith([a,b]);
 b.intrigueVisibility=[2,2];
 const response=g.performAction(r,'a','intrigue','b');
 assert.equal(response.ok,false);
 assert.match(response.error,/Intrigue unavailable/);
 assert.equal(r.pending,null);
}
// Public knowledge is distinct from another player's private intel.
{
 const a=p('a',['courtesan','lord'],4), b=p('b',['swordsman','magistrate'],2), c=p('c',['kingpin','magistrate'],2);
 const r=roomWith([a,b,c]);
 b.privateInvestigations={c:{0:'kingpin',1:'magistrate'}};
 assert(g.performAction(r,'a','intrigue','c').ok);
 assert.equal(g.privateState(r,'a').intrigueEligibleTargets.includes('c'),true);
}
// Private knowledge persists across investigations of different players,
// while a lost card shifts remaining known slot indexes correctly.
{
 const a=p('a',['courtesan','lord'],4), b=p('b',['swordsman','magistrate'],4), c=p('c',['kingpin','assassin'],4);
 const r=roomWith([a,b,c]);
 a.privateInvestigations={b:{0:'swordsman'},c:{0:'kingpin'}};
 r.pending={kind:'lose',loserId:'b',claimantId:'c',targetId:'b',reason:'Test loss',after:'finish'};
 assert(g.loseInfluence(r,'b',0).ok);
 assert.deepEqual(a.privateInvestigations.b,{});
 assert.deepEqual(a.privateInvestigations.c,{'0':'kingpin'});
}
console.log('Per-investigator Intrigue eligibility and repeat-target regressions passed.');

// Extort targets must have at least one coin; failed attempts do not spend the turn.
{
 const a=p('a',['kingpin','lord'],3), b=p('b',['swordsman','magistrate'],0), c=p('c',['assassin','courtesan'],1);
 const r=roomWith([a,b,c]);
 assert.deepEqual(g.performAction(r,'a','extort','b'),{ok:false,error:'Extort requires a target with at least 1 coin.'});
 assert.equal(r.pending,null);
 assert.equal(r.turn,0);
 assert(g.performAction(r,'a','extort','c').ok);
 assert(g.passChallenge(r,'b').ok);
 assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 const counterDecision=r.pending; r.pending=null;
 assert(g.performDeferredAction(r,counterDecision).ok);
 assert.equal(c.coins,0); // Target's only coin was taken
 assert.equal(a.coins,4);
}
console.log('Extort target balance regression passed.');

// Private knowledge can be published later, out of turn, without interrupting
// an existing action, and becomes public to *all* investigators.
{
 const a=p('a',['courtesan','lord'],3),b=p('b',['swordsman','magistrate'],2),c=p('c',['kingpin','assassin'],2);
 const r=roomWith([a,b,c]);
 a.privateInvestigations={b:{0:'swordsman',1:'magistrate'}};
 b.intrigueVisibility=[1,1];
 r.turn=1;
 r.pending={kind:'claim',claimantId:'b',targetId:'c',action:'extort',role:'kingpin',stage:'challenge'};
 const originalPending=r.pending;
 assert(g.sharePrivateIntel(r,'a','b',0).ok);
 assert.equal(r.pending,originalPending);
 assert.equal(r.turn,1);
 assert.deepEqual(g.publicState(r).sharedInvestigations[0].indices,[0]);
 assert.equal(b.intrigueVisibility[0]&2,2);
 assert.equal(b.intrigueVisibility[1]&2,0);
 assert.equal(g.privateState(r,'c').privateInvestigations?.b,undefined);
 assert.deepEqual(g.sharePrivateIntel(r,'a','b',0),{ok:false,error:'That influence is already public.'});
 assert(g.sharePrivateIntel(r,'a','b',1).ok);
 assert.deepEqual(g.publicState(r).sharedInvestigations[0].indices,[0,1]);
 assert.equal(g.sharePrivateIntel(r,'c','b',0).ok,false);
}
// Do not allow fake discovery data, opponent data, or a removed/replaced card.
{
 const a=p('a',['courtesan','lord']),b=p('b',['swordsman','magistrate']),c=p('c',['assassin','kingpin']);
 const r=roomWith([a,b,c]);
 a.privateInvestigations={b:{0:'swordsman'}};
 assert.equal(g.sharePrivateIntel(r,'c','b',0).ok,false);
 assert.equal(g.sharePrivateIntel(r,'a','b',99).ok,false);
 b.influences[0]='lord';
 assert.equal(g.sharePrivateIntel(r,'a','b',0).ok,false);
 assert.equal(r.sharedInvestigations.length,0);
}
console.log('Late private intel sharing, authorization, and public visibility regressions passed.');

// New Swordsman Hire Blade: 5 coins on declaration, challengeable, no counter.
{
 const a=p('a',['swordsman','lord'],6), b=p('b',['kingpin','magistrate'],2), c=p('c',['courtesan','assassin'],2);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','hireBlade','b').ok);
 assert.equal(a.coins,1);
 assert.equal(r.pending.role,'swordsman');
 assert.equal(r.pending.action,'hireBlade');
 assert(g.passChallenge(r,'b').ok);
 assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'lose');
 assert.equal(r.pending.loserId,'b');
 assert(!r.log.some(x=>x.includes('may claim a counter')));
 assert(g.loseInfluence(r,'b',0).ok);
 assert.equal(b.influences.length,1);
 assert.equal(r.pending,null);
}
{
 const a=p('a',['lord','magistrate'],5), b=p('b',['kingpin','swordsman'],2);
 const r=roomWith([a,b]);
 assert(g.performAction(r,'a','hireBlade','b').ok);
 assert.equal(a.coins,0);
 assert(g.challenge(r,'b').ok);
 assert.equal(r.pending.kind,'lose');
 assert.equal(r.pending.loserId,'a');
 assert.equal(b.influences.length,2);
 assert(g.loseInfluence(r,'a',0).ok);
 assert.equal(b.influences.length,2); // Hire Blade canceled on successful challenge.
}
{
 const a=p('a',['swordsman','magistrate'],4), b=p('b',['kingpin','lord'],2);
 const r=roomWith([a,b]); const before=JSON.stringify(r);
 assert.deepEqual(g.performAction(r,'a','hireBlade','b'),{ok:false,error:'Hire Blade costs 5 coins.'});
 assert.equal(JSON.stringify(r),before);
 assert.equal(g.ROLES.swordsman.name,'Swordsman');
 assert.equal(g.ROLES.courtesan.name,'Courtesan');
 assert.equal(g.ROLES.swordsman.action,'Hire Blade');
 assert.equal(g.ROLES.courtesan.action,'Intrigue');
 assert.equal(g.ROLES.lord.counter,'Authority');
}
console.log('Swordsman Hire Blade, challenge, payment, no-counter, and renamed-role regressions passed.');

// Authority: a counterclaim is challengeable, but an unchallenged claim must
// block Intrigue for free without a concealment menu.
{
 const spy=p('spy',['courtesan','swordsman'],3), subject=p('subject',['lord','magistrate'],2), witness=p('witness',['kingpin','swordsman'],2);
 const r=roomWith([spy,subject,witness]);
 assert(g.performAction(r,'spy','intrigue','subject').ok);
 assert(g.passChallenge(r,'subject').ok);assert(g.passChallenge(r,'witness').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert.deepEqual(r.pending.options,['lord','courtesan']);
 assert(g.chooseCounter(r,'subject','lord').ok);
 assert.equal(r.pending.kind,'counterClaim');
 assert(g.passChallenge(r,'spy').ok);assert.equal(r.pending.kind,'counterClaim');
 assert(g.passChallenge(r,'witness').ok);
 assert.equal(r.pending,null);
 assert.equal(subject.coins,3); // Only next-turn passive Income.
 assert.equal(spy.coins,3);
 assert.equal(spy.privateInvestigations?.subject,undefined);
 assert(r.log.some(line=>line.includes('uses Authority to block')));
}
// A player with zero coins may claim Authority.
{
 const spy=p('spy',['courtesan','swordsman'],2), subject=p('subject',['lord','magistrate'],0);
 const r=roomWith([spy,subject]);
 assert(g.performAction(r,'spy','intrigue','subject').ok);
 assert(g.passChallenge(r,'subject').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert.deepEqual(r.pending.options,['lord','courtesan']);
 assert(g.chooseCounter(r,'subject','lord').ok);
 assert(g.passChallenge(r,'spy').ok);
 assert.equal(r.pending,null);
 assert.equal(subject.coins,1);
 assert.equal(spy.coins,2);
 assert.equal(spy.privateInvestigations?.subject,undefined);
}
// If a bluffing target's Authority is challenged, they lose an influence and
// Intrigue continues against any remaining cards.
{
 const spy=p('spy',['courtesan','swordsman'],3), subject=p('subject',['magistrate','swordsman'],2), witness=p('witness',['kingpin','lord'],2);
 const r=roomWith([spy,subject,witness]);
 assert(g.performAction(r,'spy','intrigue','subject').ok);
 assert(g.passChallenge(r,'subject').ok);assert(g.passChallenge(r,'witness').ok);
 assert(g.chooseCounter(r,'subject','lord').ok);
 assert(g.challenge(r,'spy').ok);
 assert.equal(r.pending.kind,'lose');
 assert(g.loseInfluence(r,'subject',0).ok);
 assert.equal(subject.coins,2);
 assert.equal(spy.coins,3);
 assert.equal(r.pending.kind,'information');
}
// A proven Authority claim is replaced and the free counter still resolves
// after the challenger loses an influence.
{
 const spy=p('spy',['courtesan','swordsman'],3), subject=p('subject',['lord','magistrate'],2), witness=p('witness',['kingpin','assassin'],2);
 const r=roomWith([spy,subject,witness]);
 assert(g.performAction(r,'spy','intrigue','subject').ok);
 assert(g.passChallenge(r,'subject').ok);assert(g.passChallenge(r,'witness').ok);
 assert(g.chooseCounter(r,'subject','lord').ok);
 assert(g.challenge(r,'spy').ok);
 assert.equal(g.lossDecision(r,'spy').kind,'lose');
 assert(r.log.some(line=>line.includes('uses Authority to block')),'Block already resolved');
 assert(g.loseInfluence(r,'spy',1).ok);
 assert.equal(r.pending,null);
 assert.equal(subject.coins,3); // Only next-turn passive Income.
 assert.equal(spy.coins,3);
}
console.log('Free Authority and challenge outcomes passed.');

// Courtesan's Intrigue action can be countered by Gossip for a mutual private
// exchange. Gossip takes precedence over normal concealment and costs zero.
{
 const a=p('a',['courtesan','assassin'],4), b=p('b',['courtesan','swordsman'],0), c=p('c',['lord','magistrate'],3);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','intrigue','b').ok);
 assert(g.passChallenge(r,'b').ok);assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert.deepEqual(r.pending.options,['lord','courtesan']);
 assert(g.chooseCounter(r,'b','courtesan').ok);
 assert.equal(r.pending.kind,'counterClaim');
 assert(g.passChallenge(r,'a').ok);assert(g.passChallenge(r,'c').ok);
 assert.equal(r.pending,null);
 assert.deepEqual(a.privateInvestigations.b,{'0':'courtesan','1':'swordsman'});
 assert.deepEqual(b.privateInvestigations.a,{'0':'courtesan','1':'assassin'});
 assert.deepEqual(r.sharedInvestigations,[]);
 assert.deepEqual(g.publicState(r).sharedInvestigations,[]);
 assert.equal(a.coins,4);
 assert.equal(b.coins,1); // Only normal next-turn passive Income.
 assert.equal(c.privateInvestigations,undefined);
 assert(r.log.some(x=>x.includes('uses Gossip with')));
}
// Proved Gossip exchanges first, then hides the proof replacement and settles loss.
{
 const a=p('a',['courtesan','assassin'],3), b=p('b',['courtesan','swordsman'],2), c=p('c',['magistrate','kingpin'],2);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','intrigue','b').ok);
 assert(g.passChallenge(r,'b').ok);assert(g.passChallenge(r,'c').ok);
 assert(g.chooseCounter(r,'b','courtesan').ok);
 assert(g.challenge(r,'a').ok);
 assert.equal(g.lossDecision(r,'a').kind,'lose');assert.equal(g.lossDecision(r,'a').loserId,'a');
 assert.deepEqual(b.privateInvestigations.a,{'0':'courtesan','1':'assassin'});
 assert(g.loseInfluence(r,'a',1).ok);
 assert.equal(r.pending,null);
 assert.deepEqual(a.privateInvestigations.b,{'1':'swordsman'});
 assert.equal(g.privateState(r,'b').intrigueVisibility[0]&1,0);
 assert.deepEqual(b.privateInvestigations.a,{'0':'courtesan'});
}
// Bluffing Gossip counter challenged successfully: the liar loses influence,
// and original Intrigue continues, with no reciprocal information exchange.
{
 const a=p('a',['courtesan','assassin'],3), b=p('b',['swordsman','magistrate'],2), c=p('c',['lord','kingpin'],2);
 const r=roomWith([a,b,c]);
 assert(g.performAction(r,'a','intrigue','b').ok);
 assert(g.passChallenge(r,'b').ok);assert(g.passChallenge(r,'c').ok);
 assert(g.chooseCounter(r,'b','courtesan').ok);
 assert(g.challenge(r,'a').ok);
 assert.equal(r.pending.kind,'lose');
 assert(g.loseInfluence(r,'b',0).ok);
 assert.equal(r.pending.kind,'information');
 assert.equal(b.privateInvestigations?.a,undefined);
 assert.equal(g.chooseCounter(r,'b','revealAll').ok,true);
 assert.deepEqual(a.privateInvestigations.b,{'0':'magistrate'});
}
// Declining Gossip retains the existing Intrigue concealment-payment choice.
{
 const a=p('a',['courtesan','assassin'],3), b=p('b',['courtesan','swordsman'],2);
 const r=roomWith([a,b]);
 assert(g.performAction(r,'a','intrigue','b').ok);
 assert(g.passChallenge(r,'b').ok);
 assert.deepEqual(r.pending.options,['lord','courtesan']);
 const offer=r.pending;r.pending=null;assert(g.performDeferredAction(r,offer).ok);
 assert.equal(r.pending.kind,'information');
 assert(g.chooseCounter(r,'b','concealAll').ok);
 assert.equal(a.coins,5);
 assert.equal(b.coins,1); // 2 coins paid, then +1 passive Income.
}
console.log('Intrigue/Gossip counter exchange, privacy, zero-coin, challenge and payment tests passed.');
