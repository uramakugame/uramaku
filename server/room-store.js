'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {Database}=require('node:sqlite');
const ROLES=require('../shared/roles');
const VERSION=1;

// Only engine state is serialized. Transport objects and bearer secrets are
// never part of the snapshot. Credentials are already one-way hashes.
function encode(room){const {seatTokens,...state}=room;return JSON.stringify(state);}
function cloneRoom(room){return {...JSON.parse(encode(room)),seatTokens:new Map(room.seatTokens||[])};}
function validate(room){
  if(!room||!['lobby','playing','finished'].includes(room.status)||typeof room.code!=='string'||!Array.isArray(room.players)||!Array.isArray(room.deck)||!Array.isArray(room.discard))throw Error('Invalid room snapshot');
  const members=[...room.players,...(room.spectators||[])];
  if(new Set(members.map(p=>p.id)).size!==members.length)throw Error('Duplicate saved seat');
  for(const p of room.players)if(typeof p.id!=='string'||typeof p.name!=='string'||!Number.isInteger(p.coins)||p.coins<0||!Array.isArray(p.influences))throw Error('Invalid saved player');
  for(const field of ['spectators','log','revealedCards','sharedInvestigations','chat'])if(!Array.isArray(room[field]))throw Error('Incomplete room snapshot');
  for(const role of [...room.deck,...room.discard,...room.players.flatMap(p=>p.influences)])if(!Object.hasOwn(ROLES,role))throw Error('Unknown saved role');
  if(!Number.isInteger(room.turn)||!Number.isInteger(room.turnNumber)||!room.log.every(line=>typeof line==='string'))throw Error('Invalid saved turn');
  if(room.challengeLosses!==undefined&&(!Array.isArray(room.challengeLosses)||room.challengeLosses.some(q=>q.kind!=='lose'||q.parallel!==true||!room.players.some(p=>p.id===q.loserId&&p.alive)||!Number.isInteger(q.lossCount)||q.lossCount<1)))throw Error('Invalid saved challenge penalties');
  if(room.pending&&(!['claim','counterClaim','counterOffer','lose','information','informationShare','summon'].includes(room.pending.kind)))throw Error('Invalid pending decision');
}
class RoomStore{
  constructor(filename,{beforeCommit,onTransaction}={}){
    if(filename!==':memory:'){
      fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
      this.filename=path.resolve(filename);
    }else this.filename=filename;
    this.db=new Database(this.filename,{timeout:2500});this.beforeCommit=beforeCommit;this.onTransaction=onTransaction;this.closed=false;
    if(filename!==':memory:')fs.chmodSync(this.filename,0o600);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    const version=this.db.prepare('PRAGMA user_version').get().user_version;
    if(version>VERSION){this.db.close();throw Error('Database schema is newer than this application');}
    if(version===0)this.transaction(()=>this.db.exec(`
      CREATE TABLE rooms(code TEXT PRIMARY KEY, snapshot_version INTEGER NOT NULL, revision INTEGER NOT NULL, state_json TEXT NOT NULL, updated_at INTEGER NOT NULL) STRICT;
      CREATE TABLE seat_credentials(room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, seat_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, PRIMARY KEY(room_code,seat_id)) STRICT;
      CREATE TABLE command_receipts(room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, seat_id TEXT NOT NULL, command_id TEXT NOT NULL, fingerprint TEXT NOT NULL, result_json TEXT NOT NULL, PRIMARY KEY(room_code,seat_id,command_id)) STRICT;
      CREATE TABLE entry_intents(id TEXT PRIMARY KEY, code TEXT NOT NULL, kind TEXT NOT NULL, seat_id TEXT NOT NULL, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL) STRICT;
      CREATE INDEX entry_code ON entry_intents(code);
      PRAGMA user_version=1;
    `));
  }
  transaction(fn){
    let began=false,finishing=false,committed=false;const started=this.onTransaction?performance.now():0;
    try{
      this.db.exec('BEGIN IMMEDIATE');began=true;
      const result=fn();finishing=true;this.beforeCommit?.();
      this.db.exec('COMMIT');this.writeError=false;committed=true;return result;
    }catch(error){
      if(began)this.db.exec('ROLLBACK');
      if(finishing||String(error.code).includes('SQLITE'))this.writeError=true;
      throw error;
    }finally{try{this.onTransaction?.(performance.now()-started,committed);}catch{}}
  }
  loadAll(){
    return this.db.prepare('SELECT * FROM rooms ORDER BY code').all().map(row=>{
      if(row.snapshot_version!==VERSION)throw Error('Unsupported snapshot version');
      const room=JSON.parse(row.state_json);validate(room);
      if(room.code!==row.code||room.revision!==row.revision)throw Error('Snapshot metadata mismatch');
      room.seatTokens=new Map(this.db.prepare('SELECT seat_id,token_hash FROM seat_credentials WHERE room_code=?').all(row.code).map(r=>[r.seat_id,r.token_hash]));
      return room;
    });
  }
  receipt(code,seat,id){return this.db.prepare('SELECT fingerprint,result_json FROM command_receipts WHERE room_code=? AND seat_id=? AND command_id=?').get(code,seat,id);}
  save(room,expectedRevision,{receipt,consumeIntent,remove=false}={}){
    if(!remove)validate(room);
    return this.transaction(()=>{
      const existing=this.db.prepare('SELECT revision FROM rooms WHERE code=?').get(room.code);
      if((existing?.revision??null)!==expectedRevision)throw Error('Room revision conflict');
      if(remove){this.db.prepare('DELETE FROM rooms WHERE code=?').run(room.code);this.db.prepare('DELETE FROM entry_intents WHERE code=?').run(room.code);return;}
      this.db.prepare('INSERT INTO rooms VALUES(?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET snapshot_version=excluded.snapshot_version,revision=excluded.revision,state_json=excluded.state_json,updated_at=excluded.updated_at').run(room.code,VERSION,room.revision,encode(room),Date.now());
      // At most eight seats plus spectators; update only changed credentials.
      const prior=this.db.prepare('SELECT seat_id,token_hash FROM seat_credentials WHERE room_code=?').all(room.code);
      for(const p of prior)if(!room.seatTokens?.has(p.seat_id))this.db.prepare('DELETE FROM seat_credentials WHERE room_code=? AND seat_id=?').run(room.code,p.seat_id);
      for(const [id,hash] of room.seatTokens||[]){
        if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid credential hash');
        if(!prior.some(p=>p.seat_id===id&&p.token_hash===hash))this.db.prepare('INSERT INTO seat_credentials VALUES(?,?,?) ON CONFLICT(room_code,seat_id) DO UPDATE SET token_hash=excluded.token_hash').run(room.code,id,hash);
      }
      if(receipt){
        this.db.prepare('INSERT INTO command_receipts VALUES(?,?,?,?,?)').run(room.code,receipt.seat,receipt.id,receipt.fingerprint,JSON.stringify(receipt.result));
        this.db.prepare('DELETE FROM command_receipts WHERE room_code=? AND rowid NOT IN (SELECT rowid FROM command_receipts WHERE room_code=? ORDER BY rowid DESC LIMIT 512)').run(room.code,room.code);
      }
      if(consumeIntent)this.db.prepare('DELETE FROM entry_intents WHERE id=?').run(consumeIntent);
    });
  }
  prepareEntry(intent){
    this.transaction(()=>{
      this.db.prepare('DELETE FROM entry_intents WHERE expires_at<=?').run(Date.now());
      if(this.db.prepare('SELECT count(*) AS n FROM entry_intents').get().n>=2048)throw Error('Too many pending entries');
      this.db.prepare('INSERT INTO entry_intents VALUES(?,?,?,?,?,?,?)').run(intent.id,intent.code,intent.kind,intent.seatId,intent.name,intent.tokenHash,intent.expiresAt);
    });
  }
  cleanupEntries(now=Date.now()){
    if(!this.db.prepare('SELECT 1 FROM entry_intents WHERE expires_at<=? LIMIT 1').get(now))return 0;
    return this.transaction(()=>this.db.prepare('DELETE FROM entry_intents WHERE expires_at<=?').run(now).changes);
  }
  entry(id){return this.db.prepare('SELECT * FROM entry_intents WHERE id=? AND expires_at>?').get(id,Date.now());}
  codeReserved(code){return !!this.db.prepare('SELECT 1 FROM entry_intents WHERE code=? AND expires_at>? LIMIT 1').get(code,Date.now());}
  healthy(){return !this.closed&&!this.writeError&&this.db.prepare('SELECT 1 AS ok').get().ok===1;}
  close(){if(this.closed)return;this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');this.db.close();this.closed=true;}
}
module.exports={RoomStore,cloneRoom,encode,validateSnapshot:validate,SNAPSHOT_VERSION:VERSION};
