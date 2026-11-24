'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {RoomStore}=require('../../server/room-store'),{RoomTransitions}=require('../../server/room-transitions');
const game=require('../../server/game'),{copyDatabase,validateFile}=require('../../scripts/database-copy');
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-backup-')),source=path.join(dir,'source.sqlite'),saved=path.join(dir,'backups/saved.sqlite'),restored=path.join(dir,'restored.sqlite');let store,reader;
 try{
  store=new RoomStore(source);const rooms=new Map(),transitions=new RoomTransitions(store,rooms);
  const room=game.createGame('TEST',{id:'owner',name:'Owner',ready:true,alive:true,coins:0,influences:[]});
  room.seatTokens=new Map([['owner','a'.repeat(64)]]);transitions.create(room);
  transitions.run('TEST',null,'test',{},next=>{next.players.push({id:'guest',name:'Guest',ready:true,alive:true,coins:0,influences:[]});game.startGame(next);next.pending={kind:'summon',claimantId:'owner',stage:'preview',drawnRole:next.deck.pop()};return{ok:true};});
  const before=store.loadAll();await copyDatabase(source,saved);validateFile(saved);
  reader=new RoomStore(saved);assert.deepEqual(reader.loadAll(),before,'Online backup includes committed WAL state and private pending decisions');reader.close();reader=null;
  assert.equal(fs.statSync(saved).mode&0o777,0o600);
  transitions.run('TEST',null,'test',{},next=>{next.players[0].coins++;return{ok:true};});
  await copyDatabase(saved,restored);reader=new RoomStore(restored);assert.deepEqual(reader.loadAll(),before,'Restored copy is independent of newer source writes');reader.close();reader=null;
  const bytes=fs.readFileSync(restored);await assert.rejects(()=>copyDatabase(source,restored),/already exists/);assert.deepEqual(fs.readFileSync(restored),bytes);
  fs.writeFileSync(path.join(dir,'bad.sqlite'),'not a database');await assert.rejects(()=>copyDatabase(path.join(dir,'bad.sqlite'),path.join(dir,'bad-copy.sqlite')));assert(!fs.existsSync(path.join(dir,'bad-copy.sqlite')));
  const watched=new RoomStore(':memory:',{onTransaction(){throw Error('Observer failure');}});assert(watched.healthy(),'Metrics callback cannot break commits');watched.close();
  console.log('Online SQLite backup, hidden/pending-state and credential recovery, independent restore, integrity checks and overwrite refusal passed.');
 }finally{reader?.close();store?.close();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
