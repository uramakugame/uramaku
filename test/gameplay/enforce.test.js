'use strict';
const assert=require('node:assert/strict');
const game=require('../../server/game'),feedback=require('../../public/js/components/game-feedback'),i18n=require('../../shared/i18n');
const player=(id,coins,influences)=>({id,name:id,coins,influences:[...influences],alive:true,connected:true,ready:true,privateInvestigations:{},intrigueVisibility:influences.map(()=>0)});
function fixture(coins,treasuryMode=false){
 const players=[player('Kingpin',coins,['kingpin','lord']),player('Magistrate',1,['magistrate','swordsman']),player('Observer',2,['courtesan','assassin'])];
 const room=game.createGame('ENFORCE',players[0]);Object.assign(room,{players,status:'playing',challengeTimerEnabled:false,turn:0,deck:Array(18).fill('lord'),discard:[],log:[],treasuryMode});
 if(treasuryMode)Object.assign(room,{totalCoins:21,treasuryCoins:21-players.reduce((n,p)=>n+p.coins,0),economyWinThreshold:12});
 return room;
}
function declare(room){
 assert(game.performAction(room,'Kingpin','extort','Magistrate').ok);
 assert(game.passChallenge(room,'Magistrate').ok);assert(game.passChallenge(room,'Observer').ok);
 assert.equal(room.pending.kind,'counterOffer');assert(game.chooseCounter(room,'Magistrate','magistrate').ok);assert.equal(room.pending.kind,'counterClaim');
}
const invariant=room=>assert(game.treasuryInvariant(room),'All Treasury coins are conserved');
for(const mode of [false,true]){
 // Exactly 2 coins can pay; 0 or 1 must lose one influence without partial payment.
 for(const coins of [0,1,2,5]){
  const room=fixture(coins,mode),[attacker,defender]=room.players,initial=room.treasuryCoins;
  declare(room);const before={room:game.publicState(room),you:game.privateState(room,'Kingpin')};
  assert(game.passChallenge(room,'Kingpin').ok);assert(game.passChallenge(room,'Observer').ok);
  if(coins<2){
   assert.equal(room.pending.kind,'lose');assert.equal(room.pending.loserId,'Kingpin');assert.equal(room.pending.lossCount||1,1);
   assert.equal(attacker.coins,coins);assert.equal(defender.coins,1,'No partial payment to Magistrate');
   assert.equal(room.treasuryCoins,initial);assert(game.loseInfluence(room,'Kingpin',0).ok);
   assert.equal(attacker.influences.length,1);assert.equal(attacker.coins,coins);assert.equal(defender.coins,2,'Only next-turn Income');
  }else{
   assert.equal(attacker.coins,coins-2);assert.equal(defender.coins,4,'2 paid directly plus 1 next-turn Income');assert.equal(attacker.influences.length,2);
   const effects=feedback.changes(before.room,game.publicState(room),before.you,game.privateState(room,'Kingpin'));
   assert.deepEqual(effects.transfers,[{from:'Kingpin',to:'Magistrate',amount:2}]);
   assert(room.log.some(line=>line.includes('Kingpin pays 2 coins to Magistrate.')));
  }
  assert.equal(room.pending,null);assert.equal(game.publicState(room).turnPlayerId,'Magistrate');
  if(mode)assert.equal(room.treasuryCoins,initial-1,'Only next-turn Income changes Treasury');invariant(room);
 }
 // Underfunded original attackers who fail a challenge lose both automatically.
 for(const coins of [0,1,2,5]){
  const room=fixture(coins,mode),[attacker,defender]=room.players,initial=room.treasuryCoins;declare(room);
  assert(game.challenge(room,'Kingpin').ok);
  if(coins<2){
   assert.equal(attacker.alive,false);assert.equal(attacker.influences.length,0);assert.equal(room.revealedCards.filter(c=>c.playerId==='Kingpin').length,2);
   assert.equal(room.pending,null,'Two losses need no selection');assert.equal(defender.coins,2,'Counter cannot collect an unaffordable payment');
   if(mode)assert.equal(room.treasuryCoins,initial+coins-1,'Eliminated attacker returns remaining coins, then next Income');
  }else{
   assert.equal(game.lossDecision(room,'Kingpin').loserId,'Kingpin');assert.equal(game.lossDecision(room,'Kingpin').lossCount||1,1);assert.equal(attacker.coins,coins-2,'Payment precedes the choice');assert(game.loseInfluence(room,'Kingpin',1).ok);
   assert.equal(attacker.alive,true);assert.equal(attacker.influences.length,1);assert.equal(attacker.coins,coins-2);assert.equal(defender.coins,4);
   if(mode)assert.equal(room.treasuryCoins,initial-1);
  }
  assert.equal(room.pending,null);assert.equal(game.publicState(room).turnPlayerId,'Magistrate');assert.equal(room.turnNumber,1,'Advance only once');invariant(room);
 }
 // A third-party challenge costs that player only one; the attacker separately pays or loses one.
 for(const coins of [0,1,2]){
  const room=fixture(coins,mode),[attacker,defender,observer]=room.players;declare(room);assert(game.challenge(room,'Observer').ok);
  assert.equal(game.lossDecision(room,'Observer').loserId,'Observer');assert.equal(game.lossDecision(room,'Observer').lossCount||1,1);assert(game.loseInfluence(room,'Observer',0).ok);
  assert.equal(observer.influences.length,1);assert.equal(observer.alive,true);
  if(coins<2){assert.equal(room.pending.loserId,'Kingpin');assert.equal(room.pending.lossCount||1,1);assert(game.loseInfluence(room,'Kingpin',0).ok);assert.equal(attacker.influences.length,1);assert.equal(defender.coins,2);}
  else{assert.equal(attacker.coins,0);assert.equal(attacker.influences.length,2);assert.equal(defender.coins,4);}
  assert.equal(room.pending,null);invariant(room);
 }
 // A correct challenge of a bluff never applies the underfunded double penalty.
 for(const coins of [0,1]){
  const room=fixture(coins,mode);room.players[1].influences=['courtesan','swordsman'];declare(room);assert(game.challenge(room,'Kingpin').ok);
  assert.equal(room.pending.loserId,'Magistrate');assert(game.loseInfluence(room,'Magistrate',0).ok);
  assert.equal(room.players[0].influences.length,2);assert.equal(room.players[0].alive,true);assert.equal(room.pending,null);invariant(room);
 }
 // The last influence is lost automatically, even when two losses are owed.
 for(const challenge of [false,true]){
  const room=fixture(1,mode);room.players[0].influences=['kingpin'];room.players[0].intrigueVisibility=[0];declare(room);
  if(challenge)assert(game.challenge(room,'Kingpin').ok);
  else{assert(game.passChallenge(room,'Kingpin').ok);assert(game.passChallenge(room,'Observer').ok);}
  assert.equal(room.players[0].alive,false);assert.equal(room.pending,null);assert.equal(room.revealedCards.filter(c=>c.playerId==='Kingpin').length,1);invariant(room);
 }
}
assert.equal(game.ROLES.magistrate.counterEffect,'Counter Extort; Target must pay you 2 coins or lose an influence.');
assert.match(i18n.roleEffect('magistrate','counter','jp'),/あなたに2コイン/);
assert.match(i18n.translate('Magistrate uses Enforce against Kingpin’s Extort. Kingpin pays 2 coins to Magistrate.','jp'),/KingpinがMagistrateに2コイン/);
assert.match(i18n.translate('Kingpin cannot pay Enforce and must lose both influences.','jp'),/2コインを支払えず/);
console.log('2-coin Enforce: 0/1/2/5 coin boundaries, direct payments, one/double loss, third-party and successful challenges, last-card auto loss, turn order, EN/JP and Treasury conservation passed.');
