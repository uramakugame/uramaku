/* Shared action and decision markup for multiplayer and the guided match. */
(function(root){
 'use strict';
 const node=typeof module==='object'&&module.exports;
 const i18n=node?require('../../../shared/i18n'):root.URAMAKU_I18N;
 const cards=node?require('./role-cards'):root.URAMAKU_ROLE_CARDS;
 const feedback=node?require('./game-feedback'):root.URAMAKU_FEEDBACK;
 const art=node?require('../config/action-assets'):root.URAMAKU_ACTION_ART;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const word=(key,lang,params)=>i18n.get(key,lang,params);
 const roleMap={tax:'lord',intrigue:'courtesan',hireBlade:'swordsman',assassinate:'assassin',summon:'magistrate',extort:'kingpin'};
 function roleHint(room,id,lang='en'){
  const role=room.roles?.[id]||{},title=i18n.role(id,lang);
  const lines=[room.revealFactions?title+' · '+word(role.faction?.includes('Order')?'order':'underworld',lang):title];
  if(role.action&&role.action!=='—')lines.push(`${word('action',lang)} — ${lang==='jp'?role.actionJp:role.action}: ${lang==='jp'?role.effectJp:role.effect}`);
  if(role.counter&&role.counter!=='—')lines.push(`${word('counter',lang)} — ${lang==='jp'?role.counterJp:role.counter}: ${lang==='jp'?role.counterEffectJp:role.counterEffect}`);
  return lines.join('\n');
 }
 // The compact header repeats the shared treasury balance for quick reference.
 function boardTreasury({room,lang='en'}){
  if(!room.treasuryMode||room.status==='lobby')return '';
  return `<div class="game-board-treasury header-treasury ${room.riot?'is-riot':'is-order'}" role="status" aria-live="polite" aria-atomic="true"><strong class="board-treasury-balance">${esc(word('treasuryBalance',lang,{count:room.treasuryCoins,total:room.totalCoins}))}</strong></div>`;
 }
 function matchInfo({room,lang='en'}){
  const mode=room.treasuryMode?(room.revealFactions?'modeTreasuryFaction':'modeTreasury'):(room.revealFactions?'modeFaction':'modeClassic');
  return `<section class="table-match-info" aria-label="${esc(word('matchInformation',lang))}"><div class="section-title">${esc(word('matchInformation',lang))}</div><strong class="table-mode">${esc(word(mode,lang))}</strong><span class="table-round">${esc(word('currentRound',lang,{round:room.roundNumber||1}))}</span><span class="table-remaining">${esc(word('playersRemaining',lang,{count:room.players?.filter(p=>p.alive).length||0}))}</span>${room.treasuryMode?`<div class="game-board-treasury ${room.riot?'is-riot':'is-order'}" role="status"><strong class="mode-state" data-mode-state>${esc(word(room.riot?'modeStateChaos':'modeStateOrder',lang))}</strong><span class="board-treasury-balance">${esc(word('treasuryBalance',lang,{count:room.treasuryCoins,total:room.totalCoins}))}</span><span class="board-wealth-goal">${esc(word('wealthGoal',lang,{count:room.economyWinThreshold}))}</span><small class="mode-state-notice" data-mode-state-notice aria-live="polite"></small></div>`:''}</section>`;
 }
 function board({room,you,lang='en',players=''}){
  return `<div class="players table-board"><div class="table-seats">${players}</div>${matchInfo({room,lang})}${deck({room,you,lang})}</div>`;
 }
 function deck({room,you,lang='en'}){
  const pile=room.drawPile||{},count=Number.isInteger(pile.count)&&pile.count>=0?pile.count:0,discard=room.discardPile?.count||0;
  const quantity=(key,value,className)=>word(key,lang,{count:'@@count@@'}).split('@@count@@').map(text=>text?`<span>${esc(text)}</span>`:'').join(`<strong class="${className}">${value}</strong>`);
  const faction=room.revealFactions&&['order','underworld'].includes(pile.topFaction)?pile.topFaction:null;
  const discardFaction=room.revealFactions&&['order','underworld'].includes(room.discardPile?.topFaction)?room.discardPile.topFaction:null;
  const empty=count===0?word(pile.reshufflePending?'deckReshuffle':'deckEmpty',lang):'';
  return `<section class="panel game-deck-panel table-piles" aria-label="${esc(word('deckTitle',lang))}"><div class="player-roles pile-roles"><div class="pile-column draw-pile"><div class="deck-stack${count>1?' is-stacked':''}${count===0?' is-empty':''}" data-card-pile="draw">${count>0?cards.hidden({faction}):'<div class="deck-empty-slot"></div>'}${summonCard({room,you,lang})}</div><div class="deck-details" role="status" aria-live="polite" aria-atomic="true">${quantity('deckRemainingCount',count,'deck-count')}</div></div><div class="pile-column discard-pile"><div class="discard-stack${discard>1?' is-stacked':''}${discard===0?' is-empty':''}" data-card-pile="discard" aria-label="${esc(word('discardPileTitle',lang))}">${discard>0?cards.hidden({faction:discardFaction}):`<div class="deck-empty-slot"></div>`}</div><div class="deck-details">${quantity('discardPileCount',discard,'discard-count')}</div></div></div>${empty?`<small class="deck-empty-note">${esc(empty)}</small>`:''}</section>`;
 }
 // Read only public resolved outcomes. Income and pending declarations do not
 // replace the previous result; no hidden role or investigation payload is read.
 function latestOutcome(room,lang='en'){
  const entries=room.log||[];let result=null,attack=null;
  const actionNames={Purge:'purge',Overthrow:'overthrow',Assassinate:'assassinate','Hire Blade':'hireBlade','Hire Guard':'hireGuard'};
  const actionWord=id=>id==='hireGuard'?i18n.translate('Hire Guard',lang):i18n.action(id,lang);
  for(const entry of entries){
   let m;
   if(/claims .+? and declares|takes Earn |collects \d+ coins? through Tax|through Extort|loots 1 coin/.test(entry))attack=null;
   if((m=entry.match(/^(.+?) (?:claims (?:Assassin|Swordsman) and declares|uses) (Assassinate|Hire Blade|Purge|Overthrow) (?:against )(.+?)(?: during Chaos \(5 coins\))?\.$/)))attack={from:m[1],to:m[3],action:actionNames[m[2]]};
   if((m=entry.match(/^(.+?) uses Hire Guard against (.+?)’s Assassinate\./)))attack={from:m[1],to:m[2],action:'hireGuard'};
   if((m=entry.match(/^(.+?) takes Earn .* gains (\d+) coins?\.$/)))result={action:'earn',title:m[1]+' · '+i18n.action('earn',lang),detail:word('outcomeGain',lang,{player:m[1],count:m[2]})};
   else if((m=entry.match(/^(.+?) collects (\d+) coins? through Tax\.$/)))result={action:'tax',title:m[1]+' · '+i18n.action('tax',lang),detail:word('outcomeGain',lang,{player:m[1],count:m[2]})};
   else if((m=entry.match(/^(.+?) takes (\d+) coins? from (.+?) through Extort\.$/)))result={action:'extort',title:m[1]+' → '+m[3]+' · '+i18n.action('extort',lang),detail:word('outcomeTransfer',lang,{from:m[3],to:m[1],count:m[2]})};
   else if((m=entry.match(/^(.+?) loots 1 coin from (.+?) during Chaos\.$/)))result={action:'loot',title:m[1]+' → '+m[2]+' · '+i18n.action('loot',lang),detail:word('outcomeTransfer',lang,{from:m[2],to:m[1],count:1})};
   else if((m=entry.match(/^(.+?) uses Enforce against (.+?)’s Extort\. \2 pays 2 coins to \1\.$/)))result={action:'extort',title:m[1]+' · '+i18n.translate('Enforce',lang),detail:word('outcomeTransfer',lang,{from:m[2],to:m[1],count:2})};
   else if((m=entry.match(/^(.+?) loses (an influence|both influences)(?: \((.+?)\))?\.$/)))result={action:attack?.to===m[1]?attack.action:null,title:attack?.to===m[1]?attack.from+' → '+m[1]+' · '+actionWord(attack.action):m[1],detail:word(m[2]==='both influences'?'outcomeLoss':'outcomeLossOne',lang,{player:m[1],count:m[2]==='both influences'?2:1})};
   else if(/uses (?:Authority|False Trail|Intimidate) to block|uses Gossip with|investigates .+?\.|replaces an influence with Summon|discards the card drawn with Summon|shares Intrigue information|successfully challenges|wins (?:the game|by accumulating)/.test(entry))result={title:i18n.translate(entry,lang),detail:''};
  }
  return result;
 }
 function outcome({room,lang='en'}){
  const item=latestOutcome(room,lang);
  return `<section class="panel game-outcome-panel" aria-label="${esc(word('lastOutcome',lang))}"><div class="section-title">${esc(word('lastOutcome',lang))}</div>${item?`<div class="outcome-body">${item.action?`<img class="outcome-icon" src="${esc(art[item.action]||art.hireBlade)}" alt="">`:''}<div><strong>${esc(item.title)}</strong>${item.detail?`<p>${esc(item.detail)}</p>`:''}</div></div>`:`<p class="muted">${esc(word('noOutcome',lang))}</p>`}</section>`;
 }
 function actions({room,you,lang='en',allowedAction=null}){
  return [room.riot?'loot':'earn','tax','intrigue','hireBlade','assassinate','summon','extort',room.riot?'overthrow':'purge'].map(action=>{
   const role=roleMap[action],hint=role?roleHint(room,role,lang):word({earn:'hintEarn',loot:'hintLoot',purge:'hintPurge',overthrow:'hintOverthrow'}[action],lang);
   const classes=role?(you?.influences||[]).includes(role)?'held':'bluff':'neutral';
   const disabled=allowedAction===null?!!feedback.unavailableReason(room,you,action,lang):action!==allowedAction;
   return `<button type="button" class="action ${classes}${action==='loot'?' riot-loot':action==='overthrow'?' riot-overthrow':''}${action==='purge'&&room.mandatoryPurge?' forced-purge':''}" data-action="${action}" data-tooltip="${esc(hint)}" ${disabled?'disabled':''}><img src="${art[action]}" alt="" class="action-portrait ${role?'portrait-'+role:'action-general-art'}"><b>${esc(i18n.action(action,lang))}</b></button>`;
  }).join('');
 }
 function counterButtons(room,you,lang){
  return (room.pending?.options||[]).map(id=>{const role=room.roles[id],held=(you?.influences||[]).includes(id),label=word('claimCounter',lang,{role:i18n.role(id,lang),counter:lang==='jp'?role.counterJp:role.counter});return `<button type="button" class="small counter-choice${held?' held':''}" data-counter="${id}">${esc(label)}</button>`;}).join('');
 }
 function challenge({room,you,lang='en'}){
  const q=room.pending,combined=q?.kind==='claim'&&q.targetId===you?.id&&(q.options||[]).length>0;
  const copy=feedback.challengeCopy(room,you,lang);
  return `<p class="decision-question">${esc(word(combined?'targetResponseQuestion':'challengeClaim',lang))}</p><p class="challenge-claim-summary">${esc(copy.summary)}</p><div class="row decision-buttons"><button type="button" class="small" data-challenge>${esc(word('challengeChoice',lang))}</button>${combined?`${counterButtons(room,you,lang)}<button type="button" class="small" data-decline>${esc(word('allowAction',lang))}</button>`:`<button type="button" class="small" data-pass>${esc(word('passChoice',lang))}</button>`}</div>`;
 }
 function counter({room,you,lang='en'}){
  return `<p class="decision-question">${esc(word('counterQuestion',lang))}</p><div class="row decision-buttons">${counterButtons(room,you,lang)}<button type="button" class="small" data-decline>${esc(word('allowAction',lang))}</button></div>`;
 }
 function information({you,lang='en'}){
  const count=you.informationChoice?.unknownIndices?.length||0;
  return `<div class="row decision-buttons"><button type="button" class="small" data-counter="revealAll">${esc(word('revealAll',lang))}</button><button type="button" class="small" data-counter="keepOne" ${you.coins<1?'disabled':''}>${esc(word('payHideOne',lang))}</button>${count>1?`<button type="button" class="small" data-counter="concealAll" ${you.coins<2?'disabled':''}>${esc(word('payHideAll',lang))}</button>`:''}</div>`;
 }
 function ownsSummon(room,you){return room.pending?.kind==='summon'&&room.pending.claimantId===you?.id&&!!you.summonDrawnRole;}
 function summonCard({room,you,lang='en'}){
  if(!ownsSummon(room,you))return '';
  return `<div id="summonTray" class="player-roles deck-draw" hidden inert>${cards.revealed({role:you.summonDrawnRole,name:i18n.role(you.summonDrawnRole,lang),classes:['summon-drawn-card'],tooltip:roleHint(room,you.summonDrawnRole,lang)})}</div>`;
 }
 function summon({room,you,lang='en',allowDiscard=true}){
  if(!ownsSummon(room,you))return '';
  return `<section class="summon-choice stack" data-summon-controls hidden inert aria-label="${esc(i18n.action('summon',lang))}"><p class="decision-question">${esc(word('summonBoard',lang,{role:i18n.role(you.summonDrawnRole,lang)}))}</p><div class="row decision-buttons"><button type="button" class="small" data-summon-choice="discard" ${allowDiscard?'':'disabled'}>${esc(word('summonDiscardDraw',lang))}</button></div></section>`;
 }
 function challengeLoss({room,you,lang='en'}){
  const debts=room.challengeLosses||[];if(!debts.length)return '';
  const own=debts.some(q=>q.loserId===you?.id);
  return `<p class="challenge-penalty-note" role="status">${esc(word(own?'challengeLossChoose':'challengeLossWaiting',lang,{players:debts.map(q=>room.players.find(p=>p.id===q.loserId)?.name||'').join(', ')}))}</p>`;
 }
 const api={actions,roleHint,challenge,counter,information,summon,deck,board,boardTreasury,matchInfo,outcome,latestOutcome,challengeLoss};
 if(node)module.exports=api;if(root)root.URAMAKU_PANELS=api;
})(typeof window!=='undefined'?window:null);
