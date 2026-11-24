const assert = require('node:assert/strict');
const game = require('../../server/game');
const {newSeatToken,resumeSeat} = require('../../server/session');
const make=(id,influences=['lord','swordsman'],coins=3)=>({id,name:id,alive:true,ready:true,connected:true,influences,coins});
const roomWith=(players)=>{
 const r=game.createGame('TEST',players[0]);
 r.players=players;r.status='playing';r.turn=0;r.pending=null;
 r.deck=['magistrate','lord','kingpin'];r.discard=[];r.log=[];return r;
};
// An influence that did not change must retain its public and private identity.
{
 const a=make('a',['lord','swordsman']),b=make('b',['courtesan','kingpin']),c=make('c',['assassin','magistrate']);
 const r=roomWith([a,b,c]);
 a.intrigueVisibility=[3,3];
 r.sharedInvestigations=[{playerId:'a',playerName:'a',indices:[0,1],roles:['lord','swordsman'],investigatorName:'b'}];
 b.privateInvestigations={a:{0:'lord',1:'swordsman'}};
 c.privateInvestigations={a:{1:'swordsman'}};
 b.lastInvestigation={playerId:'a',playerName:'a',indices:[0,1],roles:['lord','swordsman']};
 assert(game.performAction(r,'a','tax').ok);
 assert(game.challenge(r,'b').ok);  // Genuine Lord is proven; its slot is replaced.
 assert.equal(game.lossDecision(r,'b').kind,'lose');
 assert.equal(a.influences[1],'swordsman');
 assert.notEqual(a.influences[0],'lord');
 assert.equal(a.intrigueVisibility[0],0);
 assert.equal(a.intrigueVisibility[1],3);
 assert.deepEqual(r.sharedInvestigations[0].indices,[1]);
 assert.deepEqual(r.sharedInvestigations[0].roles,['swordsman']);
 assert.deepEqual(b.privateInvestigations.a,{1:'swordsman'});
 assert.deepEqual(c.privateInvestigations.a,{1:'swordsman'});
 assert.deepEqual(b.lastInvestigation.indices,[1]);
 assert(game.privateState(r,'b').intrigueEligibleTargets.includes('a'));
 assert.equal(game.publicState(r).sharedInvestigations[0].roles[0],'swordsman');
}
// A third-party discovery of the other slot is not erased when this player proves a role.
{
 const a=make('a',['swordsman','swordsman'],6),b=make('b',['courtesan','magistrate']);
 const r=roomWith([a,b]);r.turn=0;
 a.intrigueVisibility=[2,2];
 r.sharedInvestigations=[{playerId:'a',playerName:'a',indices:[0,1],roles:['swordsman','swordsman'],investigatorName:'b'}];
 b.privateInvestigations={a:{0:'swordsman',1:'swordsman'}};
 assert(game.performAction(r,'a','hireBlade','b').ok);
 assert(game.challenge(r,'b').ok);
 assert.equal(a.intrigueVisibility[0],0);
 assert.equal(a.intrigueVisibility[1],2);
 assert.deepEqual(r.sharedInvestigations[0].indices,[1]);
 assert.deepEqual(b.privateInvestigations.a,{1:'swordsman'});
}
// The socket-exposed end-turn request cannot skip a player or interrupt a decision.
{
 const r=roomWith([make('a'),make('b'),make('c')]);
 assert.equal(game.requestEndTurn(r,'b').ok,false);
 assert.equal(game.requestEndTurn(r,'a').ok,false);
 assert(game.performAction(r,'a','tax').ok);
 assert.equal(r.pending.kind,'claim');
 assert.equal(game.requestEndTurn(r,'a').ok,false);
 assert.equal(r.pending.kind,'claim');
 assert.equal(game.publicState(r).turnPlayerId,'a');
}
// Reconnect tokens must be unguessable, private and tied to the original seat.
{
 const host=make('host');const guest=make('guest');
 const r=roomWith([host,guest]);
 const a=newSeatToken(r,host.id);
 const b=newSeatToken(r,guest.id);
 assert.notEqual(a,b);assert.equal(a.length,64);
 assert(!JSON.stringify(game.publicState(r)).includes(a));
 const old={data:{playerId:'host',room:'TEST'},disconnect(k){this.closed=k;}};
 const sockets=new Map([['host',old]]);
 const replacement={data:{}};
 assert.equal(resumeSeat(r,'incorrect',replacement,sockets).ok,false);
 assert.equal(resumeSeat(r,b,replacement,sockets).ok,true);
 assert.equal(replacement.data.playerId,'guest');
 assert.equal(resumeSeat(r,a,replacement,sockets).ok,true);
 assert.equal(replacement.data.playerId,'host');
 assert.equal(old.closed,true);
 assert.equal(old.data.playerId,null);
 assert.equal(sockets.get('host'),replacement);
 assert.equal(host.connected,true);
}
console.log('Reconnect authentication, server turn guards, and per-slot intel preservation passed.');
