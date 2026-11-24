// Seedless randomized property exercise; not used for balance conclusions.
const assert=require('node:assert/strict');
const g=require('../../server/game');
const choose=a=>a[Math.floor(Math.random()*a.length)];
const modes=[false,true];let completed=0,started=0,economic=0,riots=0;
for(const mode of modes)for(let seats=2;seats<=8;seats++)for(let game=0;game<20;game++){
  const participants=Array.from({length:seats},(_,i)=>({id:`p${i}`,name:`Player ${i+1}`,coins:0,ready:true,alive:true,influences:[]}));
  const room=g.createGame('SIM',participants[0]);room.players=participants;room.treasuryMode=mode;g.startGame(room);started++;
  for(let step=0;room.status==='playing'&&step<300;step++){
    assert(g.treasuryInvariant(room),`Invariant failed in ${mode} ${seats} game ${game} turn ${step}`);
    const pendingDraw=room.pending?.kind==='summon'&&room.pending.drawnRole?1:0;
    const handCards=room.players.reduce((sum,p)=>sum+p.influences.length,0);
    assert.equal(room.deck.length+room.discard.length+room.revealedCards.length+handCards+pendingDraw,18);
    for(const p of room.players){assert(p.coins>=0&&Number.isInteger(p.coins));}
    if(mode && !room.pendingWealthWinnerId&&room.players.some(p=>p.alive&&p.coins>=room.economyWinThreshold))throw new Error('Unresolved wealth victory');
    if(room.treasuryMode&&room.treasuryCoins===0)riots++;
    if(room.challengeLosses?.length&&(!room.pending||Math.random()<0.5)){
      const debt=choose(room.challengeLosses),loser=room.players.find(p=>p.id===debt.loserId);
      assert(loser.alive&&loser.influences.length>=2,'A manual challenge debt requires a live two-card hand');
      const result=g.loseInfluence(room,loser.id,choose([0,1]));assert(result.ok,result.error);continue;
    }
    if(room.pending){
      const q=room.pending;
      if(q.kind==='claim'||q.kind==='counterClaim'){
        const options=room.players.filter(p=>p.alive&&p.id!==q.claimantId&&!(q.passedBy||[]).includes(p.id));
        if(!options.length)throw Error('No eligible claim responses');
        const p=choose(options);
        const r=Math.random()<0.23?g.challenge(room,p.id):g.passChallenge(room,p.id);
        if(!r.ok)throw Error('Invalid challenge action: '+r.error);
      }else if(q.kind==='counterOffer'){
        if(Math.random()<0.35){const role=choose(q.options);const r=g.chooseCounter(room,q.targetId,role);if(!r.ok)throw Error(r.error);}
        else{room.pending=null;const r=g.performDeferredAction(room,q);if(!r.ok)throw Error(r.error);}
      }else if(q.kind==='information'){
        let r;
        if(q.stage==='selectHidden'){
          r=g.revealIntrigue(room,q.targetId,choose(q.unknownIndices));
        }else{
          const target=room.players.find(p=>p.id===q.targetId);
          const options=['revealAll'];
          if(target.coins>=1)options.push('keepOne');
          if(target.coins>=2&&q.unknownIndices.length===2)options.push('concealAll');
          r=g.chooseCounter(room,q.targetId,choose(options));
        }
        if(!r.ok)throw Error('Invalid concealment: '+r.error);
      }else if(q.kind==='summon'){
        const p=room.players.find(p=>p.id===q.claimantId);
        const choices={preview:['keep','discard'],replace:['replace']};
        assert(g.chooseSummon(room,p.id,choose(choices[q.stage]),choose(p.influences.map((_,index)=>index))).ok);
      }else if(q.kind==='lose'){
        const loser=room.players.find(p=>p.id===q.loserId);
        if(!loser||loser.influences.length<2)throw Error('Automatic loss should have resolved');
        const r=g.loseInfluence(room,loser.id,choose([0,1]));if(!r.ok)throw Error(r.error);
      }else{throw Error('Unexpected pending kind '+q.kind);}
      continue;
    }
    const cur=g.publicState(room).turnPlayerId;
    const actor=room.players.find(p=>p.id===cur);
    const opp=room.players.filter(p=>p.alive&&p.id!==cur);
    if(!actor||!opp.length)throw Error('No active actor/opponent');
    const wealth=opp.filter(p=>p.coins>0),actions=[];
    if(room.mandatoryPurge){actions.push(['purge',choose(opp).id]);}
    else{
      if(mode&&room.treasuryCoins===0){if(wealth.length)actions.push(['loot',choose(wealth).id]);}
      else actions.push(['earn',null]);
      if(!mode||room.treasuryCoins>0)actions.push(['tax',null]);
      if(actor.coins>=g.publicState(room).purgeCost)actions.push([g.publicState(room).riot?'overthrow':'purge',choose(opp).id]);
      if(actor.coins>=3)actions.push(['assassinate',choose(opp).id]);
      if(actor.coins>=5)actions.push(['hireBlade',choose(opp).id]);
      actions.push(['summon',null]);
      if(wealth.length)actions.push(['extort',choose(wealth).id]);
      const viable=g.privateState(room,cur).intrigueEligibleTargets;
      if(viable.length)actions.push(['intrigue',choose(viable)]);
    }
    const [action,target]=choose(actions);
    const r=g.performAction(room,cur,action,target);
    if(!r.ok)throw Error(`Action ${action}: ${r.error}; coins=${actor.coins} riot=${room.treasuryCoins}`);
  }
  assert(g.treasuryInvariant(room),'Closed supply must remain conserved at end of game');
  if(room.status==='finished'){completed++;if(room.winType==='economy')economic++;}
}
console.log(`Property test: ${started} random matches, ${completed} finished, ${economic} wealth wins, ${riots} Riot ticks; no economy invariant violations.`);
