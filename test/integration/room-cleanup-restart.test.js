'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {launch,until,wait}=require('../helpers/live-server');const {RoomStore}=require('../../server/room-store');const {RoomTransitions}=require('../../server/room-transitions');const game=require('../../server/game');const {tokenHash}=require('../../server/session');
const ack=(s,e,d={})=>s.timeout(2000).emitWithAck(e,d);
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-cleanup-')),filename=path.join(dir,'rooms.sqlite');let server;
 try{
  const store=new RoomStore(filename),t=new RoomTransitions(store,new Map()),token='a'.repeat(64);
  const seat=id=>({id,name:id,connected:false,coins:1,influences:[],ready:true,alive:true});
  const empty=game.createGame('WAIT',seat('wait'));empty.seatTokens=new Map([['wait',tokenHash(token)]]);empty.emptyLobbySince=Date.now()-800;t.create(empty);const since=empty.emptyLobbySince;
  const active=game.createGame('PLAY',seat('p1'));active.players.push(seat('p2'));active.challengeTimerEnabled=false;game.startGame(active);active.players.forEach(p=>p.connected=false);game.performAction(active,game.publicState(active).turnPlayerId,'summon');active.seatTokens=new Map([['p1',tokenHash('b'.repeat(64))],['p2',tokenHash('c'.repeat(64))]]);t.create(active);const pending=JSON.stringify(active.pending),deck=JSON.stringify(active.deck);
  const done=game.createGame('DONE',seat('done'));done.status='finished';done.seatTokens=new Map([['done',tokenHash('d'.repeat(64))]]);t.create(done);store.close();
  server=await launch(filename,{EMPTY_LOBBY_TTL_MS:'1500',ROOM_CLEANUP_INTERVAL_MS:'20'});
  const check=new RoomStore(filename);assert.equal(check.loadAll().find(r=>r.code==='WAIT').emptyLobbySince,since,'Startup retains the original abandonment clock');assert(!check.loadAll().some(r=>r.code==='DONE'));check.close();
  await wait(1600);
  const browser=await server.connect();assert((await ack(browser,'resumeSession',{code:'WAIT',token})).error);
  let db=new RoomStore(filename);assert(!db.loadAll().some(r=>r.code==='WAIT'));assert.equal(JSON.stringify(db.loadAll().find(r=>r.code==='PLAY').pending),pending);assert.equal(JSON.stringify(db.loadAll().find(r=>r.code==='PLAY').deck),deck);db.close();
  await server.stop('SIGKILL');server=null;server=await launch(filename,{EMPTY_LOBBY_TTL_MS:'100',ROOM_CLEANUP_INTERVAL_MS:'20'});
  await wait(150);const restored=await server.connect();assert((await ack(restored,'resumeSession',{code:'PLAY',token:'b'.repeat(64)})).ok);
  await until(()=>restored.state?.room.code==='PLAY','active game recovery after cleanup deadlines');assert.equal(JSON.stringify(restored.state.room.pending.decisionId),JSON.stringify(active.pending.decisionId));
  assert(!JSON.stringify(restored.state).includes('emptyLobbySince'));assert(!JSON.stringify(restored.state).includes(tokenHash('b'.repeat(64))));
  console.log('Real restart preserves empty-lobby deadlines, removes empty completed rooms, expires waiting credentials and retains exact offline active decisions/deck across crashes.');
 }finally{if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
