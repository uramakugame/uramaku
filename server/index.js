'use strict';
const path=require('node:path');
const {randomUUID,randomBytes,randomInt}=require('node:crypto');
const {setTimeout,clearTimeout}=require('node:timers');
const http=require('http');
const express=require('express');
const {Server}=require('socket.io');
const {tokenHash,tokenMatches}=require('./session');
const {onInput}=require('./socket-input');
const {RoomStore}=require('./room-store');
const {RoomTransitions}=require('./room-transitions');
const game=require('./game');
const {availableRooms,listRooms}=require('./room-directory');
const {needsUpdate,shouldRemove}=require('./room-lifecycle');
const {AbuseGuard,settings}=require('./abuse-guard');
const config=settings(process.env),abuse=new AbuseGuard(config);
const {runtimeConfig,allowOrigin}=require('./runtime-config');
const runtime=runtimeConfig(process.env);
const telemetry=require('./telemetry').createTelemetry(process.env);
const metricRuntime=require('./metrics-runtime').runtimeMetrics();

const app=express();
const server=http.createServer(app);
const io=new Server(server,{maxHttpBufferSize:16384,allowRequest:(request,callback)=>callback(null,allowOrigin(request,runtime))});
const rooms=new Map();
const socketsByPlayer=new Map();
const challengeTimers=new Map();
const store=new RoomStore(runtime.filename,{onTransaction:(ms,ok)=>{metricRuntime.recordTransaction(ms,ok);telemetry?.recordTransaction(ms,ok);}});
const transitions=new RoomTransitions(store,rooms);
let shuttingDown=false;
const browserSubscribers=new Set();
let directorySignature='',directoryTimer=null,cleanupTimer=null;
for(const room of store.loadAll()){
  for(const p of [...room.players,...(room.spectators||[])])p.connected=false;
  rooms.set(room.code,room);
}
require('./metrics-dashboard').installDashboard(app,{env:process.env,store,rooms,abuse,runtime:metricRuntime});
app.use(express.static(path.join(__dirname,'..','public')));
app.use('/shared',express.static(path.join(__dirname,'..','shared')));
app.get('/health',(_,res)=>{
  try{if(!shuttingDown&&store.healthy())return res.json({ok:true,rooms:rooms.size});}catch{}
  res.status(503).json({ok:false});
});
function member(room,id){return room?.players.find(p=>p.id===id)||(room?.spectators||[]).find(p=>p.id===id);}
function error(socket,message){socket.emit('notice',{type:'error',message});}
function reply(socket,cb,result){
  if(!result.ok){cb({error:result.error});error(socket,result.error);return false;}
  cb(result);return true;
}
function syncChallengeTimer(room){
  const q=room.pending;
  const active=room.status==='playing'&&['claim','counterClaim'].includes(q?.kind)&&q.stage==='challenge'&&Number.isFinite(q.challengeDeadline);
  const key=active?`${q.decisionId}:${q.challengeDeadline}`:null;
  const previous=challengeTimers.get(room.code);
  if(active&&previous?.key===key)return;
  if(previous){clearTimeout(previous.timer);challengeTimers.delete(room.code);}
  if(!active||shuttingDown)return;
  const timer=setTimeout(()=>{
    if(challengeTimers.get(room.code)?.key!==key)return;
    challengeTimers.delete(room.code);
    if(rooms.get(room.code)?.pending?.decisionId!==q.decisionId)return;
    try{if(!expireRoom(room.code))syncChallengeTimer(room);}
    catch{
      // A failed write never advances the published game. Retry the same
      // saved deadline; there is no fresh challenge window.
      const retry=setTimeout(()=>{challengeTimers.delete(room.code);syncChallengeTimer(room);},1000);retry.unref();
      challengeTimers.set(room.code,{key,timer:retry});
    }
  },Math.max(0,q.challengeDeadline-Date.now()));
  timer.unref();challengeTimers.set(room.code,{key,timer});
}
function notifyDirectory(){
  const signature=JSON.stringify(availableRooms(rooms));
  if(signature===directorySignature)return;
  directorySignature=signature;
  if(directoryTimer||!browserSubscribers.size)return;
  directoryTimer=setTimeout(()=>{directoryTimer=null;for(const socket of browserSubscribers)socket.emit('publicRoomsChanged');},150);
  directoryTimer.unref();
}
function emitRoom(code){
  try{if(cleanupRoom(code))return;}catch{console.error('Room cleanup could not be saved.');}
  notifyDirectory();
  const room=rooms.get(code);if(!room)return;
  syncChallengeTimer(room);
  const publicRoom=game.publicState(room),serverNow=Date.now();
  for(const p of [...room.players,...(room.spectators||[])]){
    const socket=socketsByPlayer.get(p.id);
    if(socket&&socket.data.room===code&&socket.data.playerId===p.id)socket.emit('state',{room:publicRoom,you:game.privateState(room,p.id),serverNow});
  }
}
function cleanupRoom(code,now=Date.now()){
  const room=rooms.get(code);if(!room||!shouldRemove(room,now,config.lobbyTtl))return false;
  // Removal, credential revocation and receipt/entry cleanup commit together.
  transitions.run(code,null,'deleteEmptyRoom',{},()=>({ok:true}),{remove:true});
  const timer=challengeTimers.get(code);if(timer)clearTimeout(timer.timer);challengeTimers.delete(code);
  notifyDirectory();return true;
}
function sweepRooms(){
  if(shuttingDown)return;
  try{store.cleanupEntries();}catch{console.error('Entry cleanup could not be saved.');}
  for(const room of rooms.values())try{
    if(needsUpdate(room))transitions.run(room.code,null,'lifecycle',{},()=>({ok:true}));
    cleanupRoom(room.code);
  }catch{console.error('Room cleanup could not be saved.');}
  abuse.sweep();
  cleanupTimer=setTimeout(sweepRooms,config.cleanupInterval);cleanupTimer.unref();
}
function expireRoom(code,now=Date.now()){
  const room=rooms.get(code),q=room?.pending;
  if(room?.status!=='playing'||!['claim','counterClaim'].includes(q?.kind)||q.stage!=='challenge'||!Number.isFinite(q.challengeDeadline)||now<q.challengeDeadline)return false;
  const result=transitions.run(code,null,'expireChallenge',{},next=>({ok:game.expireChallenge(next,now)}));
  if(result.ok)emitRoom(code);return result.ok;
}
function bind(socket,room,id){
  const old=socketsByPlayer.get(id);
  socket.data.playerId=id;socket.data.room=room.code;socketsByPlayer.set(id,socket);
  if(old&&old!==socket){old.data.playerId=null;old.data.room=null;old.disconnect(true);}
}
function nextCode(){
  let code;do{code=Array.from({length:4},()=> '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[randomInt(36)]).join('');}while(rooms.has(code)||store.codeReserved(code));return code;
}
function seat(id,name,ready=false){return {id,name:name.trim(),coins:0,influences:[],alive:true,ready,connected:true,commandSequence:0};}
function validateJoin(room,name,spectator=false){
  if(!room)return {ok:false,error:'Room not found.'};
  if(!spectator&&room.status!=='lobby')return {ok:false,error:'This game has already started. Join as a spectator instead.'};
  if(spectator&&(room.spectators||[]).length>=config.maxSpectators)return {ok:false,error:'This room has reached its spectator limit.'};
  if(!spectator&&room.players.length>=Math.min(game.MAX_PLAYERS,room.maxPlayers??game.MAX_PLAYERS))return {ok:false,error:'This room is full.'};
  if([...room.players,...(room.spectators||[])].some(p=>p.name.toLowerCase()===name.trim().toLowerCase()))return {ok:false,error:'That nickname is already in use.'};
  return {ok:true};
}
function enter(socket,{code,name,id,kind,hash},consumeIntent){
  let result;
  if(kind==='create'){
    if(rooms.size>=config.maxRooms)return {ok:false,error:'The server is full. Please try again later.'};
    if(rooms.has(code))return {ok:false,error:'This entry has expired. Please try again.'};
    const room=game.createGame(code,seat(id,name,true));room.seatTokens=new Map([[id,hash]]);
    result=transitions.create(room,{consumeIntent});
  }else{
    result=transitions.run(code,null,'entry',{},room=>{
      const valid=validateJoin(room,name,kind==='spectator');if(!valid.ok)return valid;
      if(kind==='spectator')game.addSpectator(room,id,name);else room.players.push(seat(id,name));
      room.seatTokens.set(id,hash);return {ok:true};
    },{consumeIntent});
  }
  if(result.ok){const room=rooms.get(code);bind(socket,room,id);return {ok:true,code,spectator:kind==='spectator'};}
  return result;
}
function confirmEntry(socket,data){
  const code=data.code.trim().toUpperCase();
  const room=rooms.get(code);
  const existing=[...(room?.seatTokens||[])].find(([,hash])=>tokenMatches(data.token,hash));
  if(existing&&member(room,existing[0])){
    transitions.run(code,null,'presence',{},next=>{member(next,existing[0]).connected=true;return {ok:true};});
    bind(socket,room,existing[0]);return {ok:true,code,spectator:!room.players.some(p=>p.id===existing[0])};
  }
  const intent=store.entry(data.intentId);
  if(!intent||intent.code!==code||!tokenMatches(data.token,intent.token_hash))return {ok:false,error:'This entry has expired. Please try again.'};
  return enter(socket,{code,name:intent.name,id:intent.seat_id,kind:intent.kind,hash:intent.token_hash},intent.id);
}
function run(socket,event,data,operation,cb){
  const code=socket.data.room,id=socket.data.playerId,room=rooms.get(code);
  if(!room||!member(room,id)||socketsByPlayer.get(id)!==socket)return reply(socket,cb,{ok:false,error:'You are not in this room.'});
  const now=Date.now();expireRoom(code,now);
  const result=transitions.run(code,id,event,data,next=>operation(next,id,now));
  if(reply(socket,cb,result))emitRoom(code);
  return result;
}
function ownerSettings(room,id){
  if(!room.players.some(p=>p.id===id))return {ok:false,error:'Only players can change room settings.'};
  if(room.status!=='lobby')return {ok:false,error:'Game settings are locked once the match starts.'};
  if(room.hostId!==id)return {ok:false,error:'Only the room owner can change game settings.'};
  return {ok:true};
}

// Real Socket.IO admission middleware runs before a socket occupies a seat.
io.use((socket,next)=>{if(abuse.admit(socket))next();else next(new Error('The server is full. Please try again later.'));});
io.on('connection',socket=>{
  const on=(event,handler)=>onInput(socket,event,(data,cb)=>{
    if(shuttingDown)return reply(socket,cb,{ok:false,error:'The server is restarting. Please reconnect.'});
    return handler(data,cb);
  },(event,data)=>abuse.allow(socket,event,data));
  const alreadyJoined=()=>Boolean(socket.data.room||socket.data.playerId);
  const guardEntry=cb=>{if(!alreadyJoined())return false;cb({error:'Leave your current room before joining another.'});return true;};
  // Compatibility for older clients. The served browser uses prepare/confirm,
  // which retains its recovery credential BEFORE a seat can be committed.
  for(const [event,kind] of [['createRoom','create'],['joinRoom','join'],['joinSpectator','spectator']])on(event,(data,cb)=>{
    if(guardEntry(cb))return;
    const code=kind==='create'?nextCode():data.code.trim().toUpperCase();
    const token=randomBytes(32).toString('hex');
    const result=enter(socket,{code,name:data.nickname,id:socket.id,kind,hash:tokenHash(token)});
    if(!result.ok)return cb({error:result.error});
    cb({...result,resumeToken:token});emitRoom(code);
  });
  on('listRooms',(data,cb)=>{
    if(data.subscribe===true)browserSubscribers.add(socket);
    else if(data.subscribe===false)browserSubscribers.delete(socket);
    cb({ok:true,...listRooms(rooms,data)});
  });
  on('stopRoomBrowser',(_data,cb)=>{browserSubscribers.delete(socket);cb({ok:true});});
  on('setRoomDetails',(data,cb)=>run(socket,'setRoomDetails',data,(room,id)=>{
    const valid=ownerSettings(room,id);if(!valid.ok)return valid;
    if(data.name===undefined&&data.visibility===undefined)return {ok:false,error:'Enter a room name or choose visibility.'};
    if(data.name!==undefined)room.name=data.name.trim();
    if(data.visibility!==undefined)room.visibility=data.visibility;
    return {ok:true};
  },cb));
  on('prepareEntry',(data,cb)=>{
    if(guardEntry(cb))return;
    if(data.kind==='create'&&rooms.size>=config.maxRooms)return cb({error:'The server is full. Please try again later.'});
    const code=data.kind==='create'?nextCode():data.code?.trim().toUpperCase();
    if(data.kind!=='create'){const valid=validateJoin(rooms.get(code),data.nickname,data.kind==='spectator');if(!valid.ok)return cb({error:valid.error});}
    const token=randomBytes(32).toString('hex'),intent={id:randomUUID(),code,kind:data.kind,seatId:randomUUID(),name:data.nickname.trim(),tokenHash:tokenHash(token),expiresAt:Date.now()+120000};
    store.prepareEntry(intent);cb({code,resumeToken:token,intentId:intent.id});
  });
  on('confirmEntry',(data,cb)=>{
    const bound=rooms.get(socket.data.room);
    if(bound?.code===data.code.trim().toUpperCase()&&tokenMatches(data.token,bound.seatTokens.get(socket.data.playerId)))return cb({ok:true,code:bound.code});
    if(guardEntry(cb))return;
    const result=confirmEntry(socket,data);
    if(reply(socket,cb,result))emitRoom(result.code);
  });
  on('resumeSession',(data,cb)=>{
    if(guardEntry(cb))return;
    const code=data.code.trim().toUpperCase(),room=rooms.get(code);
    const match=[...(room?.seatTokens||[])].find(([,hash])=>tokenMatches(data.token,hash));
    if(!match&&data.intentId){const result=confirmEntry(socket,data);if(reply(socket,cb,result))emitRoom(result.code);return;}
    if(!room)return cb({error:'Room no longer exists.'});
    if(!match||!member(room,match[0]))return cb({error:'This seat could not be recovered.'});
    const id=match[0];
    transitions.run(code,null,'presence',{},next=>{member(next,id).connected=true;return {ok:true};});
    bind(socket,room,id);cb({ok:true,code,spectator:!room.players.some(p=>p.id===id)});emitRoom(code);
  });
  on('leaveRoom',(data,cb)=>{
    const code=socket.data.room,id=socket.data.playerId,room=rooms.get(code);
    if(!room||!member(room,id))return cb({error:'You are not in a room.'});
    expireRoom(code);
    const closing=room.status==='lobby'&&room.players.length===1&&room.players[0].id===id;
    const result=transitions.run(code,id,'leaveRoom',data,next=>{
      const p=next.players.find(p=>p.id===id);
      if(next.status==='playing'&&p?.alive){const r=game.forfeitPlayer(next,id);if(!r.ok)return r;}
      if(next.status==='lobby'){
        next.players=next.players.filter(p=>p.id!==id);next.spectators=next.spectators.filter(p=>p.id!==id);
        if(p)next.log.push(`${p.name} left the lobby.`);
        if(next.hostId===id)next.hostId=next.players[0]?.id||null;
      }else if(p)p.connected=false;
      else next.spectators=next.spectators.filter(p=>p.id!==id);
      next.seatTokens.delete(id);return {ok:true};
    },{remove:closing});
    if(!reply(socket,cb,result))return;
    socketsByPlayer.delete(id);socket.data.playerId=null;socket.data.room=null;
    if(closing){
      const timer=challengeTimers.get(code);if(timer)clearTimeout(timer.timer);challengeTimers.delete(code);
      for(const p of room.spectators||[]){const peer=socketsByPlayer.get(p.id);if(peer){peer.data.playerId=null;peer.data.room=null;peer.emit('kicked',{message:'The host closed the room.'});}socketsByPlayer.delete(p.id);}
    }else emitRoom(code);
    notifyDirectory();
  });
  on('kickPlayer',(data,cb)=>{
    const result=run(socket,'kickPlayer',data,(room,id)=>{
      let r;
      if(room.status==='lobby')r=game.removeLobbyPlayer(room,id,data.targetId);
      else{
        if(room.hostId!==id)return {ok:false,error:'Only the host can remove players.'};
        const target=room.players.find(p=>p.id===data.targetId);
        if(room.status!=='playing'||!target||target.id===id||!target.alive||!target.influences.length)return {ok:false,error:'This player cannot be removed.'};
        target.connected=false;
        r=target.alive?game.forfeitPlayer(room,target.id):{ok:true};
      }
      if(r.ok)room.seatTokens.delete(data.targetId);return r.ok?{ok:true}:r;
    },cb);
    if(!result?.ok)return;
    const guest=socketsByPlayer.get(data.targetId);
    if(guest){guest.data.playerId=null;guest.data.room=null;guest.emit('kicked',{message:'The host removed you from the room.'});}socketsByPlayer.delete(data.targetId);
  });
  on('chatMessage',(data,cb)=>run(socket,'chatMessage',data,(room,id)=>game.addChatMessage(room,id,data.message),cb));
  // Reactions are transient social events, with no game-state or database write.
  on('reaction',(data,cb)=>{
    const code=socket.data.room,id=socket.data.playerId,room=rooms.get(code);
    if(!room||socketsByPlayer.get(id)!==socket||!room.players.some(p=>p.id===id)||!['playing','finished'].includes(room.status))return reply(socket,cb,{ok:false,error:'Only players in a match can react.'});
    const now=Date.now(),event={roomCode:code,playerId:id,reaction:data.reaction,expiresAt:now+require('../shared/reactions').duration};
    reply(socket,cb,{ok:true});
    for(const person of [...room.players,...room.spectators]){
      const recipient=socketsByPlayer.get(person.id);
      if(recipient?.data.room===code)recipient.emit('reaction',event);
    }
  });
  on('setRevealFactions',(data,cb)=>run(socket,'setRevealFactions',data,(room,id)=>{const valid=ownerSettings(room,id);if(valid.ok)room.revealFactions=data.enabled;return valid;},cb));
  on('setTreasuryMode',(data,cb)=>run(socket,'setTreasuryMode',data,(room,id)=>game.configureTreasuryMode(room,id,data),cb));
  on('setMaxPlayers',(data,cb)=>run(socket,'setMaxPlayers',data,(room,id)=>game.configureMaxPlayers(room,id,data.maxPlayers),cb));
  on('setChallengeTimer',(data,cb)=>run(socket,'setChallengeTimer',data,(room,id)=>game.configureChallengeTimer(room,id,data),cb));
  on('ready',(data,cb)=>run(socket,'ready',data,(room,id)=>{const p=room.players.find(p=>p.id===id);if(!p||room.status!=='lobby')return {ok:false,error:'Only lobby players can change readiness.'};p.ready=data.ready;return {ok:true};},cb));
  on('startGame',(data,cb)=>run(socket,'startGame',data,(room,id)=>{
    if(room.hostId!==id)return {ok:false,error:'Only the host can start the game.'};
    if(room.status!=='lobby')return {ok:false,error:'This match has already started.'};
    if(room.players.length<2)return {ok:false,error:'At least 2 players are required.'};
    if(room.players.length>Math.min(game.MAX_PLAYERS,room.maxPlayers??game.MAX_PLAYERS))return {ok:false,error:'Room capacity exceeded.'};
    if(room.players.some(p=>p.connected===false))return {ok:false,error:'Everyone must be connected to start.'};
    if(room.players.some(p=>!p.ready))return {ok:false,error:'Everyone must be ready.'};
    game.startGame(room);return {ok:true};
  },cb));
  const actions={
    action:(r,id,d)=>game.performAction(r,id,d.action,d.targetId),
    passChallenge:(r,id,d,now)=>game.passChallenge(r,id,now),challenge:(r,id,d,now)=>game.challenge(r,id,now),
    loseInfluence:(r,id,d)=>game.loseInfluence(r,id,d.cardIndex),
    declineCounter:(r,id,d,now)=>game.declineCounter(r,id,now),
    counter:(r,id,d)=>game.chooseCounter(r,id,d.counter),summonChoice:(r,id,d)=>game.chooseSummon(r,id,d.choice,d.cardIndex),
    intrigueReveal:(r,id,d)=>game.revealIntrigue(r,id,d.cardIndex),intrigueSharing:(r,id,d)=>game.chooseIntrigueSharing(r,id,d.share,d.indices),
    sharePrivateIntel:(r,id,d)=>game.sharePrivateIntel(r,id,d.targetId,d.slot),endTurn:(r,id)=>game.requestEndTurn(r,id)
  };
  for(const [event,operation] of Object.entries(actions))on(event,(data,cb)=>run(socket,event,data,(room,id,now)=>operation(room,id,data,now),cb));
  socket.on('disconnect',()=>{
    browserSubscribers.delete(socket);abuse.release(socket);
    const code=socket.data.room,id=socket.data.playerId,room=rooms.get(code);
    if(socketsByPlayer.get(id)!==socket)return;
    socketsByPlayer.delete(id);
    if(!room||!member(room,id))return;
    if(shuttingDown){member(room,id).connected=false;return;}
    try{transitions.run(code,null,'disconnect',{},next=>{member(next,id).connected=false;return {ok:true};});}
    catch{member(room,id).connected=false;}
    // Presence loss never forfeits a player or pauses a challenge timer.
    emitRoom(code);
  });
});
// Replay no commands or randomness: restore and expire each saved deadline once.
for(const room of rooms.values()){if(cleanupRoom(room.code))continue;expireRoom(room.code);syncChallengeTimer(room);}
cleanupTimer=setTimeout(sweepRooms,config.cleanupInterval);cleanupTimer.unref();
telemetry?.start(()=>({connections:abuse.total,rooms:rooms.size}));
server.listen(runtime.port,runtime.host,()=>console.log(`Uramaku running on http://localhost:${server.address().port}`));
function shutdown(){
  if(shuttingDown)return;shuttingDown=true;
  if(directoryTimer)clearTimeout(directoryTimer);if(cleanupTimer)clearTimeout(cleanupTimer);browserSubscribers.clear();
  for(const {timer} of challengeTimers.values())clearTimeout(timer);challengeTimers.clear();
  telemetry?.stop();
  io.close(()=>{store.close();if(server.listening)server.close();});
}
process.on?.('SIGTERM',shutdown);process.on?.('SIGINT',shutdown);
