'use strict';
const assert=require('node:assert/strict'),game=require('../../server/game'),feedback=require('../../public/js/components/game-feedback');
const p=(id,hand)=>({id,name:id,alive:true,ready:true,connected:true,coins:3,influences:[...hand],intrigueVisibility:hand.map(()=>0),privateInvestigations:{}});
function fixture(){const players=[p('a',['lord','magistrate']),p('b',['courtesan','kingpin']),p('c',['assassin','swordsman'])],room=game.createGame('MOVE',players[0]);Object.assign(room,{players,status:'playing',challengeTimerEnabled:false,deck:['lord','kingpin'],log:[]});return room;}
const view=(room,id='a')=>JSON.parse(JSON.stringify([game.publicState(room),game.privateState(room,id)]));
const changes=(a,b)=>feedback.changes(a[0],b[0],a[1],b[1]);
const pass=(r,id)=>{for(const p of r.players)if(p.alive&&p.id!==id)assert(game.passChallenge(r,p.id).ok);};
for(const slot of [0,1]){
 const r=fixture(),before=view(r),observer=view(r,'b');assert(game.performAction(r,'a','summon').ok);pass(r,'a');assert(game.chooseSummon(r,'a','replace',slot).ok);
 assert.equal(r.cardMoveNumber,1);assert.deepEqual(game.publicState(r).cardMoves,[{number:1,playerId:'a',slot,reason:'summon'}],'Only physical slot is public, neither discarded nor drawn role');
 const effect=changes(before,view(r));assert.equal(effect.motions.length,1);assert.equal(effect.motions[0].slot,slot);assert.equal(effect.motions[0].fromRole,before[1].influences[slot]);
 const other=changes(observer,view(r,'b'));assert.equal(other.motions[0].slot,slot);assert.equal(other.motions[0].fromRole,null,'Uninvolved viewer receives no private discarded role');
 assert.deepEqual(changes(view(r),view(r)).motions,[]);assert.deepEqual(feedback.changes(null,game.publicState(r),null,game.privateState(r,'a')).motions,[]);
}
{
 const r=fixture(),before=view(r,'c');assert(game.performAction(r,'a','tax').ok);assert(game.challenge(r,'b').ok);
 assert.deepEqual(game.publicState(r).cardMoves,[{number:1,playerId:'a',slot:0,reason:'proof',shownRole:'lord'}]);
 const effect=changes(before,view(r,'c'));assert.equal(effect.motions[0].fromRole,'lord','The proof role was publicly revealed');assert.equal(effect.motions[0].slot,0);assert(!JSON.stringify(game.publicState(r).cardMoves).includes('kingpin'),'Replacement identity is absent from movement metadata');
}
{
 const r=fixture();r.players[0].influences=['lord','courtesan'];const before=view(r,'c');assert(game.performAction(r,'a','intrigue','b').ok);assert(game.challenge(r,'c').ok);assert.equal(changes(before,view(r,'c')).motions[0].slot,1,'Proof targets the role’s actual slot');
}
{
 const r=fixture();assert(game.performAction(r,'a','summon').ok);pass(r,'a');const before=view(r),observer=view(r,'b');assert(game.chooseSummon(r,'a','discard').ok);
 assert.equal(r.cardMoveNumber,0);assert.deepEqual(changes(before,view(r)).motions,[{id:'a',kind:'discard',fromRole:'kingpin',faction:null}]);assert.deepEqual(changes(observer,view(r,'b')).motions,[]);assert.deepEqual(r.players[0].influences,['lord','magistrate']);
}
{
 const r=fixture();r.status='lobby';for(const p of r.players)p.influences=[];const before=view(r);game.startGame(r);const effect=changes(before,view(r));assert.equal(effect.motions.filter(m=>m.kind==='deal').length,6);assert.equal(effect.motions.filter(m=>m.id==='a').length,2);assert.equal(new Set(effect.motions.map(m=>m.id+':'+m.slot)).size,6);assert.deepEqual(changes(view(r),view(r)).motions,[]);
}
{
 const r=fixture();r.treasuryMode=true;r.totalCoins=21;r.treasuryCoins=12;r.economyWinThreshold=12;const stale=view(r,'spectator');
 for(let n=0;n<30;n++){const id=game.publicState(r).turnPlayerId;assert(game.performAction(r,id,'summon').ok);pass(r,id);assert(game.chooseSummon(r,id,'replace',0).ok);assert(game.treasuryInvariant(r));}
 assert.equal(r.cardMoveNumber,30);assert.equal(r.cardMoves.length,24);assert.equal(r.cardMoves[0].number,7);assert(r.cardMoves.every(m=>!Object.hasOwn(m,'shownRole')));assert.deepEqual(changes(stale,view(r,'spectator')).motions,[],'Do not replay a backlog of old exchanges');
}
console.log('Presentation events: correct Summon/proof slots, same-role exchanges, discard privacy, opening deals, no replay, bounded history and Treasury conservation passed.');
