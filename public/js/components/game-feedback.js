/* Shared presentation helpers. Effects observe snapshots; they never advance play. */
(function(root){
 'use strict';
 const i18n=root?.URAMAKU_I18N||(typeof require==='function'?require('../../../shared/i18n'):null);
 const word=(key,lang,params)=>i18n.get(key,lang,params);
 const costs=Object.freeze({hireBlade:5,assassinate:3,purge:7,overthrow:5});
 function requirementReason(room,you,action,lang='en'){
  const text=(key,params)=>word(key,lang,params);
  if(room?.status!=='playing'||!you?.alive)return '';
  if(action==='loot'){
   if(!room.riot)return text('actionLootRiot');
   if(room.pending?.kind==='summon')return text('lootDuringSummon');
   if(room.challengeLosses?.length||room.pending?.kind==='lose')return text('actionDecisionPending');
  }
  if(room.turnPlayerId===you.id&&room.mandatoryPurge&&action!=='purge')return text('actionPurgeRequired');
  if(action==='tax'&&room.riot)return text('actionEmptyTreasury');
  if(costs[action]&&(you.coins||0)<costs[action])return text('actionNeedCoins',{count:costs[action]});
  const opponents=(room.players||[]).filter(p=>p.alive&&p.id!==you.id);
  if(['loot','extort'].includes(action)&&!opponents.some(p=>p.coins>0))return text('actionNoCoins');
  if(action==='intrigue'&&!(you.intrigueEligibleTargets||[]).length)return text('actionNoUnknownCards');
  return '';
 }
 function unavailableReason(room,you,action,lang='en'){
  const text=(key,params)=>word(key,lang,params);
  if(room?.status!=='playing')return text('actionMatchInactive');
  if(!you?.alive)return text('actionSpectating');
  // Buttons must look disabled until the handoff applies the next Income.
  if(['action','turn'].includes(room.presentationPhase))return text('actionDecisionPending');
  if(room.pending||room.challengeLosses?.length)return text('actionDecisionPending');
  if(room.turnPlayerId!==you.id)return text('actionNotYourTurn');
  if(room.mandatoryPurge&&action!=='purge')return text('actionPurgeRequired');
  return requirementReason(room,you,action,lang);
 }
 function challengeCopy(room,you,lang='en'){
  const q=room.pending||{}, names=id=>(room.players||[]).find(p=>p.id===id)?.name||word('unknownPlayer',lang);
  const params={player:names(q.claimantId),target:names(q.targetId),role:i18n.role(q.role,lang),action:i18n.action(q.action,lang),counter:i18n.action({lord:'authority',courtesan:'gossip',swordsman:'hireGuard',assassin:'falseTrail',magistrate:'enforce',kingpin:'intimidate'}[q.role],lang)};
  const key=q.kind==='counterClaim'?'challengeCounterSummary':q.targetId?'challengeTargetSummary':'challengeActionSummary';
  return {summary:word(key,lang,params),risk:''};
 }
 function decisionKey(room,you){
  if(room?.status!=='playing'||!you?.alive)return null;
  const debt=(room.challengeLosses||[]).find(q=>q.loserId===you.id);
  if(debt)return [room.code,room.turnNumber,'penalty',debt.decisionId||debt.reason].join(':');
  const q=room.pending;
  if(!q)return null;
  let required=false;
  if(['claim','counterClaim'].includes(q.kind))required=q.stage==='challenge'&&q.claimantId!==you.id&&!(q.passedBy||[]).includes(you.id);
  if(q.kind==='lose')required=q.loserId===you.id;
  if(q.kind==='counterOffer'||q.kind==='information')required=q.targetId===you.id;
  if(q.kind==='summon')required=q.claimantId===you.id;
  return required?[room.code,room.turnNumber,q.kind,q.stage,q.claimantId,q.targetId,q.role,q.challengeDeadline].join(':'):null;
 }
 function newLogEntries(before,after){
  const a=before?.log||[],b=after?.log||[];
  if(!a.length)return b;
  for(let size=Math.min(a.length,b.length);size>0;size--){
   if(a.slice(-size).every((line,i)=>line===b[i]))return b.slice(size);
  }
  return []; // A disconnected client must not replay an unrelated history.
 }
 function openingDeal(room){
  return (room?.players||[]).flatMap((p,seat)=>Array.from({length:p.influenceCount},(_,slot)=>({id:p.id,kind:'deal',slot,faction:room.revealFactions?p.influenceFactions?.[slot]:null,delay:seat*75+slot*120})));
 }
 function changes(before,after,oldYou,you,replacementChoice=null){
  const result={sounds:[],coins:[],transfers:[],targets:[],cards:[],attacks:[],flips:[],motions:[],intel:[]};
  if(!before||before.code!==after?.code)return result;
  const intel=root?.URAMAKU_INTEL||(typeof require==='function'?require('./intel-effects'):null);
  result.intel=intel?.events(before,after,oldYou,you)||[];
  if(after.status==='finished'&&before.status!=='finished'){
   const own=(after.players||[]).find(p=>p.id===you?.id);
   if(own){const won=own.alive&&own.name===after.winner&&(after.winType==='economy'?own.coins>=after.economyWinThreshold:after.players.filter(p=>p.alive).length===1);result.sounds.push(won?'victory':'defeat');}
  }else if(after.status==='playing'){
   if(you?.alive&&after.turnPlayerId===you.id&&(before.status!=='playing'||before.turnPlayerId!==after.turnPlayerId||before.turnNumber!==after.turnNumber))result.sounds.push('turn');
   if(decisionKey(after,you)&&decisionKey(after,you)!==decisionKey(before,oldYou))result.sounds.push(after.pending?.kind==='summon'&&after.pending.stage==='preview'?'draw':'response');
  }
  if(before.status!=='playing'){
   // A teaching introduction may already have dealt hands before turn one.
   if(before.status==='lobby'&&after.status==='playing'&&!before.players?.some(p=>p.influenceCount>0))result.motions.push(...openingDeal(after));
   return result;
  }
  for(const p of after.players||[]){const old=(before.players||[]).find(x=>x.id===p.id);if(old&&p.coins!==old.coins)result.coins.push({id:p.id,delta:p.coins-old.coins});if(old&&p.id!==you?.id&&p.influenceCount<old.influenceCount)result.cards.push({id:p.id,type:'loss'});}
  if(after.pending?.kind==='summon'&&after.pending.stage==='preview'&&after.pending.claimantId===you?.id&&(before.pending?.kind!=='summon'||before.pending.stage!=='preview'))result.cards.push({id:you.id,type:'draw'});
  const entries=newLogEntries(before,after);
  const unique=name=>{const players=(after.players||[]).filter(p=>p.name===name);return players.length===1?players[0].id:null;};
  const attackSounds={purge:'attackPurge',overthrow:'attackOverthrow',hireBlade:'attackHireBlade',assassinate:'attackAssassinate',hireGuard:'attackHireBlade',falseTrail:'counter'};
  const attack=({from,to,action})=>{
   if(!attackSounds[action]||from===to||!after.players?.some(p=>p.id===from)||!after.players?.some(p=>p.id===to))return;
   if(result.attacks.some(a=>a.from===from&&a.to===to&&a.action===action))return;
   result.attacks.push({from,to,action});result.sounds.push(attackSounds[action]);
  };
  for(const entry of entries){
   let m,from,to,amount;
   if((m=entry.match(/^(.+?) takes (\d+) coins? from (.+?) through Extort\.$/))){from=unique(m[3]);to=unique(m[1]);amount=Number(m[2]);}
   else if((m=entry.match(/^(.+?) loots 1 coin from (.+?) during Chaos\.$/))){from=unique(m[2]);to=unique(m[1]);amount=1;}
   else if((m=entry.match(/^(.+?) pays (\d+) coins? to (.+?) (?:to keep|to conceal|and chooses)/))){from=unique(m[1]);to=unique(m[3]);amount=Number(m[2]);}
   else if((m=entry.match(/^(.+?) uses Enforce against (.+?)’s Extort\. \2 pays 2 coins to \1\.$/))){from=unique(m[2]);to=unique(m[1]);amount=2;}
   if(from&&to&&amount>0)result.transfers.push({from,to,amount});
   // A lesson (or a combined state update) can declare and finish an attack
   // before the viewer sees a pending claim. Use the new public declaration;
   // attack() also deduplicates the normal pending-claim path below.
   if((m=entry.match(/^(.+?) claims (Assassin|Swordsman) and declares (Assassinate|Hire Blade) against (.+?)\.$/))){
    attack({from:unique(m[1]),to:unique(m[4]),action:m[3]==='Assassinate'?'assassinate':'hireBlade'});
   }
   if((m=entry.match(/^(.+?) uses (Purge|Overthrow) against (.+?)(?: during Chaos \(5 coins\))?\.$/))){const target=unique(m[3]);if(target){result.targets.push(target);attack({from:unique(m[1]),to:target,action:m[2]==='Purge'?'purge':'overthrow'});}}
  }
  const q=after.pending,old=before.pending;
  const newClaim=q?.targetId&&['claim','counterClaim'].includes(q.kind)&&(!old||old.kind!==q.kind||old.challengeDeadline!==q.challengeDeadline||old.claimantId!==q.claimantId||old.targetId!==q.targetId||old.action!==q.action||before.turnNumber!==after.turnNumber);
  if(newClaim){result.targets.push(q.targetId);if(q.kind==='claim')attack({from:q.claimantId,to:q.targetId,action:q.action});else if(['swordsman','assassin'].includes(q.counterRole))attack({from:q.claimantId,to:q.targetId,action:q.counterRole==='swordsman'?'hireGuard':'falseTrail'});}
  // Scripted lessons supply the same public actor/target metadata as live claims.
  if(after.code==='tutorial'&&after.presentationAttack?.key!==before.presentationAttack?.key&&after.presentationAttack)attack(after.presentationAttack);
  // Only this client's own hand is compared. No hidden opponent role is inspected.
  const slotFor=index=>you.influenceSlots?.[index]??index;
  const ownHand=you?.id===oldYou?.id&&oldYou?.influences&&you?.influences;
  if(ownHand){
   if(you.influences.length<oldYou.influences.length)result.cards.push({id:you.id,type:'loss'});
   else if(you.influences.length===oldYou.influences.length){
    you.influences.forEach((role,index)=>{if(role!==oldYou.influences[index])result.cards.push({id:you.id,type:'replace',slot:slotFor(index)});});
    // A proved role is exchanged even when the replacement has the same role.
    const proved=old?.claimantId===you.id&&old.role&&entries.some(line=>(line.endsWith(`${uniqueName(after,you.id)} reveals ${i18n.role(old.role,'en')}, discards it, and draws a replacement.`)||line===`${uniqueName(after,you.id)} discards the proved ${i18n.role(old.role,'en')} and draws a replacement.`));
    const provedIndex=proved?oldYou.influences.indexOf(old.role):-1;
    if(provedIndex>=0&&!result.cards.some(card=>card.id===you.id&&card.type==='replace'))result.cards.push({id:you.id,type:'replace',slot:slotFor(provedIndex)});
   }
  }
  if(old?.kind==='summon'&&old.claimantId===you?.id&&q?.kind!=='summon'){
   const kept=entries.some(line=>line===`${uniqueName(after,you.id)} replaces an influence with Summon.`);
   const discarded=entries.some(line=>line===`${uniqueName(after,you.id)} discards the card drawn with Summon.`);
   if(kept||discarded){
    result.sounds.push(kept?'replace':'discard');
    if(discarded)result.cards.push({id:you.id,type:'discard'});
    const choice=replacementChoice;
    if(kept&&ownHand&&choice?.code===before.code&&choice.playerId===you.id&&choice.turnNumber===before.turnNumber&&Number.isInteger(choice.slot)&&choice.slot>=0&&choice.slot<you.influences.length&&!result.cards.some(card=>card.id===you.id&&card.type==='replace'))result.cards.push({id:you.id,type:'replace',slot:slotFor(choice.slot)});
   }
  }
  // Reveal effects compare public information and this viewer's private knowledge.
  // Never inspect any other player's hidden hand or a proved role's replacement.
  for(const p of after.players||[]){
   const oldPlayer=(before.players||[]).find(old=>old.id===p.id);if(!oldPlayer)continue;
   const previous=visibleRoles(before,oldYou,p.id),next=visibleRoles(after,you,p.id);
   if(p.influenceCount===oldPlayer.influenceCount){
    for(const [slot,role] of Object.entries(next))if(role&&!previous[slot])result.flips.push({id:p.id,kind:'reveal',slot:Number(slot),faction:before.revealFactions?oldPlayer.influenceFactions?.[Number(slot)]:null});
   }
   const oldLost=(before.revealedCards||[]).filter(card=>card.playerId===p.id).length;
   const lost=(after.revealedCards||[]).filter(card=>card.playerId===p.id);
   for(let index=oldLost;index<lost.length;index++){
    const role=lost[index].role;
    result.motions.push({id:p.id,kind:'loss',revealIndex:index,fromRole:role,revealDiscard:!Object.values(previous).includes(role),oldFaction:before.revealFactions?(after.roles?.[role]?.faction?.includes('Order')?'order':'underworld'):null});
    if(!Object.values(previous).includes(role))result.flips.push({id:p.id,kind:'loss',revealIndex:index,faction:before.revealFactions?(after.roles?.[role]?.faction?.includes('Order')?'order':'underworld'):null});
   }
  }
  for(const card of result.cards){
   if(card.type==='draw')result.flips.push({id:card.id,kind:'draw'});
   if(card.type==='replace'&&ownHand){
    const index=you.influenceSlots?you.influenceSlots.indexOf(card.slot):card.slot;
    if(index>=0&&oldYou.influences[index])result.flips.push({id:card.id,kind:'replace',slot:card.slot,fromRole:oldYou.influences[index]});
   }
  }
  const missedExchanges=(after.cardMoveNumber||0)-(before.cardMoveNumber||0)>1;
  for(const move of missedExchanges?[]:after.cardMoves||[]){
   if(move.number<=(before.cardMoveNumber||0))continue;
   const previous=visibleRoles(before,oldYou,move.playerId),oldPlayer=before.players?.find(p=>p.id===move.playerId),nextPlayer=after.players?.find(p=>p.id===move.playerId);
   result.motions.push({id:move.playerId,kind:'replace',slot:move.slot,fromRole:move.shownRole||previous[move.slot]||null,revealDiscard:!!move.shownRole&&!previous[move.slot],oldFaction:before.revealFactions?oldPlayer?.influenceFactions?.[move.slot]:null,faction:after.revealFactions?nextPlayer?.influenceFactions?.[move.slot]:null});
  }
  for(const card of result.cards){
   if(card.type==='replace'&&!missedExchanges&&!result.motions.some(m=>m.id===card.id&&m.slot===card.slot)){
    const index=you?.influenceSlots?you.influenceSlots.indexOf(card.slot):card.slot;
    result.motions.push({id:card.id,kind:'replace',slot:card.slot,fromRole:oldYou?.influences?.[index]||null});
   }
   if(card.type==='draw'){const faction=after.roles?.[you?.summonDrawnRole]?.faction;result.motions.push({id:card.id,kind:'draw',faction:after.revealFactions&&faction?(faction.includes('Order')?'order':'underworld'):null});}
   if(card.type==='discard'&&oldYou?.summonDrawnRole)result.motions.push({id:card.id,kind:'discard',fromRole:oldYou.summonDrawnRole});
  }
  if(entries.some(line=>/discards the card drawn with Summon\.$/.test(line))&&!result.motions.some(m=>m.kind==='discard'))result.pileDiscard=true;
  if(after.pending?.kind==='summon'&&before.pending?.kind!=='summon'&&after.pending.claimantId!==you?.id)result.pileDraw=true;
  if(entries.includes('The discard pile was shuffled to form a new deck.'))result.reshuffle=true;
  return result;
 }
 function visibleRoles(room,you,id){
  if(you?.id===id)return Object.fromEntries((you.influences||[]).map((role,index)=>[index,role]));
  const known={};
  for(const observation of room.sharedInvestigations||[])if(observation.playerId===id)(observation.roles||[]).forEach((role,index)=>{known[observation.indices?.[index]??index]=role;});
  return Object.assign(known,you?.privateInvestigations?.[id]||{});
 }
 function uniqueName(room,id){return room.players.find(p=>p.id===id)?.name;}
 // A completed turn has two public coin events: its action, then the next
 // player's Income. Render the action balance before presenting that Income.
 function timeline(before,after,oldYou,you){
  if(!before||before.code!==after?.code||before.status!=='playing'||after.turnNumber!==before.turnNumber+1)return [{room:after,you}];
  const incoming=after.players?.find(p=>p.id===after.turnPlayerId);if(!incoming)return [{room:after,you}];
  const entries=newLogEntries(before,after);let income=null;
  for(let index=entries.length-1;index>=0;index--){
   const match=entries[index].match(/^(.+?) receives (\d+) Income \(now (\d+)\)\.$/);
   if(match&&match[1]===incoming.name&&Number(match[3])===incoming.coins){income={amount:Number(match[2]),entry:entries[index]};break;}
   if(entries[index]===`${incoming.name} receives no Income because the treasury is empty.`){income={amount:0,entry:entries[index]};break;}
  }
  if(!income)return [{room:after,you}];
  const copy=value=>value?JSON.parse(JSON.stringify(value)):value;
  const actionRoom=copy(after),actionYou=copy(you),incomingPlayer=actionRoom.players.find(p=>p.id===incoming.id);
  incomingPlayer.coins-=income.amount;if(actionYou?.id===incoming.id)actionYou.coins-=income.amount;
  if(actionRoom.treasuryMode){actionRoom.treasuryCoins+=income.amount;actionRoom.riot=actionRoom.treasuryCoins===0;actionRoom.purgeCost=actionRoom.riot?5:7;}
  const index=actionRoom.log.lastIndexOf(income.entry);if(index>=0)actionRoom.log=actionRoom.log.slice(0,index);
  Object.assign(actionRoom,{turnPlayerId:before.turnPlayerId,nextTurnPlayerId:incoming.id,turnNumber:before.turnNumber,roundNumber:before.roundNumber,status:'playing',winner:null,winType:null,pending:null,mandatoryPurge:false,presentationPhase:'action'});
  const turnRoom={...actionRoom,turnPlayerId:incoming.id,turnNumber:after.turnNumber,roundNumber:after.roundNumber,presentationPhase:'turn'};
  return [{room:actionRoom,you:actionYou},{room:turnRoom,you:actionYou,turn:{from:before.turnPlayerId,to:incoming.id}}, {room:{...after,presentationPhase:'income',presentationIncome:income.amount},you}];
 }
 function present({container,before,after,oldYou,you,replacementChoice=null,lang='en',render,complete,current=()=>true}){
  const flow=root.URAMAKU_PRESENTATION,reduced=root?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const frames=reduced?[{room:after,you}]:timeline(before,after,oldYou,you);
  let index=0,previous=before,previousYou=oldYou;
  function advance(){
   if(!current())return;
   const frame=frames[index++];if(!frame){root.URAMAKU_RIOT_STATE?.announce(container,{before,after,lang});complete();return;}
   const effects=changes(previous,frame.room,previousYou,frame.you,replacementChoice),entries=previous?.code===frame.room.code?newLogEntries(previous,frame.room):[];
   const previewRect=effects.motions?.some(m=>m.kind==='discard')?root.URAMAKU_CARD_MOTION?.previewRect(container):null;
   render(frame.room,frame.you);
   if(frame.turn)animateTurn(frame.turn,{container});
   animate(effects,{container,lang,previewRect,nonBlockingCoins:frame.room.presentationPhase==='income'});playSounds(effects,entries,{container});
   previous=frame.room;previousYou=frame.you;
   if(reduced)advance();else flow.settled(container,advance);
  }
  advance();
 }
 function animateTurn({from,to},{container}){
  const players=Array.from(container.querySelectorAll('.player[data-player-id]')),next=players.find(el=>el.dataset.playerId===to),old=players.find(el=>el.dataset.playerId===from);
  const flow=root.URAMAKU_PRESENTATION;
  for(const [element,arriving] of [[old,false],[next,true]]){
   if(!element?.animate)continue;
   const release=flow.hold(container,()=>finish());let finished=false,timer;
   const ring=element.ownerDocument.createElement('span');ring.className='turn-handoff-ring';ring.setAttribute('aria-hidden','true');element.appendChild(ring);
   const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);ring.remove();release();};
   try{const animation=ring.animate(arriving?[{opacity:0,transform:'scale(1.06)'},{opacity:1,transform:'scale(1.025)',offset:.45},{opacity:.65,transform:'scale(1)'}]:[{opacity:.8,transform:'scale(1)'},{opacity:0,transform:'scale(.98)'}],{duration:520,easing:'ease-out',fill:'forwards'});animation?.finished?.then(finish,finish);timer=setTimeout(finish,620);}catch{finish();}
  }
 }
 function decorateActions(container,{room,you,lang='en',tutorial=false}={}){
  if(!container?.querySelectorAll)return;
  for(const button of container.querySelectorAll('.game-actions-panel .action[data-action]')){
   const action=button.dataset.action;
   if(!tutorial){
    const reason=unavailableReason(room,you,action,lang);
    button.disabled=!!reason;
    if(reason){
     const slot=document.createElement('div');slot.className='action-slot unavailable-action';slot.tabIndex=0;
     const requirement=requirementReason(room,you,action,lang);
     slot.dataset.tooltip=button.dataset.tooltip||'';
     if(requirement){slot.dataset.unavailableReason=requirement;slot.title=requirement;}
     const label=i18n.action(action,lang)+(requirement?'. '+requirement:'');
     slot.setAttribute('aria-label',label);
     button.parentNode.insertBefore(slot,button);slot.appendChild(button);button.setAttribute('aria-label',label);
    }
   }
   if(costs[action]){
    const cost=document.createElement('span');cost.className='action-cost';cost.textContent=word('actionCoinCost',lang,{count:costs[action]});
    button.querySelector('b')?.appendChild(cost);
   }
  }
 }
 function animate(effects,{container=document,lang='en',previewRect=null,nonBlockingCoins=false}={}){
  if(root?.matchMedia?.('(prefers-reduced-motion: reduce)').matches){if(effects.intel?.length)root?.URAMAKU_INTEL?.animate(effects.intel,{container,lang});return;}
  const flow=root?.URAMAKU_PRESENTATION;
  const deals=(effects.motions||[]).filter(m=>m.kind==='deal');
  const dealt=deals.length?flow?.beginDeal(container,{count:deals.length,lang}):null;
  const players=()=>Array.from(container.querySelectorAll('.player[data-player-id]'));
  const find=id=>players().find(el=>el.dataset.playerId===id);
  const pulse=(el,frames,duration)=>{if(!el?.animate)return;const release=flow?.hold(container,()=>complete());let closed=false,timer;const complete=()=>{if(closed)return;closed=true;clearTimeout(timer);release?.();};try{const animation=el.animate(frames,{duration,easing:'ease-out'});animation?.finished?.then(complete,complete);timer=setTimeout(complete,duration+100);}catch{complete();}};
  for(const action of effects.attacks||[]){
   const source=find(action.from),target=find(action.to);
   if(!source||!target)continue;
   const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
   const x=a.left+a.width/2,y=a.top+a.height/2,dx=b.left+b.width/2-x,dy=b.top+b.height/2-y,length=Math.hypot(dx,dy);
   if(length<1)continue;
   const styles={purge:{distance:18,duration:600,color:'#9b322e'},overthrow:{distance:24,duration:560,color:'#b57824'},hireBlade:{distance:28,duration:380,color:'#ba592e'},assassinate:{distance:16,duration:500,color:'#70526f'},hireGuard:{distance:28,duration:380,color:'#ba592e'},falseTrail:{distance:10,duration:320,color:'#70526f'}};
   const style=styles[action.action];if(!style)continue;
   const mx=dx/length*style.distance,my=dy/length*style.distance;
   const frames=[{transform:'translate(0,0)',opacity:1},{transform:`translate(${mx}px,${my}px)`,opacity:action.action==='assassinate'?0.7:1,offset:.45},{transform:'translate(0,0)',opacity:1}];
   pulse(source,frames,style.duration);
   if(action.action==='falseTrail')continue; // A block nudges, without an attack flight.
   flow?.impact(container,action.to,style.duration);
   // Fly a decorative copy of the visible card center-to-center. Live controls
   // keep their position; no opponent's private hand is fetched or inspected.
   const flight=document.createElement('div');flight.className='game-shell attack-flight';flight.setAttribute('aria-hidden','true');flight.setAttribute('inert','');
   Object.assign(flight.style,{left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px',opacity:'0'});
   const layout=document.createElement('div');layout.className='game-layout';
   const board=document.createElement('div');board.className='game-players-panel';
   const boardWidth=source.closest?.('.game-players-panel')?.getBoundingClientRect().width||a.width;
   board.style.width=boardWidth+'px';
   const copy=source.cloneNode(true);
   copy.removeAttribute('id');copy.removeAttribute('data-player-id');
   for(const el of copy.querySelectorAll('[id]'))el.removeAttribute('id');
   Object.assign(copy.style,{width:a.width+'px',height:a.height+'px',minWidth:'0',maxWidth:'none',margin:'0'});
   board.appendChild(copy);layout.appendChild(board);flight.appendChild(layout);document.body.appendChild(flight);
   const arrival=`translate(${dx}px,${dy}px)`;
   const finishAttack=flow?.hold(container,()=>removeFlight());
   const removeFlight=()=>{flight.remove();finishAttack?.();};
   try{const flightAnimation=flight.animate?.([{transform:'translate(0,0) scale(1)',opacity:.92},{transform:arrival+' scale(.94)',opacity:action.action==='assassinate'?.7:.92,offset:.75},{transform:arrival+' scale(.9)',opacity:0}],{duration:style.duration,easing:'ease-in-out',fill:'forwards'});flightAnimation?.finished?.then(removeFlight,removeFlight);setTimeout(removeFlight,style.duration+100);}catch{removeFlight();}
   pulse(target,[{boxShadow:`0 0 0 3px ${style.color}`},{boxShadow:'0 0 0 0 transparent'}],style.duration);
   const trail=document.createElement('span');trail.className='attack-trail attack-'+action.action;trail.setAttribute('aria-hidden','true');
   trail.style.left=x+'px';trail.style.top=y+'px';trail.style.width=length+'px';trail.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;trail.style.color=style.color;document.body.appendChild(trail);
   const releaseTrail=flow?.hold(container,()=>remove()),remove=()=>{trail.remove();releaseTrail?.();};
   try{const animation=trail.animate?.([{opacity:0},{opacity:.8,offset:.2},{opacity:0}],{duration:style.duration,easing:'ease-out',fill:'forwards'});animation?.finished?.then(remove,remove);setTimeout(remove,style.duration+100);}catch{remove();}
  }
  for(const id of effects.targets||[])if(!effects.attacks?.some(attack=>attack.to===id))pulse(find(id),[{boxShadow:'0 0 0 3px #bf663c'},{boxShadow:'0 0 0 0 transparent'}],650);
  const moving=new Set(),lossMotions=new Set();
  const motion=root?.URAMAKU_CARD_MOTION||(typeof require==='function'?require('./card-motion'):null);
  for(const [enabled,kind] of [[effects.pileDraw,'draw'],[effects.pileDiscard,'discard']])if(enabled){const done=flow?.hold(container);if(!motion?.pileMotion(container,{kind,onComplete:done}))done?.();}
  if(effects.reshuffle)for(const el of container.querySelectorAll('[data-card-pile]'))pulse(el,[{opacity:.5,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],280);
  for(const item of effects.motions||[]){
   if(item.kind==='discard'){const complete=flow?.hold(container);if(!motion?.discardPreview({rect:previewRect,fromRole:item.fromRole,lang,container,onComplete:complete}))complete?.();continue;}
   if(item.kind==='draw'&&flow?.whenSummonReady&&container.querySelector('#summonTray')?.hidden){
    const preview=container.querySelector('#summonTray .summon-drawn-card');if(preview)moving.add(preview);
    flow.whenSummonReady(container,tray=>{const el=tray.querySelector('.summon-drawn-card'),complete=flow.hold(container);if(!el||!motion?.animate(el,{...item,lang,pileContainer:container,onComplete:complete}))complete();});continue;
   }
   const el=item.kind==='draw'?container.querySelector('#summonTray .summon-drawn-card'):item.kind==='loss'?find(item.id)?.querySelector(`.eliminated-role-card[data-reveal-index="${item.revealIndex}"]`):find(item.id)?.querySelector(`.room-role-card[data-influence-slot="${item.slot}"]`);
   const complete=item.kind==='deal'?dealt:flow?.hold(container);
   if(el&&motion?.animate(el,{...item,lang,pileContainer:container,delay:item.kind==='loss'?flow?.revealDelay(container,item.id)||0:item.delay,reveal:!el.classList.contains('hidden-role-card'),onComplete:()=>{complete?.();}})){moving.add(el);if(item.kind==='loss')lossMotions.add(item.id);}else complete?.();
  }
  const flipped=new Set(),lossFlips=new Map();
  const flipCard=root?.URAMAKU_CARD_FLIP||(typeof require==='function'?require('./card-flip'):null);
  for(const flip of effects.flips||[]){
   const el=flip.kind==='draw'?container.querySelector('#summonTray .summon-drawn-card'):flip.kind==='loss'?find(flip.id)?.querySelector(`.eliminated-role-card[data-reveal-index="${flip.revealIndex}"]`):find(flip.id)?.querySelector(`.room-role-card[data-influence-slot="${flip.slot}"]`);
   if(el&&!moving.has(el)){
    const complete=flow?.hold(container);
    if(flipCard?.animate(el,{fromRole:flip.fromRole,faction:flip.faction,lang,delay:flip.kind==='loss'?flow?.revealDelay(container,flip.id)||0:0,onComplete:complete})){flipped.add(el);if(flip.kind==='loss')lossFlips.set(flip.id,el);}else complete?.();
   }
  }
  for(const {id,type,slot} of effects.cards||[]){
   const el=type==='draw'?container.querySelector('#summonTray .summon-drawn-card'):type==='replace'?(Number.isInteger(slot)&&slot>=0?find(id)?.querySelector(`.room-role-card[data-influence-slot="${slot}"]`):null):lossFlips.get(id)||find(id)?.querySelector('.player-roles');
   // Discarding the drawn Summon card does not move the held influences.
   if(type==='loss'&&lossMotions.has(id))continue;
   if(type!=='discard'&&!flipped.has(el)&&!moving.has(el))pulse(el,[{opacity:.45,transform:'translateY(-5px)'},{opacity:1,transform:'translateY(0)'}],300);
   if(type==='loss'&&el){const r=el.getBoundingClientRect();float(word(type==='loss'?'feedbackLost':'feedbackDiscarded',lang),r.left+r.width/2,r.top+r.height/2,28,-30,'feedback-card',400,flow?.revealDelay(container,id)||0);}
  }
  function float(text,x,y,dx,dy,kind,duration,delay=0,blocking=true,anchor=null){
   const token=document.createElement('span');token.className='feedback-token '+kind;token.textContent=text;token.setAttribute('aria-hidden','true');
   // A delayed cleanup must never expose the unfaded underlying element.
   token.style.opacity='0';token.style.left=x+'px';token.style.top=y+'px';document.body.appendChild(token);
   const release=flow?.hold(container,()=>remove(),{blocking});let closed=false,timer,positionFrame;
   const remove=()=>{if(closed)return;closed=true;clearTimeout(timer);if(positionFrame!==undefined)root?.cancelAnimationFrame?.(positionFrame);token.remove();release?.();};
   // Income remains visible through the final turn render. Resolve the live
   // player again so a detached tile's old viewport position cannot pin it
   // over another row. The same anchor is used for every coin gain/loss.
   const position=()=>{
    if(closed)return;
    const point=anchor?.();if(!point){remove();return;}
    token.style.left=point.x+'px';token.style.top=point.y+'px';
    positionFrame=root?.requestAnimationFrame?.(position);
   };
   if(anchor)position();
   try{const animation=token.animate?.([{transform:'translate(-50%,-50%)',opacity:1},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`,opacity:0}],{duration,delay,easing:'ease-out',fill:'forwards'});animation?.finished?.then(remove,remove);timer=setTimeout(remove,delay+duration+100);}catch{remove();}
  }
  for(const change of effects.coins||[]){
   const anchor=()=>{const el=find(change.id),coin=el?.querySelector('.player-coins');if(!coin)return null;const tile=el.getBoundingClientRect();return{x:tile.left+tile.width/2,y:coin.getBoundingClientRect().top};};
   const point=anchor();if(!point)continue;
   float((change.delta>0?'+':'')+change.delta,point.x,point.y,0,-24,change.delta>0?'coin-gain':'coin-loss',1475,0,!nonBlockingCoins,anchor);
  }
  for(const transfer of effects.transfers||[]){
   const a=find(transfer.from)?.querySelector('.player-coins')?.getBoundingClientRect(),b=find(transfer.to)?.querySelector('.player-coins')?.getBoundingClientRect();
   if(a&&b)float(transfer.amount===1?word('oneCoin',lang):word('actionCoinCost',lang,{count:transfer.amount}),a.left+a.width/2,a.top,b.left+b.width/2-a.left-a.width/2,b.top-a.top,'coin-transfer',1175);
  }
  if(effects.intel?.length&&root?.URAMAKU_INTEL){const reveal=()=>root.URAMAKU_INTEL.animate(effects.intel,{container,lang});if(flow)flow.whenIdle(container,reveal);else reveal();}
 }
 function playSounds(effects,entries=[],{container}={}){
  const reduced=root?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced&&(effects.motions||[]).some(m=>m.kind==='deal'))root?.UramakuAudio?.play('draw');
  const cardMotion=!reduced&&(effects.motions||[]).some(m=>['draw','replace','discard','deal','loss'].includes(m.kind));
  const sounds=(effects.sounds||[]).filter(cue=>!cardMotion||!['draw','replace','discard'].includes(cue));
  const cues=[...sounds.filter(cue=>cue.startsWith('attack')),...sounds.filter(cue=>!cue.startsWith('attack'))];
  if(entries.length&&!cardMotion&&!cues.some(cue=>cue.startsWith('attack')||['victory','defeat','draw','replace','discard'].includes(cue)))cues.push(root?.UramakuAudio?.gameEvent(entries.at(-1)));
  [...new Set(cues)].filter(Boolean).filter(cue=>cue!=='turn'||!container||!root?.URAMAKU_PRESENTATION?.deferTurn(container)).slice(0,3).forEach((cue,index)=>{const play=()=>root?.UramakuAudio?.play(cue,{delay:index*.22});if(container&&['victory','defeat'].includes(cue)&&root?.URAMAKU_PRESENTATION)root.URAMAKU_PRESENTATION.whenIdle(container,play);else play();});
 }
 const api={costs,requirementReason,unavailableReason,challengeCopy,decisionKey,newLogEntries,openingDeal,changes,timeline,present,visibleRoles,decorateActions,animate,playSounds};
 if(root)root.URAMAKU_FEEDBACK=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
