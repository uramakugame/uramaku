'use strict';
const assert=require('node:assert/strict'),harness=require('../helpers/server-harness'),game=require('../../shared/game');
const h=harness({RATE_PACKETS_PER_SEC:'1000',RATE_IP_PACKETS_PER_SEC:'2000'});
try{
 const clients=['a','b','c'].map(id=>h.client(id)),created=clients[0].send('createRoom',{nickname:'A'}),code=created.code;
 for(let n=1;n<clients.length;n++){clients[n].send('joinRoom',{code,nickname:clients[n].id.toUpperCase()});clients[n].send('ready',{ready:true});}
 clients[0].send('setTreasuryMode',{enabled:true});clients[0].send('setChallengeTimer',{enabled:false});clients[0].send('startGame');
 const room=h.rooms.get(code);room.treasuryCoins=0;room.players.forEach(p=>{p.coins=6;p.influences=['kingpin','magistrate'];});
 const current=()=>room.players.filter(p=>p.alive)[room.turn].id,actor=clients.find(p=>p.id===current()),other=clients.find(p=>p.id!==actor.id),target=room.players.find(p=>p.id!==actor.id);
 let before=JSON.stringify(room);assert(other.send('action',{action:'loot',targetId:actor.id}).error);assert.equal(JSON.stringify(room),before,'Forged off-turn Loot is rejected before any save, transfer or revision');
 for(const kind of ['claim','counterClaim','counterOffer','summon','information','lose']){
  room.pending={kind,claimantId:actor.id,targetId:target.id};before=JSON.stringify(room);assert(actor.send('action',{action:'loot',targetId:target.id}).error);assert.equal(JSON.stringify(room),before,'Loot cannot interrupt '+kind);
 }
 room.pending=null;room.challengeLosses=[{loserId:actor.id,kind:'lose'}];before=JSON.stringify(room);assert(actor.send('action',{action:'loot',targetId:target.id}).error);assert.equal(JSON.stringify(room),before);room.challengeLosses=[];
 assert(actor.send('action',{action:'loot',targetId:target.id}).ok);assert.equal(room.players.find(p=>p.id===actor.id).coins,7);assert.equal(room.players.find(p=>p.id===target.id).coins,5);assert.notEqual(current(),actor.id);assert(game.treasuryInvariant(room));
 before=JSON.stringify(room);assert(actor.send('action',{action:'loot',targetId:target.id}).error);assert.equal(JSON.stringify(room),before,'A repeated action cannot steal a second coin');
 const saved=h.store.loadAll()[0];assert.equal(saved.players.find(p=>p.id===actor.id).coins,7);assert.equal(saved.turnNumber,room.turnNumber);
 console.log('Socket/SQLite Loot: current turn only, every pending decision/penalty guarded, exactly one coin and one consumed turn, repeated/stale requests leave snapshots unchanged.');
}finally{h.close();}
