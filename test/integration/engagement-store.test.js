'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const g=require('../../server/game'),engagement=require('../../server/engagement');
const {RoomStore,encode}=require('../../server/room-store'),{RoomTransitions}=require('../../server/room-transitions');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-engagement-')),file=path.join(dir,'rooms.sqlite');
const realNow=Date.now;let at=Date.parse('2026-11-01T23:59:00Z'),store;
Date.now=()=>at;
function fixture(code){const a={id:code+'a',name:'Private name',coins:0,influences:[],alive:true,connected:true,ready:true};const r=g.createGame(code,a);r.seatTokens=new Map();r.players.push({...a,id:code+'b',name:'Other private name'});return r;}
try{
 store=new RoomStore(file);const rooms=new Map(),tx=new RoomTransitions(store,rooms);
 for(const [i,id] of engagement.MODES.entries()){
  const r=fixture('M'+i);r.treasuryMode=id.includes('treasury');r.revealFactions=id==='faction'||id==='treasuryFaction';
  tx.create(r);assert(tx.run(r.code,null,'invalid',{},()=>({ok:false,error:'Invalid'})).ok===false);
  store.beforeCommit=()=>{throw Error('disk failure');};
  assert.throws(()=>tx.run(r.code,null,'startGame',{},next=>{g.startGame(next);return {ok:true};}));
  assert.equal(engagement.report(store.db,0,at).totals.started,i);
  assert.equal(r.status,'lobby');store.beforeCommit=null;
  const actor=r.players[0].id,command={commandId:'start-'+i,commandSequence:1};
  assert(tx.run(r.code,actor,'startGame',command,next=>{g.startGame(next);return {ok:true};}).ok);
  assert(tx.run(r.code,actor,'startGame',command,()=>{throw Error('duplicate replay');}).duplicate);
  assert.equal(engagement.report(store.db,0,at).totals.started,i+1);
 }
 let report=engagement.report(store.db,0,at);assert.equal(report.totals.roomsCreated,4);assert.equal(report.totals.playerSeatJoins,8);assert.equal(report.totals.playerParticipations,8);assert(report.modes.every(m=>m.started===1));
 const startSnapshot=encode(rooms.get('M0'));tx.run('M0',null,'presence',{},()=>({ok:true}));assert.equal(encode(rooms.get('M0')),startSnapshot);
 // End after midnight: completions use the finish day, rates use the start cohort.
 at+=120000;
 store.beforeCommit=()=>{throw Error('completion commit failure');};
 assert.throws(()=>tx.run('M0',null,'forfeit',{},r=>g.forfeitPlayer(r,r.players[1].id)));
 assert.equal(engagement.report(store.db,0,at).totals.completed,0);store.beforeCommit=null;
 for(const r of rooms.values())assert(tx.run(r.code,null,'forfeit',{},next=>g.forfeitPlayer(next,next.players[1].id)).ok);
 report=engagement.report(store.db,0,at);assert.equal(report.totals.completed,4);assert.equal(report.totals.completionRate,1);assert.equal(report.totals.averageDurationMs,120000);assert.equal(report.daily[0].started,4);assert.equal(report.daily[1].completed,4);assert(report.modes.every(m=>m.completed===1));
 const endingOnly=engagement.report(store.db,7,Date.parse('2026-11-08T12:00:00Z'));
 assert.equal(endingOnly.totals.started,0);assert.equal(endingOnly.totals.completed,4);assert.equal(endingOnly.totals.completionRate,null,'Do not divide finish-day counts by unrelated start-day counts');
 const before=JSON.stringify(report.totals);
 for(const r of [...rooms.values()])tx.run(r.code,null,'deleteEmptyRoom',{},()=>({ok:true}),{remove:true});
 assert.equal(store.loadAll().length,0);assert.equal(store.db.prepare('SELECT count(*) n FROM engagement_active').get().n,0);assert.equal(JSON.stringify(engagement.report(store.db,0,at).totals),before);
 store.close();store=new RoomStore(file);assert.equal(JSON.stringify(engagement.report(store.db,0,at).totals),before);
 const tx2=new RoomTransitions(store,new Map()),lobby=fixture('M0');tx2.create(lobby);tx2.run(lobby.code,null,'deleteEmptyRoom',{},()=>({ok:true}),{remove:true});
 assert.equal(engagement.report(store.db,0,at).totals.roomsCreated,5,'Room codes can be reused without deduplicating new rooms');assert.equal(engagement.report(store.db,0,at).totals.lobbiesClosedWithoutStart,1);
 assert.throws(()=>engagement.report(store.db,999,at),/range/);
 // Recreate a real version-1 database with a live pending claim, then migrate it.
 const old=fixture('OLD1');g.startGame(old);assert(g.performAction(old,old.players[0].id,'tax').ok);new RoomTransitions(store,new Map()).create(old);
 const snapshot=encode(old);store.db.exec('DROP TABLE engagement_active; DROP TABLE engagement_daily; DROP TABLE engagement_meta; PRAGMA user_version=1;');store.close();
 store=new RoomStore(file);assert.equal(store.db.prepare('PRAGMA user_version').get().user_version,2);const restored=store.loadAll()[0];assert.equal(encode(restored),snapshot,'Migration never rewrites live game state or pending claims');
 const migrated=new RoomTransitions(store,new Map([[restored.code,restored]]));
 migrated.run(restored.code,null,'presence',{},r=>{r.players[0].connected=false;return {ok:true};});
 migrated.run(restored.code,null,'forfeit',{},r=>g.forfeitPlayer(r,r.players[1].id));
 report=engagement.report(store.db,0,at);assert.equal(report.totals.roomsCreated,0);assert.equal(report.totals.started,0);assert.equal(report.totals.completed,0,'Pre-installation matches are not invented or included in measured durations');
 for(const row of store.db.prepare('SELECT * FROM engagement_daily').all())assert(!JSON.stringify(row).includes('Private name'));
 console.log('Atomic engagement counters, all four modes, duplicate retries, rollback, restart, cleanup, UTC cohorts and v1 migration with live hidden state passed.');
}finally{Date.now=realNow;if(store&&!store.closed)store.close();fs.rmSync(dir,{recursive:true,force:true});}
