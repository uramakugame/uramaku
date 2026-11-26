'use strict';
const assert=require('node:assert/strict'),g=require('../../shared/game');
const host={id:'h',name:'Host',influences:[]},guest={id:'g',name:'Guest',influences:[]};
for(const limit of [2,3,4,5,6]){
 const room=g.createGame('CAPS',host);assert.equal(room.maxPlayers,6);assert.equal(g.MAX_PLAYERS,6);
 assert(g.configureMaxPlayers(room,'h',limit).ok);assert.equal(g.publicState(room).maxPlayers,limit);
 room.players=[host,guest];const before=JSON.stringify(room);assert(!g.configureMaxPlayers(room,'g',6).ok);assert(!g.configureMaxPlayers(room,'unknown',6).ok);assert.equal(JSON.stringify(room),before);
 for(const invalid of [0,1,7,8,2.5,'3',null,{},[]]){assert(!g.configureMaxPlayers(room,'h',invalid).ok);assert.equal(JSON.stringify(room),before);}
 room.players.push({id:'c',name:'Third'});assert(!g.configureMaxPlayers(room,'h',2).ok);assert.equal(room.players.length,3);
 room.status='playing';assert(!g.configureMaxPlayers(room,'h',6).ok);
}
for(let n=2;n<=6;n++){
 const room=g.createGame('DEAL',{id:'h',name:'Host'});room.players=Array.from({length:n},(_,i)=>({id:'p'+i,name:'Player '+i}));
 g.startGame(room);assert.equal(room.deck.length,18-2*n);assert(room.players.every(p=>p.influences.length===2));
 const cards=[...room.deck,...room.players.flatMap(p=>p.influences)];for(const role of Object.keys(g.ROLES))assert.equal(cards.filter(r=>r===role).length,3);
}
const invalid=g.createGame('FULL',host);invalid.players=Array.from({length:7},(_,i)=>({id:String(i),name:String(i)}));assert.throws(()=>g.startGame(invalid),/capacity/);assert.equal(invalid.status,'lobby');
console.log('Owner-only 2–6 capacity, occupied-seat protection, match lock, exact 18-card/three-copy deals and six cards remaining at six players passed.');
