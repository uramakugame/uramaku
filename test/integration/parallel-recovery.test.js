'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const g=require('../../server/game'),{RoomStore,encode}=require('../../server/room-store'),{RoomTransitions}=require('../../server/room-transitions'),{newSeatToken}=require('../../server/session'),{launch,until}=require('../helpers/live-server');
const ok=r=>assert.equal(r.ok,true,r.error);
function fixture(code){const seat=(id,roles)=>({id:code+id,name:id,coins:3,alive:true,ready:true,connected:true,influences:roles,intrigueVisibility:[0,0],privateInvestigations:{}}),players=[seat('a',['magistrate','lord']),seat('b',['kingpin','assassin']),seat('c',['courtesan','swordsman'])],r=g.createGame(code,players[0]);Object.assign(r,{players,status:'playing',challengeTimerEnabled:false,deck:['kingpin','swordsman','courtesan','assassin']});return r;}
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-parallel-')),file=path.join(dir,'rooms.sqlite');let store,server;
 try{
  store=new RoomStore(file);const rooms=new Map(),tx=new RoomTransitions(store,rooms),tokens={},snapshots={};
  for(const code of ['BOTH','DRAW','LOSS','PAID','INTL']){
   const r=fixture(code),id=x=>code+x;tokens[code]={};for(const p of r.players)tokens[code][p.name]=newSeatToken(r,p.id);
   if(code==='PAID'){
    r.players[0].influences=['kingpin','lord'];r.players[1].influences=['magistrate','assassin'];ok(g.performAction(r,id('a'),'extort',id('b')));ok(g.passChallenge(r,id('b')));ok(g.passChallenge(r,id('c')));ok(g.chooseCounter(r,id('b'),'magistrate'));ok(g.challenge(r,id('a')));
   }else if(code==='INTL'){
    r.players[0].influences=['courtesan','lord'];r.players[1].influences=['courtesan','assassin'];ok(g.performAction(r,id('a'),'intrigue',id('b')));ok(g.passChallenge(r,id('b')));ok(g.passChallenge(r,id('c')));ok(g.chooseCounter(r,id('b'),'courtesan'));ok(g.challenge(r,id('a')));
   }else{
    ok(g.performAction(r,id('a'),'summon'));ok(g.challenge(r,id('b')));
    if(code==='DRAW')ok(g.chooseSummon(r,id('a'),'replace',1));
    if(code==='LOSS')ok(g.loseInfluence(r,id('b'),0));
   }
   tx.create(r);snapshots[code]=JSON.parse(encode(r));
  }
  // Failed saves cannot publish only one half of a successful Summon choice.
  const live=rooms.get('BOTH'),before=encode(live);store.beforeCommit=()=>{throw Error('disk failure');};assert.throws(()=>tx.run('BOTH','BOTHa','summonChoice',{},r=>g.chooseSummon(r,'BOTHa','replace',1)));assert.equal(encode(live),before);store.beforeCommit=null;
  store.close();store=null;server=await launch(file);
  const clients={};
  for(const code of Object.keys(tokens)){
   clients[code]={};for(const name of ['a','b','c']){
    const c=await server.connect();clients[code][name]=c;ok(await c.timeout(3000).emitWithAck('resumeSession',{code,token:tokens[code][name]}));await until(()=>c.state?.room.code===code,'state '+code+name);
   }
   const a=clients[code].a,b=clients[code].b,c=clients[code].c,r=snapshots[code];
   assert.deepEqual(a.state.room.challengeLosses.map(q=>q.decisionId),r.challengeLosses.map(q=>q.decisionId));
   assert.equal(a.state.room.pending?.decisionId,r.pending?.decisionId);assert.equal(a.state.you.summonDrawnRole,r.pending?.drawnRole||null);assert.equal(b.state.you.summonDrawnRole,null);assert.equal(c.state.you.summonDrawnRole,null);
   assert(!JSON.stringify(c.state.room).includes('drawnRole'));assert(!JSON.stringify(c.state.room).includes('privateInvestigations'));for(const t of Object.values(tokens[code]))assert(!JSON.stringify(c.state).includes(t));
  }
  const commands={};
  for(const code of ['BOTH','DRAW','LOSS']){
   const {a,b,c}=clients[code],r=snapshots[code],main=r.pending?.decisionId,debt=r.challengeLosses[0]?.decisionId;
   if(code==='BOTH'){
    assert((await c.timeout(3000).emitWithAck('loseInfluence',{cardIndex:0,expectedDecision:debt})).error,'A foreign debt ID cannot authorize another player');
    assert((await b.timeout(3000).emitWithAck('loseInfluence',{cardIndex:0,expectedDecision:main})).error,'Loss cannot use the Summon decision ID');
    const packet={choice:'replace',cardIndex:1,commandId:'replace-before-crash',commandSequence:1,expectedRoom:code,expectedTurn:r.turnNumber,expectedDecision:main};commands[code]=packet;
    ok(await a.timeout(3000).emitWithAck('summonChoice',packet));await until(()=>a.state.room.pending===null,'Summon completed before penalty');assert.equal(a.state.room.turnNumber,0);assert.equal(a.state.room.challengeLosses[0].decisionId,debt);
   }else if(code==='DRAW'){
    ok(await b.timeout(3000).emitWithAck('loseInfluence',{cardIndex:1,expectedDecision:debt}));await until(()=>b.state.room.turnNumber===1,'Only remaining loss advances turn');
   }else{
    ok(await a.timeout(3000).emitWithAck('summonChoice',{choice:'discard',expectedDecision:main}));await until(()=>a.state.room.turnNumber===1,'Only remaining Summon advances turn');
   }
  }
  assert.deepEqual(clients.INTL.a.state.you.privateInvestigations.INTLb,{'1':'assassin'},'Gossip replacement remains undiscovered after restart');assert.deepEqual(clients.INTL.b.state.you.privateInvestigations.INTLa,{'0':'courtesan','1':'lord'});
  assert.equal(clients.PAID.a.state.you.coins,1);assert.equal(clients.PAID.b.state.you.coins,5,'Enforce paid before crash');
  await server.stop('SIGKILL');server=null;server=await launch(file);
  const a=await server.connect(),b=await server.connect();ok(await a.timeout(3000).emitWithAck('resumeSession',{code:'BOTH',token:tokens.BOTH.a}));ok(await b.timeout(3000).emitWithAck('resumeSession',{code:'BOTH',token:tokens.BOTH.b}));await until(()=>a.state?.room.code==='BOTH'&&b.state?.room.code==='BOTH','second recovery');
  assert((await a.timeout(3000).emitWithAck('summonChoice',commands.BOTH)).duplicate,'A retry after crash cannot replace/draw again');
  const debt=b.state.room.challengeLosses[0];ok(await b.timeout(3000).emitWithAck('loseInfluence',{cardIndex:0,expectedDecision:debt.decisionId}));await until(()=>a.state.room.turnNumber===1,'Both choices complete');assert.equal(a.state.room.challengeLosses.length,0);assert.equal(a.state.room.drawPile.count,2);assert.deepEqual(a.state.you.influences,['assassin','courtesan']);assert.equal(a.state.room.turnPlayerId,'BOTHb');
  console.log('Real Socket.IO/SQLite crash recovery for both pending choices and either completed half, independent stale/foreign IDs, atomic rollback, duplicate retry, private draw/intel and prepaid Enforce passed.');
 }finally{if(server)await server.stop();if(store&&!store.closed)store.close();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
