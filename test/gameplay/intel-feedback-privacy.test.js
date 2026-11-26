'use strict';
const assert=require('node:assert/strict'),g=require('../../server/game'),intel=require('../../public/js/components/intel-effects'),feedback=require('../../public/js/components/game-feedback');
const copy=value=>JSON.parse(JSON.stringify(value)),ok=result=>assert.equal(result.ok,true,result.error);
function fixture(){const hands=[['courtesan','lord'],['lord','magistrate'],['assassin','swordsman'],['kingpin','courtesan']],players=['a','b','c','d'].map((id,n)=>({id,name:id,alive:true,ready:true,coins:8,influences:hands[n],privateInvestigations:{},intrigueVisibility:[0,0]}));const r=g.createGame('INTL',players[0]);Object.assign(r,{players,status:'playing',challengeTimerEnabled:false,deck:['assassin','swordsman','kingpin']});return r;}
const snapshots=r=>Object.fromEntries([...r.players.map(p=>p.id),'viewer'].map(id=>[id,{room:copy(g.publicState(r)),you:copy(g.privateState(r,id))}]));
const changes=(before,after,id)=>intel.events(before[id].room,after[id].room,before[id].you,after[id].you);
function investigate(r,actor,target){ok(g.performAction(r,actor,'intrigue',target));for(const p of r.players)if(p.id!==actor)ok(g.passChallenge(r,p.id));ok(g.declineCounter(r,target));ok(g.chooseCounter(r,target,'revealAll'));}
const r=fixture(),before=snapshots(r);investigate(r,'a','b');let after=snapshots(r);
assert.deepEqual(changes(before,after,'a').map(e=>[e.id,e.slot,e.type]),[['b',0,'private'],['b',1,'private']]);assert.deepEqual(changes(before,after,'b').map(e=>[e.id,e.slot,e.type]),[['b',0,'private'],['b',1,'private']]);for(const id of ['c','d','viewer'])assert.deepEqual(changes(before,after,id),[]);
assert.deepEqual(after.b.you.intelKnownBy,[['a'],['a']]);assert(!JSON.stringify(after.c.room).includes('intelKnownBy'));assert(!JSON.stringify(after.viewer.room).includes('privateInvestigations'));assert.equal(after.viewer.you,null);
// Someone else learning an already-private card is new information for its owner.
ok(g.performAction(r,'b','earn'));const previous=snapshots(r);investigate(r,'c','b');after=snapshots(r);assert.deepEqual(after.b.you.intelKnownBy,[['a','c'],['a','c']]);assert.equal(changes(previous,after,'b').length,2);assert.equal(changes(previous,after,'c').length,2);assert.deepEqual(changes(previous,after,'a'),[]);assert.deepEqual(changes(previous,after,'d'),[]);
// Public sharing is distinct for the owner, prior investigators and new viewers.
const privateViews=after;ok(g.sharePrivateIntel(r,'a','b',0));const publicViews=snapshots(r);
for(const id of ['a','b','c','d','viewer']){const effects=changes(privateViews,publicViews,id);assert.equal(effects.length,1);assert.equal(effects[0].type,'public');assert.equal(effects[0].role,'lord');assert.equal(effects[0].own,id==='b');assert.equal(effects[0].by,'a');}
assert.equal(feedback.changes(privateViews.a.room,publicViews.a.room,privateViews.a.you,publicViews.a.you).flips.length,0,'An already-known card is not flipped again');assert.equal(feedback.changes(privateViews.d.room,publicViews.d.room,privateViews.d.you,publicViews.d.you).flips.length,1,'A new viewer still sees the normal flip');
assert.deepEqual(intel.events(null,publicViews.b.room,null,publicViews.b.you),[]);assert.deepEqual(changes(publicViews,publicViews,'b'),[]);assert.equal(g.sharePrivateIntel(r,'a','b',0).ok,false);
// Proved Gossip never marks the hidden replacement as privately known.
{
 const room=fixture();room.players[1].influences=['courtesan','magistrate'];ok(g.performAction(room,'a','intrigue','b'));ok(g.chooseCounter(room,'b','courtesan'));const old=snapshots(room);ok(g.challenge(room,'c'));const next=snapshots(room);
 assert.equal(next.a.you.privateInvestigations.b[0],undefined);assert.deepEqual(next.a.you.privateInvestigations.b,{1:'magistrate'});assert(!changes(old,next,'a').some(e=>e.id==='b'&&e.slot===0));assert(!changes(old,next,'d').length);assert(!changes(old,next,'viewer').length);
}
// Losing a card and compacting slots is not a new public-information event.
const old=snapshots(r);ok(g.performAction(r,'d','purge','b'));ok(g.loseInfluence(r,'b',0));const next=snapshots(r);for(const id of ['a','b','c','d','viewer'])assert.deepEqual(changes(old,next,id),[]);
console.log('Private intel effects are limited to recipient/owner, repeat investigators notify owners, public sharing distinguishes prior/new viewers, no replay or compacted-slot false effects, and proved Gossip hides its replacement.');
