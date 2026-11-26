/* Shared authoritative game rules, used by the server and guided tutorial. */
(function(root){
'use strict';
// Gameplay and tutorial use a single authoritative role reference.
const ROLES = typeof module==='object'&&module.exports?require('./roles'):root.URAMAKU_ROLES;
const ROLE_KEYS = Object.keys(ROLES);
const ROLE_ACTIONS = Object.fromEntries(Object.values(ROLES).map(role => [role.actionId, role.id]));
const TARGETED_ACTIONS = new Set(['intrigue','assassinate','hireBlade','extort','purge','overthrow','loot']);
const COUNTER_ROLES = {intrigue:['lord','courtesan'],assassinate:['swordsman','assassin'],extort:['kingpin','magistrate']};
const MAX_PLAYERS = 6;
const HIRE_GUARD_COST = 5;
const ENFORCE_PAYMENT = 2;
const CHALLENGE_WINDOW_MS = 15000;
function challengeTiming(room){
  const seconds=Number.isInteger(room.challengeDurationSeconds)?Math.min(60,Math.max(10,room.challengeDurationSeconds)):CHALLENGE_WINDOW_MS/1000;
  const duration=room.challengeTimerEnabled===false?null:seconds*1000;
  return {challengeDurationMs:duration,challengeDeadline:duration===null?null:Date.now()+duration};
}
function configureChallengeTimer(room,id,settings={}){
  if(!room||!room.players.some(p=>p.id===id))return{ok:false,error:'Only players can change room settings.'};
  if(room.status!=='lobby')return{ok:false,error:'Game settings are locked once the match starts.'};
  if(room.hostId!==id)return{ok:false,error:'Only the room owner can change game settings.'};
  if(!settings||typeof settings!=='object'||Array.isArray(settings))return{ok:false,error:'Invalid challenge timer settings.'};
  const {enabled,seconds}=settings;
  if(enabled!==undefined&&typeof enabled!=='boolean')return{ok:false,error:'Invalid challenge timer settings.'};
  if(seconds!==undefined&&(!Number.isInteger(seconds)||seconds<10||seconds>60))return{ok:false,error:'Challenge duration must be a whole number from 10 to 60 seconds.'};
  if(enabled!==undefined)room.challengeTimerEnabled=enabled;
  if(seconds!==undefined)room.challengeDurationSeconds=seconds;
  return{ok:true};
}
function configureTreasuryMode(room,id,settings={}){
  if(!room||!room.players.some(p=>p.id===id))return{ok:false,error:'Only players can change room settings.'};
  if(room.status!=='lobby')return{ok:false,error:'Game settings are locked once the match starts.'};
  if(room.hostId!==id)return{ok:false,error:'Only the room owner can change game settings.'};
  if(!settings||typeof settings!=='object'||Array.isArray(settings))return{ok:false,error:'Invalid Riot Mode settings.'};
  const {enabled,coinsPerPlayer}=settings;
  if((enabled===undefined&&coinsPerPlayer===undefined)||(enabled!==undefined&&typeof enabled!=='boolean'))return{ok:false,error:'Invalid Riot Mode settings.'};
  if(coinsPerPlayer!==undefined&&![5,6,7].includes(coinsPerPlayer))return{ok:false,error:'Treasury coin supply must be 5, 6 or 7 coins per player.'};
  if(enabled!==undefined)room.treasuryMode=enabled;
  if(coinsPerPlayer!==undefined)room.treasuryCoinsPerPlayer=coinsPerPlayer;
  return{ok:true};
}
function configureMaxPlayers(room,id,maxPlayers){
  if(!room||!room.players.some(p=>p.id===id))return{ok:false,error:'Only players can change room settings.'};
  if(room.status!=='lobby')return{ok:false,error:'Game settings are locked once the match starts.'};
  if(room.hostId!==id)return{ok:false,error:'Only the room owner can change game settings.'};
  if(!Number.isInteger(maxPlayers)||maxPlayers<2||maxPlayers>MAX_PLAYERS)return{ok:false,error:'Room capacity must be a whole number from 2 to 6.'};
  if(maxPlayers<room.players.length)return{ok:false,error:'Room capacity cannot be lower than the number of joined players.'};
  room.maxPlayers=maxPlayers;return{ok:true};
}
const clone = x => JSON.parse(JSON.stringify(x));
function shuffle(a) { for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
// Room setup and the reusable card deck
function createGame(code, host) { return { code, name:`${host.name}'s room`,visibility:'private',maxPlayers:MAX_PLAYERS,hostId: host.id, status:'lobby', challengeTimerEnabled:true,challengeDurationSeconds:15,revealFactions:false, treasuryMode:false, treasuryCoinsPerPlayer:6,treasuryCoins:null, totalCoins:null, economyWinThreshold:null, mandatoryPurge:false, turnNumber:0, stateTransitionNumber:0,stateTransitions:[], cardMoveNumber:0, cardMoves:[], players:[host], spectators:[], chat:[], deck:[], discard:[], revealedCards:[], sharedInvestigations:[], turn:0, pending:null, challengeLosses:[], log:[`${host.name} created the room.`], winner:null }; }
function draw(room) {
  if (!room.deck.length) { if (!room.discard.length) return null; room.deck = shuffle(room.discard.splice(0)); room.log.push('The discard pile was shuffled to form a new deck.'); }
  return room.deck.pop();
}
function startGame(room) {
  if(room.players.length<2||room.players.length>Math.min(MAX_PLAYERS,room.maxPlayers??MAX_PLAYERS))throw new Error('Room capacity exceeded.');
  // Shuffle the seating order once; the resulting order stays fixed for the match.
  room.players = shuffle(room.players.slice());
  room.deck = shuffle(ROLE_KEYS.flatMap(k => [k,k,k]));
  room.discard = []; room.revealedCards = []; room.sharedInvestigations = [];
  room.treasuryCoinsPerPlayer ??= 6;
  room.totalCoins=room.treasuryMode ? room.treasuryCoinsPerPlayer*room.players.length : null;
  room.treasuryCoins=room.treasuryMode ? (room.treasuryCoinsPerPlayer-1)*room.players.length : null;
  room.economyWinThreshold=room.treasuryMode ? (room.players.length===2?10:room.players.length===3?12:14) : null;
  room.mandatoryPurge=false;room.turnNumber=0;room.stateTransitionNumber=0;room.stateTransitions=[];room.cardMoveNumber=0;room.cardMoves=[];
  room.players.forEach(p => { p.influences=[draw(room),draw(room)]; p.coins=1; p.alive=true; p.ready=true; p.connected=true; p.intrigueVisibility=[0,0]; p.lastInvestigation=null; p.privateInvestigations={}; });
  room.status='playing'; room.turn=0; room.pending=null;room.challengeLosses=[];room.finishAfterChallengesId=null;room.pendingWealthWinnerId=null;
  room.log.push('The game has begun. Everyone starts with 1 coin.'); beginTurn(room);
}
function alive(room) { return room.players.filter(p=>p.alive); }
function current(room) { const a=alive(room); return a.length ? a[room.turn % a.length] : null; }
// Riot Mode is a closed economy; the other mode continues to mint coins.
// Coin transfers, Riot Mode and passive Income
function isTreasury(room) { return room.treasuryMode===true; }
function isRiot(room) { return isTreasury(room) && room.treasuryCoins===0; }
function purgeCost(room) { return isRiot(room) ? 5 : 7; }
function changeTreasury(room,delta){
  if(!isTreasury(room))return;
  const before=room.treasuryCoins;
  if(!Number.isInteger(delta)||before+delta<0)throw new Error('Invalid treasury transfer');
  room.treasuryCoins+=delta;
  if((before===0)!==(room.treasuryCoins===0)){
    const state=room.treasuryCoins===0?'chaos':'order';
    room.stateTransitionNumber=(room.stateTransitionNumber||0)+1;
    (room.stateTransitions||=[]).push({id:room.stateTransitionNumber,state,treasuryCoins:room.treasuryCoins});
    room.stateTransitions=room.stateTransitions.slice(-20);
    room.log.push(state==='chaos'?'The treasury is empty. Order has collapsed.':'Order has been restored.');
  }
}
function wealthVictory(room,p){
  if(!isTreasury(room)||room.status!=='playing'||!p?.alive||p.coins<room.economyWinThreshold)return false;
  // Owed penalties remain actionable even when an independent transfer wins.
  if(room.challengeLosses?.length||room.settlingChallenge){room.pendingWealthWinnerId ||= p.id;return true;}
  discardSummonDraw(room);
  room.status='finished';room.winner=p.name;room.winType='economy';room.pending=null;
  room.mandatoryPurge=false;
  room.wealthVictoryEntry=`${p.name} wins by accumulating ${p.coins} coins!`;
  return true;
}
function finishWealthAnnouncement(room){
  if(room.wealthVictoryEntry){room.log.push(room.wealthVictoryEntry);room.wealthVictoryEntry=null;}
}
function treasuryWithdrawal(room,p,requested){
  const paid=isTreasury(room)?Math.min(requested,room.treasuryCoins):requested;
  if(isTreasury(room))changeTreasury(room,-paid);
  p.coins+=paid;
  wealthVictory(room,p);
  return paid;
}
function payToTreasury(room,p,amount){
  if(p.coins<amount)throw new Error('Insufficient coins for treasury payment');
  p.coins-=amount;changeTreasury(room,amount);
}
function transferCoins(room,from,to,amount){
  if(from.coins<amount)throw new Error('Insufficient coins for transfer');
  from.coins-=amount;to.coins+=amount;
  wealthVictory(room,to);
}
function beginTurn(room) {
  if(room.status!=='playing')return;
  const p=current(room);if(!p)return;
  // Monotonic turn identifier lets the client prompt once per compulsory turn,
  // including when reconnecting in the middle of a match.
  room.turnNumber=(room.turnNumber||0)+1;
  const amount=treasuryWithdrawal(room,p,1);
  room.log.push(amount?`${p.name} receives ${amount} Income (now ${p.coins}).`:`${p.name} receives no Income because the treasury is empty.`);
  if(room.status!=='playing'){finishWealthAnnouncement(room);return;}
  room.mandatoryPurge=!isTreasury(room)&&p.coins>=10;
  if(room.mandatoryPurge)room.log.push(`${p.name} has 10 or more coins and must Purge this turn.`);
}
function treasuryInvariant(room){
  return !isTreasury(room)||room.treasuryCoins+room.players.reduce((sum,p)=>sum+(p.coins||0),0)===room.totalCoins;
}
function player(room,id) { return room.players.find(p=>p.id===id); }
function nextTurn(room) { const a=alive(room); if(a.length<2)return null; const idx=a.findIndex(p=>p.id===current(room)?.id); return a[(idx+1)%a.length]||null; }
// Public snapshots and player-private information
// Present a treasury crossing immediately after its explanatory coin/action
// line. This formats public history only; payments and resolution stay in order.
function publicLog(room){
  const lines=room.log.slice(-32);
  for(let i=0;i<lines.length-1;i++){
    if(!['The treasury is empty. Order has collapsed.','Order has been restored.'].includes(lines[i]))continue;
    if(/receives \d+ Income|takes Earn |collects \d+ coins? through Tax|uses (?:Purge|Overthrow) against|claims .+? and declares|claims Swordsman \(Hire Guard\)|coins return to the treasury|remaining coins return to the treasury/.test(lines[i+1])){[lines[i],lines[i+1]]=[lines[i+1],lines[i]];i++;}
  }
  return lines.slice(-30);
}
function publicState(room) {
  const {drawnRole,...pending}=room.pending||{};
  return { code:room.code,name:room.name||`${player(room,room.hostId)?.name||room.code}'s room`,visibility:room.visibility==='public'?'public':'private',revision:room.revision||0,status:room.status,maxPlayers:room.maxPlayers??MAX_PLAYERS,revealFactions:room.revealFactions===true,treasuryMode:isTreasury(room),treasuryCoins:room.treasuryCoins,totalCoins:room.totalCoins,economyWinThreshold:room.economyWinThreshold,riot:isRiot(room),purgeCost:purgeCost(room),mandatoryPurge:room.mandatoryPurge===true,turnNumber:room.turnNumber||0,winType:room.winType||null,hostId:room.hostId,turnPlayerId:current(room)?.id||null,nextTurnPlayerId:nextTurn(room)?.id||null,
    challengeTimerEnabled:room.challengeTimerEnabled!==false,challengeDurationSeconds:room.challengeDurationSeconds??15,treasuryCoinsPerPlayer:room.treasuryCoinsPerPlayer??6,
    players:room.players.map(p=>({id:p.id,name:p.name,coins:p.coins,alive:p.alive,ready:p.ready,connected:p.connected!==false,influenceCount:p.influences.length,...(room.status!=='lobby'&&room.revealFactions===true?{influenceFactions:p.influences.map(r=>ROLES[r]?.faction.startsWith('秩序')?'order':'underworld')}: {})})),
    spectators:(room.spectators||[]).map(p=>({id:p.id,name:p.name,connected:p.connected!==false})), chat:clone(room.chat||[]),
    challengeLosses:(room.challengeLosses||[]).map(q=>({kind:'lose',loserId:q.loserId,reason:q.reason,lossCount:q.lossCount||1,decisionId:q.decisionId})),
    pending:room.pending?{...pending,...(pending.kind==='claim'?{options:counterOptions(pending.action,player(room,pending.targetId))}:{}),...(pending.kind==='informationShare'?{roles:undefined,indices:undefined}:{}),...(pending.kind==='information'?{unknownIndices:undefined}:{}),claimantName:player(room,pending.claimantId)?.name,targetName:player(room,pending.targetId)?.name}:null,
    cardMoveNumber:room.cardMoveNumber||0,cardMoves:clone(room.cardMoves||[]),
    stateTransitionNumber:room.stateTransitionNumber||0,stateTransitions:clone(room.stateTransitions||[]),
    discardPile:{count:room.discard.length},
    drawPile:{count:room.deck.length,topFaction:room.revealFactions===true&&room.deck.length?(ROLES[room.deck.at(-1)]?.faction.startsWith('秩序')?'order':'underworld'):null,reshufflePending:room.deck.length===0&&room.discard.length>0},
    log:publicLog(room),revealedCards:clone(room.revealedCards||[]),sharedInvestigations:clone(room.sharedInvestigations||[]),winner:room.winner,roles:Object.fromEntries(Object.entries(ROLES).map(([k,v])=>[k,{name:v.name,jp:v.jp,faction:v.faction,action:v.action,actionJp:v.actionJp,effect:v.effect,effectJp:v.effectJp,counter:v.counter,counterJp:v.counterJp,counterEffect:v.counterEffect,counterEffectJp:v.counterEffectJp}])) };
}
function privateState(room,id) {
  const p=player(room,id);
  if(!p)return null;
  const pending=room.pending;
  return {
    id:p.id,commandSequence:p.commandSequence||0,influences:clone(p.influences),intrigueVisibility:clone(p.intrigueVisibility||p.influences.map(()=>0)),
    coins:p.coins,alive:p.alive,investigated:p.lastInvestigation?clone(p.lastInvestigation):null,
    intelKnownBy:p.influences.map((role,slot)=>room.players.filter(other=>other.id!==id&&other.privateInvestigations?.[id]?.[slot]===role).map(other=>other.id)),
    privateInvestigations:clone(p.privateInvestigations||{}),intrigueEligibleTargets:intrigueEligibleTargets(room,id),
    informationChoice:pending?.kind==='information'&&pending.targetId===id?{claimantName:player(room,pending.claimantId)?.name,stage:pending.stage,availableCoins:p.coins,influenceCount:p.influences.length,unknownIndices:clone(pending.unknownIndices||[])}:null,
    investigationShare:pending?.kind==='informationShare'&&pending.claimantId===id?{targetName:pending.targetName,roles:clone(pending.roles)}:null,
    summonDrawnRole:pending?.kind==='summon'&&pending.claimantId===id?pending.drawnRole||null:null,
  };
}
// Per-influence knowledge and Intrigue eligibility
function markInfluenceVisibility(target,indices,visibility) {
  target.intrigueVisibility ||= target.influences.map(()=>0);
  for(const i of indices) if(i>=0&&i<target.influences.length) target.intrigueVisibility[i]|=visibility;
}
// Only the replaced card becomes unknown. Other influence slots remain the same,
// including knowledge held by different investigators and public disclosures.
function invalidateInfluenceKnowledge(room,targetId,changedSlot) {
  const target=player(room,targetId);
  if(!target || !Number.isInteger(changedSlot)) return;
  target.intrigueVisibility ||= target.influences.map(()=>0);
  target.intrigueVisibility[changedSlot]=0;
  room.sharedInvestigations=(room.sharedInvestigations||[]).flatMap(observation=>{
    if(observation.playerId!==targetId)return[observation];
    const indices=[],roles=[];
    (observation.indices||[]).forEach((slot,i)=>{
      if(slot!==changedSlot){indices.push(slot);roles.push(observation.roles[i]);}
    });
    return indices.length?[{...observation,indices,roles}]:[];
  });
  for(const investigator of room.players){
    const known=investigator.privateInvestigations?.[targetId];
    if(known){delete known[changedSlot];if(!Object.keys(known).length)delete investigator.privateInvestigations[targetId];}
    if(investigator.lastInvestigation?.playerId===targetId){
      const remaining=investigator.privateInvestigations?.[targetId]||{};
      const indices=Object.keys(remaining).map(Number).sort((a,b)=>a-b);
      investigator.lastInvestigation=indices.length?{playerId:targetId,playerName:target.name,indices,roles:indices.map(i=>remaining[i])}:null;
    }
  }
}

// Two independent eligibility checks: an influence must not be public,
// AND the acting investigator must not have learned that particular slot.
function intrigueUnknownIndices(room,investigatorId,target) {
  const investigator=player(room,investigatorId);
  const known=investigator?.privateInvestigations?.[target.id] || {};
  return (target.influences||[]).map((_,i)=>i).filter(i=>
    !((target.intrigueVisibility?.[i]||0)&2) && !Object.hasOwn(known,i));
}
function intrigueEligibleTargets(room,investigatorId) {
  return room.players.filter(t=>t.alive&&t.id!==investigatorId&&intrigueUnknownIndices(room,investigatorId,t).length).map(t=>t.id);
}
function recordInvestigation(room,investigator,target,indices){
  investigator.privateInvestigations ||= {};
  const known=investigator.privateInvestigations[target.id] ||= {};
  for(const i of indices) known[i]=target.influences[i];
  const knownIndices=Object.keys(known).map(Number).sort((a,b)=>a-b);
  investigator.lastInvestigation={playerId:target.id,playerName:target.name,indices:knownIndices,roles:knownIndices.map(i=>known[i])};
  markInfluenceVisibility(target,indices,1);
}
// Presentation metadata exposes only which physical slot was exchanged. Proof
// roles are already public; Summon exchanges never include either card identity.
function noteCardExchange(room,playerId,slot,reason,shownRole){
  const move={number:(room.cardMoveNumber||0)+1,playerId,slot,reason};
  if(reason==='proof')move.shownRole=shownRole;
  room.cardMoveNumber=move.number;(room.cardMoves||=[]).push(move);
  if(room.cardMoves.length>24)room.cardMoves.splice(0,room.cardMoves.length-24);
}
function activeTurn(room,id) { return room.status==='playing' && current(room)?.id===id && !room.pending && !room.challengeLosses?.length; }
function performLoot(room,p,target) {
  if(!isRiot(room))return{ok:false,error:'Loot is only available during Chaos.'};
  if(target.coins<1)return{ok:false,error:'Loot requires a target with at least 1 coin.'};
  transferCoins(room,target,p,1);
  room.log.push(`${p.name} loots 1 coin from ${target.name} during Chaos.`);
  if(room.status==='finished')finishWealthAnnouncement(room);
  else finishTurn(room,p.id);
  return{ok:true};
}
// Action declarations and challenge windows
function performAction(room,id,action,targetId) {
  const p=player(room,id);
  if(!p?.alive||room.status!=='playing'||!activeTurn(room,id))return{ok:false,error:'It is not your turn or another decision is pending.'};
  const needsTarget=TARGETED_ACTIONS.has(action);
  const target=needsTarget?player(room,targetId):null;
  if(needsTarget&&(!target?.alive||target.id===id))return{ok:false,error:'Choose an opponent who has not been eliminated.'};
  if(action==='loot')return performLoot(room,p,target);
  if(room.mandatoryPurge&&action!=='purge')return{ok:false,error:'You have 10 or more coins and must use Purge this turn.'};
  if(action==='extort' && target.coins<1)return{ok:false,error:'Extort requires a target with at least 1 coin.'};
  if(action==='tax'&&isRiot(room))return{ok:false,error:'Tax is unavailable during Chaos because the treasury is empty.'};
  if(action==='intrigue'){
    const options=intrigueEligibleTargets(room,id);
    if(!options.length)return{ok:false,error:'Intrigue unavailable: no opponents have influences unknown to you.'};
    if(!options.includes(targetId))return{ok:false,error:'Intrigue unavailable: this player has no influences left for you to discover.'};
  }
  if (action==='earn') {
    if(isRiot(room))return{ok:false,error:'Earn becomes Loot during Chaos.'};
    const amount=treasuryWithdrawal(room,p,1);
    room.log.push(`${p.name} takes Earn (稼ぎ) and gains ${amount} coin${amount===1?'':'s'}.`);
    finishTurn(room,id);return{ok:true};
  }
  // Riot actions are distinct choices, not discounted versions of standard ones.
  // Keep their server IDs separate so stale/malicious clients cannot submit
  // Purge in Riot or Overthrow outside Chaos.
  if (action==='purge' || action==='overthrow') {
    const riot=isRiot(room), name=riot?'Overthrow':'Purge';
    if(riot && action!=='overthrow')return{ok:false,error:'Purge is replaced by Overthrow during Chaos.'};
    if(!riot && action!=='purge')return{ok:false,error:'Overthrow is only available during Chaos.'};
    const cost=riot?5:7;
    if(p.coins<cost)return{ok:false,error:`${name} costs ${cost} coins.`};
    payToTreasury(room,p,cost);
    room.log.push(`${p.name} uses ${name} against ${target.name}${riot?' during Chaos (5 coins)':''}.`);
    requestLoss(room,{kind:'lose',claimantId:id,targetId,loserId:targetId,reason:name,after:'finish'});return{ok:true};
  }
  if(!Object.hasOwn(ROLE_ACTIONS,action))return{ok:false,error:'Unknown action.'};
  const role=ROLE_ACTIONS[action];
  if(action==='assassinate'&&p.coins<3)return{ok:false,error:'Assassinate costs 3 coins.'};
  if(action==='hireBlade'&&p.coins<5)return{ok:false,error:`${ROLES.swordsman.action} costs 5 coins.`};
  if(action==='assassinate')payToTreasury(room,p,3);
  if(action==='hireBlade')payToTreasury(room,p,5);
  room.pending={kind:'claim',claimantId:id,targetId:target?.id||null,action,role,targetResponse:'undecided',stage:'challenge',...challengeTiming(room)};
  room.log.push(`${p.name} claims ${ROLES[role].name} and declares ${ROLES[role].action}${target?' against '+target.name:''}.`);
  return {ok:true};
}
function challenge(room,id,now=Date.now()) {
  if(expireChallenge(room,now))return{ok:false,error:'The challenge window has expired.'};
  const q=room.pending; if(!q||!['claim','counterClaim'].includes(q.kind)||q.stage!=='challenge')return{ok:false,error:'There is no claim to challenge.'};
  const challenger=player(room,id); if(!challenger?.alive||id===q.claimantId)return{ok:false,error:'You cannot challenge your own claim.'};
  if((q.passedBy||[]).includes(id))return{ok:false,error:'You have already passed on this claim.'};
  if(room.challengeLosses?.length)return{ok:false,error:'An influence loss must be revealed first.'};
  if(q.kind==='claim'&&q.targetId===id)q.targetChallenged=true;
  const claimant=player(room,q.claimantId); const idx=claimant.influences.indexOf(q.role);
  q.wasCounter = q.kind==='counterClaim';
  if(idx===-1) {
    // A failed Hire Guard or False Trail bluff costs one influence
    // for the failed counter and one for the original Assassinate.
    // Resolve both simultaneously without a selection prompt.
    const failedAssassinateCounter=q.wasCounter && q.action==='assassinate';
    const failedCounterReason=`Failed ${ROLES[q.role].name} claim and Assassinate`;
    room.log.push(`${challenger.name} successfully challenges ${claimant.name}. ${claimant.name} ${failedAssassinateCounter?`loses both influences (${failedCounterReason}).`:'must lose an influence.'}`);
    q.kind='lose'; q.loserId=claimant.id;
    q.reason=failedAssassinateCounter?failedCounterReason:'Failed claim';
    q.after=failedAssassinateCounter?'finish':'cancel';
    if(failedAssassinateCounter){q.lossCount=2;q.finishTurnId=q.targetId;}
    q.challengerId=id;
    return requestLoss(room,q);
  }
  else {
    if(q.wasCounter&&q.counterRole==='courtesan'){
      room.log.push(`${challenger.name}'s challenge fails. ${claimant.name} proves ${ROLES[q.role].name}.`);
      exchangeGossip(room,player(room,q.targetId),claimant);q.effectResolved=true;
      room.log.push(`${claimant.name} discards the proved ${ROLES[q.role].name} and draws a replacement.`);
    }else room.log.push(`${challenger.name}'s challenge fails. ${claimant.name} reveals ${ROLES[q.role].name}, discards it, and draws a replacement.`);
    invalidateInfluenceKnowledge(room,claimant.id,idx);
    room.discard.push(q.role);claimant.influences[idx]=draw(room);
    noteCardExchange(room,claimant.id,idx,'proof',q.role);
    q.kind='lose';q.loserId=challenger.id;q.reason='Failed challenge';q.after='continue';q.challengerId=id;
    // An elimination target who unsuccessfully challenges a genuine claim
    // loses one influence for the failed challenge AND one to the attack. Resolve both at once, with no selection prompt.
    // A third-party challenger only pays the normal one-influence penalty.
    if(!q.wasCounter && ['assassinate','hireBlade'].includes(q.action) && q.targetId===id) {
      q.lossCount=2;
      q.after='finish';
      q.reason=`Failed challenge and ${ROLES[q.role].action}`;
      room.log.push(`${challenger.name} loses both influences: failed challenge and ${ROLES[q.role].action}.`);
    }
    // A failed challenge against a genuine Swordsman Hire Guard costs the
    // attacking Assassin one influence for the challenge and another for
    // Hire Guard. If both influences remain, resolve together automatically.
    if(q.wasCounter && q.counterRole==='swordsman' && q.action==='assassinate' && q.targetId===id) {
      q.lossCount=2;
      q.after='finish';
      q.finishTurnId=id;
      q.reason='Failed challenge and Hire Guard';
      room.log.push(`${challenger.name} loses both influences: failed challenge and Swordsman Hire Guard.`);
    }
    if(q.wasCounter && q.counterRole==='magistrate' && q.targetId===id && challenger.coins<ENFORCE_PAYMENT){
      q.lossCount=2;
      q.after='finish';
      q.finishTurnId=id;
      q.reason='Failed challenge and Magistrate Enforce';
      room.log.push(`${challenger.name} cannot pay Enforce and must lose both influences.`);
    }
  }
  // A genuine Enforce payment is independent of the challenge penalty,
  // including the attacker's last influence. Settle before elimination/refund.
  if(q.wasCounter&&q.counterRole==='magistrate'&&player(room,q.targetId)?.coins>=ENFORCE_PAYMENT){
    room.settlingChallenge=true;
    settleEnforcePayment(room,player(room,q.targetId),claimant);q.effectResolved=true;
    delete room.settlingChallenge;
  }
  // Only settled effects and unavoidable losses can accompany a manual penalty.
  // New counter/concealment/Summon choices wait for the public loss reveal.
  if(q.after==='continue'&&challenger.influences.length>(q.lossCount||1)&&parallelContinuation(room,q)){
    return continueAlongsidePenalty(room,q);
  }
  return requestLoss(room,q);
}
// Revealed losses precede new claims and discretionary information/draw choices.
function parallelContinuation(room,q){
  if(q.wasCounter)return true; // Blocks/payments/Gossip are final; attack losses are mandatory.
  if(['tax','hireBlade'].includes(q.action))return true;
  if(['extort','assassinate'].includes(q.action))return q.targetChallenged===true||q.targetResponse==='allow';
  return false; // Summon, Intrigue and an undecided target wait for the reveal.
}
function continueAlongsidePenalty(room,q){
  const debt={kind:'lose',loserId:q.loserId,reason:q.reason,lossCount:q.lossCount||1,parallel:true};
  (room.challengeLosses||=[]).push(debt);
  // Two still-unpaid penalties against the same two-card hand need no choice.
  const owed=room.challengeLosses.filter(x=>x.loserId===q.loserId).reduce((n,x)=>n+(x.lossCount||1),0);
  room.pending=null;
  if(owed>=player(room,q.loserId).influences.length){
    room.challengeLosses=room.challengeLosses.filter(x=>x.loserId!==q.loserId||x===debt);
    debt.lossCount=owed;
    room.pending=q;resolveLoss(room,debt,0,owed);room.pending=null;
  }
  if(room.status!=='playing')return{ok:true};
  if(q.effectResolved)return finishTurn(room,q.wasCounter?q.targetId:q.claimantId);
  if(q.wasCounter)resolveCounter(room,q);else offerCounterOrResolve(room,q);
  return{ok:true};
}
function settleEnforcePayment(room,original,target){
  transferCoins(room,original,target,ENFORCE_PAYMENT);
  room.log.push(`${target.name} uses Enforce against ${original.name}’s Extort. ${original.name} pays ${ENFORCE_PAYMENT} coins to ${target.name}.`);
}
// The main action decision and each challenge debt have stable independent IDs.
function lossDecision(room,id){
  if(room.pending?.kind==='lose'&&room.pending.loserId===id)return room.pending;
  return (room.challengeLosses||[]).find(q=>q.loserId===id)||null;
}
function passChallenge(room,id,now=Date.now()) {
  if(expireChallenge(room,now))return{ok:false,error:'The challenge window has expired.'};
  const q=room.pending;
  if(!q || !['claim','counterClaim'].includes(q.kind) || q.stage!=='challenge') return {ok:false,error:'There is no claim awaiting a challenge.'};
  if(!player(room,id)?.alive || id===q.claimantId) return {ok:false,error:'The claimant cannot pass their own challenge window.'};
  if((q.passedBy||[]).includes(id)) return {ok:false,error:'You have already passed on this claim.'};
  q.passedBy=q.passedBy||[]; if(!q.passedBy.includes(id)) q.passedBy.push(id);
  const eligible=alive(room).filter(p=>p.id!==q.claimantId);
  if(!eligible.every(p=>q.passedBy.includes(p.id))) { room.log.push(`${player(room,id).name} passes on challenging.`); return {ok:true}; }
  resolveUnchallengedClaim(room,q);
  return {ok:true};
}
function resolveUnchallengedClaim(room,q) {
  room.pending=null;
  if(q.kind==='counterClaim')return resolveCounter(room,q);
  if(!player(room,q.claimantId)?.alive)return finishTurn(room,q.claimantId);
  offerCounterOrResolve(room,q);
}
function expireChallenge(room,now=Date.now()) {
  const q=room.pending;
  if(room.status!=='playing'||!['claim','counterClaim'].includes(q?.kind)||q.stage!=='challenge'||!Number.isFinite(q.challengeDeadline)||now<q.challengeDeadline)return false;
  resolveUnchallengedClaim(room,q);
  return true;
}
// Counter offers and resolution
function counterOptions(action,target) {
  if(!target?.alive)return[];
  return (COUNTER_ROLES[action]||[]).filter(role=>role!=='swordsman'||target.coins>=HIRE_GUARD_COST);
}
function offerCounterOrResolve(room,q) {
  const target=player(room,q.targetId);
  // Counter abilities are claims too: offer every legal counter, even when the
  // target does not hold that role, so they may bluff and be challenged.
  const options=(q.targetChallenged||q.targetResponse==='allow')?[]:counterOptions(q.action,target);
  if(options.length) { room.pending={kind:'counterOffer',claimantId:q.claimantId,targetId:q.targetId,action:q.action,options,responseDecisionId:q.kind==='claim'?q.responseDecisionId:undefined}; room.log.push(`${target.name} may claim a counter ability.`); return; }
  resolveAction(room,q);
}
function exchangeGossip(room,original,target){
  recordInvestigation(room,original,target,target.influences.map((_,i)=>i));
  recordInvestigation(room,target,original,original.influences.map((_,i)=>i));
  room.log.push(`${target.name} uses Gossip with ${original.name}. Both players privately exchange their remaining influence identities.`);
}
function resolveCounter(room,q) { const target=player(room,q.claimantId); const original=player(room,q.targetId);
  if(!target?.alive||!original?.alive)return finishTurn(room,q.targetId);
  if(q.counterRole==='courtesan' && q.action==='intrigue') {
    exchangeGossip(room,original,target);
    return finishTurn(room,original.id);
  }
  if(q.counterRole==='lord') {
    room.log.push(`${target.name} uses Authority to block ${original.name}’s Intrigue.`);
    return finishTurn(room,original.id);
  }
  if(q.counterRole==='assassin') {
    room.log.push(`${target.name} uses False Trail to block ${original.name}’s Assassinate.`);
    return finishTurn(room,original.id);
  }
  if(q.counterRole==='swordsman') {
    room.log.push(`${target.name} uses Hire Guard against ${original.name}’s Assassinate. ${original.name} must lose an influence.`);
    return requestLoss(room,{kind:'lose',claimantId:target.id,targetId:original.id,loserId:original.id,reason:'Hire Guard',after:'finish',finishTurnId:original.id});
  }
  if(q.counterRole==='kingpin') {
    room.log.push(`${target.name} uses Intimidate to block ${original.name}’s Extort.`);
    return finishTurn(room,original.id);
  }
  if(q.counterRole==='magistrate') {
    if(original.coins>=ENFORCE_PAYMENT){
      settleEnforcePayment(room,original,target);
      return finishTurn(room,original.id);
    }
    room.log.push(`${target.name} uses Enforce against ${original.name}’s Extort. ${original.name} cannot pay and must lose an influence.`);
    return requestLoss(room,{kind:'lose',claimantId:target.id,targetId:original.id,loserId:original.id,reason:'Enforce',after:'finish',finishTurnId:original.id});
  }
}
function performDeferredAction(room,q) { resolveAction(room,{claimantId:q.claimantId,targetId:q.targetId,action:q.action}); return {ok:true}; }
function declineCounter(room,id,now=Date.now()){
  expireChallenge(room,now);
  const q=room.pending,target=player(room,id);
  if(room.status!=='playing'||!target?.alive||q?.targetId!==id)return{ok:false,error:'No counter is available to decline.'};
  if(q.kind==='counterOffer'){room.pending=null;return performDeferredAction(room,q);}
  if(q.kind!=='claim'||!COUNTER_ROLES[q.action]||q.targetResponse==='allow'||q.stage!=='challenge')return{ok:false,error:'No counter is available to decline.'};
  q.targetResponse='allow';q.passedBy ||= [];if(!q.passedBy.includes(id))q.passedBy.push(id);
  room.log.push(`${target.name} allows the action without a counter.`);
  if(alive(room).filter(p=>p.id!==q.claimantId).every(p=>q.passedBy.includes(p.id)))resolveUnchallengedClaim(room,q);
  return{ok:true};
}
function chooseCounterRole(room,id,role) {
  expireChallenge(room);
  const q=room.pending;
  const target=player(room,id);
  const combined=q?.kind==='claim'&&q.stage==='challenge'&&q.targetResponse!=='allow';
  if(room.status!=='playing'||room.challengeLosses?.length||!q||(!combined&&q.kind!=='counterOffer')||q.targetId!==id||!counterOptions(q.action,target).includes(role))return{ok:false,error:'That counter is not available to you.'};
  if(role==='swordsman'){
    payToTreasury(room,target,HIRE_GUARD_COST);
    room.log.push(`${target.name} pays ${HIRE_GUARD_COST} coins to claim Hire Guard.`);
  }
  room.pending={kind:'counterClaim',claimantId:id,targetId:q.claimantId,action:q.action,role,counterRole:role,stage:'challenge',...challengeTiming(room)};
  room.log.push(`${target.name} claims ${ROLES[role].name} (${ROLES[role].counter}).`); return{ok:true};
}
// Influence loss, elimination and challenge continuation
function requestLoss(room,q) {
  const loser=player(room,q.loserId);
  if(!loser || !loser.influences.length) return {ok:false,error:'No influence remains to lose.'};
  let count=Math.max(1,Math.floor(q.lossCount||1));
  const owed=(room.challengeLosses||[]).filter(x=>x.loserId===q.loserId).reduce((n,x)=>n+(x.lossCount||1),0);
  if(owed&&loser.influences.length<=count+owed){
    room.challengeLosses=room.challengeLosses.filter(x=>x.loserId!==q.loserId);
    count+=owed;q.lossCount=count;
  }
  if(loser.influences.length<=count) {
    room.pending=q;
    resolveLoss(room,q,0,count);
  } else room.pending=q;
  return {ok:true};
}
function loseInfluence(room,id,cardIndex) {
  const q=lossDecision(room,id); if(!q)return{ok:false,error:'You are not currently required to lose influence.'};
  const p=player(room,id); if(!p||p.influences.length<=1)return{ok:false,error:'Your final influence is lost automatically.'};
  if(!Number.isInteger(cardIndex)||cardIndex<0||cardIndex>=p.influences.length)return{ok:false,error:'Choose one of your own influence cards.'};
  return resolveLoss(room,q,cardIndex);
}
function resolveLoss(room,q,cardIndex,count=1) {
  const p=player(room,q.loserId); if(!p)return{ok:false,error:'Player not found.'};
  const lost=[];
  // The identity of an investigated card follows its slot, not its role name.
  // Invalidate other players' older observations after a card is removed,
  // while preserving disclosure status of the surviving influence.
  const oldVisibility=[...(p.intrigueVisibility||p.influences.map(()=>0))];
  for(let n=0;n<count&&p.influences.length;n++){const index=count>1?0:cardIndex;const [card]=p.influences.splice(index,1);if(card){
    oldVisibility.splice(index,1);
    for(const investigator of room.players){
      const known=investigator.privateInvestigations?.[p.id];
      if(!known)continue;
      const shifted={};
      for(const [slot,role] of Object.entries(known)){
        const n=Number(slot);
        if(n!==index)shifted[n>index?n-1:n]=role;
      }
      investigator.privateInvestigations[p.id]=shifted;
    }
    // Preserve knowledge of surviving copies, even when both cards share a role.
    for(const observation of [
      ...(room.sharedInvestigations||[]).filter(x=>x.playerId===p.id),
      ...room.players.map(x=>x.lastInvestigation).filter(x=>x?.playerId===p.id)
    ]){
      const next=[];
      (observation.indices||observation.roles.map((_,i)=>i)).forEach((slot,i)=>{
        if(slot!==index) next.push({slot:slot>index?slot-1:slot,role:observation.roles[i]});
      });
      observation.indices=next.map(x=>x.slot);
      observation.roles=next.map(x=>x.role);
    }
    (room.revealedCards ||= []).push({role:card,playerId:p.id,playerName:p.name,reason:q.reason||'Influence lost'});lost.push(card);}}
  p.intrigueVisibility=oldVisibility;
  // Knowledge is tied to influence slots, so shift indexes after each removal.
  // The indices removed were recorded in the original card index space above;
  // rebuilding from current surviving cards removes stale private knowledge.

  room.sharedInvestigations=(room.sharedInvestigations||[]).filter(x=>x.playerId!==p.id||x.roles.length);
  for(const other of room.players){
    if(other.lastInvestigation?.playerId!==p.id)continue;
    const known=other.privateInvestigations?.[p.id]||{};
    const slots=Object.keys(known).map(Number).sort((a,b)=>a-b);
    other.lastInvestigation=slots.length?{playerId:p.id,playerName:p.name,indices:slots,roles:slots.map(i=>known[i])}:null;
  }
  room.log.push(`${p.name} loses ${lost.length===1?'an influence':'both influences'}${lost.length?` (${lost.map(r=>ROLES[r].name).join(', ')})`:''}.`);
  if(!p.influences.length){
    p.alive=false;
    room.challengeLosses=(room.challengeLosses||[]).filter(x=>x.loserId!==p.id);
    // A truthful Extort still takes coins after its target pays a failed
    // challenge penalty. Settle that transfer before refunding the rest of
    // an eliminated Treasury player's coins or deciding the match winner.
    if(q.after==='continue'&&!q.wasCounter&&q.action==='extort'&&q.targetId===p.id&&q.claimantId!==p.id&&!q.finishAfterLossId&&player(room,q.claimantId)?.alive){
      collectExtort(room,player(room,q.claimantId),p);q.actionResolved=true;
    }
    if(q.after==='cancel'&&q.wasCounter&&q.action==='extort'&&q.claimantId===p.id&&player(room,q.targetId)?.alive){collectExtort(room,player(room,q.targetId),p);q.actionResolved=true;q.finishTurnId=q.targetId;}
    if(isTreasury(room)&&p.coins){const returned=p.coins;payToTreasury(room,p,returned);room.log.push(`${p.name}'s ${returned} remaining coins return to the treasury.`);}
    room.log.push(`${p.name} has been eliminated.`);
  }
  if(q.parallel)room.challengeLosses=(room.challengeLosses||[]).filter(x=>x!==q);
  if(alive(room).length===1&&!room.challengeLosses?.length){discardSummonDraw(room);room.status='finished';room.winner=alive(room)[0].name;room.winType='elimination';room.wealthVictoryEntry=null;room.pendingWealthWinnerId=null;room.finishAfterChallengesId=null;room.pending=null;room.mandatoryPurge=false;room.log.push(`${room.winner} wins the game.`);return{ok:true};}
  if(q.parallel){
    if(!room.challengeLosses?.length&&!room.pending)return finishTurn(room,room.finishAfterChallengesId||current(room)?.id);
    return{ok:true};
  }
  return continueAfterLoss(room,q);
}
function continueAfterLoss(room,q) {
  const after=q.after; const claimant=player(room,q.claimantId); room.pending=null;
  // A departure can cancel the action without canceling an already owed
  // challenge penalty. Complete that penalty before advancing the turn.
  if(q.finishAfterLossId)return finishTurn(room,q.finishAfterLossId);
  if(q.actionResolved||q.effectResolved)return finishTurn(room,q.wasCounter?q.targetId:q.claimantId);
  if(after==='continue'&&claimant?.alive) { if(q.wasCounter) resolveCounter(room,q); else offerCounterOrResolve(room,q); }
  else if(after==='continue') finishTurn(room,q.wasCounter?q.targetId:q.claimantId);
  else if(after==='finish') finishTurn(room,q.finishTurnId || q.claimantId);
  else if(after==='cancel') { if(q.wasCounter) resolveAction(room,{claimantId:q.targetId,targetId:q.claimantId,action:q.action}); else finishTurn(room,q.claimantId); }
  return{ok:true};
}

// Action effects and Summon decisions
function resolveAction(room,q) {
  const p=player(room,q.claimantId), t=player(room,q.targetId); if(!p?.alive)return finishTurn(room,q.claimantId);
  // Elimination effects and investigations need a living target. Extort's
  // owed transfer is settled in resolveLoss before elimination refunds.
  if(q.targetId && !t?.alive){
    room.log.push(`${p.name}'s ${ROLES[ROLE_ACTIONS[q.action]]?.action||q.action} has no remaining target.`);
    return finishTurn(room,p.id);
  }
  if(q.action==='tax'){const collected=treasuryWithdrawal(room,p,2);room.log.push(`${p.name} collects ${collected} coin${collected===1?'':'s'} through Tax.`);finishTurn(room,p.id);}
  if(q.action==='intrigue'){
    if(!t?.alive)return finishTurn(room,p.id);
    const unknown=intrigueUnknownIndices(room,p.id,t);
    // Recheck when deferred actions resolve: knowledge may have changed
    // during another player's influence loss or an intervening reveal.
    if(!unknown.length){room.log.push(`${p.name}'s Intrigue cannot proceed: ${t.name} has no unknown influences.`);return finishTurn(room,p.id);}
    room.log.push(`${p.name} investigates ${t.name}.`);
    if(t.coins===0){
      recordInvestigation(room,p,t,unknown);
      room.log.push(`${t.name} has no coins; Intrigue reveals the remaining unknown influence to ${p.name}.`);
      finishTurn(room,p.id);
    }else{
      room.pending={kind:'information',claimantId:p.id,targetId:t.id,action:'intrigue',stage:'choice',unknownIndices:unknown};
      room.log.push(`${t.name} may pay to conceal the influences not yet known to ${p.name}.`);
    }
  }
  if(q.action==='hireBlade'){room.log.push(`${t.name} must lose an influence to ${ROLES.swordsman.action}.`);requestLoss(room,{kind:'lose',claimantId:p.id,targetId:t.id,loserId:t.id,reason:ROLES.swordsman.action,after:'finish'});}
  if(q.action==='assassinate'){room.log.push(`${t.name} must lose an influence to the Assassinate action.`);requestLoss(room,{kind:'lose',claimantId:p.id,targetId:t.id,loserId:t.id,reason:'Assassinate',after:'finish'});}
  if(q.action==='summon'){
    const drawnRole=draw(room);
    if(!drawnRole){
      room.log.push(`${p.name} cannot draw a card with Summon.`);
      return finishTurn(room,p.id);
    }
    room.pending={kind:'summon',action:'summon',claimantId:p.id,stage:'preview',drawnRole};
    room.log.push(`${p.name} draws a card with Summon.`);
    return;
  }
  if(q.action==='extort'){collectExtort(room,p,t);finishTurn(room,p.id);}
}
function collectExtort(room,claimant,target){
  if(target.coins<2)room.log.push(`${target.name} has fewer than 2 coins; Extort takes what they have.`);
  const amount=Math.min(2,target.coins);transferCoins(room,target,claimant,amount);
  room.log.push(`${claimant.name} takes ${amount} coins from ${target.name} through Extort.`);
}
function discardSummonDraw(room) {
  const q=room.pending;
  if(q?.kind==='summon'&&q.drawnRole)room.discard.push(q.drawnRole);
}
function chooseSummon(room,id,choice,cardIndex) {
  const q=room.pending;
  const p=player(room,id);
  if(room.status!=='playing'||q?.kind!=='summon'||q.claimantId!==id||!p?.alive)
    return{ok:false,error:'You do not have a Summon decision.'};
  if(q.stage==='preview'&&choice==='discard'){
    discardSummonDraw(room);
    room.log.push(`${p.name} discards the card drawn with Summon.`);
    return finishTurn(room,id);
  }
  if(q.stage==='preview'&&choice==='replace'){
    if(!Number.isInteger(cardIndex)||cardIndex<0||cardIndex>=p.influences.length)
      return{ok:false,error:'Choose one of your own influence cards.'};
    room.discard.push(p.influences[cardIndex]);
    invalidateInfluenceKnowledge(room,id,cardIndex);
    p.influences[cardIndex]=q.drawnRole;
    noteCardExchange(room,id,cardIndex,'summon');
    room.log.push(`${p.name} replaces an influence with Summon.`);
    return finishTurn(room,id);
  }
  return{ok:false,error:'That Summon choice is no longer available.'};
}

// Intrigue concealment and private information sharing
function chooseCounter(room,id,counter) {
  const q=room.pending;
  if(q?.kind==='counterOffer'||q?.kind==='claim') return chooseCounterRole(room,id,counter);
  if(!q||q.kind!=='information')return{ok:false,error:'No Intrigue response is available.'};
  const t=player(room,q.targetId);
  const investigator=player(room,q.claimantId);
  if(id!==q.targetId)return{ok:false,error:'Only the targeted player may respond.'};
  if(q.stage!=='choice')return{ok:false,error:'Your Intrigue response is already in progress.'};
  if(counter==='keepOne'){
    if(!(q.unknownIndices||[]).length)return{ok:false,error:'No unrevealed influences remain to conceal.'};
    if(t.coins<1)return{ok:false,error:'You do not have a coin to spend.'};
    transferCoins(room,t,investigator,1);
    if(room.status==='finished'||room.pendingWealthWinnerId){
      room.log.push(`${t.name} pays 1 coin to ${investigator.name} to conceal information.`);
      finishTurn(room,q.claimantId);return{ok:true};
    }
    if((q.unknownIndices||[]).length===1){
      room.log.push(`${t.name} pays 1 coin to ${investigator.name} to keep their remaining influence hidden from Intrigue.`);
      room.pending=null; finishTurn(room,q.claimantId); return{ok:true};
    }
    q.stage='selectHidden';
    room.log.push(`${t.name} pays 1 coin to ${investigator.name} and chooses one influence to keep hidden. The other will be revealed.`);
    return{ok:true};
  }
  if(counter==='concealAll'){
    if((q.unknownIndices||[]).length!==2)return{ok:false,error:'All influences can only be concealed when neither is publicly revealed.'};
    if(t.coins<2)return{ok:false,error:'You need 2 coins to keep both influences hidden.'};
    transferCoins(room,t,investigator,2); room.log.push(`${t.name} pays 2 coins to ${investigator.name} to keep both influences hidden from Intrigue.`);
    room.pending=null; finishTurn(room,q.claimantId); return{ok:true};
  }
  if(counter==='revealAll'){
    const claimant=player(room,q.claimantId);
    recordInvestigation(room,claimant,t,q.unknownIndices); 
    room.log.push(`${t.name} declines to pay. All remaining influence is revealed privately to ${claimant.name}.`);
    finishTurn(room,q.claimantId); return{ok:true};
  }
  return{ok:false,error:'Invalid Intrigue response.'};
}
function revealIntrigue(room,id,cardIndex){
  const q=room.pending;
  if(!q||q.kind!=='information'||q.stage!=='selectHidden'||q.targetId!==id)return{ok:false,error:'You are not choosing an influence to keep hidden.'};
  const t=player(room,id),claimant=player(room,q.claimantId);
  if(!Number.isInteger(cardIndex)||cardIndex<0||cardIndex>=t.influences.length)return{ok:false,error:'Choose one of your influence cards to keep hidden.'};
  if(!(q.unknownIndices||[]).includes(cardIndex))return{ok:false,error:'You may only conceal an influence the investigator does not already know.'};
  const revealedIndices=(q.unknownIndices||[]).filter(i=>i!==cardIndex);
  recordInvestigation(room,claimant,t,revealedIndices);
  room.log.push(`${t.name} keeps one influence hidden. The revealed information is private to ${claimant.name}.`);
  finishTurn(room,q.claimantId);return{ok:true};
}

function chooseIntrigueSharing(room,id,share,indices){
  const q=room.pending;
  if(!q||q.kind!=='informationShare'||q.claimantId!==id)return{ok:false,error:'You have no Intrigue information to share.'};
  const investigator=player(room,id);
  if(share){
    const selected=Array.isArray(indices)?[...new Set(indices)].filter(i=>Number.isInteger(i)&&i>=0&&i<q.roles.length).map(i=>q.roles[i]):q.roles.slice();
    if(!selected.length)return{ok:false,error:'Select at least one influence to reveal.'};
    room.sharedInvestigations ||= [];
    const previous=room.sharedInvestigations.find(x=>x.playerId===q.targetId);
    room.sharedInvestigations=room.sharedInvestigations.filter(x=>x.playerId!==q.targetId);
    const selectedIndices=Array.isArray(indices)?[...new Set(indices)].filter(i=>Number.isInteger(i)&&i>=0&&i<q.roles.length):q.roles.map((_,i)=>i);
    const target=player(room,q.targetId);
    markInfluenceVisibility(target,selectedIndices.map(i=>(q.indices?.[i]??i)),2);
    const slots=new Map((previous?.indices||[]).map((slot,i)=>[slot,previous.roles[i]]));
    selectedIndices.forEach((i,j)=>slots.set(q.indices?.[i]??i,selected[j]));
    room.sharedInvestigations.push({playerId:q.targetId,playerName:q.targetName,roles:[...slots.values()],indices:[...slots.keys()],investigatorId:investigator?.id,investigatorName:investigator?.name||'A player'});
    room.log.push(`${investigator?.name||'A player'} shares Intrigue information about ${q.targetName}: ${selected.map(r=>ROLES[r].name).join(', ')}.`);
  }else room.log.push(`${investigator?.name||'A player'} keeps Intrigue information about ${q.targetName} private.`);
  room.pending=null;finishTurn(room,id);return{ok:true};
}
// Publish a previously discovered influence without taking an action or ending a turn.
// Knowledge belongs to the investigator, even if the original Courtesan claim
// was a bluff; never trust a card identity or a visibility flag supplied by UI.
function sharePrivateIntel(room,id,targetId,slot) {
  if(room.status!=='playing')return{ok:false,error:'Private information can only be shared during a match.'};
  const investigator=player(room,id),target=player(room,targetId);
  if(!investigator?.alive)return{ok:false,error:'Only players still holding influences can share their information.'};
  if(!target?.alive||target.id===id)return{ok:false,error:'Choose an opponent who has not been eliminated.'};
  if(!Number.isInteger(slot)||slot<0||slot>=target.influences.length)return{ok:false,error:'That influence no longer exists.'};
  const known=investigator.privateInvestigations?.[targetId]||{};
  if(!Object.hasOwn(known,slot)||known[slot]!==target.influences[slot])return{ok:false,error:'You have not privately discovered that influence.'};
  if((target.intrigueVisibility?.[slot]||0)&2)return{ok:false,error:'That influence is already public.'};
  markInfluenceVisibility(target,[slot],2);
  room.sharedInvestigations ||= [];
  const previous=room.sharedInvestigations.find(x=>x.playerId===targetId);
  const slots=new Map((previous?.indices||[]).map((i,index)=>[i,previous.roles[index]]));
  slots.set(slot,target.influences[slot]);
  room.sharedInvestigations=room.sharedInvestigations.filter(x=>x.playerId!==targetId);
  room.sharedInvestigations.push({playerId:targetId,playerName:target.name,indices:[...slots.keys()],roles:[...slots.values()],investigatorId:investigator.id,investigatorName:investigator.name});
  room.log.push(`${investigator.name} shares Intrigue information about ${target.name}: ${ROLES[target.influences[slot]].name}.`);
  return{ok:true};
}
// Turn advancement
function finishTurn(room,id) {
  if(room.status!=='playing'){finishWealthAnnouncement(room);return{ok:true};}
  room.pending=null;
  if(room.challengeLosses?.length){room.finishAfterChallengesId ||= id;return{ok:true};}
  id=room.finishAfterChallengesId||id;room.finishAfterChallengesId=null;
  if(room.pendingWealthWinnerId){const winner=player(room,room.pendingWealthWinnerId);room.pendingWealthWinnerId=null;if(wealthVictory(room,winner)){finishWealthAnnouncement(room);return{ok:true};}}
  const living=alive(room);
  if(living.length<=1){room.status='finished';room.winner=living[0]?.name||null;room.winType='elimination';return{ok:true};}
  // Use the original seating order even when a counter eliminated the active player.
  const seat=room.players.findIndex(p=>p.id===id);
  const next=[...room.players.slice(seat+1),...room.players.slice(0,seat+1)].find(p=>p.alive);
  room.turn=living.indexOf(next);
  beginTurn(room);
  return{ok:true};
}
function requestEndTurn(room,id) {
  if(room.status!=='playing')return{ok:false,error:'The match is not active.'};
  if(room.pending||room.challengeLosses?.length)return{ok:false,error:'A decision is still pending.'};
  if(current(room)?.id!==id)return{ok:false,error:'It is not your turn.'};
  return{ok:false,error:'Turns advance automatically after an action resolves.'};
}
// A player leaving an active match forfeits rather than blocking other seats.
// Lost influence stays public; the other players keep playing immediately.
// Room membership, forfeits, spectators and chat
function forfeitPlayer(room,id){
 const quitter=player(room,id);
 if(!quitter || room.status!=='playing'||!quitter.alive)return{ok:false,error:'No active influence to forfeit.'};
 const previousAlive=alive(room),currentId=current(room)?.id;
 const pending=room.pending;
 const debts=room.challengeLosses||[];
 room.challengeLosses=debts.filter(q=>q.loserId!==id);
 const hadDebts=debts.length>0;
 const quittingCurrent=currentId===id;
 const from=previousAlive.findIndex(p=>p.id===id);
 for(const role of quitter.influences){(room.revealedCards||=[]).push({role,playerId:id,playerName:quitter.name,reason:'Forfeit'});}
 quitter.influences=[];quitter.intrigueVisibility=[];quitter.alive=false;
 if(isTreasury(room)&&quitter.coins){const returned=quitter.coins;payToTreasury(room,quitter,returned);room.log.push(`${quitter.name}'s ${returned} coins return to the treasury.`);}
 room.log.push(`${quitter.name} forfeits the match and loses all remaining influences.`);
 room.log.push(`${quitter.name} has been eliminated.`);
 const survivors=alive(room);
 if(survivors.length<=1){
  discardSummonDraw(room);
  room.pending=null;room.challengeLosses=[];room.finishAfterChallengesId=null;room.pendingWealthWinnerId=null;room.status='finished';room.winner=survivors[0]?.name||null;room.winType='elimination';room.mandatoryPurge=false;
  if(room.winner)room.log.push(`${room.winner} wins the game.`);
  return{ok:true};
 }
 // Restore the index of the current player after removing an earlier seat.
 if(!quittingCurrent)room.turn=survivors.findIndex(p=>p.id===currentId);
 if(pending?.kind==='lose'){
   if(pending.loserId===id){
     // Forfeiting satisfies this player's penalty. Other participants still
     // receive the normal action/counter continuation, where applicable.
     continueAfterLoss(room,pending);
   }else{
     // Never erase another player's established penalty when a claimant or
     // target departs. Its eventual selection finishes the canceled action.
     if(quittingCurrent||pending.claimantId===id||pending.targetId===id)pending.finishAfterLossId ||= currentId;
     if(quittingCurrent){
       const next=[...previousAlive.slice(from+1),...previousAlive.slice(0,from)].find(p=>p.alive);
       room.turn=survivors.findIndex(p=>p.id===next.id);
     }
   }
 }else if(quittingCurrent){
   discardSummonDraw(room);
   room.pending=null;finishTurn(room,currentId);
 }else if(pending && (pending.claimantId===id||pending.targetId===id||pending.loserId===id)){
   // A now-absent participant must not leave an unresolved response behind.
   room.pending=null;finishTurn(room,currentId);
 }else if(pending && ['claim','counterClaim'].includes(pending.kind)){
   // The player is no longer eligible to challenge; resolve if everyone
   // remaining has already passed on the current claim.
   const others=survivors.filter(p=>p.id!==pending.claimantId);
   if(others.every(p=>(pending.passedBy||[]).includes(p.id))){
     resolveUnchallengedClaim(room,pending);
   }
 }else if(hadDebts&&!pending&&!room.challengeLosses.length){
   finishTurn(room,room.finishAfterChallengesId||currentId);
 }
 return{ok:true};
}
function removeLobbyPlayer(room,requesterId,targetId){
 if(room.status!=='lobby')return{ok:false,error:'Players can only be removed during room setup.'};
 if(room.hostId!==requesterId)return{ok:false,error:'Only the host can remove players.'};
 if(requesterId===targetId)return{ok:false,error:'The host cannot kick themselves.'};
 const index=room.players.findIndex(p=>p.id===targetId);
 if(index<0)return{ok:false,error:'That player is not in the lobby.'};
 const [removed]=room.players.splice(index,1);
 room.log.push(`${removed.name} was removed from the lobby by the host.`);
 return{ok:true,removed};
}
function addSpectator(room, id, name) {
  const clean=String(name||'').trim().slice(0,18);
  if(!clean)return{ok:false,error:'Enter a nickname.'};
  if(room.players.some(p=>p.name.toLowerCase()===clean.toLowerCase())||(room.spectators||[]).some(p=>p.name.toLowerCase()===clean.toLowerCase()))return{ok:false,error:'That nickname is already in use.'};
  room.spectators ||= []; room.spectators.push({id,name:clean,connected:true}); room.log.push(`${clean} joined as a spectator.`); return{ok:true};
}
function addChatMessage(room, id, message) {
  const sender=player(room,id)||(room.spectators||[]).find(p=>p.id===id);
  const content=String(message||'').trim().slice(0,300);
  if(!sender)return{ok:false,error:'You are not in this room.'};
  if(!content)return{ok:false,error:'Enter a message.'};
  room.chat ||= []; room.chat.push({id,name:sender.name,message:content,at:Date.now()});
  if(room.chat.length>100)room.chat.splice(0,room.chat.length-100);
  return{ok:true};
}
const api={MAX_PLAYERS,configureMaxPlayers,lossDecision,beginTurn,configureChallengeTimer,configureTreasuryMode,expireChallenge,ROLES,createGame,publicState,privateState,startGame,treasuryInvariant,performAction,challenge,passChallenge,loseInfluence,chooseCounter,declineCounter,chooseSummon,revealIntrigue,chooseIntrigueSharing,sharePrivateIntel,finishTurn,requestEndTurn,performDeferredAction,addSpectator,addChatMessage,forfeitPlayer,removeLobbyPlayer};

if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.URAMAKU_GAME=api;
})(typeof window!=='undefined'?window:null);
