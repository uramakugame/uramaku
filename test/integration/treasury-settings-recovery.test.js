'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {launch,until}=require('../helpers/live-server'),{RoomStore}=require('../../server/room-store');
async function main(){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-supply-')),filename=path.join(directory,'rooms.sqlite');let server;
 const request=(client,event,data={})=>client.timeout(3000).emitWithAck(event,data);
 try{
  server=await launch(filename);let host=await server.connect(),guest=await server.connect(),viewer=await server.connect();
  const created=await request(host,'createRoom',{nickname:'Owner'}),joined=await request(guest,'joinRoom',{code:created.code,nickname:'Guest'});assert(created.code);assert(joined.resumeToken);await request(viewer,'joinSpectator',{code:created.code,nickname:'Viewer'});
  await until(()=>host.state?.room.players.length===2,'lobby state');assert.equal(host.state.room.treasuryCoinsPerPlayer,6);assert.equal(host.state.room.challengeDurationSeconds,15);assert.equal(host.state.room.maxPlayers,6);assert((await request(host,'setMaxPlayers',{maxPlayers:3})).ok);
  assert((await request(host,'setTreasuryMode',{enabled:true,coinsPerPlayer:7})).ok);assert((await request(host,'setChallengeTimer',{seconds:10})).ok);
  await until(()=>guest.state?.room.treasuryCoinsPerPlayer===7&&host.state?.room.challengeDurationSeconds===10,'shared setting');const revision=host.state.room.revision;
  for(const actor of [guest,viewer]){assert((await request(actor,'setTreasuryMode',{enabled:false,coinsPerPlayer:5})).error);assert((await request(actor,'setMaxPlayers',{maxPlayers:6})).error);}
  for(const data of [{coinsPerPlayer:4},{enabled:false,coinsPerPlayer:8},{coinsPerPlayer:'5'},{enabled:'false'},{}])assert((await request(host,'setTreasuryMode',data)).error);
  for(const seconds of [5,9,10.5,61,'10'])assert((await request(host,'setChallengeTimer',{seconds})).error);
  assert.equal(host.state.room.revision,revision,'Rejected settings do not commit a room');assert.equal(host.state.room.treasuryMode,true);
  await server.stop('SIGKILL');server=await launch(filename);host=await server.connect();guest=await server.connect();
  assert((await request(host,'resumeSession',{code:created.code,token:created.resumeToken})).ok);assert((await request(guest,'resumeSession',{code:created.code,token:joined.resumeToken})).ok);
  await until(()=>host.state?.room.players.every(p=>p.connected),'lobby resumed');assert.equal(host.state.room.treasuryCoinsPerPlayer,7);assert.equal(host.state.room.challengeDurationSeconds,10);assert.equal(host.state.room.maxPlayers,3);
  assert((await request(host,'setTreasuryMode',{enabled:false})).ok);assert.equal(host.state.room.treasuryCoinsPerPlayer,7);assert((await request(host,'setTreasuryMode',{enabled:true,coinsPerPlayer:5})).ok);
  await request(host,'ready',{ready:true});await request(guest,'ready',{ready:true});assert((await request(host,'startGame')).ok);
  await until(()=>guest.state?.room.status==='playing'&&host.state?.room.status==='playing','new game');const before=host.state;
  assert.equal(before.room.totalCoins,10);assert.equal(before.room.treasuryCoins,7);assert.equal(before.room.economyWinThreshold,10);assert.equal(before.room.treasuryCoinsPerPlayer,5);assert.equal(before.room.treasuryCoins+before.room.players.reduce((sum,p)=>sum+p.coins,0),10);
  assert((await request(host,'setTreasuryMode',{coinsPerPlayer:7})).error);assert((await request(host,'setChallengeTimer',{seconds:60})).error);assert.equal(host.state.room.totalCoins,10);assert((await request(host,'setMaxPlayers',{maxPlayers:6})).error);
  await server.stop('SIGKILL');server=await launch(filename);host=await server.connect();assert((await request(host,'resumeSession',{code:created.code,token:created.resumeToken})).ok);
  await until(()=>host.state?.room.status==='playing','active game resumed');for(const field of ['maxPlayers','treasuryCoinsPerPlayer','treasuryCoins','totalCoins','economyWinThreshold','turnPlayerId','challengeDurationSeconds'])assert.equal(host.state.room[field],before.room[field],field);assert.deepEqual(host.state.you.influences,before.you.influences);assert.equal(host.state.you.coins,before.you.coins);
  const db=new RoomStore(filename);try{const room=db.loadAll()[0];room.treasuryCoinsPerPlayer=8;assert.throws(()=>db.save(room,room.revision),/Invalid saved Treasury coin supply/);}finally{db.close();}
  console.log('Real Socket.IO/SQLite Treasury settings: default 6, shared owner-only 5/7 selection, invalid atomic requests, 10s minimum, lobby/active crash recovery, exact finite supply, 10-coin wealth goal and mid-match locks passed.');
 }finally{if(server)await server.stop();fs.rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
