const { randomBytes,createHash,timingSafeEqual } = require('node:crypto');
const tokenHash=token=>createHash('sha256').update(token).digest('hex');
function tokenMatches(token,hash){return typeof token==='string'&&/^[a-f0-9]{64}$/i.test(token)&&typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash)&&timingSafeEqual(Buffer.from(tokenHash(token),'hex'),Buffer.from(hash,'hex'));}
// Tokens never enter public game state and do not use nicknames as credentials.
function newSeatToken(room, participantId) {
  room.seatTokens ||= new Map();
  const token=randomBytes(32).toString('hex');
  room.seatTokens.set(participantId,tokenHash(token));
  return token;
}
function resumeSeat(room,token,socket,socketsByPlayer) {
  if(!room || typeof token!=='string' || token.length!==64)return {ok:false,error:'Invalid reconnect token.'};
  const match=[...(room.seatTokens||new Map()).entries()].find(([,hash])=>tokenMatches(token,hash));
  if(!match)return {ok:false,error:'This seat could not be recovered.'};
  const id=match[0];
  const member=room.players.find(p=>p.id===id)||(room.spectators||[]).find(p=>p.id===id);
  if(!member)return {ok:false,error:'This seat is no longer available.'};
  const old=socketsByPlayer.get(id);
  if(old&&old!==socket){old.data.playerId=null;old.data.room=null;old.disconnect(true);}
  socket.data.playerId=id;socket.data.room=room.code;
  socketsByPlayer.set(id,socket);member.connected=true;
  return {ok:true,code:room.code,spectator:!room.players.some(p=>p.id===id)};
}
module.exports={newSeatToken,resumeSeat,tokenHash,tokenMatches};
