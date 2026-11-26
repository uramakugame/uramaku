'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const g=require('../../server/game'),{RoomStore}=require('../../server/room-store'),{RoomTransitions}=require('../../server/room-transitions'),{newSeatToken}=require('../../server/session'),{launch,until}=require('../helpers/live-server');
const ok=result=>assert.equal(result.ok,true,result.error);
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-losses-')),file=path.join(dir,'rooms.sqlite');let store,server;
 try{
  store=new RoomStore(file);const tx=new RoomTransitions(store,new Map()),tokens={};
  for(const code of ['DUAL','PAID','INTL']){
   const players=['a','b','c'].map((id,index)=>({id:code+id,name:id,coins:6,influences:index===0?['swordsman','kingpin']:index===1?['courtesan','magistrate']:['assassin','lord'],alive:true,ready:true,connected:true,privateInvestigations:{},intrigueVisibility:[0,0]}));
   const r=g.createGame(code,players[0]);Object.assign(r,{status:'playing',players,challengeTimerEnabled:false,deck:['kingpin','assassin','lord']});tokens[code]={};for(const p of players)tokens[code][p.name]=newSeatToken(r,p.id);
   if(code==='DUAL'){ok(g.performAction(r,code+'a','hireBlade',code+'b'));ok(g.challenge(r,code+'c'));assert.equal(r.pending.loserId,code+'b');assert.equal(r.challengeLosses[0].loserId,code+'c');}
   if(code==='PAID'){ok(g.performAction(r,code+'a','extort',code+'b'));ok(g.chooseCounter(r,code+'b','magistrate'));ok(g.challenge(r,code+'a'));assert.equal(players[0].coins,4);assert.equal(players[1].coins,8);}
   if(code==='INTL'){players[0].influences=['courtesan','lord'];ok(g.performAction(r,code+'a','intrigue',code+'b'));ok(g.chooseCounter(r,code+'b','courtesan'));ok(g.challenge(r,code+'a'));assert.deepEqual(players[0].privateInvestigations[code+'b'],{1:'magistrate'});}
   tx.create(r);
  }
  store.close();store=null;server=await launch(file);const clients={};
  for(const code of Object.keys(tokens)){clients[code]={};for(const id of ['a','b','c']){const c=await server.connect();ok(await c.timeout(3000).emitWithAck('resumeSession',{code,token:tokens[code][id]}));await until(()=>c.state?.room.code===code,'resume '+code+id);clients[code][id]=c;}}
  const {a,b,c}=clients.DUAL,primary=b.state.room.pending.decisionId,debt=c.state.room.challengeLosses[0].decisionId;
  assert((await c.timeout(3000).emitWithAck('loseInfluence',{cardIndex:0,expectedDecision:primary})).error,'Independent losses cannot reuse each other’s ID');
  ok(await b.timeout(3000).emitWithAck('loseInfluence',{cardIndex:0,expectedDecision:primary}));await until(()=>a.state.room.pending===null,'first loss');assert.equal(a.state.room.turnNumber,0);assert.equal(a.state.room.challengeLosses.length,1);
  ok(await c.timeout(3000).emitWithAck('loseInfluence',{cardIndex:0,expectedDecision:debt}));await until(()=>a.state.room.turnNumber===1,'both losses');assert.equal(a.state.room.challengeLosses.length,0);
  assert.equal(clients.PAID.a.state.you.coins,4);assert.equal(clients.PAID.b.state.you.coins,8);
  assert.deepEqual(clients.INTL.a.state.you.privateInvestigations.INTLb,{1:'magistrate'});assert(!JSON.stringify(clients.INTL.c.state.room).includes('privateInvestigations'));
  console.log('Current-rule restart recovery preserves two mandatory loss decisions and their independent IDs, prepaid Enforce, private Gossip and one next-turn Income.');
 }finally{if(server)await server.stop();if(store&&!store.closed)store.close();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
