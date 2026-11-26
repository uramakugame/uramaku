/* Guided match controller. Gameplay belongs to shared/game.js; copy and route
 * belong to shared/tutorial.js. These are the same controls as the live room. */
const I18N=window.URAMAKU_I18N;
const panels=window.URAMAKU_PANELS;
const tutorial=new window.URAMAKU_TUTORIAL.Tutorial();
const app=document.getElementById('tutorial-app');
window.URAMAKU_PROJECT.bind(app);
let tutorialLanguage=I18N.getLanguage(),targetAction=null,feedbackMessage='';
const roleTooltips=window.URAMAKU_TOOLTIPS.install({getState:()=>tutorial.view().room,getLanguage:()=>tutorialLanguage});
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const word=(key,params)=>I18N.get(key,tutorialLanguage,params);
const roleName=id=>I18N.role(id,tutorialLanguage);
const playerName=p=>tutorialLanguage==='jp'?({you:'あなた',mei:'メイ',akira:'アキラ',sora:'ソラ'}[p?.id]||p?.name):p?.name;
function logText(message){
 let text=I18N.translate(message,tutorialLanguage);
 if(tutorialLanguage==='jp')return text.replace(/\bYou\b/g,'あなた').replace(/\bMei\b/g,'メイ').replace(/\bAkira\b/g,'アキラ').replace(/\bSora\b/g,'ソラ');
 const verbs={claims:'claim',declares:'declare',collects:'collect',takes:'take',pays:'pay',loses:'lose',draws:'draw',discards:'discard',replaces:'replace',passes:'pass',receives:'receive',uses:'use',reveals:'reveal',investigates:'investigate',shares:'share',keeps:'keep',wins:'win',has:'have'};
 return text.replace(/\bYou's\b/g,'Your').replace(/\bYou (claims|declares|collects|takes|pays|loses|draws|discards|replaces|passes|receives|uses|reveals|investigates|shares|keeps|wins|has)\b/g,(_,verb)=>'You '+verbs[verb]);
}
function showHint(){feedbackMessage=word('tutorialFollow');const el=document.getElementById('tutorialFeedback');if(el){el.textContent=feedbackMessage;el.hidden=false;}}
function dealCards(){window.URAMAKU_FEEDBACK.animate({motions:window.URAMAKU_FEEDBACK.openingDeal(tutorial.view().room)},{container:app,lang:tutorialLanguage});}
let tutorialPresentation=null;
const reactionSession=window.URAMAKU_PLAYER_REACTIONS.install({container:app,getRoom:()=>tutorialPresentation?.room||tutorial.view().room,getYou:()=>tutorial.view().you,getLanguage:()=>tutorialLanguage});
function handle(input){
 if(window.URAMAKU_PRESENTATION.busy(app))return;
 const before=tutorial.view();
 const previousStep=tutorial.step;
 if(!tutorial.dispatch(input).ok){showHint();return;}
 feedbackMessage='';targetAction=null;
 const after=tutorial.view();
 const replacement=input.type==='replace'?{code:before.room.code,playerId:'you',turnNumber:before.room.turnNumber,slot:input.cardIndex}:null;
 window.URAMAKU_PRESENTATION.enqueue(app,{code:'tutorial',run:(complete,current)=>{
  window.URAMAKU_FEEDBACK.present({container:app,before:before.room,after:after.room,oldYou:before.you,you:after.you,replacementChoice:replacement,lang:tutorialLanguage,current,render:(room,you)=>{tutorialPresentation={room,you,step:room.presentationPhase?previousStep:tutorial.step};render();},complete:()=>{if(!current())return;tutorialPresentation=null;render();complete();}});
 }});
}
function chooseAction(action){
 const expected=tutorial.step.input;
 if(expected.type!=='action'||expected.action!==action){showHint();return;}
 if(expected.targetId){targetAction=action;feedbackMessage='';render();return;}
 handle({type:'action',action});
}
function influenceCards(p,room,you){
 const own=p.id==='you',expected=room.presentationPhase?{type:'presentation'}:tutorial.step.input,cards=[];
 if(own){
  you.influences.forEach((role,index)=>{
   const type=expected.type==='loss'?'lose':expected.type==='replace'?'replace':null;
   const visibility=you.intrigueVisibility?.[index]||0;
   cards.push(window.URAMAKU_ROLE_CARDS.revealed({role,name:roleName(role),slot:index,status:word(visibility&2?'publicRevealed':visibility&1?'privateRevealed':'hidden'),classes:type&&expected.cardIndex===index?['tutorial-highlight']:[],tooltip:type?null:panels.roleHint(room,role,tutorialLanguage),select:type?{type,index,label:word(type==='lose'?'loseInfluence':'replaceInfluence')}:null}));
  });
 }else{
  const known=window.URAMAKU_FEEDBACK.visibleRoles(room,you,p.id);
  for(let slot=0;slot<p.influenceCount;slot++){
   const role=known[slot];
   const shared=room.sharedInvestigations?.find(x=>x.playerId===p.id)?.indices?.includes(slot);
   const canShare=!shared&&you.alive&&p.alive&&you.privateInvestigations?.[p.id]?.[slot];
   cards.push(role?window.URAMAKU_ROLE_CARDS.revealed({role,name:roleName(role),slot,status:word(shared?'publicIntel':'privateIntel'),classes:[shared?'shared-role-card':'private-revealed-role-card'],tooltip:panels.roleHint(room,role,tutorialLanguage),extraHtml:canShare?window.URAMAKU_ROLE_CARDS.shareControl({targetId:p.id,slot,label:word('makePublic'),ariaLabel:word('shareInfluenceAria',{player:playerName(p),role:roleName(role)})}):''}):window.URAMAKU_ROLE_CARDS.hidden({slot}));
  }
 }
 room.revealedCards.filter(card=>card.playerId===p.id).forEach((lost,revealIndex)=>cards.push(window.URAMAKU_ROLE_CARDS.revealed({role:lost.role,name:roleName(lost.role),revealIndex,status:word('eliminated'),classes:['eliminated-role-card'],tooltip:panels.roleHint(room,lost.role,tutorialLanguage)})));
 return cards.join('');
}
function decisionMarkup(room,you,input=tutorial.step.input){
 const markup=(['pass','challenge'].includes(input.type)||input.type==='counter'&&room.pending?.kind==='claim')?panels.challenge({room,you,lang:tutorialLanguage}):['counter','decline'].includes(input.type)?panels.counter({room,you,lang:tutorialLanguage}):input.type==='information'?panels.information({you,lang:tutorialLanguage}):input.type==='replace'?panels.summon({room,you,lang:tutorialLanguage,allowDiscard:false}):'';
 return markup?`<section class="panel stack game-decision-panel t-decision" aria-label="${esc(word('tutorialYourResponse'))}">${markup}</section>`:'';
}
function bindCardDecision(selector,callback){
 app.querySelectorAll(selector).forEach(card=>{card.onclick=()=>callback(card);card.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();callback(card);}};});
}
function render(){
 window.URAMAKU_PRESENTATION?.sync(app,{code:'tutorial',lang:tutorialLanguage});
 window.URAMAKU_RIOT_STATE?.sync(app,{room:tutorialPresentation?.room||tutorial.view().room,lang:tutorialLanguage});
 const movingCards=window.URAMAKU_CARD_MOTION?.capture(app)||[];
 roleTooltips.hide();
 const {room,you}=tutorialPresentation||tutorial.view(),step=tutorialPresentation?.step||tutorial.step,input=room.presentationPhase?{type:'presentation'}:step.input;
 const progress=Math.round(tutorial.index/(window.URAMAKU_TUTORIAL.steps.length-1)*100);
 const allowed=input.type==='action'?input.action:false;
 app.innerHTML=`<div class="shell game-shell t-shell factions-off"><header class="mast"><div class="jp">裏 幕</div><div class="sub">URAMAKU · A GAME OF INFLUENCE</div></header><div class="t-header"><div><span class="t-eyebrow">${esc(word('tutorialMatch'))}</span><h1>${esc(word('tutorial'))}</h1><small>${esc(word('tutorialSeats'))}</small></div><div class="t-header-actions"><span>${esc(word('tutorialLessonProgress',{current:tutorial.index+1,total:window.URAMAKU_TUTORIAL.steps.length}))}</span><button type="button" id="backStep" class="small" ${tutorial.checkpoints.length<2?'disabled':''}>${esc(word('tutorialBack'))}</button><button type="button" id="restart" class="small">${esc(word('tutorialRestart'))}</button><a href="/?fromTutorial=1" class="t-exit">${esc(word('tutorialLobby'))}</a></div></div><div class="game-layout t-layout"><aside class="game-actions-sidebar"><div class="panel game-room-code t-empty-room" aria-hidden="true"></div><section class="panel game-actions-panel"><div class="section-title">${esc(word('actions'))}</div><div class="actions">${panels.actions({room,you,lang:tutorialLanguage,allowedAction:allowed})}</div></section></aside><div class="game-main"><section class="panel action-flow t-lesson" aria-live="polite"><div class="section-title">${esc(word('tutorialLesson'))} · ${progress}%</div><div class="t-progress"><div style="width:${progress}%"></div></div><h2>${esc(step.title[tutorialLanguage])}</h2><p>${esc(step.text[tutorialLanguage])}</p>${targetAction?`<p class="t-feedback">${esc(word('tutorialTarget',{player:playerName(room.players.find(p=>p.id===input.targetId))}))}</p>`:''}${decisionMarkup(room,you,input)}<p id="tutorialFeedback" class="t-feedback" role="status" ${feedbackMessage?'':'hidden'}>${esc(feedbackMessage)}</p>${input.type==='next'?`<div class="t-choices"><button type="button" id="continueLesson" class="t-primary">${esc(word('tutorialContinue'))}</button></div>`:''}${input.type==='end'?`<div class="t-choices"><a href="/?fromTutorial=1" class="t-primary t-end-link">${esc(word('tutorialLobby'))}</a></div>`:''}</section><section class="panel game-players-panel t-board"><div class="row t-board-head"><div class="section-title">${esc(word('playersInfluences'))}</div><div class="row"><span>${esc(word('tutorialRound',{round:tutorial.round}))}</span>${window.URAMAKU_PLAYER_REACTIONS.controls({room,you,lang:tutorialLanguage})}</div></div>${panels.board({room,you,lang:tutorialLanguage,players:room.players.map(p=>`<div class="player ${room.status==='playing'&&p.alive&&room.turnPlayerId===p.id?'active-player':''}${targetAction&&p.id===input.targetId?' selectable-target tutorial-highlight':''}" data-player-id="${p.id}" ${targetAction&&p.id===input.targetId?`role="button" tabindex="0" aria-label="${esc(playerName(p))}"`:''}><div class="player-meta"><div class="player-name-row"><div class="name">${esc(playerName(p))}${p.id==='you'?' '+esc(word('you')):''}</div></div><div class="player-coins">${esc(word('coins'))} ${p.coins}</div></div><div class="player-roles">${influenceCards(p,room,you)}</div></div>`).join('')})}</section></div><aside class="game-sidebar">${panels.outcome({room,lang:tutorialLanguage})}<section class="panel game-log-panel"><div class="section-title">${esc(word('gameLog'))}</div><div class="log" aria-live="polite">${room.log.slice().reverse().map((entry,index)=>`<div class="${index===0?'log-latest':''}">${esc(logText(entry))}</div>`).join('')}</div></section></aside></div>${window.URAMAKU_PROJECT.footer({lang:tutorialLanguage})}</div>`;
 window.URAMAKU_FEEDBACK.decorateActions(app,{lang:tutorialLanguage,tutorial:true});
 if(input.type==='action')app.querySelector(`[data-action="${input.action}"]`)?.classList.add('tutorial-highlight');
 const selector=input.type==='share'?`[data-share-private-target="${input.targetId}"][data-share-private-slot="${input.slot}"]`:input.type==='counter'?`[data-counter="${input.counter}"]`:input.type==='challenge'?'[data-challenge]':input.type==='pass'?'[data-pass]':input.type==='decline'?'[data-decline]':input.type==='information'?`[data-counter="${input.choice}"]`:null;
 if(selector)app.querySelector(selector)?.classList.add('tutorial-highlight');
 document.documentElement.lang=tutorialLanguage==='jp'?'ja':'en';
 document.getElementById('backStep').onclick=()=>{window.URAMAKU_PRESENTATION.cancel(app);reactionSession.reset();window.URAMAKU_INTEL.cancel(app);tutorialPresentation=null;tutorial.back();targetAction=null;feedbackMessage='';render();};
 document.getElementById('restart').onclick=()=>{window.URAMAKU_PRESENTATION.cancel(app);reactionSession.reset();window.URAMAKU_INTEL.cancel(app);tutorialPresentation=null;tutorial.restart();targetAction=null;feedbackMessage='';render();dealCards();};
 document.getElementById('continueLesson')?.addEventListener('click',()=>handle({type:'next'}));
 app.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>chooseAction(button.dataset.action));
 if(targetAction)bindCardDecision('.selectable-target[data-player-id]',card=>handle({type:'action',action:targetAction,targetId:card.dataset.playerId}));
 bindCardDecision('[data-lose]',card=>handle({type:'loss',cardIndex:Number(card.dataset.lose)}));
 bindCardDecision('[data-summon-replace]',card=>{if(!document.getElementById('summonTray')?.hidden)handle({type:'replace',cardIndex:Number(card.dataset.summonReplace)});});
 app.querySelectorAll('[data-share-private-target]').forEach(button=>button.onclick=event=>{event.stopPropagation();handle({type:'share',targetId:button.dataset.sharePrivateTarget,slot:Number(button.dataset.sharePrivateSlot)});});
 app.querySelectorAll('[data-pass]').forEach(button=>button.onclick=()=>handle({type:'pass'}));
 app.querySelectorAll('[data-challenge]').forEach(button=>button.onclick=()=>handle({type:'challenge'}));
 app.querySelectorAll('[data-counter]').forEach(button=>button.onclick=()=>handle(input.type==='information'?{type:'information',choice:button.dataset.counter}:{type:'counter',counter:button.dataset.counter}));
 app.querySelectorAll('[data-decline]').forEach(button=>button.onclick=()=>handle({type:'decline'}));
 app.querySelectorAll('[data-summon-choice]').forEach(button=>button.onclick=()=>{if(!document.getElementById('summonTray')?.hidden)handle({type:'summon',choice:button.dataset.summonChoice});});
 window.URAMAKU_PRESENTATION?.presentSummon(app,document.getElementById('summonTray'),{key:`tutorial:${room.turnNumber}:${you.summonDrawnRole}`});
 window.URAMAKU_CARD_MOTION?.restore(app,movingCards);
 window.URAMAKU_INTEL?.sync(app,{code:'tutorial',lang:tutorialLanguage});reactionSession.sync();window.URAMAKU_RIOT_STATE?.sync(app,{room,lang:tutorialLanguage});
 window.URAMAKU_PRESENTATION?.sync(app,{lang:tutorialLanguage});
}

render();dealCards();
