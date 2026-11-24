'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {io}=require('socket.io-client'),{launch,until}=require('../helpers/live-server');
async function main(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uramaku-proxy-'));let server;const clients=[];
 try{
  server=await launch(path.join(dir,'rooms.sqlite'),{NODE_ENV:'production',RAILWAY_PROJECT_ID:'test',RAILWAY_VOLUME_MOUNT_PATH:dir,TRUST_RAILWAY_PROXY:'1',TRUSTED_PROXY_HOPS:'0',MAX_CONNECTIONS_PER_IP:'1',RATE_CREATE_PER_10_MIN:'1'});
  async function connect(real,transport='websocket',forwarded='192.0.2.9'){
   const c=io(server.url,{forceNew:true,reconnection:false,transports:[transport],extraHeaders:{'X-Real-IP':real,'X-Forwarded-For':forwarded}});clients.push(c);
   let failure;c.on('state',state=>c.state=state);c.on('connect_error',error=>failure=error.message);await until(()=>c.connected||failure,'simulated edge connection');return {c,failure};
  }
  const a=await connect('203.0.113.1'),b=await connect('203.0.113.2','polling');assert(a.c.connected);assert(b.c.connected);
  const same=await connect('203.0.113.1','polling','198.51.100.4');assert.match(same.failure,/server is full/);
  const ack=(c,event,data)=>c.timeout(2000).emitWithAck(event,data);
  const credential=await ack(a.c,'prepareEntry',{kind:'create',nickname:'First'});assert(credential.intentId);
  assert.match((await ack(a.c,'prepareEntry',{kind:'create',nickname:'Rate limited'})).error,/Too many requests/);
  assert((await ack(b.c,'prepareEntry',{kind:'create',nickname:'Independent'})).intentId,'Another real IP has a separate creation budget');
  const malformed=await connect('not-an-ip'),otherMalformed=await connect('also-invalid','polling');assert(malformed.c.connected);assert.match(otherMalformed.failure,/server is full/,'Invalid headers share the safe peer quota');
  assert((await ack(a.c,'confirmEntry',{code:credential.code,token:credential.resumeToken,intentId:credential.intentId})).ok);
  assert((await ack(b.c,'joinRoom',{code:credential.code,nickname:'Second'})).ok);
  await until(()=>b.c.state?.room.players.length===2,'observer roster');
  a.c.disconnect();await until(()=>b.c.state.room.players.some(p=>p.name==='First'&&!p.connected),'server-side disconnect');
  const resumed=await connect('203.0.113.1');assert(resumed.c.connected,'Disconnect releases the same resolved IP');
  assert((await ack(resumed.c,'resumeSession',{code:credential.code,token:credential.resumeToken})).ok);
  assert((await ack(resumed.c,'leaveRoom',{})).ok);assert((await ack(b.c,'leaveRoom',{})).ok);
  const health=await fetch(server.url+'/health').then(r=>r.json());assert(health.ok);assert.equal(health.rooms,0,'Temporary test lobbies are removed after the checks');
  console.log('Real WebSocket/polling with simulated Railway edge headers: separate client quotas, shared-IP admission, creation limits, invalid fallback and disconnect release passed.');
 }finally{for(const c of clients)c.disconnect();if(server)await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
