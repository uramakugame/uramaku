const assert=require('node:assert/strict');
const {createGame,publicState,performAction,forfeitPlayer,removeLobbyPlayer,passChallenge}=require('../../server/game');
const {newSeatToken,resumeSeat}=require('../../server/session');
const seat=(id,roles=['lord','swordsman'])=>({id,name:id,alive:true,ready:true,connected:true,coins:5,influences:[...roles],intrigueVisibility:[0,0],privateInvestigations:{}});
function running(){const a=seat('a'),b=seat('b'),c=seat('c');const room=createGame('TEST',a);room.players=[a,b,c];room.status='playing';room.turn=0;room.deck=['assassin','magistrate','kingpin'];room.discard=[];return room;}
// The host can remove a guest during setup but cannot remove themselves.
{
 const a=seat('a'),b=seat('b'),c=seat('c');const r=createGame('TEST',a);r.players.push(b,c);
 assert.equal(removeLobbyPlayer(r,'b','c').ok,false);
 assert.equal(removeLobbyPlayer(r,'a','a').ok,false);
 assert.equal(removeLobbyPlayer(r,'a','missing').ok,false);
 const token=newSeatToken(r,'b');assert.equal(removeLobbyPlayer(r,'a','b').ok,true);
 assert.equal(r.players.length,2);assert(!r.players.some(p=>p.id==='b'));
 r.seatTokens.delete('b');
 assert.equal(resumeSeat(r,token,{data:{}},new Map()).ok,false);
 r.status='playing';assert.equal(removeLobbyPlayer(r,'a','c').ok,false);
}
// Forfeiting on your turn eliminates both influences, then gives the next
// surviving player a normal turn and its passive Income.
{
 const r=running();assert.equal(performAction(r,'a','tax').ok,true);
 assert.equal(r.pending.kind,'claim');
 assert.equal(forfeitPlayer(r,'a').ok,true);
 assert.equal(r.pending,null);
 assert.equal(r.players[0].alive,false);
 assert.equal(r.revealedCards.filter(x=>x.playerId==='a').length,2);
 assert.equal(publicState(r).turnPlayerId,'b');
 assert.equal(r.players[1].coins,6);
 assert.equal(performAction(r,'b','earn').ok,true);
}
// Forfeiting the targeted counter-decision player must free the table.
{
 const r=running();assert(performAction(r,'a','assassinate','b').ok);
 assert(passChallenge(r,'b').ok);assert(passChallenge(r,'c').ok);
 assert.equal(r.pending.kind,'counterOffer');
 assert(forfeitPlayer(r,'b').ok);
 assert.equal(r.pending,null);
 assert.equal(publicState(r).turnPlayerId,'c');
}
// When a spectator/third party leaves, the active player's turn survives.
{
 const r=running();assert(forfeitPlayer(r,'c').ok);
 assert.equal(publicState(r).turnPlayerId,'a');
 assert.equal(r.pending,null);assert.equal(r.players[0].coins,5);
}
// A player leaving a pending challenge removes them from eligible voters.
{
 const r=running();assert(performAction(r,'a','tax').ok);
 assert(passChallenge(r,'b').ok); // c is the last response required
 assert(forfeitPlayer(r,'c').ok);
 assert.equal(r.pending,null);
 assert.equal(r.players[0].coins,7); // Tax was allowed through
 assert.equal(publicState(r).turnPlayerId,'b');
}
// Final survivor wins immediately; no pending decisions or ghost turns.
{
 const a=seat('a'),b=seat('b');const r=createGame('TEST',a);
 r.players=[a,b];r.status='playing';r.turn=0;
 assert(forfeitPlayer(r,'a').ok);
 assert.equal(r.status,'finished');assert.equal(r.winner,'b');
 assert.equal(r.pending,null);
}
console.log('Host kick, seat revocation, voluntary forfeit, game continuation and winner tests passed.');
