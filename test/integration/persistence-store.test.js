'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {RoomStore,encode}=require('../../server/room-store');
const {RoomTransitions}=require('../../server/room-transitions');
const {newSeatToken,tokenHash}=require('../../server/session');
const g=require('../../server/game');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-store-')),filename=path.join(dir,'state.sqlite');
let store=new RoomStore(filename);const rooms=new Map(),tx=new RoomTransitions(store,rooms);
const person=id=>({id,name:id,coins:5,alive:true,ready:true,connected:true,influences:['lord','magistrate'],privateInvestigations:{},intrigueVisibility:[0,0]});
try{
  const a=person('a'),b=person('b'),c=person('c');const r=g.createGame('SAVE',a);
  Object.assign(r,{status:'playing',players:[a,b,c],deck:['courtesan','assassin','kingpin'],turn:0,challengeTimerEnabled:false});
  const token=newSeatToken(r,'a');newSeatToken(r,'b');newSeatToken(r,'c');tx.create(r);
  assert.equal(r.seatTokens.get('a'),tokenHash(token));assert.notEqual(r.seatTokens.get('a'),token);
  const initial=encode(r),rows=store.db.prepare('SELECT * FROM rooms').all();
  assert.equal(tx.run('SAVE','b','bad',{},next=>{next.players[0].coins=999;return {ok:false,error:'Rejected'};}).ok,false);
  assert.equal(encode(r),initial);assert.deepEqual(store.db.prepare('SELECT * FROM rooms').all(),rows);
  store.beforeCommit=()=>{throw Error('injected commit failure');};
  assert.throws(()=>tx.run('SAVE','a','tax',{},next=>g.performAction(next,'a','tax')));
  assert.equal(encode(r),initial);assert.equal(store.loadAll()[0].pending,null);assert.equal(store.healthy(),false);
  store.beforeCommit=null;
  const packet={commandId:'claim-once',commandSequence:1,expectedRoom:'SAVE',expectedTurn:0};
  assert(tx.run('SAVE','a','action',packet,next=>g.performAction(next,'a','tax')).ok);
  const pending=encode(r),decision=r.pending.decisionId;assert(decision);assert(store.healthy());
  assert(tx.run('SAVE','a','action',packet,()=>{throw Error('duplicate ran');}).duplicate);
  assert.equal(encode(r),pending);
  assert.equal(tx.run('SAVE','a','action',{...packet,changed:true},()=>({ok:true})).ok,false,'A reused ID with another payload is rejected');
  assert.equal(tx.run('SAVE','b','pass',{expectedDecision:'wrong'},next=>g.passChallenge(next,'b')).ok,false);
  assert.equal(tx.run('SAVE','b','pass',{expectedRoom:'NOPE'},next=>g.passChallenge(next,'b')).ok,false);
  assert(tx.run('SAVE','b','pass',{expectedDecision:decision},next=>g.passChallenge(next,'b')).ok);
  assert.equal(r.pending.decisionId,decision,'A pass must preserve the decision and its deadline');
  store.close();store=new RoomStore(filename);
  const restored=store.loadAll()[0];assert.equal(encode(restored),encode(r));assert.equal(restored.seatTokens.get('a'),tokenHash(token));
  const recovered=new RoomTransitions(store,new Map([['SAVE',restored]]));
  assert(recovered.run('SAVE','a','action',packet,()=>{throw Error('replayed after restart');}).duplicate);
  assert(recovered.run('SAVE','c','challenge',{},next=>g.challenge(next,'c')).ok);
  assert.equal(g.lossDecision(restored,'c').kind,'lose');assert.notEqual(g.lossDecision(restored,'c').decisionId,decision);
  assert.equal(recovered.run('SAVE','b','pass',{expectedDecision:decision},()=>({ok:true})).ok,false);
  store.db.prepare('DELETE FROM command_receipts WHERE command_id=?').run('claim-once');
  const beforeOldRetry=encode(restored);
  assert.equal(recovered.run('SAVE','a','action',packet,()=>{throw Error('pruned receipt replay');}).ok,false);
  assert.equal(encode(restored),beforeOldRetry,'The durable sequence also rejects a retry after receipt pruning');
  // Transactions remove credentials/receipts with the room; plaintext tokens
  // never enter the main file, WAL, snapshot or receipt table.
  for(const file of fs.readdirSync(dir))assert(!fs.readFileSync(path.join(dir,file)).includes(Buffer.from(token)));
  const beforeDelete=restored.revision;
  store.beforeCommit=()=>{throw Error('failed delete');};assert.throws(()=>store.save(restored,beforeDelete,{remove:true}));assert.equal(store.loadAll().length,1);
  store.beforeCommit=null;store.save(restored,beforeDelete,{remove:true});assert.equal(store.loadAll().length,0);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM seat_credentials').get().n,0);assert.equal(store.db.prepare('SELECT count(*) AS n FROM command_receipts').get().n,0);
  // Never silently open a database produced by a newer application schema.
  store.db.exec('PRAGMA user_version=999');store.close();assert.throws(()=>new RoomStore(filename),/newer/);
  console.log('SQLite transactions, schema guards, rollback, hashed credentials, durable command receipts, stale-decision guards and cascade deletion passed.');
}finally{if(!store.closed)store.close();fs.rmSync(dir,{recursive:true,force:true});}
