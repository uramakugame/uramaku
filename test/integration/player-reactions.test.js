'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {launch,until}=require('../helpers/live-server'),{RoomStore}=require('../../server/room-store'),{validatePacket}=require('../../server/socket-input'),{AbuseGuard,settings}=require('../../server/abuse-guard');
const presets=require('../../shared/reactions');
for(const reaction of presets.ids)assert(validatePacket('reaction',{reaction}));for(const reaction of ['<script>','Challenge','',null,{},1])assert.equal(validatePacket('reaction',{reaction}),false);
let now=1000;const guard=new AbuseGuard(settings(),()=>now),seat={id:'socket-a',data:{playerId:'seat-a'},handshake:{address:'127.0.0.1'}};
assert(guard.allow(seat,'reaction',{}));assert.equal(guard.allow(seat,'reaction',{}),false);now+=3999;assert.equal(guard.allow(seat,'reaction',{}),false);now++;assert(guard.allow(seat,'reaction',{}));assert(guard.allow(seat,'listRooms',{}),'Reaction cooldown does not consume the room-browsing allowance');
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-reactions-')),file=path.join(dir,'state.sqlite');let server,db;
 const ask=(client,event,data={})=>client.timeout(3000).emitWithAck(event,data);
 try{
  server=await launch(file);const host=await server.connect(),guest=await server.connect(),viewer=await server.connect(),other=await server.connect();const room=await ask(host,'createRoom',{nickname:'Owner'}),joined=await ask(guest,'joinRoom',{code:room.code,nickname:'Guest'});await ask(viewer,'joinSpectator',{code:room.code,nickname:'Viewer'});await ask(other,'createRoom',{nickname:'Other'});
  assert((await ask(host,'reaction',{reaction:'thinking'})).error,'Waiting lobbies have no player-board reactions');
  await ask(host,'setChallengeTimer',{enabled:false});await ask(guest,'ready',{ready:true});assert((await ask(host,'startGame')).ok);await until(()=>viewer.state?.room.status==='playing','game began');
  const received=new Map();for(const client of [host,guest,viewer,other]){received.set(client,[]);client.on('reaction',event=>received.get(client).push(event));}
  db=new RoomStore(file);const before=db.db.prepare('SELECT revision,state_json FROM rooms WHERE code=?').get(room.code),ownerId=host.state.you.id;
  // The guest's unused cooldown lets this run immediately after lobby rejection.
  const senderId=guest.state.you.id;assert((await ask(guest,'reaction',{reaction:'wellPlayed',playerId:ownerId})).ok);await until(()=>received.get(viewer).length===1,'viewer received reaction');
  for(const client of [host,guest,viewer]){const event=received.get(client)[0];assert.equal(event.playerId,senderId,'Client-supplied player identity is ignored');assert.equal(event.reaction,'wellPlayed');assert.equal(event.roomCode,room.code);assert(event.expiresAt>Date.now());assert.deepEqual(Object.keys(event).sort(),['expiresAt','matchNumber','playerId','reaction','roomCode']);assert(!JSON.stringify(event).includes(joined.resumeToken));}
  assert.equal(received.get(other).length,0);assert((await ask(guest,'reaction',{reaction:'ouch'})).error,'Cooldown applies server-side');assert.equal(received.get(viewer).length,1);assert((await ask(viewer,'reaction',{reaction:'believe'})).error,'Spectators cannot speak for a player card');
  assert.deepEqual(db.db.prepare('SELECT revision,state_json FROM rooms WHERE code=?').get(room.code),before,'Reaction success and rejection produce no game-state/database writes');
  guest.disconnect();const resumed=await server.connect();assert((await ask(resumed,'resumeSession',{code:room.code,token:joined.resumeToken})).ok);assert((await ask(resumed,'reaction',{reaction:'suspicious'})).error,'Seat cooldown survives a new socket');
  db.close();db=null;await server.stop();server=await launch(file);const back=await server.connect(),events=[];back.on('reaction',event=>events.push(event));await ask(back,'resumeSession',{code:room.code,token:room.resumeToken});await until(()=>back.state?.room.code===room.code,'resumed after restart');assert.equal(events.length,0);assert(!JSON.stringify(back.state.room).includes('wellPlayed'),'Reactions are not saved or replayed');
  console.log('Preset validation, exact four-second seat cooldown, room-only player/spectator delivery, authenticated identity, reconnect limits, no game/SQL writes and no reaction replay passed.');
 }finally{if(db&&!db.closed)db.close();if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
