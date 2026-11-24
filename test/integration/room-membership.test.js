'use strict';
const assert=require('node:assert/strict');
const harness=require('../helpers/server-harness');
const h=harness(),host=h.client('host'),guest=h.client('guest'),spectator=h.client('viewer');
const first=host.send('createRoom',{nickname:'Host'});
const second=guest.send('createRoom',{nickname:'Guest'});
spectator.send('joinSpectator',{code:first.code,nickname:'Viewer'});
const firstRoom=h.rooms.get(first.code),secondRoom=h.rooms.get(second.code);
for(const client of [host,guest,spectator]){
  for(const [event,data] of [
    ['createRoom',{nickname:'Another'}],['joinRoom',{code:first.code,nickname:'Another'}],
    ['joinSpectator',{code:second.code,nickname:'Another'}],['resumeSession',{code:first.code,token:first.resumeToken}]
  ]){
    const before=JSON.stringify([firstRoom,secondRoom]),membership={...client.data},count=h.rooms.size;
    assert.equal(client.send(event,data).error,'Leave your current room before joining another.');
    assert.deepEqual(client.data,membership);assert.equal(h.rooms.size,count);assert.equal(JSON.stringify([firstRoom,secondRoom]),before);
  }
}
// Wrong credentials cannot bind a fresh connection to an occupied seat.
const stranger=h.client('stranger');assert(stranger.send('resumeSession',{code:first.code,token:'0'.repeat(64)}).error);
assert.equal(stranger.data.playerId,undefined);assert.equal(h.sockets.get('host'),host);
// Refresh restores the exact seat and invalidates the old connection binding.
const refreshed=h.client('refreshed');assert(refreshed.send('resumeSession',{code:first.code,token:first.resumeToken}).ok);
assert.equal(refreshed.data.playerId,'host');assert.equal(host.closed,true);assert.equal(host.data.room,null);
assert.equal(firstRoom.players.length,1);assert.equal(firstRoom.players[0].connected,true);
assert.equal(spectator.send('leaveRoom').ok,true);
const third=spectator.send('createRoom',{nickname:'Free seat'});assert(third.code);assert.equal(h.rooms.get(third.code).players.length,1);
// A disconnected ready seat cannot be started by the remaining host.
const peer=h.client('peer');peer.send('joinRoom',{code:first.code,nickname:'Peer'});peer.send('ready',{ready:true});peer.disconnect();
refreshed.send('startGame');assert.equal(firstRoom.status,'lobby');assert.equal(refreshed.events.at(-1).payload.message,'Everyone must be connected to start.');
console.log('Player/spectator entry guards, authenticated refresh, seat isolation and connected-start requirement passed.');
