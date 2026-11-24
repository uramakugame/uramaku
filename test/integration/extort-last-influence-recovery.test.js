'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');const g=require('../../server/game'),{RoomStore}=require('../../server/room-store'),{RoomTransitions}=require('../../server/room-transitions'),{newSeatToken}=require('../../server/session'),{launch,until}=require('../helpers/live-server');
const ack=(s,e,d={})=>s.timeout(2000).emitWithAck(e,d);
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-extort-')),file=path.join(dir,'rooms.sqlite');let server;
 try{
  const db=new RoomStore(file),rooms=new Map(),tx=new RoomTransitions(db,rooms),credentials={};
  for(const mode of [false,true]){
   const code=mode?'TRSY':'CLSC',players=[['actor',['kingpin','lord'],2],['target',['courtesan'],5],['observer',['assassin','swordsman'],1]].map(([id,influences,coins])=>({id:code+'-'+id,name:id,influences,coins,alive:true,connected:true,privateInvestigations:{},intrigueVisibility:influences.map(()=>0)}));
   const r=g.createGame(code,players[0]);Object.assign(r,{status:'playing',players,deck:['magistrate'],challengeTimerEnabled:false,treasuryMode:mode,totalCoins:21,treasuryCoins:13,economyWinThreshold:12});assert(g.performAction(r,players[0].id,'extort',players[1].id).ok);
   credentials[code]={};for(const p of players)credentials[code][p.name]=newSeatToken(r,p.id);tx.create(r);
  }db.close();
  server=await launch(file);const packets={};
  for(const [code,tokens] of Object.entries(credentials)){
   const target=await server.connect(),observer=await server.connect();assert((await ack(target,'resumeSession',{code,token:tokens.target})).ok);assert((await ack(observer,'resumeSession',{code,token:tokens.observer})).ok);
   await until(()=>target.state?.room&&observer.state?.room,'resume state');
   const packet={commandId:'last-challenge',commandSequence:1,expectedRoom:code,expectedTurn:0,expectedDecision:target.state.room.pending.decisionId};packets[code]=packet;
   assert((await ack(target,'challenge',packet)).ok);await until(()=>observer.state.room.players.find(p=>p.name==='actor').coins===4,'durable Extort transfer');
   assert.equal(observer.state.room.players.find(p=>p.name==='target').alive,false);assert.equal(observer.state.room.log.filter(x=>x.includes('through Extort')).length,1);assert.equal(observer.state.room.pending,null);
  }
  await server.stop('SIGKILL');server=null;server=await launch(file);
  for(const [code,tokens] of Object.entries(credentials)){
   const target=await server.connect(),observer=await server.connect();assert((await ack(target,'resumeSession',{code,token:tokens.target})).ok);assert((await ack(observer,'resumeSession',{code,token:tokens.observer})).ok);
   await until(()=>observer.state?.room,'recovered observer state');
   const before=JSON.stringify(observer.state.room.players);const repeated=await ack(target,'challenge',packets[code]);assert(repeated.ok&&repeated.duplicate);assert.equal(JSON.stringify(observer.state.room.players),before);
   const room=observer.state.room;assert.equal(room.players.find(p=>p.name==='actor').coins,4);assert.equal(room.players.find(p=>p.name==='target').coins,code==='TRSY'?0:3);assert.equal(room.log.filter(x=>x.includes('through Extort')).length,1);
   if(code==='TRSY')assert.equal(room.treasuryCoins+room.players.reduce((n,p)=>n+p.coins,0),21);
  }
  console.log('Real Socket.IO last-influence Extort in Classic/Treasury, atomic saved transfer/penalty/refund, crash recovery and duplicate challenge receipt passed.');
 }finally{if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
