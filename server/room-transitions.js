'use strict';
const {randomUUID,createHash}=require('node:crypto');
const {cloneRoom,encode}=require('./room-store');
const {updateLifecycle}=require('./room-lifecycle');
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));return value;}
function fingerprint(event,data){return createHash('sha256').update(JSON.stringify([event,canonical(data)])).digest('hex');}
function stamp(next,previous){
  const q=next.pending,p=previous?.pending;
  if(q&&(!q.decisionId||q.kind!==p?.kind||q.stage!==p?.stage))q.decisionId=randomUUID();
  if(q&&['claim','counterOffer'].includes(q.kind)&&!q.responseDecisionId)q.responseDecisionId=q.decisionId;
  for(const debt of next.challengeLosses||[])if(!debt.decisionId)debt.decisionId=randomUUID();
  next.revision=(previous?.revision||0)+1;
}
class RoomTransitions{
  constructor(store,rooms){this.store=store;this.rooms=rooms;}
  create(room,options){updateLifecycle(room);stamp(room,null);this.store.save(room,null,options);this.rooms.set(room.code,room);return {ok:true};}
  run(code,seat,event,data,operation,options={}){
    const room=this.rooms.get(code);if(!room)return{ok:false,error:'Room no longer exists.'};
    if(data?.expectedRoom!==undefined&&data.expectedRoom!==code)return{ok:false,error:'This request is no longer valid.'};
    const member=[...room.players,...(room.spectators||[])].find(p=>p.id===seat);
    const command=data?.commandId,seq=data?.commandSequence;
    const hash=command?fingerprint(event,data):null;
    if(command){
      if(!member)return{ok:false,error:'You are not in this room.'};
      const old=this.store.receipt(code,seat,command);
      if(old)return old.fingerprint===hash?{...JSON.parse(old.result_json),duplicate:true}:{ok:false,error:'This request is no longer valid.'};
      if(seq<=(member.commandSequence||0))return{ok:false,error:'This request is no longer valid.'};
    }
    const decision=event==='loseInfluence'?require('./game').lossDecision(room,seat):room.pending;
    const response=['counter','declineCounter'].includes(event)&&['claim','counterOffer'].includes(decision.kind);
    const decisionId=response?(decision.responseDecisionId||decision.decisionId):decision?.decisionId;
    if(data?.expectedDecision!==undefined&&data.expectedDecision!==(decisionId||null))return{ok:false,error:'This decision is no longer available.'};
    if(data?.expectedTurn!==undefined&&data.expectedTurn!==room.turnNumber)return{ok:false,error:'This request is no longer valid.'};
    const next=cloneRoom(room);
    if(command)[...next.players,...(next.spectators||[])].find(p=>p.id===seat).commandSequence=seq;
    const result=operation(next)||{ok:true};if(!result.ok)return result;
    updateLifecycle(next);
    // Genuine no-ops do not rewrite a room unless recording a command receipt.
    if(!options.remove&&!command&&encode(next)===encode(room)&&JSON.stringify([...next.seatTokens])===JSON.stringify([...room.seatTokens]))return result;
    stamp(next,room);
    const reply={...result,revision:next.revision};
    const receipt=command?{seat,id:command,fingerprint:hash,result:reply}:undefined;
    this.store.save(next,room.revision??null,{...options,receipt});
    if(options.remove)this.rooms.delete(code);
    else{
      // Publish only after commit. Keeping this outer identity also lets
      // existing consumers hold a room reference without seeing candidates.
      for(const key of Object.keys(room))if(!(key in next))delete room[key];
      Object.assign(room,next);
    }
    return reply;
  }
}
module.exports={RoomTransitions,stamp};
