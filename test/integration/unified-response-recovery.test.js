'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const g=require('../../server/game'),{RoomStore}=require('../../server/room-store'),{RoomTransitions}=require('../../server/room-transitions'),{newSeatToken}=require('../../server/session'),{launch,until}=require('../helpers/live-server');
const ok=result=>assert.equal(result.ok,true,result.error);
function fixture(code,hand=['courtesan','kingpin'],target=['courtesan','magistrate']){const players=['a','b','c','d'].map((id,i)=>({id:code+id,name:id,coins:6,alive:true,connected:true,ready:true,influences:i===0?[...hand]:i===1?[...target]:['assassin','lord'],intrigueVisibility:[0,0],privateInvestigations:{}})),r=g.createGame(code,players[0]);Object.assign(r,{players,status:'playing',turnNumber:1,deck:['kingpin','swordsman','courtesan','assassin','magistrate'],challengeTimerEnabled:false});return r;}
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-unified-')),file=path.join(dir,'rooms.sqlite');let store,server;const credentials={},saved={};
 try{
  store=new RoomStore(file);const tx=new RoomTransitions(store,new Map());
  for(const code of ['EARL','LOSS','SUMN','TIME','RACE']){
   const r=fixture(code,code==='SUMN'?['magistrate','lord']:code==='RACE'?['assassin','lord']:undefined,code==='RACE'?['swordsman','courtesan']:undefined);const action=code==='SUMN'?'summon':code==='RACE'?'assassinate':'intrigue';
   ok(g.performAction(r,code+'a',action,action==='summon'?undefined:code+'b'));
   if(code==='TIME'){r.challengeTimerEnabled=true;r.pending.challengeDeadline=Date.now()-1;r.pending.challengeDurationMs=15000;}
   credentials[code]={};for(const p of r.players)credentials[code][p.name]=newSeatToken(r,p.id);tx.create(r);if(['LOSS','SUMN'].includes(code))ok(tx.run(code,null,'challenge',{},next=>g.challenge(next,code+'c')));saved[code]=JSON.parse(JSON.stringify(r));
  }
  store.close();store=null;server=await launch(file);const clients={};
  async function resume(code,name){const c=await server.connect();ok(await c.timeout(3000).emitWithAck('resumeSession',{code,token:credentials[code][name]}));await until(()=>c.state?.room.code===code,'restored '+code+name);return c;}
  for(const code of Object.keys(credentials)){clients[code]={};for(const name of ['a','b','c'])clients[code][name]=await resume(code,name);}
  const ack=(c,event,data={})=>c.timeout(3000).emitWithAck(event,data);
  // Immediate counter closes the original window; a stale challenge cannot hit it.
  const {a:ra,b:rb,c:rc}=clients.RACE,original=ra.state.room.pending.decisionId;
  ok(await ack(rb,'counter',{counter:'swordsman',expectedDecision:rb.state.room.pending.responseDecisionId}));await until(()=>ra.state.room.pending?.kind==='counterClaim','immediate counter');assert.equal(rb.state.you.coins,1);
  assert((await ack(rc,'challenge',{expectedDecision:original})).error);assert.equal(ra.state.room.pending.kind,'counterClaim');assert.equal(ra.state.room.challengeLosses.length,0);
  // Original expiry preserves an untimed target response and its stable identity.
  const t=clients.TIME.b;assert.equal(t.state.room.pending.kind,'counterOffer');assert.equal(t.state.room.pending.challengeDeadline,undefined);assert.equal(t.state.room.pending.responseDecisionId,saved.TIME.pending.responseDecisionId);
  ok(await ack(t,'counter',{counter:'courtesan',expectedDecision:saved.TIME.pending.responseDecisionId}));await until(()=>t.state.room.pending?.kind==='counterClaim','post-expiry counter');assert(t.state.room.pending.challengeDeadline>Date.now()+10000);
  // The public-information barrier survives restart and creates a fresh response ID.
  const l=clients.LOSS;assert.equal(l.b.state.room.pending.kind,'lose');assert((await ack(l.b,'counter',{counter:'courtesan'})).error);
  ok(await ack(l.c,'loseInfluence',{cardIndex:0,expectedDecision:l.c.state.room.pending.decisionId}));await until(()=>l.b.state.room.pending?.kind==='counterOffer','loss then response');assert.notEqual(l.b.state.room.pending.responseDecisionId,saved.LOSS.pending.responseDecisionId);
  assert((await ack(l.b,'counter',{counter:'courtesan',expectedDecision:saved.LOSS.pending.responseDecisionId})).error);
  ok(await ack(l.b,'counter',{counter:'courtesan',expectedDecision:l.b.state.room.pending.responseDecisionId}));await until(()=>l.b.state.room.pending?.kind==='counterClaim','new informed counter');
  // Summon has no preview before loss, draws exactly once after it, and stays private.
  const s=clients.SUMN;assert.equal(s.a.state.room.pending.kind,'lose');assert.equal(s.a.state.you.summonDrawnRole,null);assert.equal(s.a.state.room.drawPile.count,4);
  const packet={cardIndex:0,commandId:'reveal-before-crash',commandSequence:1,expectedRoom:'SUMN',expectedTurn:1,expectedDecision:s.c.state.room.pending.decisionId};
  ok(await ack(s.c,'loseInfluence',packet));await until(()=>s.a.state.room.pending?.kind==='summon','loss then draw');const drawn=s.a.state.you.summonDrawnRole;assert.equal(drawn,'assassin');assert.equal(s.b.state.you.summonDrawnRole,null);assert.equal(s.a.state.room.drawPile.count,3);
  const text=JSON.stringify(s.b.state.room);assert(!text.includes('drawnRole'));assert(!text.includes('privateInvestigations'));for(const token of Object.values(credentials.SUMN))assert(!JSON.stringify(s.b.state).includes(token));
  await server.stop('SIGKILL');server=null;server=await launch(file);
  const anew=await resume('SUMN','a'),cnew=await resume('SUMN','c');assert.equal(anew.state.you.summonDrawnRole,drawn);assert.equal(anew.state.room.drawPile.count,3);assert((await ack(cnew,'loseInfluence',packet)).duplicate);
  ok(await ack(anew,'summonChoice',{choice:'replace',cardIndex:1,expectedDecision:anew.state.room.pending.decisionId}));await until(()=>anew.state.room.turnNumber===2,'complete restored Summon');assert.equal(anew.state.room.drawPile.count,3);
  const early=await resume('EARL','b');const pending=early.state.room.pending;
  // Failed commits cannot save a counter cost or close a window in isolation.
  store=new RoomStore(':memory:');const r=fixture('FAIL',['assassin','lord'],['swordsman','courtesan']),rooms=new Map(),testTx=new RoomTransitions(store,rooms);ok(g.performAction(r,'FAILa','assassinate','FAILb'));testTx.create(r);const before=JSON.stringify(r);store.beforeCommit=()=>{throw Error('disk full');};assert.throws(()=>testTx.run('FAIL','FAILb','counter',{},x=>g.chooseCounter(x,'FAILb','swordsman')));assert.equal(JSON.stringify(r),before);assert.equal(store.loadAll()[0].pending.kind,'claim');store.beforeCommit=null;
  assert.equal(pending.kind,'claim');console.log('Real Socket.IO/SQLite: immediate counter races, stable untimed offers, loss-first response IDs, private loss-first Summon, crash/retry recovery and atomic cost rollback passed.');
 }finally{if(server)await server.stop();if(store&&!store.closed)store.close();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
