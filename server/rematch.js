'use strict';
const game=require('./game');
// Rebuild through the existing room defaults; no per-match private state is
// carried forward. Credentials and command sequences belong to the room seat.
function returnToLobby(room,requesterId){
 if(room.status!=='finished')return{ok:false,error:'The match must finish before playing again.'};
 if(room.hostId!==requesterId)return{ok:false,error:'Only the owner can return the room to the lobby.'};
 const players=room.players.filter(p=>room.seatTokens.has(p.id));
 const owner=players.find(p=>p.id===requesterId);
 if(!owner)return{ok:false,error:'You are not in this room.'};
 const clean=p=>({id:p.id,name:p.name,coins:0,influences:[],alive:true,ready:false,connected:p.connected===true,commandSequence:p.commandSequence||0});
 const next=game.createGame(room.code,clean(owner));
 for(const key of ['name','visibility','maxPlayers','revealFactions','treasuryMode','treasuryCoinsPerPlayer','challengeTimerEnabled','challengeDurationSeconds'])if(key in room)next[key]=room[key];
 next.players=players.map(clean);
 next.spectators=(room.spectators||[]).filter(p=>room.seatTokens.has(p.id)).map(p=>({id:p.id,name:p.name,connected:p.connected===true,commandSequence:p.commandSequence||0}));
 const kept=new Set([...next.players,...next.spectators].map(p=>p.id));
 next.seatTokens=new Map([...room.seatTokens].filter(([id])=>kept.has(id)));
 next.matchNumber=(room.matchNumber||1)+1;
 next.log=[`${owner.name} returned the room to the lobby for a new match.`];
 for(const key of Object.keys(room))delete room[key];
 Object.assign(room,next);
 return{ok:true};
}
module.exports={returnToLobby};
