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
 function deck({room,you,lang='en'}){
  const pile=room.drawPile||{},count=Number.isInteger(pile.count)&&pile.count>=0?pile.count:0;
  const faction=room.revealFactions&&['order','underworld'].includes(pile.topFaction)?pile.topFaction:null;
  const next=count>0&&faction?word('deckNextFaction',lang,{faction:word(faction,lang)}):'';
  const empty=count===0?word(pile.reshufflePending?'deckReshuffle':'deckEmpty',lang):'';
  return `<section class="panel game-deck-panel" aria-label="${esc(word('deckTitle',lang))}"><div class="deck-summary"><div class="deck-stack${count>1?' is-stacked':''}${count===0?' is-empty':''}">${count>0?cards.hidden({faction}):'<div class="deck-empty-slot"></div>'}${summonCard({room,you,lang})}</div><div class="deck-details" role="status" aria-live="polite" aria-atomic="true"><strong class="deck-count">${count}</strong><span class="deck-count-label">${esc(word('deckRemaining',lang))}</span>${next?`<small class="deck-next-faction">${esc(next)}</small>`:''}${empty?`<small class="deck-empty-note">${esc(empty)}</small>`:''}</div></div></section>`;
 }
 function actions({room,you,lang='en',allowedAction=null}){
  return [room.riot?'loot':'earn','tax','intrigue','hireBlade','assassinate','summon','extort',room.riot?'overthrow':'purge'].map(action=>{
   const role=roleMap[action],hint=role?roleHint(room,role,lang):word({earn:'hintEarn',loot:'hintLoot',purge:'hintPurge',overthrow:'hintOverthrow'}[action],lang);
   const classes=role?(you?.influences||[]).includes(role)?'held':'bluff':'neutral';
   const disabled=allowedAction===null?!!feedback.unavailableReason(room,you,action,lang):action!==allowedAction;
   return `<button type="button" class="action ${classes}${action==='loot'?' riot-loot':action==='overthrow'?' riot-overthrow':''}${action==='purge'&&room.mandatoryPurge?' forced-purge':''}" data-action="${action}" data-tooltip="${esc(hint)}" ${disabled?'disabled':''}><img src="${art[action==='overthrow'?'purge':action]}" alt="" class="action-portrait ${role?'portrait-'+role:'action-general-art'}"><b>${esc(i18n.action(action,lang))}</b></button>`;
  }).join('');
 }
 function challenge({room,you,lang='en'}){
  const copy=feedback.challengeCopy(room,you,lang);
  return `<p class="decision-question">${esc(word('challengeClaim',lang))}</p><p class="challenge-claim-summary">${esc(copy.summary)}</p><div class="row decision-buttons"><button type="button" class="small" data-challenge>${esc(word('challengeChoice',lang))}</button><button type="button" class="small" data-pass>${esc(word('passChoice',lang))}</button></div>`;
 }
 function counter({room,lang='en'}){
  return `<p class="decision-question">${esc(word('counterQuestion',lang))}</p><div class="row decision-buttons">${(room.pending?.options||[]).map(id=>{const role=room.roles[id];return `<button type="button" class="small" data-counter="${id}">${esc(lang==='jp'?role.counterJp:role.counter)} — ${esc(i18n.role(id,lang))}${id==='swordsman'?' ('+esc(word('actionCoinCost',lang,{count:5}))+')':''}</button>`;}).join('')}<button type="button" class="small" data-decline>${esc(word('allowAction',lang))}</button></div>`;
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
 const api={actions,roleHint,challenge,counter,information,summon,deck,challengeLoss};
 if(node)module.exports=api;if(root)root.URAMAKU_PANELS=api;
})(typeof window!=='undefined'?window:null);
