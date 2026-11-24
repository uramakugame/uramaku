'use strict';

// One validation boundary for client packets. The engine still authorizes
// turns, claims and choices; shape validation never grants permission.
const text = max => value => typeof value==='string' && value.trim().length>0 && value.length<=max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const id=text(128), name=text(18), word=text(32);
const boolean=value=>typeof value==='boolean';
const slot=value=>Number.isInteger(value)&&value>=0&&value<=1;
const optional=check=>value=>value===undefined||check(value);
const code=value=>typeof value==='string'&&/^[a-z0-9]{4}$/i.test(value.trim());
const shapes={
  createRoom:{nickname:name}, joinRoom:{code,nickname:name}, joinSpectator:{code,nickname:name},
  prepareEntry:{kind:value=>['create','join','spectator'].includes(value),code:optional(code),nickname:name},
  confirmEntry:{code,token:value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value),intentId:id},
  resumeSession:{code,token:value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value),intentId:optional(id)},
  listRooms:{query:optional(value=>typeof value==='string'&&value.length<=64&&!/[\u0000-\u001f\u007f-\u009f]/u.test(value)),offset:optional(value=>Number.isInteger(value)&&value>=0&&value<=1000000),subscribe:optional(boolean)},
  stopRoomBrowser:{},
  setRoomDetails:{name:optional(text(40)),visibility:optional(value=>['public','private'].includes(value))},
  leaveRoom:{}, kickPlayer:{targetId:id},
  chatMessage:{message:text(300)},
  setRevealFactions:{enabled:boolean}, setTreasuryMode:{enabled:boolean},
  setChallengeTimer:{enabled:optional(boolean),seconds:optional(value=>Number.isInteger(value)&&value>=5&&value<=60)},
  ready:{ready:boolean}, startGame:{},
  action:{action:word,targetId:optional(id)},
  passChallenge:{}, challenge:{}, loseInfluence:{cardIndex:slot}, declineCounter:{},
  counter:{counter:word},
  summonChoice:{choice:value=>['discard','keep','replace'].includes(value),cardIndex:optional(slot)},
  intrigueReveal:{cardIndex:slot},
  intrigueSharing:{share:boolean,indices:optional(value=>Array.isArray(value)&&value.length<=2&&value.every(slot))},
  sharePrivateIntel:{targetId:id,slot}, endTurn:{}
};

function validatePacket(event,data){
  const shape=shapes[event];
  if(!shape||!data||typeof data!=='object'||Array.isArray(data))return false;
  if(data.commandId!==undefined&&(!id(data.commandId)||!Number.isSafeInteger(data.commandSequence)||data.commandSequence<1))return false;
  if(data.commandSequence!==undefined&&data.commandId===undefined)return false;
  if(data.expectedDecision!==undefined&&data.expectedDecision!==null&&!id(data.expectedDecision))return false;
  if(data.expectedRoom!==undefined&&!code(data.expectedRoom))return false;
  if(data.expectedTurn!==undefined&&(!Number.isSafeInteger(data.expectedTurn)||data.expectedTurn<0))return false;
  return Object.entries(shape).every(([key,check])=>check(data[key]));
}
function onInput(socket,event,handler,guard){
  if(!shapes[event])throw new Error('Unknown client event');
  socket.on(event,(data,callback)=>{
    if(typeof data==='function'){callback=data;data=undefined;}
    if(data===undefined)data={};
    const ack=typeof callback==='function'?callback:null;
    const reject=message=>{
      if(ack)ack({error:message});
      else socket.emit('notice',{type:'error',message});
    };
    if(guard&&!guard(event,data))return reject('Too many requests. Please wait and try again.');
    if(!validatePacket(event,data))return reject('Invalid request.');
    try { return handler(data,ack||(()=>{})); }
    catch { return reject('The request could not be completed.'); }
  });
}
module.exports={onInput,validatePacket};
