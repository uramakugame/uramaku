'use strict';
// Real HTTP + Socket.IO clients supplement the deterministic handler harness.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {io}=require('socket.io-client');
const root=path.resolve(__dirname,'../..');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){const value=predicate();if(value)return value;await wait(10);}
  throw new Error('Timed out: '+label);
}
async function main(){
  const child=spawn(process.execPath,['server/index.js'],{cwd:root,env:{...process.env,PORT:'0',SQLITE_PATH:':memory:'},stdio:['ignore','pipe','pipe']});
  let output='',errors='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>errors+=data);
  const clients=[];
  try {
    await until(()=>/localhost:\d+/.test(output)||child.exitCode!==null,'server start');
    assert.equal(child.exitCode,null,errors);
    const port=Number(output.match(/localhost:(\d+)/)[1]),url=`http://127.0.0.1:${port}`;
    async function connect(transport){
      const c=io(url,{transports:[transport],reconnection:false,forceNew:true});clients.push(c);
      c.on('state',state=>{c.state=state;});c.on('notice',notice=>{c.notice=notice;});
      await until(()=>c.connected,'connection over '+transport);assert.equal(c.io.engine.transport.name,transport);
      return c;
    }
    const host=await connect('polling'),b=await connect('websocket'),c=await connect('polling'),d=await connect('websocket');
    const crew=[host,b,c,d],credentials=new Map();
    const first=await host.timeout(2000).emitWithAck('createRoom',{nickname:'Host'});assert(first.code);credentials.set(host,first);
    for(const [index,p] of [b,c,d].entries())credentials.set(p,await p.timeout(2000).emitWithAck('joinRoom',{code:first.code,nickname:'Guest '+index}));
    await until(()=>crew.every(p=>p.state?.room.players.length===4),'roster');
    assert.equal((await host.timeout(2000).emitWithAck('createRoom',null)).error,'Invalid request.');
    assert.equal((await host.timeout(2000).emitWithAck('createRoom',{nickname:'Ghost'})).error,'Leave your current room before joining another.');
    for(const p of crew)assert(!JSON.stringify(p.state).includes(first.resumeToken),'Tokens remain private');
    host.emit('setChallengeTimer',{enabled:false});
    for(const p of [b,c,d])p.emit('ready',{ready:true});
    await until(()=>host.state.room.players.every(p=>p.ready)&&host.state.room.challengeTimerEnabled===false,'settings and readiness');
    host.emit('startGame');await until(()=>crew.every(p=>p.state?.room.status==='playing'),'start match');
    const actor=crew.find(p=>p.state.you.id===host.state.room.turnPlayerId),actorId=actor.state.you.id;
    const coins=actor.state.you.coins;
    actor.emit('action',{action:'tax'});await until(()=>crew.every(p=>p.state.room.pending?.kind==='claim'),'Tax claim');
    for(const p of crew.filter(p=>p!==actor))p.emit('passChallenge');
    await until(()=>actor.state.room.pending===null&&actor.state.room.turnPlayerId!==actorId,'Tax continuation');
    assert.equal(actor.state.you.coins,coins+2);
    const next=crew.find(p=>p.state.you.id===actor.state.room.turnPlayerId),challenger=crew.find(p=>p!==next);
    const genuine=next.state.you.influences.includes('lord');
    const loser=genuine?challenger:next;
    next.emit('action',{action:'tax'});await until(()=>challenger.state.room.pending?.kind==='claim','second claim');
    const loss=()=>loser.state.room.pending?.kind==='lose'?loser.state.room.pending:(loser.state.room.challengeLosses||[]).find(q=>q.loserId===loser.state.you.id);
    challenger.emit('challenge');await until(()=>loss(),'challenge loss');
    assert.equal(loss().loserId,loser.state.you.id);
    loser.emit('loseInfluence',{cardIndex:0});await until(()=>loser.state.you.influences.length===1,'penalty selection');
    await until(()=>crew.every(p=>p.state.room.pending===null&&!p.state.room.challengeLosses?.length),'challenge continuation');
    // A temporary disconnect retains the seat and exact private hand.
    const saved=credentials.get(next),seat=next.state.you.id,hand=[...next.state.you.influences],balance=next.state.you.coins;
    const observer=crew.find(p=>p!==next);next.disconnect();
    await until(()=>observer.state.room.players.find(p=>p.id===seat).connected===false,'disconnected indicator');
    const stranger=await connect('websocket');
    assert((await stranger.timeout(2000).emitWithAck('resumeSession',{code:first.code,token:'0'.repeat(64)})).error);
    const resumed=await connect('polling');
    assert((await resumed.timeout(2000).emitWithAck('resumeSession',{code:first.code,token:saved.resumeToken})).ok);
    await until(()=>resumed.state?.you.id===seat,'authenticated refresh');
    assert.deepEqual(resumed.state.you.influences,hand);assert.equal(resumed.state.you.coins,balance);
    assert.equal(resumed.state.room.players.length,4);
    const activeHost=next===host?resumed:host;
    const invalid=await activeHost.timeout(2000).emitWithAck('ready',{ready:'yes'});assert.equal(invalid.error,'Invalid request.');
    activeHost.emit('chatMessage',{message:'Transport check'});await until(()=>resumed.state.room.chat.at(-1)?.message==='Transport check','chat');
    const health=await fetch(url+'/health').then(r=>r.json());assert.equal(health.ok,true);assert.equal(health.rooms,1);
    console.log('Real polling/WebSocket clients: create/join, ready/start, Tax, challenge/loss, chat, malformed packets and authenticated reconnect passed.');
  } finally {
    for(const client of clients)client.disconnect();
    child.kill('SIGTERM');await until(()=>child.exitCode!==null||child.signalCode!==null,'child cleanup');
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
