'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const harness=require('../helpers/server-harness'),game=require('../../shared/game'),{RoomTransitions}=require('../../server/room-transitions'),{RoomStore,encode}=require('../../server/room-store'),engagement=require('../../server/engagement'),{launch,until}=require('../helpers/live-server');
const settings=['name','visibility','maxPlayers','revealFactions','treasuryMode','treasuryCoinsPerPlayer','challengeTimerEnabled','challengeDurationSeconds'];
for(const treasury of [false,true])for(const factions of [false,true]){
 const h=harness({RATE_PACKETS_PER_SEC:'1000',RATE_IP_PACKETS_PER_SEC:'2000'});
 try{
  const host=h.client('host'),a=h.client('a'),b=h.client('b'),left=h.client('left'),watch=h.client('watch');
  const created=host.send('createRoom',{nickname:'Host'}),code=created.code,r=h.rooms.get(code),tx=new RoomTransitions(h.store,h.rooms);
  assert(host.send('rematch').error);host.send('setRoomDetails',{name:'Same group',visibility:'public'});host.send('setMaxPlayers',{maxPlayers:5});host.send('setChallengeTimer',{enabled:false,seconds:25});host.send('setRevealFactions',{enabled:factions});host.send('setTreasuryMode',{enabled:treasury,coinsPerPlayer:7});
  for(const c of [a,b,left]){c.send('joinRoom',{code,nickname:c.id});c.send('ready',{ready:true});}watch.send('joinSpectator',{code,nickname:'Viewer'});assert(host.send('startGame').ok);assert(host.send('rematch').error);
  assert(left.send('leaveRoom').ok);assert(!r.seatTokens.has('left'));
  tx.run(code,null,'testIntel',{},next=>{const owner=next.players.find(p=>p.id==='host');owner.privateInvestigations={a:{0:'lord'}};owner.lastInvestigation={roles:['lord'],playerId:'a'};owner.intrigueVisibility=[3,1];next.sharedInvestigations=[{playerId:'host',roles:['lord'],indices:[0]}];return{ok:true};});
  for(const id of ['a','b'])assert(tx.run(code,null,'finishFixture',{},next=>game.forfeitPlayer(next,id)).ok);
  assert.equal(r.status,'finished');const before=encode(r),savedSettings=Object.fromEntries(settings.map(k=>[k,r[k]])),tokens=[...r.seatTokens],metrics=engagement.report(h.store.db,0).totals;
  assert.equal(metrics.started,1);assert.equal(metrics.completed,1);
  for(const c of [a,watch,h.client('stranger')])assert(c.send('rematch').error);assert.equal(encode(r),before);
  const packet={commandId:'rematch-once',commandSequence:1,expectedRoom:code,expectedMatch:1};
  const events=host.events.length;h.store.beforeCommit=()=>{throw Error('storage failure');};assert(host.send('rematch',packet).error);h.store.beforeCommit=null;assert.equal(encode(r),before);assert.deepEqual([...r.seatTokens],tokens);assert(!host.events.slice(events).some(e=>e.event==='state'));
  assert(host.send('rematch',packet).ok);assert.equal(r.status,'lobby');assert.equal(r.code,code);assert.equal(r.matchNumber,2);assert.equal(r.hostId,'host');assert.deepEqual(Object.fromEntries(settings.map(k=>[k,r[k]])),savedSettings);
  assert.deepEqual(r.players.map(p=>p.id).sort(),['a','b','host']);assert.equal(r.spectators[0].id,'watch');assert.deepEqual([...r.seatTokens],tokens);
  for(const p of r.players){assert.equal(p.coins,0);assert.equal(p.ready,false);assert.equal(p.alive,true);assert.deepEqual(p.influences,[]);assert.equal(p.privateInvestigations,undefined);assert.equal(p.lastInvestigation,undefined);assert.equal(p.intrigueVisibility,undefined);}
  for(const field of ['deck','discard','revealedCards','sharedInvestigations','challengeLosses','cardMoves','stateTransitions'])assert.deepEqual(r[field],[]);
  assert.equal(r.pending,null);assert.equal(r.winner,null);assert.equal(r.turnNumber,0);assert.equal(r.roundNumber,0);assert.equal(r.players.find(p=>p.id==='host').commandSequence,1);
  const after=encode(r);assert(host.send('rematch',packet).duplicate);assert.equal(encode(r),after);assert(host.send('ready',{ready:true,expectedMatch:1}).error);assert.equal(encode(r),after);assert(host.send('startGame').error);
  for(const c of [host,a,b])assert(c.send('ready',{ready:true,expectedMatch:2}).ok);assert(host.send('startGame',{expectedMatch:2}).ok);assert.equal(r.status,'playing');assert.equal(r.matchNumber,2);assert.equal(r.turnNumber,1);assert.equal(r.roundNumber,1);assert.equal(r.deck.length,12);assert(r.players.every(p=>p.influences.length===2));assert(game.treasuryInvariant(r));
  const second=encode(r);assert(host.send('rematch',packet).duplicate);assert.equal(encode(r),second);assert(host.send('action',{action:'earn',expectedMatch:1,expectedTurn:1}).error);assert.equal(encode(r),second);
  const totals=engagement.report(h.store.db,0).totals;assert.equal(totals.roomsCreated,1);assert.equal(totals.playerSeatJoins,4);assert.equal(totals.started,2);assert.equal(totals.completed,1);assert.equal(totals.playerParticipations,7);
  // An explicit owner departure during play is resolved when the match ends.
  assert(host.send('leaveRoom',{expectedMatch:2}).ok);assert.equal(r.hostId,'host');const successor=r.players.find(p=>p.id!=='host'&&p.connected===true&&r.seatTokens.has(p.id)).id;assert(tx.run(code,null,'finishFixture',{},next=>game.forfeitPlayer(next,'b')).ok);assert.equal(r.status,'finished');assert.equal(r.hostId,successor);assert(({a,b})[successor].send('rematch',{expectedMatch:2}).ok);assert.equal(r.matchNumber,3);assert(!r.players.some(p=>p.id==='host'));
 }finally{h.close();}
}
// Prefer an online successor to an earlier offline reserved seat; disconnecting
// alone retains the owner and the same reconnect credential.
{
 const h=harness();try{
  const host=h.client('host'),a=h.client('a'),b=h.client('b'),made=host.send('createRoom',{nickname:'Host'}),code=made.code;
  a.send('joinRoom',{code,nickname:'A'});b.send('joinRoom',{code,nickname:'B'});a.disconnect();host.disconnect();assert.equal(h.rooms.get(code).hostId,'host');
  const back=h.client('back');assert(back.send('resumeSession',{code,token:made.resumeToken}).ok);assert(back.send('leaveRoom').ok);assert.equal(h.rooms.get(code).hostId,'b');
 }finally{h.close();}
}
const ack=(c,event,data={})=>c.timeout(2500).emitWithAck(event,data);
async function live(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-rematch-')),filename=path.join(dir,'rooms.sqlite');let server;
 try{
  server=await launch(filename);const host=await server.connect(),guest=await server.connect(),viewer=await server.connect();
  const made=await ack(host,'createRoom',{nickname:'Host'}),code=made.code,joined=await ack(guest,'joinRoom',{code,nickname:'Guest'}),watched=await ack(viewer,'joinSpectator',{code,nickname:'Viewer'});
  await ack(host,'setRoomDetails',{name:'Rematch room',visibility:'private'});await ack(host,'setTreasuryMode',{enabled:true,coinsPerPlayer:7});await ack(host,'setRevealFactions',{enabled:true});await ack(guest,'ready',{ready:true});assert((await ack(host,'startGame')).ok);assert((await ack(guest,'leaveRoom')).ok);await until(()=>host.state?.room.status==='finished','first result');
  const command={commandId:'rematch-live-once',commandSequence:1,expectedRoom:code,expectedMatch:1};assert((await ack(host,'rematch',command)).ok);await until(()=>host.state?.room.status==='lobby'&&viewer.state?.room.matchNumber===2,'same-room lobby broadcast');assert.equal(host.state.room.players.length,1);assert.equal(host.state.room.name,'Rematch room');assert.equal(viewer.state.you,null);assert.deepEqual(host.state.you.influences,[]);
  const newcomer=await server.connect(),newSeat=await ack(newcomer,'joinRoom',{code,nickname:'Next guest'});await ack(host,'ready',{ready:true});await ack(newcomer,'ready',{ready:true});assert((await ack(host,'startGame',{expectedMatch:2})).ok);await until(()=>host.state?.room.status==='playing'&&newcomer.state?.room.status==='playing','second deal');
  const hand=[...host.state.you.influences],id=host.state.you.id;assert.equal(host.state.room.roundNumber,1);assert.equal(host.state.room.turnNumber,1);assert.equal(host.state.room.totalCoins,14);assert.equal(host.state.room.drawPile.count,14);assert(host.state.room.players.every(p=>!('influences' in p)));
  await server.stop('SIGKILL');server=await launch(filename);const resumed=await server.connect(),peer=await server.connect(),spectator=await server.connect();
  assert((await ack(resumed,'resumeSession',{code,token:made.resumeToken})).ok);assert((await ack(peer,'resumeSession',{code,token:newSeat.resumeToken})).ok);assert((await ack(spectator,'resumeSession',{code,token:watched.resumeToken})).ok);await until(()=>resumed.state?.room.matchNumber===2&&spectator.state?.room.status==='playing','second-match restart recovery');
  assert.equal(resumed.state.you.id,id);assert.deepEqual(resumed.state.you.influences,hand);assert.equal(spectator.state.you,null);assert((await ack(resumed,'rematch',command)).duplicate);assert.equal(resumed.state.room.status,'playing');assert((await ack(resumed,'action',{action:'earn',expectedMatch:1,expectedTurn:1})).error);
  const intruder=await server.connect();assert((await ack(intruder,'resumeSession',{code,token:joined.resumeToken})).error,'Departed first-match token is not revived');
  const db=new RoomStore(filename);try{const totals=engagement.report(db.db,0).totals;assert.equal(totals.roomsCreated,1);assert.equal(totals.started,2);assert.equal(totals.completed,1);assert.equal(db.loadAll()[0].matchNumber,2);}finally{db.close();}
  console.log('Rematch: all modes, owner/phase guards, atomic rollback, exact seat/settings preservation, private-state reset, readiness, old-command rejection/idempotency, owner succession, separate metrics, real Socket.IO spectator/rejoin flow and crash recovery passed.');
 }finally{if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
}
live().catch(error=>{console.error(error);process.exitCode=1;});
