'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {RoomStore,encode}=require('../../server/room-store');const {RoomTransitions}=require('../../server/room-transitions');
const {newSeatToken}=require('../../server/session');const g=require('../../server/game');const {launch,until,wait}=require('../helpers/live-server');
const person=id=>({id,name:id,coins:5,influences:['lord','magistrate'],alive:true,ready:true,connected:true,privateInvestigations:{},intrigueVisibility:[0,0]});
function fixture(code){const players=['a','b','c','d'].map(person);const r=g.createGame(code,players[0]);Object.assign(r,{players,status:'playing',deck:['lord','magistrate','assassin','courtesan','swordsman','kingpin'],turn:0,challengeTimerEnabled:false});return r;}
function ok(r){assert.equal(r.ok,true,r.error);}
function passes(r){for(const id of ['b','c','d'])ok(g.passChallenge(r,id));}
function information(r){r.players[0].influences=['courtesan','lord'];ok(g.performAction(r,'a','intrigue','b'));passes(r);const q=r.pending;r.pending=null;ok(g.performDeferredAction(r,q));}
function semantics(r){const state=JSON.parse(encode(r));delete state.revision;for(const p of [...state.players,...state.spectators]){delete p.connected;delete p.commandSequence;}return state;}
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-restart-')),filename=path.join(dir,'rooms.sqlite');let server,db;
 try{
  db=new RoomStore(filename);const rooms=new Map(),tx=new RoomTransitions(db,rooms),tokens=new Map(),expected=new Map();
  const setups=[
   r=>{ok(g.performAction(r,'a','tax'));},
   r=>{r.players[0].influences=['kingpin','lord'];ok(g.performAction(r,'a','extort','b'));passes(r);},
   r=>{r.players[0].influences=['kingpin','lord'];ok(g.performAction(r,'a','extort','b'));passes(r);ok(g.chooseCounter(r,'b','magistrate'));},
   r=>{r.players[0].influences=['assassin','lord'];r.players[1].influences=['swordsman','lord'];ok(g.performAction(r,'a','assassinate','b'));passes(r);ok(g.chooseCounter(r,'b','swordsman'));},
   r=>{ok(g.performAction(r,'a','tax'));ok(g.challenge(r,'c'));},
   r=>information(r),
   r=>{information(r);ok(g.chooseCounter(r,'b','keepOne'));},
   r=>{ok(g.performAction(r,'a','summon'));passes(r);},
   r=>{ok(g.performAction(r,'a','summon'));passes(r);},
   r=>{r.players[0].influences=['courtesan','lord'];r.players[1].influences=['courtesan','magistrate'];ok(g.performAction(r,'a','intrigue','b'));passes(r);ok(g.chooseCounter(r,'b','courtesan'));ok(g.challenge(r,'c'));},
   r=>{r.players[0].influences=['assassin','lord'];ok(g.performAction(r,'a','assassinate','b'));ok(g.challenge(r,'c'));ok(g.forfeitPlayer(r,'b'));},
   r=>{r.pending={kind:'informationShare',claimantId:'a',targetId:'b',targetName:'b',roles:['lord','magistrate'],indices:[0,1]};},
   r=>{}
  ];
  for(const [index,setup] of setups.entries()){
   const code=String(index).padStart(4,'0');let r=fixture(code);setup(r);
   // Actual seats use globally unique IDs; do not reuse a/b across live rooms.
   const namespace=value=>typeof value==='string'&&['a','b','c','d'].includes(value)?code+'-'+value:Array.isArray(value)?value.map(namespace):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[namespace(k),namespace(v)])):value;
   r=namespace(r);
   const creds={};for(const p of r.players)creds[p.id.split('-').at(-1)]=newSeatToken(r,p.id);
   r.spectators.push({id:code+'-viewer',name:'Spectator',connected:true});creds.viewer=newSeatToken(r,code+'-viewer');
   if(['claim','counterClaim'].includes(r.pending?.kind)){r.challengeTimerEnabled=true;r.challengeDurationSeconds=60;Object.assign(r.pending,{challengeDurationMs:60000,challengeDeadline:Date.now()+60000});}
   tx.create(r);tokens.set(code,creds);expected.set(code,semantics(r));
  }
  // An entry intent also survives stopping before a seat has been finalized.
  const {randomBytes,randomUUID}=require('node:crypto'),{tokenHash}=require('../../server/session');
  const preToken=randomBytes(32).toString('hex'),intent={id:randomUUID(),code:'PEND',kind:'create',seatId:'new-owner',name:'New Owner',tokenHash:tokenHash(preToken),expiresAt:Date.now()+120000};db.prepareEntry(intent);
  db.close();db=null;
  server=await launch(filename);
  assert.equal((await fetch(server.url+'/health').then(r=>r.json())).rooms,setups.length);
  // Apply an action, deliberately discard its ACK, then crash the process.
  const actor=await server.connect(),observer=await server.connect(),creds=tokens.get('0012');
  assert((await actor.timeout(3000).emitWithAck('resumeSession',{code:'0012',token:creds.a})).ok);
  assert((await observer.timeout(3000).emitWithAck('resumeSession',{code:'0012',token:creds.b})).ok);
  const packet={action:'earn',commandId:'lost-ack',commandSequence:1,expectedRoom:'0012',expectedTurn:0};
  actor.emit('action',packet,()=>{});await until(()=>observer.state?.room.turnPlayerId==='0012-b','committed action before crash');
  db=new RoomStore(filename);expected.set('0012',semantics(db.loadAll().find(r=>r.code==='0012')));db.close();db=null;
  await server.stop('SIGKILL');server=null;
  server=await launch(filename);
  const clientsByRoom=new Map();
  for(const [code,creds] of tokens){
   const a=await server.connect(),viewer=await server.connect();
   assert((await a.timeout(3000).emitWithAck('resumeSession',{code,token:creds.a})).ok);
   assert((await viewer.timeout(3000).emitWithAck('resumeSession',{code,token:creds.viewer})).ok);
   await until(()=>a.state?.room.code===code&&viewer.state?.room.code===code,'restored room '+code);
   clientsByRoom.set(code,{a,viewer});
   assert.equal(viewer.state.you,null,'Spectators receive no private snapshot');
   assert(!JSON.stringify(viewer.state).includes(creds.a),'No bearer credential in public state');
   const hidden=expected.get(code).pending?.drawnRole;
   if(hidden){assert.equal(a.state.you.summonDrawnRole,hidden);assert.equal(viewer.state.room.pending.drawnRole,undefined);}
   if(code==='0012')assert((await a.timeout(3000).emitWithAck('action',packet)).duplicate,'A lost-ACK action must not run twice after restart');
  }
  db=new RoomStore(filename);for(const r of db.loadAll())assert.deepEqual(semantics(r),expected.get(r.code),'Exact saved engine continuation: '+r.code);db.close();db=null;
  // Resume each saved decision through the actual socket handlers, then
  // compare its complete result with the same uninterrupted engine flow.
  const scripts=[
   [['b','passChallenge'],['c','passChallenge'],['d','passChallenge']],
   [['b','declineCounter']],
   [['a','passChallenge'],['c','passChallenge'],['d','passChallenge']],
   [['a','passChallenge'],['c','passChallenge'],['d','passChallenge'],['a','loseInfluence',{cardIndex:0}]],
   [['c','loseInfluence',{cardIndex:0}]],
   [['b','counter',{counter:'revealAll'}]],
   [['b','intrigueReveal',{cardIndex:0}]],
   [['a','summonChoice',{choice:'discard'}]],
   [['a','summonChoice',{choice:'replace',cardIndex:1}]],
   [['c','loseInfluence',{cardIndex:0}]],
   [['c','loseInfluence',{cardIndex:0}]],
   [['a','intrigueSharing',{share:false}]]
  ];
  for(const [index,script] of scripts.entries()){
   const code=String(index).padStart(4,'0'),comparison=JSON.parse(JSON.stringify(expected.get(code)));
   for(const [id,event,data={}] of script){
    let client=clientsByRoom.get(code)[id];
    if(!client){client=await server.connect();assert((await client.timeout(3000).emitWithAck('resumeSession',{code,token:tokens.get(code)[id]})).ok);clientsByRoom.get(code)[id]=client;}
    const actual=await client.timeout(3000).emitWithAck(event,data);assert(actual.ok,event+' in '+code+': '+actual.error);
    let result;
    if(event==='passChallenge')result=g.passChallenge(comparison,code+'-'+id);
    if(event==='loseInfluence')result=g.loseInfluence(comparison,code+'-'+id,data.cardIndex);
    if(event==='counter')result=g.chooseCounter(comparison,code+'-'+id,data.counter);
    if(event==='intrigueReveal')result=g.revealIntrigue(comparison,code+'-'+id,data.cardIndex);
    if(event==='summonChoice')result=g.chooseSummon(comparison,code+'-'+id,data.choice,data.cardIndex);
    if(event==='intrigueSharing')result=g.chooseIntrigueSharing(comparison,code+'-'+id,data.share);
    if(event==='declineCounter'){const q=comparison.pending;comparison.pending=null;result=g.performDeferredAction(comparison,q);}
    ok(result);
   }
   db=new RoomStore(filename);const actual=db.loadAll().find(r=>r.code===code);assert.deepEqual(semantics(actual),semantics(comparison),'Resumed continuation matches uninterrupted play: '+code);db.close();db=null;
  }
  const pendingOwner=await server.connect();assert((await pendingOwner.timeout(3000).emitWithAck('resumeSession',{code:'PEND',token:preToken,intentId:intent.id})).ok);
  await until(()=>pendingOwner.state?.room.code==='PEND','unfinished entry recovery');assert.equal(pendingOwner.state.room.players.length,1);
  assert.equal((await fetch(server.url+'/data/rooms.sqlite')).status,404,'Database is outside the served files');
  // A saved current-rule challenge expires through downtime exactly once.
  await server.stop();server=null;
  db=new RoomStore(filename);const r=fixture('TIME');r.challengeTimerEnabled=true;r.challengeDurationSeconds=10;ok(g.performAction(r,'a','tax'));const timeToken=newSeatToken(r,'a');new RoomTransitions(db,new Map()).create(r);db.close();db=null;
  await wait(10100);server=await launch(filename);const timed=await server.connect();assert((await timed.timeout(3000).emitWithAck('resumeSession',{code:'TIME',token:timeToken})).ok);
  await until(()=>timed.state?.room.code==='TIME','expired window restoration');assert.equal(timed.state.room.pending,null);assert.equal(timed.state.you.coins,7);assert.equal(timed.state.room.turnPlayerId,'b');
  await server.stop('SIGKILL');server=null;server=await launch(filename);const again=await server.connect();await again.timeout(3000).emitWithAck('resumeSession',{code:'TIME',token:timeToken});await until(()=>again.state?.you,'second restart');assert.equal(again.state.you.coins,7,'Expired Tax is not repeated');
  console.log('Real server crash/restart: 13 simultaneous rooms, every pending decision, exact deck/private state, lost ACKs, unfinished joins, spectators and elapsed challenge recovery passed.');
 }finally{if(server)await server.stop();if(db&&!db.closed)db.close();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
