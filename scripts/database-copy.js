'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{Database,backup}=require('node:sqlite');
const {validateSnapshot,SNAPSHOT_VERSION,SCHEMA_VERSION}=require('../server/room-store');
function validateFile(filename){
 const db=new Database(filename,{readOnly:true});try{
  if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Database integrity check failed.');
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(![1,SCHEMA_VERSION].includes(version))throw Error('Unsupported database version.');
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Database references are incomplete.');
  for(const row of db.prepare('SELECT code,revision,snapshot_version,state_json FROM rooms').all()){
   if(row.snapshot_version!==SNAPSHOT_VERSION)throw Error('Unsupported snapshot version.');
   const room=JSON.parse(row.state_json);validateSnapshot(room);if(room.code!==row.code||room.revision!==row.revision)throw Error('Snapshot metadata mismatch.');
  }
  // Validate the tables used for reconnects and duplicate-command recovery too.
  for(const table of ['seat_credentials','command_receipts','entry_intents',...(version>=2?['engagement_meta','engagement_daily','engagement_active']:[])])db.prepare('SELECT count(*) AS n FROM '+table).get();
 }finally{db.close();}
}
async function copyDatabase(from,to){
 from=path.resolve(from);to=path.resolve(to);
 if(!fs.statSync(from).isFile())throw Error('The source must be a database file.');
 if(fs.existsSync(to)||fs.existsSync(to+'-wal')||fs.existsSync(to+'-shm'))throw Error('Destination already exists. Choose a fresh path; existing databases are never overwritten.');
 fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o700});
 const temp=path.join(path.dirname(to),'.uramaku-copy-'+randomUUID()+'.sqlite');
 const source=new Database(from,{readOnly:true});
 try{
  await backup(source,temp);fs.chmodSync(temp,0o600);validateFile(temp);
  // Atomic publish without overwriting a file created by another process.
  fs.linkSync(temp,to);return to;
 }finally{source.close();for(const file of [temp,temp+'-wal',temp+'-shm'])try{fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
async function main(){
 const args=process.argv.slice(2),mode=args.shift();if(!['backup','restore'].includes(mode))throw Error('Usage: node scripts/database-copy.js backup|restore --from SOURCE --to NEW_FILE');
 const fields={};while(args.length){const key=args.shift();if(!['--from','--to'].includes(key)||!args.length||fields[key])throw Error('Expected --from SOURCE --to NEW_FILE.');fields[key]=args.shift();}
 const from=fields['--from']||(mode==='backup'?process.env.SQLITE_PATH||path.join(__dirname,'../data/uramaku.sqlite'):null),to=fields['--to'];
 if(!from||!to)throw Error('Specify --from SOURCE and --to NEW_FILE.');
 console.log(await copyDatabase(from,to));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={copyDatabase,validateFile};
