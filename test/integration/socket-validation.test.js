'use strict';
const assert=require('node:assert/strict');
const harness=require('../helpers/server-harness');
const {onInput,validatePacket}=require('../../server/socket-input');
const h=harness({RATE_PACKETS_PER_SEC:'1000',RATE_IP_PACKETS_PER_SEC:'2000'}),a=h.client('a'),b=h.client('b');
const created=a.send('createRoom',{nickname:'Akira'});assert(created.code);
const room=h.rooms.get(created.code);
b.send('joinRoom',{code:created.code,nickname:'Sora'});
// Every registered packet boundary rejects malformed input without state changes.
let reactionCase=0;
for(const event of Object.keys(a.handlers).filter(x=>x!=='disconnect')){
  for(const bad of [null,[],123,'payload']){
    const before=JSON.stringify(room);
    const client=event==='reaction'?h.client('reaction-invalid-'+reactionCase++):a;
    let answer;assert.doesNotThrow(()=>client.handlers[event](bad,result=>answer=result),event);
    assert.equal(answer.error,'Invalid request.',event);
    assert.equal(JSON.stringify(room),before,event+' must not mutate the room');
  }
}
for(const event of ['createRoom','joinRoom','resumeSession','leaveRoom'])assert.doesNotThrow(()=>h.client('invalid-ack-'+event).handlers[event]({},'not a function'));
for(const nickname of [123,{},[],true,'x'.repeat(19),'bad\nname','bad\u0000name']){
  const c=h.client('bad-name');assert(c.send('createRoom',{nickname}).error);
}
for(const message of [123,{},'x'.repeat(301),'bad\u0000message']){
  const before=JSON.stringify(room);b.send('chatMessage',{message});assert.equal(JSON.stringify(room),before);
}
for(const event of ['setRevealFactions','setTreasuryMode']){
  const before=JSON.stringify(room);a.send(event,{enabled:'false'});assert.equal(JSON.stringify(room),before);
}
assert.equal(validatePacket('loseInfluence',{cardIndex:0.5}),false);
assert.equal(validatePacket('loseInfluence',{cardIndex:'0'}),false);
assert.equal(validatePacket('intrigueSharing',{share:true,indices:[0,1,2]}),false);
assert.equal(validatePacket('setChallengeTimer',{seconds:1e100}),false);
// An internal error never returns its exception, secret or stack to the browser.
const events=[],handlers={};const socket={on:(event,fn)=>handlers[event]=fn,emit:(event,data)=>events.push({event,data})};
onInput(socket,'startGame',()=>{throw new Error('SECRET DATABASE INTERNALS');});
let response;handlers.startGame({},r=>response=r);
assert.equal(response.error,'The request could not be completed.');
handlers.startGame({});assert(!JSON.stringify(events).includes('SECRET'));
assert.doesNotThrow(()=>a.handlers.chatMessage({message:'Still works'},42));assert.equal(room.chat.at(-1).message,'Still works');
const i18n=require('../../shared/i18n');
for(const message of ['Invalid request.','The request could not be completed.','Leave your current room before joining another.','Everyone must be connected to start.']){
 assert.equal(i18n.translate(message,'en'),message);assert.notEqual(i18n.translate(message,'jp'),message,'Japanese error translation: '+message);
}
console.log('All socket payload guards, safe acknowledgments, input limits and private server errors passed.');
