'use strict';
// These timestamps are internal snapshot metadata, never public activity/chat.
function connected(room){return [...room.players,...(room.spectators||[])].some(p=>p.connected===true);}
function needsUpdate(room){return room.status==='lobby'&&!connected(room)?!Number.isFinite(room.emptyLobbySince):room.emptyLobbySince!==null;}
function updateLifecycle(room,now=Date.now()){
  room.emptyLobbySince=room.status==='lobby'&&!connected(room)?(Number.isFinite(room.emptyLobbySince)?room.emptyLobbySince:now):null;
}
function shouldRemove(room,now,lobbyTtl){
  if(connected(room))return false;
  if(room.status==='finished')return true;
  return room.status==='lobby'&&Number.isFinite(room.emptyLobbySince)&&now-room.emptyLobbySince>=lobbyTtl;
}
module.exports={connected,needsUpdate,updateLifecycle,shouldRemove};
