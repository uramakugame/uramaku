const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const realGame=require('../../server/game');
const realSession=require('../../server/session');

// Exercise the REAL room event handlers with fake Socket.IO transports. In
// particular, reuse the same socket ID when a departed player makes a room.
const serverSource=fs.readFileSync(path.join(__dirname,'../../server/index.js'),'utf8');
let ioInstance;
class MockIoServer {
  constructor(){ioInstance=this;}
  use(fn){this.admit=fn;}
  on(event,listener){if(event==='connection')this.connect=listener;}
}
const express=()=>({use(){},get(){}});
express.static=()=>()=>{};
const fakeHttp={createServer(){return {listen(){}};}};
const testContext={
  require(id){
    if(id==='express')return express;
    if(id==='socket.io')return {Server:MockIoServer};
    if(id==='http')return fakeHttp;
    if(id==='./game')return realGame;
    if(id==='./session')return realSession;
    if(id.startsWith('./'))return require(path.resolve(__dirname,'../../server',id));
    return require(id);
  },
  __dirname:path.join(__dirname,'../../server'),console,process:{env:{PORT:0,SQLITE_PATH:':memory:'}}
};
vm.createContext(testContext);
vm.runInContext(serverSource,testContext,{filename:'server/index.js'});
function client(id){
  const socket={id,data:{},handlers:{},received:[],
    on(event,handler){this.handlers[event]=handler;},
    emit(event,payload){this.received.push({event,payload});},
    disconnect(){this.disconnected=true;},
    send(event,payload={}){let response;this.handlers[event](payload,result=>{response=result;});return response;}
  };
  ioInstance.admit(socket,error=>{if(error)throw error;ioInstance.connect(socket);});
  return socket;
}
const akira=client('same-socket-id');
const sora=client('other-socket-id');
const first=akira.send('createRoom',{nickname:'Akira'});
assert.equal(first.code.length,4);
assert.equal(sora.send('joinRoom',{code:first.code,nickname:'Sora'}).code,first.code);
// Simulate a completed match; its player records intentionally remain for the
// match recap. This is exactly the lifecycle that caused the reported bug.
const finished=vm.runInContext(`rooms.get('${first.code}')`,testContext);
finished.status='finished';finished.winner='Sora';
assert.equal(akira.send('leaveRoom').ok,true);
assert.equal(finished.players.find(p=>p.name==='Akira').connected,false);
const next=akira.send('createRoom',{nickname:'Akira'});
assert.notEqual(next.code,first.code);
assert.equal(akira.data.room,next.code);
assert.equal(akira.data.playerId,'same-socket-id','Same socket ID must be reused in this regression');
const akiraStateCount=akira.received.filter(x=>x.event==='state').length;
const soraStateCount=sora.received.filter(x=>x.event==='state').length;
vm.runInContext(`emitRoom('${first.code}')`,testContext);
assert.equal(akira.received.filter(x=>x.event==='state').length,akiraStateCount,'Old-room broadcasts cannot displace a departed player');
assert.equal(sora.received.filter(x=>x.event==='state').length,soraStateCount+1);
assert.equal(akira.send('setRoomDetails',{name:'New room'}).ok,true);assert.equal(akira.received.at(-1).payload.room.code,next.code);
assert.equal(akira.handlers.chatMessage,undefined);
const browser=require('../helpers/browser-room-harness')();const newRoom=vm.runInContext(`rooms.get('${next.code}')`,testContext);
browser.paint(realGame.publicState(newRoom),realGame.privateState(newRoom,'same-socket-id'));
browser.handlers.state({room:realGame.publicState(finished),you:null});assert.equal(browser.value('state.code'),next.code,'Browser rejects old-room snapshots');
console.log('Finished-room broadcast isolation, new-room updates, stale-state guard and absent chat endpoint passed.');

// Repeated Start requests cannot reset an active or completed match.
{
 const host=client('start-host');
 const guest=client('start-guest');
 const {code}=host.send('createRoom',{nickname:'Host'});
 guest.send('joinRoom',{code,nickname:'Guest'});
 guest.send('ready',{ready:true});
 host.send('startGame');
 const room=vm.runInContext(`rooms.get('${code}')`,testContext);
 assert.equal(room.status,'playing');
 const snapshot=JSON.stringify(room);
 host.send('startGame');
 assert.equal(JSON.stringify(room),snapshot,'An active room must keep its hands, coins, deck and turn');
 assert.equal(host.received.at(-1).event,'notice');
 assert.equal(host.received.at(-1).payload.message,'This match has already started.');
 room.status='finished';
 host.send('startGame');
 assert.equal(room.status,'finished');
 assert.equal(host.received.at(-1).payload.message,'This match has already started.');
}
console.log('Repeated match start requests are rejected without resetting room state.');
