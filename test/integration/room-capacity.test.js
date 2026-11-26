'use strict';
const assert=require('node:assert/strict'),harness=require('../helpers/server-harness');
const h=harness({RATE_PACKETS_PER_SEC:'1000',RATE_IP_PACKETS_PER_SEC:'2000'});
try{
 const host=h.client('host'),guest=h.client('guest'),watch=h.client('watch'),a=h.client('a'),b=h.client('b');
 const made=host.send('createRoom',{nickname:'Host'}),code=made.code,room=h.rooms.get(code);
 assert.equal(room.maxPlayers,6);assert(host.send('setMaxPlayers',{maxPlayers:3}).ok);host.send('setRoomDetails',{visibility:'public'});
 guest.send('joinRoom',{code,nickname:'Guest'});watch.send('joinSpectator',{code,nickname:'Watch'});
 const before=JSON.stringify(room);for(const client of [guest,watch])assert(client.send('setMaxPlayers',{maxPlayers:6}).error);assert.equal(JSON.stringify(room),before);
 for(const maxPlayers of [1,7,8,3.3,'4',null,{}]){assert(host.send('setMaxPlayers',{maxPlayers}).error);assert.equal(JSON.stringify(room),before);}
 const pa=a.send('prepareEntry',{kind:'join',code,nickname:'A'}),pb=b.send('prepareEntry',{kind:'join',code,nickname:'B'});assert(pa.resumeToken&&pb.resumeToken);
 assert(a.send('confirmEntry',{code,token:pa.resumeToken,intentId:pa.intentId}).ok);assert(b.send('confirmEntry',{code,token:pb.resumeToken,intentId:pb.intentId}).error);
 assert.equal(room.players.length,3);assert.equal(host.send('listRooms').rooms.length,0);assert(host.send('setMaxPlayers',{maxPlayers:2}).error);
 assert(host.send('setMaxPlayers',{maxPlayers:4}).ok);assert.equal(host.send('listRooms').rooms[0].maxPlayers,4);assert.equal(h.store.loadAll()[0].maxPlayers,4);
 guest.send('ready',{ready:true});a.send('ready',{ready:true});assert(host.send('startGame').ok);assert.equal(room.deck.length,12);assert(host.send('setMaxPlayers',{maxPlayers:6}).error);assert.equal(h.store.loadAll()[0].maxPlayers,4);
 // Each room retains its own limit; spectators do not consume seats.
 const other=h.client('other'),second=other.send('createRoom',{nickname:'Other'});assert(other.send('setMaxPlayers',{maxPlayers:2}).ok);assert.equal(h.rooms.get(second.code).maxPlayers,2);assert.equal(room.maxPlayers,4);
 console.log('Authenticated capacity setting, public listings/full filtering, prepared-final-seat race, unchanged membership, persistent lobby/match setting and room isolation passed.');
}finally{h.close();}
