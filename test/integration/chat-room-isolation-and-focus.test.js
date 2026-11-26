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
sora.send('chatMessage',{message:'The old match was fun.'});
assert.equal(finished.chat.at(-1).message,'The old match was fun.','Old room chat still works after the match');
assert.equal(akira.received.filter(x=>x.event==='state').length,akiraStateCount,
  'Chat in a finished old room must not push a departed player out of their new room');
assert.equal(sora.received.filter(x=>x.event==='state').length,soraStateCount+1,
  'Players still in the finished room must receive chat updates');
assert.equal(akira.data.room,next.code);
assert.equal(akira.received.at(-1).payload.room.code,next.code);
assert.equal(akira.send('chatMessage',{message:'Message from new lobby'}).ok,true);
assert.equal(akira.received.at(-1).payload.room.code,next.code,'New lobby must still receive its own chat');

const appSource=fs.readFileSync(path.join(__dirname,'../../public/js/app.js'),'utf8');
// Sending via Enter or the Send button must retain the same focused input;
// replacing app.innerHTML was previously dropping the cursor.
const sendChat=appSource.slice(appSource.indexOf('function sendChat(){'),appSource.indexOf('function hasRole('));
let focusCount=0;
const input={value:' Hello again ',focus(){focusCount++;this.focused=true;}};
const sent=[];
const composeContext={chatDraft:' Hello again ',
  $:selector=>selector==='#chatInput'?input:null,
  send:(event,payload)=>sent.push({event,payload}),
  render(){throw Error('Chat send must not replace the input element');}
};
vm.runInNewContext(sendChat+'\nsendChat()',composeContext);
assert.equal(sent.length,1);
assert.equal(sent[0].event,'chatMessage');
assert.equal(sent[0].payload.message,'Hello again');
assert.equal(input.value,'');assert.equal(composeContext.chatDraft,'');assert.equal(focusCount,1);
assert.equal(input.focused,true);

// Reject even a delayed/stale old-room state at the browser boundary. This
// guard is defense-in-depth alongside the server room-membership check.
const stateHandler=appSource.slice(appSource.indexOf("socket.on('state',d=>{"),appSource.indexOf("socket.on('notice'"));
const handlers={};
const clientRoom={code:next.code,status:'lobby',chat:[],log:[]};
const messages={innerHTML:'',scrollTop:0,scrollHeight:1};
let rendered=0;
const stateContext={
  socket:{on:(type,handler)=>handlers[type]=handler},
  pendingReplacementChoice:null,roomCode:next.code,state:clientRoom,me:{id:'same-socket-id',name:'Akira'},chatOpen:true,
  unreadChat:0,announcedWinnerRoom:null,
  document:{querySelector:sel=>sel==='.chat-messages'?messages:null},
  window:{URAMAKU_PRESENTATION:{enqueue(_container,{run}){run(()=>{},()=>true);}},URAMAKU_FEEDBACK:{...require('../../public/js/components/game-feedback'),animate(){},present({after,you,render,complete}){render(after,you);complete();}}},
  app:{},referenceLanguage:'en',
  UramakuAudio:{play(){},gameEvent(){return 'coin'}},syncMandatoryPurgeTargeting(){},
  render(){rendered++},showActionAnnouncement(){},showVictory(){},
  esc:input=>String(input),t:()=> 'No messages yet.'
};
vm.createContext(stateContext);
vm.runInContext(stateHandler,stateContext);
handlers.state({room:{code:first.code,status:'finished',chat:[],log:[]},you:{}});
assert.equal(stateContext.state,clientRoom,'Browser ignores mismatched room updates');
assert.equal(rendered,0);
handlers.state({room:{...clientRoom,chat:[{name:'Akira',message:'Hi again'}]},you:stateContext.me});
assert.equal(rendered,0,'Chat-only updates leave the input mounted and focused');
assert.match(messages.innerHTML,/Hi again/);
console.log('Finished-room chat isolation, new-room updates, stale-state guard and continuous chat focus passed.');

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
