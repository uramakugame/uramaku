'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {launch,until}=require('../helpers/live-server');const {RoomStore}=require('../../server/room-store');const {RoomTransitions}=require('../../server/room-transitions');const {createGame}=require('../../server/game');
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-public-')),filename=path.join(dir,'rooms.sqlite');let server;
 try{
  server=await launch(filename);const host=await server.connect(),outsider=await server.connect();
  let changed=0;outsider.on('publicRoomsChanged',()=>changed++);
  assert.equal((await outsider.timeout(2000).emitWithAck('listRooms',{subscribe:true})).rooms.length,0);
  const prepared=await host.timeout(2000).emitWithAck('prepareEntry',{kind:'create',nickname:'Owner'});
  assert((await host.timeout(2000).emitWithAck('confirmEntry',{code:prepared.code,intentId:prepared.intentId,token:prepared.resumeToken})).ok);
  await host.timeout(2000).emitWithAck('setRoomDetails',{name:'夜の対戦',visibility:'public'});
  await host.timeout(2000).emitWithAck('setRevealFactions',{enabled:true});await host.timeout(2000).emitWithAck('setTreasuryMode',{enabled:true});
  await until(()=>changed>0,'coalesced listing notification');
  let listed=await outsider.timeout(2000).emitWithAck('listRooms',{query:'夜の'});assert.equal(listed.rooms[0].code,prepared.code);assert.equal(listed.rooms[0].mode,'treasuryFaction');
  assert(!JSON.stringify(listed).includes(prepared.resumeToken));
  await server.stop('SIGKILL');server=null;server=await launch(filename);
  const browser=await server.connect();assert.equal((await browser.timeout(2000).emitWithAck('listRooms',{})).rooms.length,0,'Offline owner keeps a restored public room out of discovery');
  const owner=await server.connect();assert((await owner.timeout(2000).emitWithAck('resumeSession',{code:prepared.code,token:prepared.resumeToken})).ok);
  await until(()=>owner.state?.room.name==='夜の対戦','restored name and membership');assert.equal(owner.state.room.visibility,'public');assert.equal(owner.state.room.challengeDurationSeconds,15);
  listed=await browser.timeout(2000).emitWithAck('listRooms',{query:prepared.code.toLowerCase()});assert.equal(listed.rooms[0].name,'夜の対戦');assert.equal(listed.rooms[0].mode,'treasuryFaction');
  await owner.timeout(2000).emitWithAck('setRoomDetails',{visibility:'private'});assert.equal((await browser.timeout(2000).emitWithAck('listRooms',{query:prepared.code})).rooms.length,0);
  console.log('Real public-room notifications, Japanese name search, combined modes, persisted visibility/names, owner reconnection passed.');
 }finally{if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
