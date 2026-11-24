'use strict';
const assert=require('node:assert/strict');const {Tutorial}=require('../../shared/tutorial');const t=new Tutorial();while(t.step.id!=='assassinate')t.dispatch(t.step.input);
assert.equal(t.room.players.find(p=>p.id==='akira').coins,0,'Assassinate is charged on declaration before learner passes');assert.equal(t.room.players.find(p=>p.id==='mei').coins,0);
const serialized=JSON.stringify(t.room);t.view();t.view();assert.equal(JSON.stringify(t.room),serialized);t.dispatch(t.step.input);assert.equal(t.step.id,'hire-guard');assert.equal(t.room.players[0].coins,5);
t.dispatch(t.step.input);assert.equal(t.room.players[0].coins,0);t.dispatch(t.step.input);assert.equal(t.step.id,'double-loss');assert.equal(t.room.players.find(p=>p.id==='akira').influences.length,0);assert.deepEqual(t.room.players[0].influences,['magistrate','kingpin']);
assert(t.back());assert.equal(t.step.id,'guard-challenge');assert.equal(t.room.players[0].coins,0);t.dispatch(t.step.input);assert.equal(t.room.players[0].coins,0);
console.log('Immediate 3-coin Assassinate and 5-coin Hire Guard payments, double loss and no duplicate replay charges passed.');
