'use strict';
const assert=require('node:assert/strict');const harness=require('../helpers/server-harness');
const {updateLifecycle,shouldRemove}=require('../../server/room-lifecycle');
let now=1000000;const original=Date.now;Date.now=()=>now;
const h=harness();
try{
 const host=h.client('host'),peer=h.client('peer'),viewer=h.client('viewer');
 const made=host.send('createRoom',{nickname:'Host'}),code=made.code;peer.send('joinRoom',{code,nickname:'Peer'});viewer.send('joinSpectator',{code,nickname:'Viewer'});
 const room=h.rooms.get(code);now+=600000;h.sweep();assert(h.rooms.has(code),'A quiet connected lobby never expires');
 const unchanged=h.store.db.prepare('SELECT total_changes() n').get().n;h.sweep();assert.equal(h.store.db.prepare('SELECT total_changes() n').get().n,unchanged,'Idle maintenance performs no writes');
 host.disconnect();peer.disconnect();assert.equal(room.hostId,'host','Disconnect never transfers ownership');assert.equal(room.emptyLobbySince,null,'A spectator keeps the room occupied');
 viewer.disconnect();const first=room.emptyLobbySince;assert.equal(first,now);
 now+=299999;h.sweep();assert(h.rooms.has(code));
 const back=h.client('back');assert(back.send('resumeSession',{code,token:made.resumeToken}).ok);assert.equal(room.emptyLobbySince,null);
 back.disconnect();assert.equal(room.emptyLobbySince,now);now+=299999;h.sweep();assert(h.rooms.has(code));now++;
 const intent=h.client('intent').send('prepareEntry',{kind:'join',code,nickname:'Future'});assert(intent.intentId);
 const saved=JSON.stringify(room);h.store.beforeCommit=()=>{throw Error('simulated disk failure');};h.sweep();assert(h.rooms.has(code));assert.equal(JSON.stringify(room),saved);assert.equal(h.store.loadAll().find(r=>r.code===code).emptyLobbySince,room.emptyLobbySince);
 h.store.beforeCommit=null;h.sweep();assert(!h.rooms.has(code));
 for(const table of ['rooms','seat_credentials','command_receipts','entry_intents'])assert.equal(h.store.db.prepare(`SELECT count(*) n FROM ${table}`).get().n,0,table+' cascades/revokes atomically');
 assert(h.client('expired').send('resumeSession',{code,token:made.resumeToken}).error);
 const a=h.client('active-a'),b=h.client('active-b'),active=a.send('createRoom',{nickname:'A'});b.send('joinRoom',{code:active.code,nickname:'B'});b.send('ready',{ready:true});a.send('setChallengeTimer',{enabled:false});a.send('startGame');
 const game=h.rooms.get(active.code);const actor=game.players.find(p=>p.id===game.players[game.turn].id);(actor.id==='active-a'?a:b).send('action',{action:'summon'});
 a.disconnect();b.disconnect();const pending=JSON.stringify(game.pending);now+=86400000;h.sweep();assert(h.rooms.has(active.code));assert.equal(JSON.stringify(game.pending),pending,'Offline active games retain unresolved choices');
 // Completed games stay while any player OR spectator is connected.
 const c=h.client('c'),d=h.client('d'),v=h.client('v');const done=c.send('createRoom',{nickname:'C'});d.send('joinRoom',{code:done.code,nickname:'D'});v.send('joinSpectator',{code:done.code,nickname:'V'});
 const finished=h.rooms.get(done.code);finished.status='finished';c.disconnect();d.disconnect();assert(h.rooms.has(done.code));v.disconnect();assert(!h.rooms.has(done.code));
 const expiredIntent=h.client('intent2').send('prepareEntry',{kind:'create',nickname:'Pending'});now+=120000;h.sweep();assert.equal(h.store.entry(expiredIntent.intentId),undefined);assert.equal(h.store.db.prepare('SELECT count(*) n FROM entry_intents').get().n,0);
 const metadata={status:'lobby',players:[],spectators:[],emptyLobbySince:123};updateLifecycle(metadata,1000);assert.equal(metadata.emptyLobbySince,123);assert(shouldRemove(metadata,300123,300000),'Restart must not renew an already empty lobby');
 console.log('Continuous five-minute abandonment, spectator presence, reconnect reset, no idle writes, failed-delete rollback, credential/intent cleanup and offline active-game retention passed.');
}finally{h.close();Date.now=original;}
