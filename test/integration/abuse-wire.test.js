'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');const {io}=require('socket.io-client');
const {launch,until}=require('../helpers/live-server');const {RoomStore}=require('../../server/room-store');
const ack=(s,e,d={})=>s.timeout(2000).emitWithAck(e,d);
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-limits-')),filename=path.join(dir,'rooms.sqlite');let server,extra;
 try{
  server=await launch(filename,{RATE_CREATE_PER_10_MIN:'2',RATE_CHAT_PER_MIN:'2',RATE_BROWSE_PER_MIN:'2',RATE_PACKETS_PER_SEC:'100',MAX_ROOMS:'1',MAX_SPECTATORS_PER_ROOM:'1',MAX_CONNECTIONS_PER_IP:'5'});
  const host=await server.connect(),guest=await server.connect(),spectator=await server.connect(),spare=await server.connect(),browser=await server.connect();
  // Two pending creates are permitted; capacity is rechecked at confirmation.
  const a=await ack(host,'prepareEntry',{kind:'create',nickname:'Host'}),b=await ack(spare,'prepareEntry',{kind:'create',nickname:'Other'});
  assert((await ack(host,'confirmEntry',{code:a.code,token:a.resumeToken,intentId:a.intentId})).ok);
  assert.match((await ack(spare,'confirmEntry',{code:b.code,token:b.resumeToken,intentId:b.intentId})).error,/server is full/);
  await ack(guest,'joinRoom',{code:a.code,nickname:'Guest'});assert((await ack(spectator,'joinSpectator',{code:a.code,nickname:'Viewer'})).code);
  assert.match((await ack(spare,'joinSpectator',{code:a.code,nickname:'Overflow'})).error,/spectator limit/);
  assert((await ack(host,'chatMessage',{message:'First'})).ok);assert((await ack(host,'chatMessage',{message:'Second'})).ok);
  const db=new RoomStore(filename),before=db.db.prepare('SELECT total_changes() n').get().n,revision=db.loadAll()[0].revision;
  assert.match((await ack(host,'chatMessage',{message:'Rejected'})).error,/Too many requests/);assert.equal(db.loadAll()[0].revision,revision);assert.equal(db.loadAll()[0].chat.length,2);assert.equal(db.db.prepare('SELECT total_changes() n').get().n,before);db.close();
  assert((await ack(browser,'listRooms',{})).ok);assert((await ack(browser,'listRooms',{})).ok);assert.match((await ack(browser,'listRooms',{})).error,/Too many requests/);
  extra=io(server.url,{transports:['websocket'],reconnection:false,extraHeaders:{'X-Forwarded-For':'198.51.100.50'}});let rejected;extra.on('connect_error',error=>rejected=error.message);
  await until(()=>rejected,'connection capacity rejection');assert.match(rejected,/server is full/);assert.equal(extra.connected,false,'Forged proxy headers cannot bypass connection capacity');extra.disconnect();
  guest.disconnect();await until(()=>host.state.room.players.some(p=>p.name==='Guest'&&!p.connected),'offline seat');
  assert((await ack(host,'kickPlayer',{targetId:host.state.room.players.find(p=>p.name==='Guest').id})).ok);
  const replacement=await server.connect();assert((await ack(replacement,'joinRoom',{code:a.code,nickname:'Replacement'})).code,'Disconnect frees a connection and lobby kick frees its seat');
  console.log('Real WebSocket rate rejection without state writes, prepared-create contention, room/spectator/connection caps and spoofed-header protection passed.');
 }finally{extra?.disconnect();if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
