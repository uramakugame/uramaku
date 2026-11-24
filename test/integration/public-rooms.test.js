'use strict';
const assert=require('node:assert/strict');
const harness=require('../helpers/server-harness');
const {upgradeRoom,listRooms}=require('../../server/room-directory');
const g=require('../../server/game');
const h=harness({RATE_PACKETS_PER_SEC:'1000',RATE_IP_PACKETS_PER_SEC:'2000'}),host=h.client('host'),guest=h.client('guest'),viewer=h.client('viewer'),browser=h.client('browser');
const created=host.send('createRoom',{nickname:'Hasu'}),code=created.code,room=h.rooms.get(code);
const listing=query=>browser.send('listRooms',{query:query||''});
assert.equal(room.visibility,'private');assert.equal(room.challengeDurationSeconds,15);assert.equal(listing().rooms.length,0);
guest.send('joinRoom',{code,nickname:'Guest'});viewer.send('joinSpectator',{code,nickname:'Viewer'});
const original=JSON.stringify(room),identity=room.players.map(p=>p.id);
for(const client of [guest,viewer])assert(client.send('setRoomDetails',{visibility:'public',name:'Unauthorized'}).error);
assert.equal(JSON.stringify(room),original,'Unauthorized settings cannot change the snapshot');
assert(host.send('setRoomDetails',{name:'Evening Duel',visibility:'public'}).ok);
assert.equal(room.code,code);assert.deepEqual(room.players.map(p=>p.id),identity);assert.equal(host.closed,undefined);assert.equal(guest.closed,undefined);
let dto=listing().rooms[0];assert(dto);assert.equal(dto.name,'Evening Duel');assert.equal(dto.playerCount,2);assert.equal(dto.maxPlayers,8);assert.equal(dto.status,'waiting');
assert.deepEqual(Object.keys(dto).sort(),['code','name','mode','playerCount','maxPlayers','status'].sort());
assert(!JSON.stringify(dto).includes(created.resumeToken));assert(!JSON.stringify(dto).includes(room.seatTokens.get('host')));
assert.equal(listing('dUeL').rooms[0].code,code);assert.equal(listing(code.toLowerCase()).rooms[0].code,code);assert.equal(listing('missing').rooms.length,0);
for(const [faction,treasury,mode] of [[false,false,'classic'],[true,false,'faction'],[true,true,'treasuryFaction'],[false,true,'treasury']]){
 host.send('setRevealFactions',{enabled:faction});host.send('setTreasuryMode',{enabled:treasury});assert.equal(listing().rooms[0].mode,mode);
}
for(const data of [{name:''},{name:'x'.repeat(41)},{name:{}},{name:'bad\nname'},{visibility:'friends'}]){
 const before=JSON.stringify(room);assert(host.send('setRoomDetails',data).error);assert.equal(JSON.stringify(room),before);
}
host.send('setRoomDetails',{visibility:'private'});assert.equal(listing(code).rooms.length,0,'Exact-code search must not expose private rooms');
assert(h.client('invited').send('joinRoom',{code,nickname:'Invited'}).code,'Code invitations still work for private rooms');
host.send('setRoomDetails',{visibility:'public'});
// Spectators do not consume seats; disconnected reserved players do.
const guests=[];for(let n=0;n<4;n++){const c=h.client('guest-'+n);c.send('joinRoom',{code,nickname:'Guest '+n});guests.push(c);}
assert.equal(room.players.length,7);assert.equal(listing().rooms[0].playerCount,7);
const a=h.client('last-a'),b=h.client('last-b');
const p=a.send('prepareEntry',{kind:'join',code,nickname:'Last A'}),q=b.send('prepareEntry',{kind:'join',code,nickname:'Last B'});
assert(a.send('confirmEntry',{code,token:p.resumeToken,intentId:p.intentId}).ok);
assert(b.send('confirmEntry',{code,token:q.resumeToken,intentId:q.intentId}).error,'Only one request may fill the final seat');
assert.equal(room.players.length,8);assert.equal(listing().rooms.length,0);assert.equal(b.data.playerId,undefined);
a.disconnect();assert.equal(listing().rooms.length,0,'A reserved offline seat is still occupied');
assert(host.send('kickPlayer',{targetId:room.players.at(-1).id}).ok);assert.equal(listing().rooms.length,1);
host.disconnect();assert.equal(listing().rooms.length,0,'An owner-offline lobby is hidden without changing its visibility');assert.equal(room.visibility,'public');
const resumed=h.client('resumed');assert(resumed.send('resumeSession',{code,token:created.resumeToken}).ok);assert.equal(listing().rooms[0].name,'Evening Duel');
const changes=h.store.db.prepare('SELECT total_changes() AS n').get().n;
for(let n=0;n<30;n++)listing('eve');assert.equal(h.store.db.prepare('SELECT total_changes() AS n').get().n,changes,'Discovery never writes to the database');
// A started room leaves discovery and rejects metadata changes.
const start=h.client('start-host'),peer=h.client('start-peer'),made=start.send('createRoom',{nickname:'Start host'});
peer.send('joinRoom',{code:made.code,nickname:'Peer'});start.send('setRoomDetails',{name:'Start this',visibility:'public'});peer.send('ready',{ready:true});start.send('startGame');
assert.equal(listing(made.code).rooms.length,0);const active=h.rooms.get(made.code),before=JSON.stringify(active);
assert(start.send('setRoomDetails',{visibility:'private'}).error);assert.equal(JSON.stringify(active),before);
// Pagination includes only public, open lobbies and clamps an obsolete page.
const synthetic=new Map();for(let n=0;n<45;n++){const r=g.createGame(String(n).padStart(4,'0'),{id:'h'+n,name:'Host',connected:true});r.visibility='public';synthetic.set(r.code,r);}
assert.equal(listRooms(synthetic).rooms.length,20);assert.equal(listRooms(synthetic,{offset:20}).rooms.length,20);assert.equal(listRooms(synthetic,{offset:40}).rooms.length,5);
assert.equal(listRooms(synthetic,{offset:999}).offset,40);
const legacy=g.createGame('OLD1',{id:'old',name:'Old'});delete legacy.name;delete legacy.visibility;legacy.challengeDurationSeconds=2;legacy.pending={kind:'claim',stage:'challenge',challengeDeadline:123456,challengeDurationMs:2000};
assert(upgradeRoom(legacy));assert.equal(legacy.visibility,'private');assert.equal(legacy.challengeDurationSeconds,5);assert.equal(legacy.pending.challengeDeadline,123456);assert.equal(upgradeRoom(legacy),false);
console.log('Public/private discovery, safe DTOs/search, modes, owner authorization, code invitations, reserved seats, final-seat race, read-only queries and legacy normalization passed.');
