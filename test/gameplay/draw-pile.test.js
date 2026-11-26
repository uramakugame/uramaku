'use strict';
const assert=require('node:assert/strict'),game=require('../../server/game'),feedback=require('../../public/js/components/game-feedback');
const person=(id,hand=['lord','magistrate'])=>({id,name:id,coins:3,alive:true,ready:true,connected:true,influences:hand,intrigueVisibility:hand.map(()=>0),privateInvestigations:{}});
function fixture(){const r=game.createGame('DECK',person('a'));Object.assign(r,{status:'playing',challengeTimerEnabled:false,revealFactions:true,players:[person('a'),person('b',['kingpin','courtesan'])],deck:['kingpin','lord','assassin'],discard:[]});return r;}
const pile=r=>game.publicState(r).drawPile;
const faction=role=>['lord','swordsman','magistrate'].includes(role)?'order':'underworld';
for(let seats=2;seats<=6;seats++)for(const visible of [false,true]){
 const r=game.createGame('START',person('0',[]));r.players=Array.from({length:seats},(_,i)=>person(String(i),[]));r.revealFactions=visible;game.startGame(r);
 assert.equal(pile(r).count,18-seats*2);assert.equal(pile(r).topFaction,visible?faction(r.deck.at(-1)):null);assert.equal(pile(r).reshufflePending,false);
 assert.deepEqual(Object.keys(pile(r)).sort(),['count','reshufflePending','topFaction'],'Only count and public back metadata cross the wire');
}
for(const role of ['lord','swordsman','magistrate','courtesan','kingpin','assassin']){
 const r=fixture();r.deck=['lord',role];const before=JSON.stringify(r);assert.equal(pile(r).topFaction,faction(role));assert.equal(JSON.stringify(r),before,'Inspecting the deck never draws or shuffles');r.revealFactions=false;assert.deepEqual(pile(r),{count:2,topFaction:null,reshufflePending:false});
}
// Both public piles expose backs only; reading or reconnecting does not draw.
for(const role of ['lord','swordsman','magistrate','courtesan','kingpin','assassin'])for(const visible of [false,true]){
 const r=fixture();r.revealFactions=visible;r.discard=['lord',role];const before=JSON.stringify(r),snapshot=game.publicState(r);
 assert.deepEqual(snapshot.discardPile,{count:2,topFaction:visible?faction(role):null});assert.deepEqual(Object.keys(snapshot.discardPile).sort(),['count','topFaction']);assert.equal(JSON.stringify(r),before);assert(!Object.values(snapshot.discardPile).includes(role),'The discarded role stays hidden');
 const restored=JSON.parse(before);assert.deepEqual(game.publicState(restored).discardPile,snapshot.discardPile,'Restoring the saved discard order restores its top back');
 r.discard=[];assert.deepEqual(game.publicState(r).discardPile,{count:0,topFaction:null});
}
for(const choice of ['replace','discard']){
 const r=fixture();assert(game.performAction(r,'a','summon').ok);assert.equal(pile(r).count,3,'Claiming Summon does not draw during the challenge');const declared=game.publicState(r),oldYou=game.privateState(r,'a');assert(game.passChallenge(r,'b').ok);const drawn=feedback.changes(declared,game.publicState(r),oldYou,game.privateState(r,'a')).motions.find(m=>m.kind==='draw');assert.equal(drawn.faction,'underworld','The moving preview keeps the drawn card’s back, while the deck shows the next faction');assert.deepEqual(pile(r),{count:2,topFaction:'order',reshufflePending:false});
 assert.equal(game.privateState(r,'a').summonDrawnRole,'assassin');assert.equal(game.privateState(r,'b').summonDrawnRole,null);assert(!Object.hasOwn(game.publicState(r).pending,'drawnRole'));assert(!Object.values(pile(r)).includes('assassin'),'The next back must never disclose the previous private draw');
 const preview=game.publicState(r),ownerBefore=game.privateState(r,'a'),observerBefore=game.privateState(r,'b');
 assert(game.chooseSummon(r,'a',choice,choice==='replace'?1:undefined).ok);assert.equal(pile(r).count,2,'Choosing a Summon result does not count the preview or reusable discard as draw-pile cards');assert.equal(r.discard.length,1);
 const after=game.publicState(r),owner=feedback.changes(preview,after,ownerBefore,game.privateState(r,'a')),observer=feedback.changes(preview,after,observerBefore,game.privateState(r,'b'));
 assert.equal(after.discardPile.topFaction,choice==='replace'?'order':'underworld');
 if(choice==='replace'){assert.equal(owner.motions[0].oldFaction,'order');assert.equal(owner.motions[0].faction,'underworld');assert.equal(observer.motions[0].oldFaction,'order');assert.equal(observer.motions[0].fromRole,null);}
 else{assert.equal(owner.motions[0].faction,'underworld');assert.equal(observer.pileDiscard,true);assert.equal(observer.pileDiscardFaction,'underworld');assert.deepEqual(observer.motions,[],'An observer sees only the discarded back, never the rejected role');}
}
{
 const r=fixture();r.deck=['courtesan','swordsman','assassin'];assert(game.performAction(r,'a','summon').ok);assert(game.challenge(r,'b').ok);assert.equal(pile(r).count,2,'Only proof replacement happens before the penalty choice');assert.equal(pile(r).topFaction,'order');assert.equal(game.privateState(r,'a').summonDrawnRole,null);assert(game.loseInfluence(r,'b',0).ok);assert.equal(pile(r).count,1,'Resolving Summon then draws its separate preview');assert.equal(pile(r).topFaction,'underworld');assert.equal(game.privateState(r,'a').summonDrawnRole,'swordsman');
}
{
 const r=fixture();r.deck=[];r.discard=['lord','courtesan'];const original=JSON.stringify(r);assert.deepEqual(pile(r),{count:0,topFaction:null,reshufflePending:true});assert.equal(JSON.stringify(r),original,'An empty-pile preview must not decide the shuffle early');assert(game.performAction(r,'a','summon').ok);assert(game.passChallenge(r,'b').ok);assert.equal(pile(r).count,1);assert.equal(pile(r).topFaction,faction(r.deck.at(-1)));assert.equal(pile(r).reshufflePending,false);assert.equal(r.discard.length,0);
}
{
 const r=fixture();r.deck=[];assert.deepEqual(pile(r),{count:0,topFaction:null,reshufflePending:false});assert(game.performAction(r,'a','summon').ok);assert(game.passChallenge(r,'b').ok);assert.equal(r.pending,null);assert.equal(pile(r).count,0,'A fully exhausted deck invents no cards');
}
{
 const r=fixture();r.players[0].coins=7;const old=pile(r);assert(game.performAction(r,'a','purge','b').ok);assert(game.loseInfluence(r,'b',0).ok);assert.deepEqual(pile(r),old,'Permanent influence loss never returns a card to the draw pile');
}
console.log('Draw-pile counts for 2–6 players, top faction only when enabled, private previews, proof/Summon draws, empty piles, lazy reshuffles and read-only snapshots passed.');
