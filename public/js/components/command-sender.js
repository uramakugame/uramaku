/* Reliable room commands; rendering and tutorial controls stay independent. */
(function(root){
'use strict';
const decisions=new Set(['passChallenge','challenge','loseInfluence','declineCounter','counter','summonChoice','intrigueReveal','intrigueSharing']);
function create({socket,getView,report,uuid=()=>crypto.randomUUID(),schedule=setTimeout}){
  let ready=false,inFlight=false,sequence=0,generation=0;const queue=[];
  function pump(){
    if(!ready||inFlight||!queue.length)return;
    const job=queue[0],view=getView();
    if(view.room?.code!==job.packet.expectedRoom){queue.shift();pump();return;}
    inFlight=true;const attemptGeneration=generation;
    socket.timeout(5000).emit(job.event,job.packet,(transportError,result)=>{
      if(attemptGeneration!==generation)return;
      inFlight=false;
      if(transportError){
        if(++job.attempts<3){if(ready&&socket.connected)schedule(pump,250);return;}
        queue.shift();report('Your connection was interrupted. Refresh to restore the latest room state.');pump();return;
      }
      queue.shift();if(result?.error)report(result.error);pump();
    });
  }
  return {
    send(event,data={}){
      const {room,you}=getView();
      if(!ready||!socket.connected||!room){report('Reconnecting to your room. Please wait.');return false;}
      if(queue.length>=32){report('Please wait for your previous requests to finish.');return false;}
      sequence=Math.max(sequence,you?.commandSequence||0)+1;
      const packet={...data,commandId:uuid(),commandSequence:sequence,expectedRoom:room.code};
      if(decisions.has(event)||event==='action'||event==='sharePrivateIntel')packet.expectedTurn=room.turnNumber||0;
      if(decisions.has(event)){
        const decision=event==='loseInfluence'&&!(room.pending?.kind==='lose'&&room.pending.loserId===you?.id)?(room.challengeLosses||[]).find(q=>q.loserId===you?.id):room.pending;
        const response=['counter','declineCounter'].includes(event)&&['claim','counterOffer'].includes(decision.kind);
        packet.expectedDecision=(response?decision.responseDecisionId||decision.decisionId:decision?.decisionId)||null;
      }
      queue.push({event,packet,attempts:0});pump();return true;
    },
    resume(){ready=true;pump();},
    disconnect(){ready=false;},
    reset(){generation++;inFlight=false;ready=false;sequence=0;queue.length=0;},
  };
}
const api={create};if(root)root.URAMAKU_COMMAND_SENDER=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
