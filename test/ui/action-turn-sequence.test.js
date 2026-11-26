'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),g=require('../../server/game'),feedback=require('../../public/js/components/game-feedback'),cards=require('../../public/js/components/role-cards'),panels=require('../../public/js/components/game-panels'),{harness}=require('../tutorial/browser-harness');
const copy=value=>JSON.parse(JSON.stringify(value)),ok=result=>assert.equal(result.ok,true,result.error);
function fixture(mode=false){const p=(id,hand,coins)=>({id,name:id,alive:true,ready:true,connected:true,coins,influences:hand,privateInvestigations:{},intrigueVisibility:[0,0]});const r=g.createGame('FLOW',p('a',['kingpin','magistrate'],4));Object.assign(r,{status:'playing',players:[p('a',['kingpin','magistrate'],4),p('b',['magistrate','courtesan'],5)],deck:['assassin','lord','swordsman'],challengeTimerEnabled:false,turnNumber:1,treasuryMode:mode,totalCoins:mode?12:null,treasuryCoins:mode?3:null,economyWinThreshold:mode?10:null});return r;}
const view=r=>({room:copy(g.publicState(r)),you:copy(g.privateState(r,'a'))});
const tick=async()=>{for(let n=0;n<4;n++)await Promise.resolve();};
function setup(lang='en'){
 const h=harness(lang),animations=[],timers=[],frames=[];h.window.matchMedia=()=>({matches:false});
 const prototype=Object.getPrototypeOf(h.app);prototype.animate=function(keyframes,options){const a={element:this,keyframes,options,done:false};animations.push(a);return {cancel(){if(!a.done){a.done=true;a.cancel?.();}},finished:{then(finish,cancel){a.complete=()=>{if(!a.done){a.done=true;finish();}};a.cancel=cancel;}}};};
 h.context.setTimeout=(fn,ms)=>{const t={fn,ms};timers.push(t);return t;};h.context.clearTimeout=t=>{if(t)t.canceled=true;};
 function paint(room,you){
  frames.push(copy({room,you}));h.app.innerHTML='<div class="game-shell game-layout"><section class="action-flow"><div class="player-decision-overlay"><button data-pass>Pass</button></div></section><div class="game-actions-panel"><div class="actions"><button data-action="earn">Earn</button></div></div><div class="game-players-panel">'+room.players.map(p=>'<div class="player '+(p.id===room.turnPlayerId?'active-player':'')+'" data-player-id="'+p.id+'"><div class="player-coins">Coins: '+p.coins+'</div><div class="player-roles">'+Array.from({length:p.influenceCount},(_,slot)=>{const known=feedback.visibleRoles(room,you,p.id)[slot];return known?cards.revealed({role:known,name:known,slot}):cards.hidden({slot});}).join('')+room.revealedCards.filter(c=>c.playerId===p.id).map((c,revealIndex)=>cards.revealed({role:c.role,name:c.role,revealIndex,classes:['eliminated-role-card']})).join('')+'</div></div>').join('')+'</div>'+panels.deck({room,you,lang})+'</div>';
  const flow=h.window.URAMAKU_PRESENTATION;flow.sync(h.app,{code:room.code,lang});flow.presentSummon(h.app,h.app.querySelector('#summonTray'),{key:room.code+':'+you.summonDrawnRole});
 }
 function start(before,after,onComplete=()=>{}){h.window.URAMAKU_PRESENTATION.enqueue(h.app,{code:after.room.code,run:(complete,current)=>h.window.URAMAKU_FEEDBACK.present({container:h.app,before:before?.room,after:after.room,oldYou:before?.you,you:after.you,lang,render:paint,current,complete:()=>{onComplete();complete();}})});}
 function finishCurrent(){for(const a of animations.filter(a=>!a.done))a.complete();}
 async function drain(){for(let n=0;n<35;n++){finishCurrent();for(const t of timers.filter(t=>!t.done&&!t.canceled)){t.done=true;t.fn();}await tick();if(!h.window.URAMAKU_PRESENTATION.busy(h.app)&&!animations.some(a=>!a.done))return;}throw Error('Presentation did not settle');}
 return {...h,animations,timers,frames,paint,start,finishCurrent,drain};
}
async function main(){
 for(const lang of ['en','jp'])for(const mode of [false,true]){
  const r=fixture(mode);ok(g.performAction(r,'a','extort','b'));const before=view(r);ok(g.declineCounter(r,'b'));const after=view(r),saved=JSON.stringify(after),h=setup(lang);let completed=0;h.start(before,after,()=>completed++);
  assert.equal(h.frames.length,1);assert.equal(h.frames[0].room.players[1].coins,3,'Extort takes 2 before the target receives Income');assert.equal(h.frames[0].room.turnPlayerId,'a');assert(h.app.classList.contains('presentation-busy'));assert(h.app.querySelector('.actions').hasAttribute('inert'));assert(h.animations.some(a=>a.element.classList.contains('coin-loss')&&a.element.textContent==='-2'));assert(!h.animations.some(a=>a.element.classList.contains('coin-gain')&&a.element.textContent==='+1'));
  if(mode)assert.equal(h.frames[0].room.treasuryCoins,3);
  h.finishCurrent();await tick();assert.equal(h.frames.length,2);assert.equal(h.frames[1].room.presentationPhase,'turn');assert.equal(h.frames[1].room.players[1].coins,3);assert.equal(h.app.querySelector('.active-player').dataset.playerId,'b');assert.equal(h.animations.filter(a=>!a.done&&a.element.classList.contains('turn-handoff-ring')).length,2);assert.equal(completed,0);
  h.finishCurrent();await tick();assert.equal(h.frames.length,3);assert.equal(h.frames[2].room.presentationPhase,'income');assert.equal(h.frames[2].room.players[1].coins,4);assert(h.animations.some(a=>!a.done&&a.element.classList.contains('coin-gain')&&a.element.textContent==='+1'));assert.equal(completed,1,'Income floats do not hold the turn controls');assert(!h.app.querySelector('.actions').hasAttribute('inert'));
  h.finishCurrent();await tick();assert.equal(completed,1);assert(!h.app.classList.contains('presentation-busy'));assert(!h.app.querySelector('.actions').hasAttribute('inert'));assert.equal(JSON.stringify(after),saved,'Presentation never changes the server snapshot');
 }
 // Tax, Enforce and card replacement use the same action-before-Income split.
 for(const action of ['tax','enforce','summon']){
  const r=fixture(),h=setup();let before;
  if(action==='tax'){ok(g.performAction(r,'a','tax'));before=view(r);ok(g.passChallenge(r,'b'));}
  if(action==='enforce'){ok(g.performAction(r,'a','extort','b'));ok(g.chooseCounter(r,'b','magistrate'));before=view(r);ok(g.passChallenge(r,'a'));}
  if(action==='summon'){ok(g.performAction(r,'a','summon'));ok(g.passChallenge(r,'b'));before=view(r);ok(g.chooseSummon(r,'a','replace',1));}
  h.start(before,view(r));assert.equal(h.frames[0].room.turnPlayerId,'a');assert.equal(h.frames[0].room.players[1].coins,action==='enforce'?7:5);await h.drain();assert.equal(h.frames.at(-1).room.players[1].coins,action==='enforce'?8:6);
 }
 // All attack effects, revealed losses and coin costs finish before handoff.
 for(const action of ['purge','overthrow','hireBlade','assassinate','hireGuard','falseTrail']){
  const r=fixture(),h=setup();r.players[0].coins=7;r.players[0].influences=['assassin','swordsman'];r.players[1].influences=['swordsman','assassin'];r.players[1].coins=6;
  if(action==='overthrow')Object.assign(r,{treasuryMode:true,totalCoins:13,treasuryCoins:0,economyWinThreshold:14});
  const before=view(r);
  if(['hireGuard','falseTrail'].includes(action)){ok(g.performAction(r,'a','assassinate','b'));ok(g.chooseCounter(r,'b',action==='hireGuard'?'swordsman':'assassin'));ok(g.passChallenge(r,'a'));if(g.lossDecision(r,'a'))ok(g.loseInfluence(r,'a',0));}
  else{ok(g.performAction(r,'a',action,'b'));if(r.pending?.kind==='claim'){ok(g.passChallenge(r,'b'));if(r.pending?.kind==='counterOffer')ok(g.declineCounter(r,'b'));}if(g.lossDecision(r,'b'))ok(g.loseInfluence(r,'b',0));}
  h.start(before,view(r));assert.equal(h.frames[0].room.presentationPhase,'action');assert(!h.animations.some(a=>a.element.classList.contains('turn-handoff-ring')));await h.drain();assert(h.frames.some(f=>f.room.presentationPhase==='turn'));assert.equal(h.frames.at(-1).room.turnPlayerId,'b');
 }
 // A fresh private Summon cannot release the sequence before its in-place flip.
 {
  const r=fixture(),h=setup();ok(g.performAction(r,'a','summon'));const before=view(r);ok(g.passChallenge(r,'b'));let finished=0;h.start(before,view(r),()=>finished++);await tick();assert.equal(finished,0);assert(h.animations.some(a=>a.element.closest('#summonTray')));await h.drain();assert.equal(finished,1);
 }
 // New work registered by an idle callback is awaited by later callbacks.
 {
  const h=setup(),flow=h.window.URAMAKU_PRESENTATION;flow.sync(h.app,{code:'jobs'});const first=flow.hold(h.app);let second,done=0;flow.whenIdle(h.app,()=>second=flow.hold(h.app));flow.whenIdle(h.app,()=>done++);first();assert.equal(done,0);second();assert.equal(done,1);
 }
 // Rapid snapshots remain ordered; leaving cancels queued work and floating coins.
 {
  const r=fixture(),h=setup();ok(g.performAction(r,'a','extort','b'));const before=view(r);ok(g.declineCounter(r,'b'));let second=0,stale=0;h.start(before,view(r),()=>stale++);h.window.URAMAKU_PRESENTATION.enqueue(h.app,{code:r.code,run:done=>{second++;done();}});assert.equal(second,0);await h.drain();assert.equal(second,1);assert.equal(stale,1);
  h.start(before,view(r),()=>stale++);h.window.URAMAKU_PRESENTATION.enqueue(h.app,{code:r.code,run:done=>{second++;done();}});h.window.URAMAKU_PRESENTATION.sync(h.app,{code:null});assert.equal(h.document.body.querySelectorAll('.feedback-token').length,0);await h.drain();assert.equal(second,1);assert.equal(stale,1);assert(!h.app.classList.contains('presentation-busy'));
 }
 // Exercise the actual live state handler and command guard with queued packets.
 for(const wealth of [false,true]){
  const r=fixture(wealth),h=setup(),handlers={},sent=[],wins=[];
  if(wealth){r.players[0].coins=1;r.players[1].coins=9;r.treasuryCoins=2;}
  if(!wealth)ok(g.performAction(r,'a','extort','b'));
  const before=view(r);if(wealth)ok(g.performAction(r,'a','earn'));else ok(g.declineCounter(r,'b'));const after=view(r);
  h.window.URAMAKU_COMMAND_SESSION={resume(){},send:(event,data)=>{sent.push({event,data});return true;}};
  const scope={window:h.window,document:h.document,app:h.app,socket:{on:(event,handler)=>handlers[event]=handler},state:before.room,me:before.you,roomCode:r.code,pendingReplacementChoice:null,referenceLanguage:'en',announcedWinnerRoom:null,serverClockOffset:0,UramakuAudio:h.window.UramakuAudio,syncMandatoryPurgeTargeting(){},render(){h.paint(scope.state,scope.me);},showVictory:(...args)=>wins.push(args),announcementForLog:()=>null,showActionAnnouncement(){},esc:String,t:(key,params)=>h.window.URAMAKU_I18N.get(key,'en',params)};
  const source=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8');vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('function send(event,data={})'),source.indexOf('// Live room snapshots')),scope);vm.runInContext(source.slice(source.indexOf("socket.on('state',d=>{"),source.indexOf("socket.on('notice'")),scope);
  handlers.state(after);assert.equal(scope.state.presentationPhase,'action');assert.equal(scope.send('action',{action:'earn'}),false);assert.equal(sent.length,0);assert.equal(scope.send('reaction',{reaction:'thinking'}),true,'Reactions stay usable during animation');assert.equal(wins.length,0);
  const updated={room:{...after.room,revision:99,players:after.room.players.map(p=>({...p,connected:false}))},you:after.you};handlers.state(updated);assert.equal(scope.state.presentationPhase,'action','A later snapshot cannot replace the visible action stage');
  await h.drain();assert.equal(scope.state,updated.room);assert.equal(wins.length,wealth?1:0);assert(!h.window.URAMAKU_PRESENTATION.busy(h.app));assert.equal(scope.send('action',{action:'earn'}),true);
 }
 // Animations unavailable: cleanup and input release still complete once.
 {
  const r=fixture(),h=setup();ok(g.performAction(r,'a','extort','b'));const before=view(r);ok(g.declineCounter(r,'b'));Object.getPrototypeOf(h.app).animate=function(){throw Error('Animation API unavailable');};let done=0;h.start(before,view(r),()=>done++);await h.drain();assert.equal(done,1);assert.equal(h.document.body.querySelectorAll('.feedback-token').length,0);
 }
 // Reduced motion skips staging/holds, and initial snapshots replay no history.
 {
  const r=fixture(),h=setup();ok(g.performAction(r,'a','extort','b'));const before=view(r);ok(g.declineCounter(r,'b'));h.window.matchMedia=()=>({matches:true});let done=0;h.start(before,view(r),()=>done++);assert.equal(done,1);assert.equal(h.frames.length,1);assert.equal(h.animations.length,0);h.start(null,view(r));assert.equal(h.sounds.length,0);
 }
 console.log('Action → animated turn border → Income: exact Extort -2/+1, Tax/Enforce/Summon, all six attack/block paths, private draw completion, queued updates, input locks, room cancellation and reduced motion passed in EN/JP.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
