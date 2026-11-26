'use strict';
const {MAX_PLAYERS}=require('../shared/game');
const capacity=room=>Math.min(MAX_PLAYERS,room.maxPlayers??MAX_PLAYERS);
function roomMetadata(room){
  const owner=room.players.find(p=>p.id===room.hostId);
  return {name:typeof room.name==='string'&&room.name.trim()?room.name.trim().slice(0,40):`${owner?.name||room.code}'s room`,visibility:room.visibility==='public'?'public':'private'};
}
function availableRooms(rooms){
  return [...rooms.values()].filter(room=>room.visibility==='public'&&room.status==='lobby'&&room.players.length<capacity(room)&&room.players.some(p=>p.id===room.hostId&&p.connected!==false))
    .map(room=>({code:room.code,name:roomMetadata(room).name,mode:room.treasuryMode?(room.revealFactions?'treasuryFaction':'treasury'):(room.revealFactions?'faction':'classic'),playerCount:room.players.length,maxPlayers:capacity(room),status:'waiting'}))
    .sort((a,b)=>a.name.localeCompare(b.name)||a.code.localeCompare(b.code));
}
function listRooms(rooms,{query='',offset=0}={}){
  const search=query.trim().toLowerCase();
  const all=availableRooms(rooms).filter(room=>!search||room.name.toLowerCase().includes(search)||room.code.toLowerCase().includes(search));
  offset=Math.min(offset,Math.max(0,Math.floor((all.length-1)/20)*20));
  return {rooms:all.slice(offset,offset+20),total:all.length,offset,nextOffset:offset+20<all.length?offset+20:null};
}
module.exports={roomMetadata,availableRooms,listRooms};
