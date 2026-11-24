'use strict';
function roomMetadata(room){
  const owner=room.players.find(p=>p.id===room.hostId);
  return {name:typeof room.name==='string'&&room.name.trim()?room.name.trim().slice(0,40):`${owner?.name||room.code}'s room`,visibility:room.visibility==='public'?'public':'private'};
}
function upgradeRoom(room){
  const before=JSON.stringify([room.name,room.visibility,room.challengeDurationSeconds]);
  Object.assign(room,roomMetadata(room));
  const duration=room.challengeDurationSeconds;
  room.challengeDurationSeconds=Number.isInteger(duration)?Math.min(60,Math.max(5,duration)):15;
  // Pending deadlines are outcomes of an earlier configuration. Never reset
  // an in-progress window while normalizing settings from an older release.
  return before!==JSON.stringify([room.name,room.visibility,room.challengeDurationSeconds]);
}
function availableRooms(rooms){
  return [...rooms.values()].filter(room=>room.visibility==='public'&&room.status==='lobby'&&room.players.length<8&&room.players.some(p=>p.id===room.hostId&&p.connected!==false))
    .map(room=>({code:room.code,name:roomMetadata(room).name,mode:room.treasuryMode?(room.revealFactions?'treasuryFaction':'treasury'):(room.revealFactions?'faction':'classic'),playerCount:room.players.length,maxPlayers:8,status:'waiting'}))
    .sort((a,b)=>a.name.localeCompare(b.name)||a.code.localeCompare(b.code));
}
function listRooms(rooms,{query='',offset=0}={}){
  const search=query.trim().toLowerCase();
  const all=availableRooms(rooms).filter(room=>!search||room.name.toLowerCase().includes(search)||room.code.toLowerCase().includes(search));
  offset=Math.min(offset,Math.max(0,Math.floor((all.length-1)/20)*20));
  return {rooms:all.slice(offset,offset+20),total:all.length,offset,nextOffset:offset+20<all.length?offset+20:null};
}
module.exports={roomMetadata,upgradeRoom,availableRooms,listRooms};
