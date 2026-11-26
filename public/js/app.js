const socket = io();
const app = document.getElementById('app');
let challengeCountdownTimer=null, serverClockOffset=0, warnedChallengeKey=null;
let referenceLanguage=window.URAMAKU_I18N.getLanguage();
const i18n=window.URAMAKU_I18N;
const t=(key,params)=>i18n.get(key,referenceLanguage,params);
const tl=(string)=>i18n.translate(string,referenceLanguage);
const roleName=(id)=>i18n.role(id,referenceLanguage);
const roleAction=(id)=>i18n.action(id,referenceLanguage);
function languageToggleMarkup(){return `<button id="languageToggle" class="language-toggle small" type="button" aria-label="${t('languageToggleAria')}" title="${t('languageToggleAria')}"><span class="language-option ${referenceLanguage==='en'?'is-active':''}">EN</span><span class="language-switch-arrow" aria-hidden="true">⇄</span><span class="language-option ${referenceLanguage==='jp'?'is-active':''}">JP</span></button>`;}
function localizeRoom(root=document.body){i18n.apply(root,referenceLanguage);document.documentElement.lang=referenceLanguage==='jp'?'ja':'en';}
function changeLanguage(lang){referenceLanguage=lang==='jp'?'jp':'en';i18n.setLanguage(referenceLanguage);const overlay=document.getElementById('rulesReferenceOverlay');if(overlay)overlay.remove();render();window.UramakuAudio?.renderToggle();if(overlay)showRules();const stack=document.getElementById('actionAnnouncements');if(stack)for(const toast of stack.children){if(toast.dataset.originalMessage)toast.textContent=tl(toast.dataset.originalMessage);}}
function bindLanguageToggle(){document.getElementById('languageToggle')?.addEventListener('click',()=>changeLanguage(referenceLanguage==='en'?'jp':'en'));}
let roomCode=null, me=null, state=null, notice='', noticeTimer=null, chatOpen=false, chatDraft='', unreadChat=0;
const roleTooltips=window.URAMAKU_TOOLTIPS.install({getState:()=>state,getLanguage:()=>referenceLanguage});
const reactionSession=window.URAMAKU_PLAYER_REACTIONS.install({container:app,socket,getRoom:()=>state,getYou:()=>me,getLanguage:()=>referenceLanguage,clock:()=>Date.now()+serverClockOffset,report:message=>show(message)});
let announcedWinnerRoom=null;
let chatBounds=null, chatSizeObserver=null; // Window geometry persists across room-state renders.
let targetSelectionAction=null;
let roomNameDraft=null;
let kickSelectionActive=false,kickPendingId=null,kickRoomCode=null;
let pendingReplacementChoice=null;
// One forced-Purge explanation per turn. Targeting starts automatically; the
// explanation is dismissible without canceling the required action.
let forcedPurgeKey=null, forcedPurgeExplainerOpen=false, forcedPurgeTargetSubmitted=false;
function syncMandatoryPurgeTargeting(){
 if(kickSelectionActive)return;
 const required=state?.status==='playing'&&state.mandatoryPurge===true&&state.turnPlayerId===me?.id&&me?.alive&&(!state.pending);
 if(!required)return;
 const key=`${state.code}:${state.turnNumber}:${me.id}`;
 if(forcedPurgeKey!==key){
   forcedPurgeKey=key;forcedPurgeExplainerOpen=true;forcedPurgeTargetSubmitted=false;
 }
 if(!forcedPurgeTargetSubmitted)targetSelectionAction='purge';
}
function mandatoryPurgeExplainer(){
 if(!state?.mandatoryPurge||state.status!=='playing'||state.turnPlayerId!==me?.id||state.pending||!forcedPurgeExplainerOpen||forcedPurgeTargetSubmitted)return '';
 return `<aside class="forced-purge-explainer" role="status" aria-label="Mandatory Purge explanation"><div class="forced-purge-heading"><strong>Mandatory Purge</strong><button type="button" id="dismissMandatoryPurge" aria-label="Dismiss explanation">×</button></div><p>Purge was selected automatically because you have <strong>10 or more coins after Income</strong>.</p><p><strong>Select an opponent's player card</strong> to eliminate an influence. Purge costs 7 coins and cannot be challenged.</p></aside>`;
}
const ACTION_ANNOUNCEMENT_DURATION=2500;
const ACTION_FADE_OUT_MS=540;
const ANNOUNCEMENT_GAP_MS=1000;
let previousAnnouncementRemovalAt=0;
const $ = (s)=>document.querySelector(s);
window.URAMAKU_ANNOUNCEMENTS={show:showActionAnnouncement};
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
// Role tooltips and general-action descriptions
function roleHint(role){
 const r=state?.roles?.[role]||{};
 const faction=String(r.faction||'').includes('Order')?t('order'):t('underworld');
 const title=referenceLanguage==='jp'?r.jp:r.name||role;
 // The optional setting governs tooltip faction details as well as card emblems.
 const lines=[state?.revealFactions?`${title} · ${faction}`:title];
 if(r.action&&r.action!=='—')lines.push(`${t('action')} — ${referenceLanguage==='jp'?r.actionJp:r.action}: ${referenceLanguage==='jp'?r.effectJp:r.effect||''}`);
 if(r.counter&&r.counter!=='—')lines.push(`${t('counter')} — ${referenceLanguage==='jp'?r.counterJp:r.counter}: ${referenceLanguage==='jp'?r.counterEffectJp:r.counterEffect||''}`);
 return lines.join('\n');
}
function generalActionHint(action){
 if(action==='earn')return state?.riot?t('hintLoot'):t('hintEarn');
 if(action==='purge'||action==='overthrow')return t(action==='overthrow'?'hintOverthrow':'hintPurge');
 return '';
}

// A private reconnect token restores this browser tab's seat on refresh or a
// temporary socket disconnect. Never use a nickname alone to authenticate.
const SEAT_STORAGE_KEY='uramaku-seat';
function savedSeat(){try{return JSON.parse(sessionStorage.getItem(SEAT_STORAGE_KEY)||'null');}catch{return null;}}
function rememberSeat(result){
 if(!result?.code||!result.resumeToken)return;
 try{sessionStorage.setItem(SEAT_STORAGE_KEY,JSON.stringify({code:result.code,token:result.resumeToken,...(result.intentId?{intentId:result.intentId}:{})}));return true;}catch{return false;}
}
window.URAMAKU_COMMAND_SESSION=window.URAMAKU_COMMAND_SENDER.create({socket,getView:()=>({room:state,you:me}),report:message=>show(message)});
window.URAMAKU_ROOM_BROWSER_SESSION=window.URAMAKU_PUBLIC_ROOMS.install({socket,document,getLanguage:()=>referenceLanguage,onJoin:room=>openEntryDialog('join',room)});
function send(event,data={}){
 if(window.URAMAKU_PRESENTATION?.busy(app)&&['action','challenge','passChallenge','counter','declineCounter','loseInfluence','summonChoice','intrigueReveal','intrigueSharing','sharePrivateIntel','endTurn'].includes(event))return false;
 if(event==='summonChoice'&&data.choice==='replace'&&Number.isInteger(data.cardIndex)&&state?.pending?.kind==='summon'&&state.pending.stage==='preview'&&state.pending.claimantId===me?.id){pendingReplacementChoice={code:state.code,playerId:me.id,turnNumber:state.turnNumber,slot:data.cardIndex};}
 return window.URAMAKU_COMMAND_SESSION.send(event,data);
}
// Live room snapshots, reconnects and notices
socket.on('state',d=>{
 if(!roomCode||d?.room?.code!==roomCode)return;
 if(Number.isFinite(d.serverNow))serverClockOffset=d.serverNow-Date.now();
 window.URAMAKU_PRESENTATION.enqueue(app,{code:d.room.code,run:(complete,current)=>presentRoomSnapshot(d,complete,current)});
});
function presentRoomSnapshot(d,complete,current){
 if(!current()||roomCode!==d.room.code){complete();return;}
 const previous=state,previousYou=me,next=d.room,nextYou=d.you,choice=pendingReplacementChoice;
 window.URAMAKU_ROOM_BROWSER_SESSION?.close();window.URAMAKU_COMMAND_SESSION?.resume();
 const beforeChat=previous?.chat||[],afterChat=next.chat||[];
 if(previous&&previous.code===next.code&&afterChat.length>beforeChat.length){
  const incoming=afterChat.slice(beforeChat.length).filter(message=>message.id!==nextYou?.id);
  if(incoming.length){UramakuAudio.play('chat');if(!chatOpen)unreadChat+=incoming.length;}
 }
 if(previous&&previous.code===next.code)for(const entry of window.URAMAKU_FEEDBACK.newLogEntries(previous,next)){
  const announcement=announcementForLog(entry);if(announcement)showActionAnnouncement(announcement);
 }
 const chatOnly=previous&&chatOpen&&previous.code===next.code&&JSON.stringify({...previous,chat:[],revision:0})===JSON.stringify({...next,chat:[],revision:0});
 function paint(room,you){
  state=room;me=you;roomCode=room.code;
  if(!room.presentationPhase)syncMandatoryPurgeTargeting();else targetSelectionAction=null;
  if(chatOnly){
   const list=document.querySelector('.chat-messages');
   if(list){list.innerHTML=(state.chat||[]).map(m=>`<div class="chat-message"><b>${esc(m.name)}</b><span>${esc(m.message)}</span></div>`).join('')||`<p class="muted">${t('chatEmpty')}</p>`;list.scrollTop=list.scrollHeight;}
  }else{
   const chatInput=document.getElementById('chatInput');
   const hadFocus=chatOpen&&chatInput&&document.activeElement===chatInput;
   const cursor=hadFocus?chatInput.selectionStart:null;
   render();
   if(hadFocus){const input=document.getElementById('chatInput');if(input){input.focus();if(cursor!==null)input.setSelectionRange(cursor,cursor);}}
  }
 }
 window.URAMAKU_FEEDBACK.present({container:app,before:previous,after:next,oldYou:previousYou,you:nextYou,replacementChoice:choice,lang:referenceLanguage,render:paint,current,complete:()=>{
  if(!current())return;
  if(next.pending?.kind!=='summon'||pendingReplacementChoice?.code!==next.code)pendingReplacementChoice=null;
  paint(next,nextYou);
  if(next.status==='finished'&&announcedWinnerRoom!==next.code){announcedWinnerRoom=next.code;showVictory(next.winner||'A player',next.winType==='economy',next.economyWinThreshold);}
  if(next.status!=='finished'&&announcedWinnerRoom===next.code)announcedWinnerRoom=null;
  complete();
 }});
}
socket.on('notice' ,d=>{
 kickPendingId=null;
  pendingReplacementChoice=null;
  // Restore compulsory targeting if the action was rejected by the server
  // (for example, because a target became ineligible before the request arrived).
  if(forcedPurgeTargetSubmitted&&state?.mandatoryPurge&&state.status==='playing'&&state.turnPlayerId===me?.id&&!state.pending){
    forcedPurgeTargetSubmitted=false;forcedPurgeExplainerOpen=true;targetSelectionAction='purge';render();
  }
  show(d.message);
});
socket.on('connect_error',error=>show(error?.message==='The server is full. Please try again later.'?error.message:t('connectionFailed')));
socket.on('disconnect',()=>window.URAMAKU_COMMAND_SESSION.disconnect());
socket.on('connect',()=>{
 const seat=savedSeat();if(!seat?.code||!seat?.token)return;
 socket.emit('resumeSession',seat,result=>{
   if(result?.error){
     if(result.error==='Room no longer exists.'||result.error==='This seat could not be recovered.'||result.error==='This entry has expired. Please try again.'){
       try{sessionStorage.removeItem(SEAT_STORAGE_KEY);}catch{}
       state=null;me=null;roomCode=null;render();
     }else show(result.error);
   }else{roomCode=result.code;notice='';window.URAMAKU_COMMAND_SESSION.resume();}
 });
});
socket.on('kicked',({message}={})=>{
 window.URAMAKU_COMMAND_SESSION.reset();
 try{sessionStorage.removeItem(SEAT_STORAGE_KEY);}catch{}
 state=null;me=null;roomCode=null;targetSelectionAction=null;forcedPurgeKey=null;forcedPurgeExplainerOpen=false;forcedPurgeTargetSubmitted=false;chatOpen=false;
 notice=message||'The host removed you from the room.';render();
});
function exitCurrentRoom(){
 if(!state)return;
 if(state.status==='playing'&&me?.alive&&!window.confirm('Exit this ongoing match? You will forfeit your remaining influences and cannot rejoin as a player.'))return;
 socket.emit('leaveRoom',{},result=>{
   if(result?.error){show(result.error);return;}
   try{sessionStorage.removeItem(SEAT_STORAGE_KEY);}catch{}
   window.URAMAKU_COMMAND_SESSION.reset();
   state=null;me=null;roomCode=null;targetSelectionAction=null;forcedPurgeKey=null;forcedPurgeExplainerOpen=false;forcedPurgeTargetSubmitted=false;chatOpen=false;announcedWinnerRoom=null;
   notice='';render();
 });
}
function shell(content){const lobby=!state||state.status==='lobby';return `<div class="shell ${lobby?'lobby-shell':'game-shell'} ${state?.revealFactions?'factions-on':'factions-off'}">${lobby?window.URAMAKU_PROJECT.header({lang:referenceLanguage}):'<header class="mast"><div class="jp">裏 幕</div><div class="sub">URAMAKU · A GAME OF INFLUENCE</div></header>'}${notice?`<div class="notice">${esc(notice)}</div>`:''}${content}${window.URAMAKU_PROJECT.footer({lang:referenceLanguage})}</div>`;}

function updateChallengeCountdown(){
 clearTimeout(challengeCountdownTimer);
 const q=state?.pending;
 if(state?.status!=='playing'||!['claim','counterClaim'].includes(q?.kind)||q.stage!=='challenge'||!Number.isFinite(q.challengeDeadline))return;
 const remaining=Math.max(0,q.challengeDeadline-Date.now()-serverClockOffset);
 const seconds=Math.ceil(remaining/1000);
 const label=document.querySelector('[data-challenge-countdown]');
 if(label)label.textContent=seconds?t('challengeContinues',{seconds}):t('challengeTimeOver');
 const bar=document.querySelector('[data-challenge-progress]');
 if(bar)bar.style.width=Math.min(100,remaining/(q.challengeDurationMs||state.challengeDurationSeconds*1000||15000)*100)+'%';
 document.querySelector('[data-challenge-clock]')?.classList.toggle('deadline-near',seconds<=2);
 const key=window.URAMAKU_FEEDBACK.decisionKey(state,me);
 if(seconds>0&&seconds<=2&&key&&warnedChallengeKey!==key){warnedChallengeKey=key;UramakuAudio.play('deadline');}
 if(seconds===0){document.querySelectorAll('[data-challenge],[data-pass]').forEach(button=>button.disabled=true);return;}
 challengeCountdownTimer=setTimeout(updateChallengeCountdown,100);
}
// Current Turn status and private decision summaries
function renderActionFlow(){
 const flow=(stage,headline,subline='',attention=false)=>`<section class="action-flow ${attention?'flow-attention':''}" aria-label="Current action status" aria-live="polite"><div class="flow-status"><div class="flow-kicker">${esc(stage)}</div><div class="flow-chain"><strong>${esc(headline)}</strong></div>${subline?`<p class="flow-summary">${esc(subline)}</p>`:''}${state.status==='playing'&&['claim','counterClaim'].includes(state.pending?.kind)&&state.pending.stage==='challenge'&&Number.isFinite(state.pending.challengeDeadline)?'<div class="challenge-clock" data-challenge-clock><p class="flow-summary" data-challenge-countdown></p><div class="challenge-progress" aria-hidden="true"><span data-challenge-progress></span></div></div>':''}</div></section>`;
 if(state.presentationPhase==='action')return flow(t('resolvingStage'),t('resolvingAction'));
 if(state.presentationPhase==='turn')return flow(t('nextTurnStage'),t('playerTurnBegins',{player:state.players.find(p=>p.id===state.turnPlayerId)?.name||''}));
 if(state.presentationPhase==='income')return flow(t('incomeStage'),t(state.presentationIncome===0?'playerReceivesNoIncome':'playerReceivesIncome',{player:state.players.find(p=>p.id===state.turnPlayerId)?.name||''}));
 if(state.status==='finished')return flow('MATCH COMPLETE',state.winType==='economy'?`${state.winner||'A player'} wins by reaching ${state.economyWinThreshold} coins!`:`${state.winner||'A player'} wins the game!`);
 if(state.status!=='playing')return '';
 const q=state.pending||(state.challengeLosses||[])[0];
 const nameFor=id=>state.players.find(p=>p.id===id)?.name||'A player';
 if(!q)return flow(state.mandatoryPurge?'MANDATORY PURGE':'CURRENT TURN',state.mandatoryPurge?`${nameFor(state.turnPlayerId)} must Purge this turn (10+ coins).`:`${nameFor(state.turnPlayerId)} is choosing an action.`,state.mandatoryPurge?'Purge is the only permitted action.':state.turnPlayerId===me?.id?'Choose an action below.':'');
 const labels=Object.fromEntries(['earn','tax','intrigue','extort','assassinate','summon','purge','overthrow','hireBlade'].map(id=>[id,i18n.action(id,referenceLanguage)]));
 const action=labels[q.action]||(q.kind==='information'?'Intrigue':labels[String(q.reason||'').toLowerCase()]||'the current action');
 // A counterclaim is made by the target, not the player who initiated the action.
 const actor=nameFor(q.claimantId);
 const target=nameFor(q.targetId);
 const actionSentence=q.targetId?`${actor} targets ${target} with ${action}.`:`${actor} uses ${action}.`;
 const respondingToClaim=(q.kind==='claim'||q.kind==='counterClaim')&&me?.alive&&me.id!==q.claimantId&&!(q.passedBy||[]).includes(me.id);
 const ownDecision=(q.kind==='lose'&&q.loserId===me?.id)||(q.kind==='counterOffer'&&q.targetId===me?.id)||(q.kind==='information'&&q.targetId===me?.id)||respondingToClaim;
 if(q.kind==='claim'){
   const roleName=state.roles?.[q.role]?(referenceLanguage==='jp'?state.roles[q.role].jp:state.roles[q.role].name):q.role||'a role';
   const eligible=state.players.filter(p=>p.alive&&p.id!==q.claimantId).length;
   const passed=(q.passedBy||[]).length;
   return flow('CHALLENGE',actionSentence,`${nameFor(q.claimantId)} claims ${roleName}. ${passed}/${eligible} passed.`,ownDecision);
 }
 if(q.kind==='counterOffer')return flow('COUNTER',actionSentence,ownDecision?'':`Waiting for ${nameFor(q.targetId)} to counter or allow the action.`,ownDecision);
 if(q.kind==='counterClaim'){
   const counter=state.roles?.[q.role]?(referenceLanguage==='jp'?state.roles[q.role].counterJp:state.roles[q.role].counter):'a counter';
   const roleName=state.roles?.[q.role]?(referenceLanguage==='jp'?state.roles[q.role].jp:state.roles[q.role].name):q.role||'a role';
   const eligible=state.players.filter(p=>p.alive&&p.id!==q.claimantId).length;
   const passed=(q.passedBy||[]).length;
   return flow('COUNTER CHALLENGE',window.URAMAKU_FEEDBACK.challengeCopy(state,me,referenceLanguage).summary,`${nameFor(q.claimantId)} claims ${roleName} (${counter}). ${passed}/${eligible} passed.`,ownDecision);
 }
 if(q.kind==='lose')return flow('INFLUENCE LOSS',`${nameFor(q.loserId)} must lose ${q.lossCount>1?'two influences':'an influence'}.`,q.reason||'',ownDecision);
 if(q.kind==='summon'){
   const ownSummon=q.claimantId===me?.id;
   return flow(roleAction('summon'),actionSentence,ownSummon?'':t('summonWait',{player:nameFor(q.claimantId)}),ownSummon);
 }
 if(q.kind==='information')return flow('INTRIGUE',actionSentence,ownDecision?'':`Waiting for ${nameFor(q.targetId)} to conceal influences.`,ownDecision);
 
 return flow('CURRENT TURN',actionSentence,'Resolving the action.',ownDecision);
}
// Lobby settings remain separate from the shared in-board match information.
function treasurySettingsMarkup(owner){
 if(!state.treasuryMode)return '';
 const supply=state.treasuryCoinsPerPlayer??6;
 return `<label class="lobby-setting-value" for="treasuryCoinsPerPlayer"><span>${esc(t('treasurySupplyLabel'))}</span><select id="treasuryCoinsPerPlayer" ${owner?'':'disabled'}>${[5,6,7].map(count=>`<option value="${count}" ${supply===count?'selected':''}>${count}</option>`).join('')}</select><small>${esc(t('treasurySupplyHelp'))}</small></label>`;
}
function kickEligible(p){return state?.hostId===me?.id&&p.id!==me.id&&(state.status==='lobby'||state.status==='playing'&&p.alive&&p.influenceCount>0);}
function kickControlsMarkup(){
 if(state?.hostId!==me?.id||state.status!=='playing')return '';
 return `<button id="kickModeToggle" type="button" class="small kick-mode-toggle" aria-pressed="${kickSelectionActive}" title="${esc(t('kickSelectMatch'))}" ${kickPendingId||!state.players.some(kickEligible)?'disabled':''}>${esc(t(kickSelectionActive?'kickCancel':'kickMode'))}</button>`;
}
function capacityMarkup(owner){
 return `<label class="lobby-setting-value" for="maxPlayers"><span>${esc(t('maxPlayersLabel'))}</span><select id="maxPlayers" ${owner?'':'disabled'}>${[2,3,4,5,6].map(n=>`<option value="${n}" ${n===(state.maxPlayers??6)?'selected':''} ${n<state.players.length?'disabled':''}>${n}</option>`).join('')}</select><small>${esc(t('maxPlayersHelp'))}</small></label>`;
}
// Room entry and lobby controls
function openEntryDialog(mode){
 const options=arguments[1]||{};
 // Keep the welcome screen uncluttered; only request details after choosing a path.
 document.getElementById('roomEntryDialog')?.remove();
 const creating=mode==='create';
 const backdrop=document.createElement('div');backdrop.className='modal-backdrop room-entry-backdrop';backdrop.id='roomEntryDialog';
 backdrop.innerHTML=`<form class="panel room-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="roomEntryTitle"><div class="room-entry-dialog-head"><span class="lobby-entry-number">${creating?'HOST A MATCH':'ENTER A MATCH'}</span><button type="button" class="room-entry-close" aria-label="Close dialog">×</button></div><h2 id="roomEntryTitle">${creating?'Create room':'Join room'}</h2><p>${creating?'Choose the name other players will see.':'Enter the nickname you want to use and your invitation code.'}</p><label for="entryNickname">Nickname</label><input id="entryNickname" name="nickname" maxlength="18" autocomplete="nickname" placeholder="Your name" required>${creating?'':`<label for="entryCode">Room code</label><input id="entryCode" name="code" maxlength="4" minlength="4" autocomplete="off" placeholder="ABCD" required autocapitalize="characters" spellcheck="false">`}<p class="room-entry-error" id="entryError" role="alert" hidden></p><div class="room-entry-buttons">${creating?'<button type="submit" class="primary" data-entry-action="create">Create room</button>':'<button type="submit" class="primary" data-entry-action="player">Join as player</button><button type="button" data-entry-action="spectator">Spectate</button>'}</div></form>`;
 document.body.appendChild(backdrop);
 localizeRoom(backdrop);
 const form=backdrop.querySelector('form');const nick=form.querySelector('#entryNickname'),code=form.querySelector('#entryCode');
 const error=form.querySelector('#entryError');const close=()=>backdrop.remove();
 form.querySelector('.room-entry-close').addEventListener('click',close);
 backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});
 backdrop.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
 code?.addEventListener('input',()=>{code.value=code.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});
 if(code&&options.code)code.value=options.code;
 let submitting=false;
 const submit=action=>{
  if(submitting)return;
  const nickname=nick.value.trim(),room=code?.value.trim().toUpperCase();
  if(!nickname){error.textContent='Enter a nickname.';error.hidden=false;nick.focus();return;}
  if(!creating&&(!room||room.length!==4)){error.textContent='Enter the four-character room code.';error.hidden=false;code.focus();return;}
  error.hidden=true;submitting=true;
  form.querySelectorAll('[data-entry-action]').forEach(b=>b.disabled=true);
  const fail=message=>{submitting=false;form.querySelectorAll('[data-entry-action]').forEach(b=>b.disabled=false);error.textContent=window.URAMAKU_I18N?.translate(message,referenceLanguage)||message;error.hidden=false;};
  socket.emit('prepareEntry',{kind:creating?'create':action==='spectator'?'spectator':'join',nickname,...(creating?{}:{code:room})},prepared=>{
   if(!backdrop.isConnected)return;
   if(prepared?.error)return fail(prepared.error);
   if(rememberSeat(prepared)===false)return fail('Your browser could not save the reconnect token. Enable session storage and try again.');
   let attempts=0;
   const confirm=()=>{
    let settled=false;
    const timer=setTimeout(()=>{if(settled)return;settled=true;if(++attempts<3&&socket.connected)confirm();else fail('Your connection was interrupted. Refresh to restore the latest room state.');},5000);
    socket.emit('confirmEntry',{code:prepared.code,token:prepared.resumeToken,intentId:prepared.intentId},res=>{
     if(settled)return;settled=true;clearTimeout(timer);submitting=false;
     if(res?.error){try{sessionStorage.removeItem(SEAT_STORAGE_KEY);}catch{}return fail(res.error);}
     roomCode=res.code;if(action==='spectator')chatOpen=false;window.URAMAKU_COMMAND_SESSION?.resume();close();
    });
   };confirm();
  });
 };
 form.addEventListener('submit',e=>{e.preventDefault();submit(creating?'create':'player');});
 form.querySelector('[data-entry-action="spectator"]')?.addEventListener('click',()=>submit('spectator'));
 nick.focus();
}
function copyRoomCode(button){
 if(!state?.code||!navigator.clipboard?.writeText)return;
 navigator.clipboard.writeText(state.code).then(()=>{
  if(!button.isConnected)return;
  const original=button.dataset.originalCopyText||button.textContent;
  button.dataset.originalCopyText=original;
  button.textContent=t('copied');button.classList.add('copy-success');
  clearTimeout(button.copyResetTimer);
  button.copyResetTimer=setTimeout(()=>{if(button.isConnected){button.textContent=original;button.classList.remove('copy-success');}},1400);
 }).catch(()=>show('Unable to copy automatically. Please select the code and copy it.'));
}
// Room and player-board rendering
function render(){
 window.URAMAKU_PROJECT.bind(app);reactionSession.sync();window.URAMAKU_RIOT_STATE?.sync(app,{room:state,lang:referenceLanguage});window.URAMAKU_INTEL?.sync(app,{code:state?.code??null,lang:referenceLanguage});
 window.URAMAKU_PRESENTATION?.sync(app,{code:state?.code??null,lang:referenceLanguage});
 const movingCards=window.URAMAKU_CARD_MOTION?.capture(app)||[];
 roleTooltips.hide();
 clearTimeout(challengeCountdownTimer);
 // Preserve user-resized chat geometry even when room state forces a full render.
 if(chatOpen)captureChatBounds();
 if(!state?.presentationPhase)syncMandatoryPurgeTargeting();else targetSelectionAction=null; if(!state){
 app.innerHTML=shell(`<div class="lobby-welcome"><div class="lobby-welcome-intro"><span class="lobby-eyebrow">HIDDEN ROLES · OPEN STRATEGY</span><h1>Choose your next move.</h1><p>${esc(t('publicWelcome'))}</p>${window.URAMAKU_PROJECT.disclosure({lang:referenceLanguage})}</div><div class="lobby-entry-actions"><div class="lobby-entry-buttons"><button id="create" class="primary">Create room</button><button id="join">Join room</button><button id="browseRooms">${esc(t('browseRooms'))}</button></div><div class="lobby-entry-language">${languageToggleMarkup()}</div></div><a class="lobby-tutorial-link" href="/tutorial.html"><strong>New to URAMAKU?</strong> Try the guided tutorial <span aria-hidden="true">→</span></a>${window.URAMAKU_PROJECT.campaign({lang:referenceLanguage})}</div>`);
 $('#create').onclick=()=>openEntryDialog('create');
 $('#join').onclick=()=>openEntryDialog('join');
 $('#browseRooms').onclick=event=>window.URAMAKU_ROOM_BROWSER_SESSION.open(event.currentTarget);
 localizeRoom();bindLanguageToggle();
 return;
 }
 const meId=me?.id, current=state.turnPlayerId, isTurn=current===meId;
 if(kickRoomCode!==state.code){kickSelectionActive=false;kickPendingId=null;kickRoomCode=state.code;}
 if(kickPendingId&&!state.players.some(p=>p.id===kickPendingId&&p.alive&&(state.status==='lobby'||p.influenceCount>0)))kickPendingId=null;
 if(state.hostId!==meId||!state.players.some(kickEligible))kickSelectionActive=false;
 if(targetSelectionAction&&!canChooseAction(targetSelectionAction))targetSelectionAction=null;
 const players=state.players.map(p=>{
  const isMe=p.id===meId, held=isMe?(me?.influences||[]):[];
  const choosingInfluence=isMe&&!targetSelectionAction;
  const loss=state.pending?.kind==='lose'&&state.pending.loserId===meId?state.pending:(state.challengeLosses||[]).find(q=>q.loserId===meId);
  const selectingLoss=choosingInfluence&&!!loss&&(loss.lossCount||1)===1&&held.length>1;
  const selectingConceal=choosingInfluence&&state.pending?.kind==='information'&&state.pending.targetId===meId&&me?.informationChoice?.stage==='selectHidden';
  const selectingReplacement=choosingInfluence&&state.pending?.kind==='summon'&&state.pending.claimantId===meId&&state.pending.stage==='preview';
  const concealOptions=me?.informationChoice?.unknownIndices||[];
  const privateIntel=me?.privateInvestigations?.[p.id]||{};
  const privateIntelSlots=Object.keys(privateIntel).map(Number).sort((a,b)=>a-b);
  const shared=state.sharedInvestigations?.find(x=>x.playerId===p.id);
  const sharedRoles=shared?.roles||[];
  const seen=new Set();
  const cards=[];
  if(isMe){
    held.forEach((r,i)=>{
      const visibility=me?.intrigueVisibility?.[i]||0;
      const status=(visibility&2)?'Publicly revealed':(visibility&1)?'Privately revealed':'Hidden';
      const canConceal=selectingConceal&&concealOptions.includes(i);
      const selectionType=selectingLoss?'lose':canConceal?'conceal':selectingReplacement?'replace':null;
      const selectionLabel=selectingLoss?t('loseInfluence'):canConceal?t('hideInfluence'):t('replaceInfluence');
      cards.push(window.URAMAKU_ROLE_CARDS.revealed({
        role:r,name:roleName(r),status,slot:i,
        classes:[(visibility&2)?'shared-role-card':(visibility&1)?'private-revealed-role-card':'',selectingConceal&&!canConceal?'conceal-not-eligible':''],
        select:selectionType?{type:selectionType,index:i,label:selectionLabel}:null,
        tooltip:selectionType?null:roleHint(r)
      }));
    });
  }else{
    privateIntelSlots.forEach(slot=>{
      const r=privateIntel[slot];
      seen.add(slot);
      cards[slot]=window.URAMAKU_ROLE_CARDS.revealed({
        role:r,name:roleName(r),slot,status:shared?.indices?.includes(slot)?'Public intel':'Private intel',
        classes:[shared?.indices?.includes(slot)?'shared-role-card':'private-intel-shareable'],tooltip:roleHint(r),
        extraHtml:!shared?.indices?.includes(slot)&&p.alive&&me?.alive&&state.status==='playing'?window.URAMAKU_ROLE_CARDS.shareControl({targetId:p.id,slot,label:t('makePublic'),ariaLabel:t('shareInfluenceAria',{role:roleName(r),player:p.name})}):''
      });
    });
    sharedRoles.forEach((r,i)=>{
      const slot=shared?.indices?.[i]??i;
      if(seen.has(slot))return;
      seen.add(slot);
      cards[slot]=window.URAMAKU_ROLE_CARDS.revealed({role:r,name:roleName(r),slot,status:'Public intel',classes:['shared-role-card'],tooltip:roleHint(r)});
    });
  }
  const liveCards=isMe?cards.join(''):Array.from({length:p.influenceCount},(_,slot)=>cards[slot]||window.URAMAKU_ROLE_CARDS.hidden({faction:state.revealFactions?p.influenceFactions?.[slot]:null,slot})).join('');
  const roleSlots=liveCards+
   (state.revealedCards||[]).filter(c=>c.playerId===p.id||(!c.playerId&&c.playerName===p.name)).map((c,revealIndex)=>window.URAMAKU_ROLE_CARDS.revealed({role:c.role,name:roleName(c.role),revealIndex,status:'Eliminated',classes:['eliminated-role-card'],tooltip:roleHint(c.role)})).join('');
  const indicator=state.status==='lobby'&&p.id===state.hostId?'<span class="turn-badge owner-badge">OWNER</span>':'';
  const kick=kickSelectionActive&&kickEligible(p)?`<button class="lobby-kick small" type="button" data-kick-id="${esc(p.id)}" data-kick-name="${esc(p.name)}">${esc(t('kick'))}</button>`:'';
  const offline=p.connected===false?`<span class="player-offline">${esc(t('offline'))}</span>`:'';
  return `<div class="player ${state.status==='playing'&&p.id===current?'active-player':''}${kick?' selectable-kick':''}" data-player-id="${esc(p.id)}"><div class="player-meta"><div class="player-name-row"><div class="name">${esc(p.name)} ${isMe?t('you'):''}</div>${indicator}${state.status==='lobby'?`<span class="lobby-ready ${p.ready?'is-ready':'is-not-ready'}">${p.ready?'Ready':'Not ready'}</span>`:''}</div><div class="player-coin-row"><div class="player-coins">Coins: ${p.coins}</div>${offline||kick?`<div class="player-presence">${offline}${kick}</div>`:''}</div></div><div class="player-roles">${roleSlots}</div></div>`;
 }).join('');
 if(state.status==='lobby'){
  const owner=state.hostId===meId;
  const waiting=state.players.filter(p=>!p.ready).length;
  const readyCount=state.players.length-waiting;
  if(!owner||roomNameDraft?.code!==state.code||!roomNameDraft.dirty||roomNameDraft.value.trim()===state.name)roomNameDraft={code:state.code,value:state.name||'',dirty:false};

  const lobbyRoster=state.players.map(p=>`<div class="lobby-seat ${p.ready?'is-ready':'is-waiting'}"><div class="lobby-seat-monogram">${esc(p.name.slice(0,1).toUpperCase())}</div><div class="lobby-seat-detail"><strong>${esc(p.name)}${p.id===meId?' <span class="lobby-you">(you)</span>':''}</strong><small>${p.id===state.hostId?'Host · ':''}${p.connected?'Connected':'Offline'}</small></div><span class="lobby-seat-status">${p.ready?'Ready':'Not ready'}</span>${owner&&p.id!==meId?`<button class="lobby-kick" type="button" data-kick-id="${esc(p.id)}" data-kick-name="${esc(p.name)}" aria-label="Kick ${esc(p.name)}">Kick</button>`:''}</div>`).join('');
  app.innerHTML=shell(`<div class="lobby-dashboard"><div class="lobby-intro"><div><span class="lobby-eyebrow">${esc(t(state.visibility==='public'?'publicMatch':'privateMatch'))}</span><h1>Gather your players</h1><p>Share your room code, choose your rule variant, and start when everyone is ready.</p></div><div class="lobby-intro-tools">${languageToggleMarkup()}<button id="exitRoom" type="button" class="lobby-exit">Leave room</button></div></div><div class="lobby-panels"><section class="panel lobby-room-panel"><div class="section-title">Room Code</div><div class="lobby-code-box"><span class="lobby-code" aria-label="Room code">${esc(state.code)}</span><button id="copy" type="button">Copy code</button></div><p class="lobby-detail">Send this code to friends so they can join from their devices.</p><form class="lobby-room-settings" id="roomDetails"><label for="roomName">${esc(t('roomNameLabel'))}</label><div class="lobby-room-name-input"><input id="roomName" type="text" maxlength="40" required value="${esc(roomNameDraft.value)}" ${owner?'':'disabled'}>${owner?`<button type="submit" class="small">${esc(t('roomDetailsSave'))}</button>`:''}</div><label for="roomVisibility">${esc(t('roomVisibilityLabel'))}</label><select id="roomVisibility" ${owner?'':'disabled'}><option value="private" ${state.visibility!=='public'?'selected':''}>${esc(t('roomPrivate'))}</option><option value="public" ${state.visibility==='public'?'selected':''}>${esc(t('roomPublic'))}</option></select><small>${esc(t('roomVisibilityHelp'))}</small></form><div class="section-title">Match settings</div>${capacityMarkup(owner)}<label class="lobby-option"><input id="revealFactions" type="checkbox" ${state.revealFactions?'checked':''} ${!owner?'disabled':''}><span><strong>Show hidden factions</strong><small>Optional mode: show Order or Underworld on card backs. Standard play keeps both hidden.${owner?'':' Only the host can change this setting.'}</small></span></label><label class="lobby-option"><input id="treasuryMode" type="checkbox" ${state.treasuryMode?'checked':''} ${!owner?'disabled':''}><span><strong>${esc(t('treasuryMode'))}</strong><small>${esc(t('treasuryDetail'))}${owner?'':esc(t('showFactionHost'))}</small></span></label>${treasurySettingsMarkup(owner)}<label class="lobby-option"><input id="challengeTimerEnabled" type="checkbox" ${state.challengeTimerEnabled!==false?'checked':''} ${!owner?'disabled':''}><span><strong>${esc(t('challengeTimerSetting'))}</strong><small>${esc(t('challengeTimerHelp'))}</small></span></label><label class="lobby-setting-value lobby-timer-duration" for="challengeDurationSeconds"><span>${esc(t('challengeDurationLabel'))}</span><input id="challengeDurationSeconds" type="number" inputmode="numeric" min="10" max="60" step="1" value="${state.challengeDurationSeconds??15}" ${!owner||state.challengeTimerEnabled===false?'disabled':''}><small>${esc(t('challengeDurationHint'))}</small></label><div class="lobby-reference-actions"><button id="lobbyRulesButton" type="button" class="small">Actions | How to play</button><button id="guidedTutorialButton" type="button" class="small">Guided Tutorial</button></div></section><section class="panel lobby-roster-panel"><div class="lobby-roster-head"><div><div class="section-title">Players</div><h2>${state.players.length} / ${state.maxPlayers??6} joined</h2></div><div class="lobby-roster-tools"><span class="lobby-ready-count">${readyCount} ready</span><button id="chatToggle" class="lobby-chat-button small" type="button">Open chat</button></div></div><div class="lobby-roster">${lobbyRoster}</div>${state.spectators?.length?`<p class="lobby-spectators">Spectators: ${state.spectators.map(p=>esc(p.name)).join(', ')}</p>`:''}<div class="lobby-ready-footer">${me?`<button id="ready" type="button" class="${state.players.find(p=>p.id===meId)?.ready?'':'primary'}">${state.players.find(p=>p.id===meId)?.ready?'✓ Ready · click to change':'Mark ready'}</button>`:'<span>Watching as spectator</span>'}${owner?`<button id="start" type="button" class="primary" ${state.players.length<2||waiting?'disabled':''}>Start match</button>`:''}</div><p class="lobby-detail">${state.players.length<2?'Invite at least one more player to begin.':waiting?`${waiting} player${waiting!==1?'s':''} still preparing.`:'Everyone is ready. The host can start the match.'}</p></section></div></div>${chatOpen?renderChat():''}`);
  localizeRoom();bindLanguageToggle();
  document.getElementById('roomName')?.addEventListener('input',event=>{roomNameDraft={code:state.code,value:event.target.value,dirty:true};});
  document.getElementById('roomDetails')?.addEventListener('submit',event=>{event.preventDefault();const input=document.getElementById('roomName');if(owner&&input.checkValidity())send('setRoomDetails',{name:input.value.trim()});});
  document.getElementById('maxPlayers')?.addEventListener('change',event=>send('setMaxPlayers',{maxPlayers:Number(event.target.value)}));
  document.getElementById('roomVisibility')?.addEventListener('change',event=>send('setRoomDetails',{visibility:event.target.value}));
 document.getElementById('copy')?.addEventListener('click',e=>copyRoomCode(e.currentTarget));
  document.getElementById('revealFactions')?.addEventListener('change',e=>send('setRevealFactions',{enabled:e.target.checked}));
  document.getElementById('challengeTimerEnabled')?.addEventListener('change',e=>send('setChallengeTimer',{enabled:e.target.checked}));
  document.getElementById('challengeDurationSeconds')?.addEventListener('change',e=>{if(!e.target.checkValidity()){show(t('challengeDurationInvalid'));return;}send('setChallengeTimer',{seconds:Number(e.target.value)});});
  document.getElementById('treasuryMode')?.addEventListener('change',e=>send('setTreasuryMode',{enabled:e.target.checked}));
  document.getElementById('treasuryCoinsPerPlayer')?.addEventListener('change',e=>send('setTreasuryMode',{coinsPerPlayer:Number(e.target.value)}));
  document.getElementById('ready')?.addEventListener('click',()=>send('ready',{ready:!state.players.find(p=>p.id===meId)?.ready}));
  document.getElementById('start')?.addEventListener('click',()=>send('startGame'));
  document.getElementById('lobbyRulesButton')?.addEventListener('click',showRules);
  document.getElementById('guidedTutorialButton')?.addEventListener('click',()=>{window.location.href='/tutorial.html';});
  document.getElementById('exitRoom')?.addEventListener('click',exitCurrentRoom);
  bindChatUI();
  bindKickControls();
  return;
 }
 const lobby='';
 let game=''; if(state.status==='playing'||state.status==='finished') game=`
 <section class="panel game-actions-panel"><div class="row" style="justify-content:space-between"><div class="section-title">Actions</div></div><div class="actions">${window.URAMAKU_PANELS.actions({room:state,you:me,lang:referenceLanguage})}</div><button id="rulesButton" class="small actions-rules-bottom">Actions | How to play</button></section>`;
 app.innerHTML=shell(`${state.status==='lobby'?'':'<div class="game-layout"><div class="game-main">'+renderActionFlow()}<section class="panel game-players-panel"><div class="game-board-header"><div class="section-title">Players & Influences</div><div class="row game-board-controls">${state.status==='lobby'?'':`${kickControlsMarkup()}${languageToggleMarkup()}${window.URAMAKU_PLAYER_REACTIONS.controls({room:state,you:me,lang:referenceLanguage})}<button id="chatToggle" class="small">${chatOpen?'Close chat':'Open chat'}</button>`}</div></div>${mandatoryPurgeExplainer()}${window.URAMAKU_PANELS.board({room:state,you:me,lang:referenceLanguage,players})}${state.spectators?.length?`<div class="spectator-list"><b>Spectators:</b> ${state.spectators.map(s=>`${esc(s.name)}${s.connected?'':' (disconnected)'}`).join(' · ')}</div>`:''}</section>${lobby}${game}${chatOpen?renderChat():''}${state.status==='lobby'?'':'</div><aside class="game-sidebar">'}${state.status==='lobby'?'':window.URAMAKU_PANELS.outcome({room:state,lang:referenceLanguage})}<section class="panel game-log-panel">${state.status==='lobby'?'':`<div class="game-room-code"><div class="room-code-heading"><span class="section-title">ROOM CODE</span><strong class="room-code-value" aria-label="Room code">${esc(state.code)}</strong></div><div class="room-code-controls"><button id="copy" class="small" type="button">Copy code</button><button id="exitRoom" class="small" type="button">Leave room</button></div></div>`}<div class="section-title">Game log · Recent events</div><div class="log" aria-live="polite">${state.log.slice().reverse().map((x,i)=>`<div class="${i===0?'log-latest':''}">${esc(x)}</div>`).join('')}</div></section>${state.status==='lobby'?'':'</aside></div>'}`);
 if(state.status!=='lobby'){
   const layout=$('.game-layout'), actions=$('.game-actions-panel');
   if(layout&&actions){
     const main=layout.querySelector('.game-main');
     const log=layout.querySelector('.game-sidebar');
     const flow=main?.querySelector('.action-flow');
     const playersPanel=main?.querySelector('.game-players-panel');
     const roomCode=log?.querySelector('.game-room-code');
     const aside=document.createElement('aside');
     aside.className='game-actions-sidebar';
     layout.insertBefore(aside,layout.firstChild);
     if(roomCode){roomCode.classList.add('panel');aside.appendChild(roomCode);}
     aside.appendChild(actions);
     if(flow)main.insertBefore(flow,main.firstChild);
     if(playersPanel && flow)main.insertBefore(playersPanel,flow.nextSibling);
     if(flow && state.status==='playing' && !targetSelectionAction){const penaltyMarkup=window.URAMAKU_PANELS.challengeLoss({room:state,you:me,lang:referenceLanguage});if(penaltyMarkup)flow.querySelector('.flow-status')?.insertAdjacentHTML('beforeend',penaltyMarkup);const decisionMarkup=renderPending(isTurn);if(decisionMarkup){flow.classList.add('has-decision');flow.insertAdjacentHTML('beforeend',decisionMarkup);}}
   }
 }
 bindKickControls();
 if(targetSelectionAction){
   const candidates=state.players.filter(p=>p.alive&&p.id!==me?.id&&(targetSelectionAction!=='intrigue'||me?.intrigueEligibleTargets?.includes(p.id))&&(!['extort','loot'].includes(targetSelectionAction)||p.coins>0));
   const panel=document.querySelector('.game-players-panel');
   panel?.classList.add('target-selecting');
   const compulsory=state.mandatoryPurge&&targetSelectionAction==='purge';
   // Target selection is a current-turn decision, just like challenges and counters.
   // Keep the player board fully visible and clickable while choosing a target.
   const flow=document.querySelector('.game-layout .action-flow');
   if(flow){
     flow.classList.add('has-decision','has-target-selection','flow-attention');
     if(!compulsory){
       const headline=flow.querySelector('.flow-chain strong');
       if(headline)headline.textContent=`${me?.name||'You'} is choosing a target for ${actionLabel(targetSelectionAction)}.`;
       const summary=flow.querySelector('.flow-summary');
       if(summary)summary.textContent='Click a highlighted opponent on the board.';
     }
     flow.insertAdjacentHTML('beforeend',`<div class="player-decision-overlay target-selection-decision"><section class="panel stack game-decision-panel" aria-label="Select action target"><p class="decision-question">${compulsory?'Mandatory Purge: select an opponent to eliminate an influence.':`Select a player for ${esc(actionLabel(targetSelectionAction))}.`}</p>${compulsory?'':'<div class="row decision-buttons"><button type="button" class="small" id="cancelTargetSelection">Cancel</button></div>'}</section></div>`);
   }
   document.getElementById('cancelTargetSelection')?.addEventListener('click',()=>{targetSelectionAction=null;render();});
   for(const candidate of candidates){
     const card=[...document.querySelectorAll('.game-players-panel .player[data-player-id]')].find(el=>el.dataset.playerId===candidate.id);
     if(card){card.classList.add('selectable-target');card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label',`Target ${candidate.name} with ${actionLabel(targetSelectionAction)}`);
       const choose=()=>{const action=targetSelectionAction;if(state.mandatoryPurge&&action==='purge'){forcedPurgeTargetSubmitted=true;forcedPurgeExplainerOpen=false;}targetSelectionAction=null;send('action',{action,targetId:candidate.id});render();};
       card.addEventListener('click',choose);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
     }
   }
 }
 const summonTray=document.getElementById('summonTray');
 window.URAMAKU_PRESENTATION?.presentSummon(app,summonTray,{key:`${state.code}:${state.turnNumber}:${me?.summonDrawnRole}`});
 document.getElementById('dismissMandatoryPurge')?.addEventListener('click',()=>{forcedPurgeExplainerOpen=false;render();});
 window.URAMAKU_FEEDBACK.decorateActions(app,{room:state,you:me,lang:referenceLanguage});
 updateChallengeCountdown();
 positionActionAnnouncements();
 bindChatUI();
 localizeRoom();bindLanguageToggle();
 if(chatOpen&&$('.chat-messages'))$('.chat-messages').scrollTop=$('.chat-messages').scrollHeight;
 if($('#copy'))$('#copy').onclick=e=>copyRoomCode(e.currentTarget);
 if($('#exitRoom'))$('#exitRoom').onclick=exitCurrentRoom;
 if($('#revealFactions'))$('#revealFactions').onchange=e=>send('setRevealFactions',{enabled:e.target.checked});
 if($('#ready'))$('#ready').onclick=()=>send('ready',{ready:!state.players.find(p=>p.id===meId)?.ready});
 if($('#start'))$('#start').onclick=()=>send('startGame');
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>chooseAction(b.dataset.action));
 bindCardDecision('[data-lose]',card=>send('loseInfluence',{cardIndex:Number(card.dataset.lose)}));
 bindCardDecision('[data-summon-replace]',card=>{if(!document.getElementById('summonTray')?.hidden)send('summonChoice',{choice:'replace',cardIndex:Number(card.dataset.summonReplace)});});
 document.querySelectorAll('[data-summon-choice]').forEach(button=>button.onclick=()=>{if(!document.getElementById('summonTray')?.hidden)send('summonChoice',{choice:button.dataset.summonChoice});});
 if($('#rulesButton'))$('#rulesButton').onclick=showRules;
 if($('#lobbyRulesButton'))$('#lobbyRulesButton').onclick=showRules;

 if($('#guidedTutorialButton'))$('#guidedTutorialButton').onclick=()=>{window.location.href='/tutorial.html';};
 document.querySelectorAll('[data-target]').forEach(b=>b.onclick=()=>send('action',{action:window.targetAction,targetId:b.dataset.target}));
 document.querySelectorAll('[data-share-private-target]').forEach(button=>button.onclick=e=>{
   e.stopPropagation();
   const targetId=button.dataset.sharePrivateTarget,slot=Number(button.dataset.sharePrivateSlot);
   if(!me?.privateInvestigations?.[targetId]?.[slot])return;
   if(state.sharedInvestigations?.find(x=>x.playerId===targetId)?.indices?.includes(slot))return;
   send('sharePrivateIntel',{targetId,slot});
 });
 bindCardDecision('[data-intrigue-reveal]',card=>send('intrigueReveal',{cardIndex:Number(card.dataset.intrigueReveal)}));
 document.querySelectorAll('[data-challenge]').forEach(b=>b.onclick=()=>send('challenge'));
 document.querySelectorAll('[data-pass]').forEach(b=>b.onclick=()=>send('passChallenge'));
 document.querySelectorAll('[data-counter]').forEach(b=>b.onclick=()=>send('counter',{counter:b.dataset.counter}));
 document.querySelectorAll('[data-decline]').forEach(b=>b.onclick=()=>send('declineCounter'));
 window.URAMAKU_PRESENTATION?.presentDecision(app,document.querySelector('[data-response-controls]'),{key:state?.pending?.decisionId});
 window.URAMAKU_CARD_MOTION?.restore(app,movingCards);
 window.URAMAKU_INTEL?.sync(app,{code:state?.code,lang:referenceLanguage});reactionSession.sync();window.URAMAKU_RIOT_STATE?.sync(app,{room:state,lang:referenceLanguage});
 window.URAMAKU_PRESENTATION?.sync(app,{lang:referenceLanguage});
 // Turns advance only when the game engine completes the current action.
}

// The same room chat is available during setup and after the match begins.
// Incoming chat-only state updates refresh the message list without touching
// the compose input, preventing loss of focus, draft text, or cursor position.
// The chat remains a floating room window during both lobby and gameplay.
// Its position/size and composer draft survive incoming socket updates.
function captureChatBounds(){
 const el=document.querySelector('#chatWindow');
 if(!el || !el.getBoundingClientRect)return;
 const b=el.getBoundingClientRect();
 if(b.width>0&&b.height>0)chatBounds={left:b.left,top:b.top,width:b.width,height:b.height};
}
function placeChatWindow(){
 const el=document.getElementById('chatWindow'); if(!el)return;
 const vw=window.innerWidth,vh=window.innerHeight,pad=12;
 if(!chatBounds){
   const width=Math.min(470,Math.max(270,vw-pad*2));
   const height=Math.min(490,Math.max(240,vh-pad*2));
   chatBounds={left:Math.max(pad,vw-width-28),top:Math.max(pad,vh-height-28),width,height};
 }
 chatBounds.width=Math.min(chatBounds.width,Math.max(270,vw-pad*2));
 chatBounds.height=Math.min(chatBounds.height,Math.max(220,vh-pad*2));
 chatBounds.left=Math.max(pad,Math.min(chatBounds.left,vw-chatBounds.width-pad));
 chatBounds.top=Math.max(pad,Math.min(chatBounds.top,vh-chatBounds.height-pad));
 Object.assign(el.style,{left:`${chatBounds.left}px`,top:`${chatBounds.top}px`,width:`${chatBounds.width}px`,height:`${chatBounds.height}px`});
 chatSizeObserver?.disconnect();
 if(typeof ResizeObserver!=='undefined'){
   chatSizeObserver=new ResizeObserver(()=>{
     if(!el.isConnected)return;
     const bounds=el.getBoundingClientRect();
     if(bounds.width>0&&bounds.height>0){chatBounds={left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height};}
   });
   chatSizeObserver.observe(el);
 }
 const drag=el.querySelector('.chat-drag-handle');
 if(drag){
   let active=null;
   drag.addEventListener('pointerdown',e=>{
     if(e.button!==0||e.target.closest('button'))return;
     const b=el.getBoundingClientRect();
     active={pointer:e.pointerId,x:e.clientX,y:e.clientY,left:b.left,top:b.top};
     drag.setPointerCapture(e.pointerId);e.preventDefault();
   });
   drag.addEventListener('pointermove',e=>{
     if(!active||active.pointer!==e.pointerId)return;
     const b=el.getBoundingClientRect();
     chatBounds.left=Math.max(pad,Math.min(active.left+e.clientX-active.x,window.innerWidth-b.width-pad));
     chatBounds.top=Math.max(pad,Math.min(active.top+e.clientY-active.y,window.innerHeight-b.height-pad));
     el.style.left=`${chatBounds.left}px`;el.style.top=`${chatBounds.top}px`;
   });
   const finish=e=>{if(active?.pointer===e.pointerId){active=null;captureChatBounds();}};
   drag.addEventListener('pointerup',finish);drag.addEventListener('pointercancel',finish);
 }
}
function bindChatUI(){
 if(chatOpen)unreadChat=0;
 const button=$('#chatToggle');
 if(button){
   button.classList.toggle('chat-unread',unreadChat>0);
   button.textContent=chatOpen?'Close chat':unreadChat?`Open chat (${unreadChat} new)`:'Open chat';
   button.setAttribute('aria-expanded',chatOpen?'true':'false');
   button.onclick=()=>{if(chatOpen)captureChatBounds();chatOpen=!chatOpen;if(chatOpen)unreadChat=0;render();if(chatOpen)$('#chatInput')?.focus();};
 }
 if($('#chatSend'))$('#chatSend').onclick=sendChat;
 if($('#chatClose'))$('#chatClose').onclick=()=>{chatOpen=false;render();};
 const input=$('#chatInput');
 if(input){
   input.value=chatDraft;
   input.oninput=e=>{chatDraft=e.target.value;};
   input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}};
 }
 if(chatOpen){placeChatWindow();if($('.chat-messages'))$('.chat-messages').scrollTop=$('.chat-messages').scrollHeight;}
}
// Floating room chat
function renderChat(){const messages=state.chat||[];return `<div class="chat-backdrop" id="chatBackdrop"><section class="chat-modal" id="chatWindow" role="dialog" aria-label="Room chat window"><header class="chat-drag-handle" aria-label="Drag to move chat window" title="Drag to move"><strong>Room chat</strong><span class="chat-window-hint">Drag to move · resize from corner</span><button id="chatClose" class="small" type="button">Close</button></header><div class="chat-messages">${messages.map(m=>`<div class="chat-message"><b>${esc(m.name)}</b><span>${esc(m.message)}</span></div>`).join('')||'<p class="muted">No messages yet.</p>'}</div><div class="chat-compose"><input id="chatInput" maxlength="300" placeholder="Write a message…"><button id="chatSend" class="primary">Send</button></div></section></div>`;}
function sendChat(){
 const input=$('#chatInput');
 const message=chatDraft.trim();
 if(!message||!input)return;
 send('chatMessage',{message});
 chatDraft='';input.value='';
 // Preserve the actual input node and return focus even after clicking Send.
 // Incoming chat-only state updates refresh the messages without a rerender.
 input.focus();
}
// Shared card selection and pending decisions
function bindCardDecision(selector,onSelect){
 document.querySelectorAll(selector).forEach(card=>{
   card.onclick=()=>onSelect(card);
   card.onkeydown=event=>{
     if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(card);}
   };
 });
}
function hasRole(role){return (me?.influences||[]).includes(role);}
function renderPending(isTurn){const q=state.pending;if(!q)return'';if(q.kind==='summon'&&q.claimantId!==me?.id)return'';if((q.kind==='claim'||q.kind==='counterClaim')&&(!me?.alive||q.claimantId===me?.id||(q.passedBy||[]).includes(me?.id)))return'';if(q.kind==='information'&&!['choice','selectHidden'].includes(me?.informationChoice?.stage))return'';if(q.kind==='lose'&&q.loserId!==me?.id)return'';if(q.kind==='counterOffer'&&q.targetId!==me?.id)return'';if(q.kind==='information'&&q.targetId!==me?.id)return'';if(q.kind==='information'&&me?.informationChoice?.stage==='selectHidden')return'';const gated=['counterOffer','information'].includes(q.kind);let html='<div class="player-decision-overlay"'+(gated?' data-response-controls hidden inert':'')+'><section class="panel stack game-decision-panel" role="region" aria-label="Your response required">'+(['claim','counterClaim','counterOffer'].includes(q.kind)?'':'<div class="section-title">Your decision</div>');
 if(q.kind==='claim'||q.kind==='counterClaim'){
   const eligible=state.players.filter(p=>p.alive&&p.id!==q.claimantId).length;
   const passed=(q.passedBy||[]).length;
   const alreadyPassed=(q.passedBy||[]).includes(me?.id);
   html+=alreadyPassed
     ? `<p class="muted waiting-status">You passed. Waiting for other players… (${passed}/${eligible})</p>`
     : window.URAMAKU_PANELS.challenge({room:state,you:me,lang:referenceLanguage});
 }



 if(q.kind==='lose'){const loser=state.players.find(p=>p.id===q.loserId);const count=Math.max(1,q.lossCount||1);html+=`<p class="loss-instruction">${count===1?'Select an influence on your player card to lose.':'Both influences are lost automatically.'} <small>${esc(q.reason||'')}</small></p>`;}
 if(q.kind==='summon')html+=window.URAMAKU_PANELS.summon({room:state,you:me,lang:referenceLanguage});
 if(q.kind==='counterOffer')html+=window.URAMAKU_PANELS.counter({room:state,you:me,lang:referenceLanguage});
 if(q.kind==='information'&&me?.informationChoice?.stage==='choice')html+=window.URAMAKU_PANELS.information({you:me,lang:referenceLanguage});

 // A card choice happens on the real player board, with no modal or duplicate portraits.
 html+='</section></div>';return html;}
function canChooseAction(action){
 return state?.status==='playing'&&me?.alive&&!state.pending&&!state.challengeLosses?.length&&state.turnPlayerId===me.id&&(action!=='loot'||state.riot);
}
function actionLabel(action){return roleAction(action);}
function bindKickControls(){
 const toggle=document.getElementById('kickModeToggle');
 toggle?.addEventListener('click',()=>{if(kickPendingId||state.hostId!==me?.id)return;kickSelectionActive=!kickSelectionActive;targetSelectionAction=null;render();});
 const choose=(id,name)=>{
  const target=state.players.find(p=>p.id===id);
  if((state.status!=='lobby'&&!kickSelectionActive)||kickPendingId||!target||!kickEligible(target))return;
  const key=state.status==='lobby'?'kickLobbyConfirm':'kickMatchConfirm';
  if(!window.confirm(t(key,{name})))return;
  kickSelectionActive=false;kickPendingId=id;render();
  if(!send('kickPlayer',{targetId:id})){kickPendingId=null;render();}
 };
 document.querySelectorAll('[data-kick-id]').forEach(button=>{
  button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();});
  button.addEventListener('click',event=>{event.stopPropagation();choose(button.dataset.kickId,button.dataset.kickName);});
 });
 for(const card of document.querySelectorAll('.player.selectable-kick')){
  const p=state.players.find(p=>p.id===card.dataset.playerId);card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',t('kick')+' '+p.name);
  card.onclick=event=>{if(event.target.closest('button,.room-role-card'))return;choose(p.id,p.name);};
  card.onkeydown=event=>{if((event.key==='Enter'||event.key===' ')&&event.target===card){event.preventDefault();choose(p.id,p.name);}};
 }
}
function chooseAction(action){
 if(kickSelectionActive)kickSelectionActive=false;
 if(state.mandatoryPurge&&action!=='purge'){show('Mandatory Purge: you must Purge this turn.');return;}
 if(!canChooseAction(action))return;
 if(action==='tax'&&state.riot){show('Tax is unavailable while the treasury is empty.');return;}
 if(action==='loot'&&!state.players.some(p=>p.alive&&p.id!==me?.id&&p.coins>0)){show('Loot unavailable: no opponents have coins.');return;}
 if(action==='intrigue' && !(me?.intrigueEligibleTargets||[]).length){show('Intrigue unavailable: no opponents have influences left for you to discover.');return;}
 if(action==='extort' && !state.players.some(p=>p.alive&&p.id!==me?.id&&p.coins>0)){show('Extort unavailable: no opponents have coins.');return;}
 if(['intrigue','extort','assassinate','hireBlade','purge','overthrow','loot'].includes(action)){
   targetSelectionAction=action;render();
   document.querySelector('.game-players-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'});
   return;
 }
 targetSelectionAction=null;send('action',{action});
}
// Translate public game-log sentences, never private influence data, into
// short notifications. Keep the existing log as the canonical match history.
// Action announcements and game-log presentation
function announcementForLog(entry){
 let m;
 if((m=entry.match(/^(.+?) loots 1 coin from (.+?) during Chaos\.$/)))return `${m[1]} loots 1 coin from ${m[2]}`;
 // Order/Chaos changes use the small shared state cue, not a board overlay.
 if((m=entry.match(/^(.+?) wins by accumulating (\d+) coins!$/)))return `${m[1]} wins by wealth with ${m[2]} coins!`;
 if((m=entry.match(/^(.+?) takes Earn \(/)))return `${m[1]} earns ${entry.includes('gains 0 coins')?'0 coins':'1 coin'}`;
 if((m=entry.match(/^(.+?) uses (Purge|Overthrow) against (.+?)(?: during Chaos \(5 coins\))?\.$/)))return `${m[1]} uses ${m[2]} against ${m[3]}`;
 if((m=entry.match(new RegExp('^(.+?) claims (.+?) and declares ('+['tax','intrigue','extort','assassinate','hireBlade','summon'].map(id=>i18n.action(id,'en').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')(?: against (.+?))?\\.$'))))
   return m[4]?`${m[1]} claims ${m[2]} (${m[3]}) and targets ${m[4]}.`:`${m[1]} uses ${m[3]}`;
 if((m=entry.match(/^(.+?) claims (.+?) \((Authority|Gossip|Hire Guard|False Trail|Intimidate|Enforce)\)\.$/)))return `${m[1]} claims ${m[2]} (${m[3]})`;
 if((m=entry.match(/^(.+?) successfully challenges (.+?)\./)))return `${m[1]}'s challenge succeeds! ${m[2]} must lose an Influence`;
 if((m=entry.match(/^(.+?)'s challenge fails\./)))return `${m[1]}'s challenge fails`;
 if((m=entry.match(/^(.+?) uses Gossip with (.+?)\. Both players privately exchange/)))return `${m[1]} and ${m[2]} exchange influences privately`;
 if((m=entry.match(/^(.+?) uses Intimidate to block (.+?)’s Extort\./)))return `${m[1]}'s Intimidate succeeds.`;
 if((m=entry.match(/^(.+?) uses (Authority|False Trail|Hire Guard|Intimidate|Enforce) (?:to block|against) (.+?)’s (Intrigue|Assassinate|Extort)\./)))
   return `${m[1]} resolves ${m[2]} against ${m[3]}`;
 if((m=entry.match(/^(.+?) collects (\d+) coins? through Tax\./)))return `${m[1]} gains ${m[2]} coins from Tax`;
 if((m=entry.match(/^(.+?) takes (\d+) coins? from (.+?) through Extort\./)))return `${m[1]} takes ${m[2]} coins from ${m[3]}`;
 if((m=entry.match(/^(.+?) investigates (.+?)\./)))return `${m[1]} investigates ${m[2]}`;
 if((m=entry.match(/^(.+?) pays (\d+) coins? to (.+?) (?:to keep|and chooses)/)))return `${m[1]} pays ${m[2]} coin${Number(m[2])===1?'':'s'} to conceal information`;
 if((m=entry.match(/^(.+?) declines to pay\./)))return `${m[1]} reveals all unknown influences`;
 if((m=entry.match(/^(.+?) has no coins; Intrigue reveals/)))return `${m[1]} cannot conceal their influences`;
 if((m=entry.match(/^(.+?) shares Intrigue information about (.+?):/)))return `${m[1]} reveals Intrigue results about ${m[2]}`;
 if((m=entry.match(/^(.+?) keeps Intrigue information about (.+?) private\./)))return `${m[1]} keeps Intrigue results private`;
 if((m=entry.match(/^(.+?) loses (?:an influence|both influences) \(([^)]+)\)/)))return `${m[1]} loses ${m[2]}`;
 if((m=entry.match(/^(.+?) loses (an influence|both influences)/)))return `${m[1]} loses ${m[2]}`;
 if((m=entry.match(/^(.+?) has been eliminated\./)))return `${m[1]} is eliminated`;
 if((m=entry.match(/^(.+?) wins the game\./)))return `${m[1]} wins the game!`;
 return null;
}
function showActionAnnouncement(message,{state=null}={}){
 // New messages appear immediately. Ordinary notices last at least 2.5 seconds;
 // their fade-outs are spaced one second apart. State notices use a fixed lifetime.
 let stack=document.getElementById('actionAnnouncements');
 if(!stack){stack=document.createElement('div');stack.id='actionAnnouncements';stack.className='action-announcements';stack.setAttribute('aria-live','polite');stack.setAttribute('aria-relevant','additions');document.body.appendChild(stack);}
 if(state)for(const previous of stack.querySelectorAll('.state-transition-notice'))previous.remove();
 const toast=document.createElement('div');toast.className='action-announcement announce-active'+(state?' state-transition-notice state-'+state:'');if(toast.dataset)toast.dataset.originalMessage=message;toast.textContent=typeof tl==='function'?tl(message):message;
 stack.appendChild(toast);
 positionActionAnnouncements();
 const now=performance.now();
 const fadeStart=state?now+ACTION_ANNOUNCEMENT_DURATION-ACTION_FADE_OUT_MS:Math.max(now+ACTION_ANNOUNCEMENT_DURATION-ACTION_FADE_OUT_MS,previousAnnouncementRemovalAt+ANNOUNCEMENT_GAP_MS);
 const removal=fadeStart+ACTION_FADE_OUT_MS;if(!state)previousAnnouncementRemovalAt=removal;
 setTimeout(()=>toast.classList.add('announce-exit'),Math.max(0,fadeStart-now));
 setTimeout(()=>{toast.remove();if(stack.isConnected&&!stack.childElementCount)stack.remove();},Math.max(0,removal-now));
}


function positionActionAnnouncements(){
 const stack=document.getElementById('actionAnnouncements');
 if(!stack)return;
 const board=typeof document.querySelector==='function'?document.querySelector('.game-layout .game-players-panel'):null;
 if(!board){if(stack.style){stack.style.left='50%';stack.style.top='50%';}return;}
 const bounds=board.getBoundingClientRect();
 // Stay visible on small screens and during page scroll while visually
 // following the center of the player board, not the browser window.
 const width=Math.min(stack.offsetWidth||560,window.innerWidth-20);
 const halfWidth=width/2;
 const x=Math.max(halfWidth+10,Math.min(window.innerWidth-halfWidth-10,bounds.left+bounds.width/2));
 const y=Math.max(48,Math.min(window.innerHeight-48,bounds.top+bounds.height/2));
 stack.style.left=`${x}px`;
 stack.style.top=`${y}px`;
}
function showVictory(winner,byWealth=false,goal=null){
 const old=document.getElementById('victoryDialog');if(old)old.remove();
 const backdrop=document.createElement('div');backdrop.id='victoryDialog';backdrop.className='victory-backdrop';
 backdrop.innerHTML=`<section class="panel victory-panel" role="dialog" aria-modal="true" aria-label="Match complete"><div class="section-title">Match complete</div><h2>${esc(winner)} ${byWealth?`wins by wealth${goal?` (${goal} coins)`:``}!`:`wins the game!`}</h2><div class="victory-actions"><button class="primary" id="victoryLeaveRoom">Leave room</button><button id="dismissVictory">Close</button></div></section>`;
 document.body.appendChild(backdrop);backdrop.querySelector('#dismissVictory').onclick=()=>backdrop.remove();backdrop.querySelector('#victoryLeaveRoom').onclick=()=>{backdrop.remove();exitCurrentRoom();};localizeRoom(backdrop);
}
function show(s){kickPendingId=null;notice=s;clearTimeout(noticeTimer);render();noticeTimer=setTimeout(()=>{if(notice===s){notice='';render();}},5000);}
window.addEventListener('resize',positionActionAnnouncements);
window.addEventListener('scroll',positionActionAnnouncements,{passive:true});
render();

// How to Play and the action reference share one accessible modal.
let referenceTab='rules';

// Localized Actions and How to Play reference
function showRules(){
 const old=document.getElementById('rulesReferenceOverlay');
 if(old){old.remove();return;}
 const overlay=document.createElement('div');
 overlay.id='rulesReferenceOverlay';overlay.className='rules-reference-overlay';
 overlay.innerHTML=`<section class="rules-reference-modal panel" role="dialog" aria-modal="true" aria-label="Game guide"><header class="rules-reference-header"><h2 id="referenceTitle">Game guide</h2><div class="reference-header-controls"><div class="reference-language" role="group" aria-label="Reference language"><button type="button" data-lang="en">EN</button><button type="button" data-lang="jp">JP</button></div><button id="closeRules" type="button" aria-label="Close reference">✕</button></div></header><nav class="reference-tabs" aria-label="Guide sections"><button type="button" data-tab="rules">Actions</button><button type="button" data-tab="howto">How to Play</button><button type="button" data-tab="treasury">Riot Mode</button></nav><div class="rules-reference-body"></div></section>`;
 document.body.appendChild(overlay);
 const body=overlay.querySelector('.rules-reference-body');
 const renderReference=()=>{
   const jp=referenceLanguage==='jp';
   overlay.querySelector('#referenceTitle').textContent=t('gameGuide');
   overlay.querySelector('[data-tab="rules"]').textContent=t('actions');
   overlay.querySelector('[data-tab="howto"]').textContent=t('howTo');
   overlay.querySelector('[data-tab="treasury"]').textContent=t('treasuryGuide');
   if(referenceTab==='treasury'){
     body.innerHTML=i18n.get('treasuryModeHtml',referenceLanguage);
   }else if(referenceTab==='howto'){
     body.innerHTML=i18n.get('howToHtml',referenceLanguage);
   }else{
     const rows=['lord','courtesan','swordsman','assassin','magistrate','kingpin'].map(key=>[key,state.roles[key]]).filter(([,r])=>r).map(([key,r])=>`<tr><td><div class="reference-role"><img class="portrait-${esc(key)}" src="/assets/portraits/${esc(key)}.jpg" alt=""><div><strong>${esc(jp?r.jp:r.name)}</strong></div></div></td><td>${esc(jp?(r.faction.startsWith('秩序')?'秩序':'裏社会'):(r.faction.includes('Order')?'Order':'Underworld'))}</td><td>${esc((jp?r.actionJp:r.action)||'—')}</td><td>${esc((jp?r.effectJp:r.effect)||'—')}</td><td>${esc((jp?r.counterJp:r.counter)||'—')}</td><td>${i18n.roleEffect(key,'counter',referenceLanguage,{boldRoles:true})}</td></tr>`).join('');
     body.innerHTML=`<div class="table-wrap"><table class="rules-table"><thead><tr>${['role','faction','action','effect','counter','effect'].map(key=>`<th>${t(key)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div><h3>${t('basic')}</h3><div class="basic-rules"><div><b>${t('incomeBase')}</b><span>${t('incomeRule')}</span></div><div><b>${roleAction('earn')}</b><span>${t('earnRule')}</span></div><div><b>${roleAction('purge')}</b><span>${t('purgeRule')}</span></div></div><div class="basic-action-notes"><p class="howto-note">${t('basicNoChallenge')}</p><p class="howto-note">${t('basicNote')}</p></div>`;
   }
   localizeRoom(overlay);
   overlay.querySelectorAll('[data-lang]').forEach(b=>{const active=b.dataset.lang===referenceLanguage;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
   overlay.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===referenceTab;b.classList.toggle('selected',active);b.setAttribute('aria-current',active?'page':'false');});
 };
 renderReference();
 const close=()=>{overlay.remove();document.removeEventListener('keydown',onKey);};
 const onKey=e=>{if(e.key==='Escape')close();};
 document.addEventListener('keydown',onKey);
 overlay.querySelector('#closeRules').onclick=close;
 overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
 overlay.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{referenceLanguage=b.dataset.lang;i18n.setLanguage(referenceLanguage);render();renderReference();});
 overlay.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{referenceTab=b.dataset.tab;renderReference();});
 overlay.querySelector('#closeRules').focus();
}

// On returning from the full-page tutorial, do not restore transient fixed overlays
// from a browser's back/forward cache or retain the tutorial scroll offset.
window.addEventListener?.('pageshow',()=>{
 window.URAMAKU_ROOM_BROWSER_SESSION?.close();
  document.querySelectorAll('.role-quick-tooltip,.action-announcements,.rules-reference-overlay,.room-entry-backdrop').forEach(el=>{
    if(el.classList.contains('role-quick-tooltip')){el.hidden=true;return;}
    el.remove();
  });
  if(window.location?.search?.includes('fromTutorial=1')){
    window.scrollTo?.(0,0);
    window.history?.replaceState?.(window.history.state,'',window.location.pathname);
  }
});
