'use strict';
const assert=require('node:assert/strict');const harness=require('../helpers/server-harness');const game=require('../../server/game');const {cloneRoom}=require('../../server/room-store');
const h=harness({RATE_PACKETS_PER_SEC:'1000',RATE_IP_PACKETS_PER_SEC:'2000'});
try{
 const clients=['host','a','b','c'].map(id=>h.client(id));const made=clients[0].send('createRoom',{nickname:'Host'}),code=made.code;
 const tokens={host:made.resumeToken};for(let n=1;n<4;n++){tokens[clients[n].id]=clients[n].send('joinRoom',{code,nickname:clients[n].id}).resumeToken;clients[n].send('ready',{ready:true});}
 clients[0].send('setChallengeTimer',{enabled:false});clients[0].send('startGame');const room=h.rooms.get(code);
 assert(clients[1].send('kickPlayer',{targetId:'b'}).error);assert(clients[0].send('kickPlayer',{targetId:'host'}).error);assert(room.players.find(p=>p.id==='a').connected);
 clients[1].disconnect();const refreshed=h.client('fresh-a');assert(refreshed.send('resumeSession',{code,token:tokens.a}).ok);
 assert(room.players.find(p=>p.id==='a').connected);const online=JSON.stringify(room);assert(clients[0].send('kickPlayer',{targetId:'a'}).error);assert.equal(JSON.stringify(room),online,'Reconnected players cannot be kicked');refreshed.disconnect();
 const before=JSON.stringify(room),credential=room.seatTokens.get('a'),broadcasts=clients[0].events.length;
 h.store.beforeCommit=()=>{throw Error('disk unavailable');};assert(clients[0].send('kickPlayer',{targetId:'a'}).error);h.store.beforeCommit=null;
 assert.equal(JSON.stringify(room),before);assert.equal(room.seatTokens.get('a'),credential);assert(!clients[0].events.slice(broadcasts).some(e=>e.event==='state'));
 const expected=cloneRoom(room);expected.players.find(p=>p.id==='a').connected=false;assert(game.forfeitPlayer(expected,'a').ok);
 assert(clients[0].send('kickPlayer',{targetId:'a'}).ok);assert(!room.seatTokens.has('a'));assert.equal(room.players.find(p=>p.id==='a').alive,false);assert.equal(room.players.find(p=>p.id==='a').connected,false);assert(!refreshed.events.some(e=>e.event==='kicked'));
 assert.deepEqual(room.players,expected.players);assert.deepEqual(room.pending,expected.pending);assert.equal(room.turn,expected.turn);assert.equal(room.hostId,'host');
 assert(h.client('revoked-a').send('resumeSession',{code,token:tokens.a}).error);
 assert(!h.store.loadAll()[0].seatTokens.has('a'),'Seat revocation survives persistence');
 // A pending owed challenge loss survives removal of its claimant. The engine
 // handles the continuation; the host control must not shortcut it.
 const actor=room.players.find(p=>p.alive&&p.id!=='host');room.players.forEach(p=>{if(p.alive){p.influences=['lord','magistrate'];p.coins=3;}});
 room.turn=room.players.filter(p=>p.alive).findIndex(p=>p.id===actor.id);room.pending=null;
 const attacker=clients.find(s=>s.id===actor.id);assert(attacker.send('action',{action:'tax'}).ok);assert(clients[0].send('challenge').ok);assert.equal(game.lossDecision(room,'host').kind,'lose');assert.equal(game.lossDecision(room,'host').loserId,'host');
 attacker.disconnect();assert(clients[0].send('kickPlayer',{targetId:actor.id}).ok);assert.equal(game.lossDecision(room,'host').kind,'lose');assert.equal(game.lossDecision(room,'host').loserId,'host');assert(clients[0].send('loseInfluence',{cardIndex:0}).ok);
 console.log('Owner-only offline kick, reconnect protection, atomic rollback, normal forfeit continuation, durable token revocation and owed challenge loss passed.');
}finally{h.close();}
