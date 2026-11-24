'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const game=require('../../server/game');
const feedback=require('../../public/js/components/game-feedback');
const i18n=require('../../shared/i18n');
const player=(id,roles)=>({id,name:id.toUpperCase(),coins:5,alive:true,influences:roles});
function fixture(){const room=game.createGame('TEST',player('a',['magistrate','assassin']));room.players.push(player('b',['swordsman','lord']),player('c',['courtesan','kingpin']));Object.assign(room,{status:'playing',deck:['kingpin','lord','magistrate']});return room;}
const view=(room,id='b')=>[game.publicState(room),game.privateState(room,id)];
function effects(before,after,choice=null){return feedback.changes(before?.[0],after[0],before?.[1],after[1],choice);}
{
 const room=fixture();const before=view(room);game.performAction(room,'a','tax');const after=view(room);
 assert.deepEqual(effects(before,after).sounds,['response']);
 assert.match(feedback.challengeCopy(...after).summary,/A claims Lord and uses Tax/);
 assert.deepEqual(effects(after,after).sounds,[],'Repeated snapshots cannot repeat a decision cue');
 game.passChallenge(room,'b');assert.deepEqual(effects(after,view(room)).sounds,[]);
 const passed=view(room);game.passChallenge(room,'c');const end=view(room);
 assert(effects(passed,end).sounds.includes('turn'),'Income and appended logs must not suppress your turn cue');
 assert(effects(passed,end).coins.some(p=>p.id==='b'&&p.delta===1));
 assert.deepEqual(effects(null,end).sounds,[],'Initial join must not replay the room history');
 assert.deepEqual(feedback.changes(after[0],{...end[0],code:'OTHER'},after[1],end[1]).sounds,[]);
}
{
 const room=fixture();game.performAction(room,'a','assassinate','b');game.passChallenge(room,'b');game.passChallenge(room,'c');
 assert.equal(room.pending.kind,'counterOffer');
 const before=view(room,'a');game.chooseCounter(room,'b','swordsman');const after=view(room,'a');
 const copy=feedback.challengeCopy(...after);
 assert.match(copy.summary,/B claims Swordsman and uses Hire Guard against A’s Assassinate/,'Counter summary must identify the counter claimant');
 assert.equal(copy.risk,'','Challenge prompt does not repeat tutorial coaching');
 assert.deepEqual(effects(before,after).targets,['a']);
 assert.equal(feedback.challengeCopy(...view(room,'c')).risk,'');
 assert.match(feedback.challengeCopy(after[0],after[1],'jp').summary,/護衛を雇う/);
}
{
 const room=fixture();const [state,you]=view(room,'a');
 for(const [action,cost] of Object.entries(feedback.costs))assert.equal(feedback.unavailableReason(state,{...you,coins:cost-1},action),`Requires ${cost} coins.`);
 assert.equal(feedback.unavailableReason(state,you,'summon'),'');
 assert.match(feedback.unavailableReason({...state,turnPlayerId:'b'},you,'earn'),/your turn/);
 assert.match(feedback.unavailableReason({...state,mandatoryPurge:true},you,'tax'),/must use Purge/);
 assert.match(feedback.unavailableReason({...state,riot:true},you,'tax'),/treasury is empty/);
 const riot={...state,riot:true,pending:{kind:'summon'}};
 assert.match(feedback.unavailableReason(riot,you,'loot'),/Summon/);
 assert.match(feedback.unavailableReason(riot,you,'loot','jp'),/召喚/);
 assert.equal(feedback.unavailableReason({...riot,pending:{kind:'claim'},turnPlayerId:'b'},you,'loot'),'','Off-turn Riot Loot retains its approved availability');
 assert.match(feedback.unavailableReason(state,{...you,intrigueEligibleTargets:[]},'intrigue'),/unknown influences/);
}
{
 const room=fixture();game.performAction(room,'a','summon');const before=view(room,'a');
 game.passChallenge(room,'b');game.passChallenge(room,'c');const preview=view(room,'a');
 assert.deepEqual(effects(before,preview).sounds,['draw']);
 assert.equal(game.publicState(room).pending.drawnRole,undefined);
 const observer=effects(view(room,'b'),view(room,'b'));assert.deepEqual(observer.cards,[]);
 game.chooseSummon(room,'a','keep');const keep=view(room,'a');game.chooseSummon(room,'a','replace',0);
 const replaced=effects(keep,view(room,'a'),{code:room.code,playerId:'a',turnNumber:keep[0].turnNumber,slot:0});assert(replaced.sounds.includes('replace'));assert.deepEqual(replaced.cards,[{id:'a',type:'replace',slot:0}]);
}
{
 const before={code:'T',status:'playing',players:[{id:'a',name:'A',coins:2},{id:'b',name:'B',coins:5}],log:['old']};
 const after={...before,players:[{id:'a',name:'A',coins:4},{id:'b',name:'B',coins:3}],log:['old','A takes 2 coins from B through Extort.']};
 assert.deepEqual(feedback.changes(before,after,null,null).transfers,[{from:'b',to:'a',amount:2}]);
 const ambiguous={...after,players:[...after.players,{id:'c',name:'B',coins:1}]};assert.deepEqual(feedback.changes(before,ambiguous,null,null).transfers,[],'Duplicate nicknames must not animate the wrong source');
 assert.deepEqual(feedback.newLogEntries({log:['a','b','c']},{log:['b','c','d']}),['d']);
 const won={...after,status:'finished',winner:'A',players:[{id:'a',name:'A',alive:true,coins:4},{id:'b',name:'B',alive:false,coins:0}]};
 assert.deepEqual(feedback.changes(after,won,null,{id:'a'}).sounds,['victory']);
 assert.deepEqual(feedback.changes(after,won,null,{id:'b'}).sounds,['defeat']);
 assert.deepEqual(feedback.changes(after,won,null,null).sounds,[]);
}
// Countdown warns each eligible player once, excludes passed players, and disables expired choices.
{
 const source=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8');
 const method=source.slice(source.indexOf('function updateChallengeCountdown(){'),source.indexOf('// Current Turn status'));
 let now=1000;const sounds=[],label={},bar={style:{}},buttons=[{disabled:false},{disabled:false}];
 const context={window:{URAMAKU_FEEDBACK:feedback},state:{code:'T',status:'playing',players:[],pending:{kind:'claim',stage:'challenge',claimantId:'a',challengeDeadline:2500}},me:{id:'b',alive:true},Date:{now:()=>now},serverClockOffset:0,challengeCountdownTimer:null,warnedChallengeKey:null,clearTimeout(){},setTimeout(){},UramakuAudio:{play:kind=>sounds.push(kind)},t:(key,params)=>i18n.get(key,'en',params),document:{querySelector:sel=>sel.includes('progress')?bar:sel.includes('clock')?{classList:{toggle(){}}}:label,querySelectorAll:()=>buttons}};
 vm.createContext(context);vm.runInContext(method,context);context.updateChallengeCountdown();context.updateChallengeCountdown();assert.deepEqual(sounds,['deadline']);
 context.state.pending.passedBy=['b'];context.warnedChallengeKey=null;context.updateChallengeCountdown();assert.equal(sounds.length,1);
 now=2600;context.updateChallengeCountdown();assert(buttons.every(b=>b.disabled));assert.equal(bar.style.width,'0%');assert.match(label.textContent,/closed/);
}
console.log('Explicit counter claims, risk copy, availability, transition cues, private card effects, log rollover and deadline warning regressions passed.');

// Real shared decorator with a small DOM adapter: disabled controls retain a
// keyboard-focusable explanation, costs are visible, tutorial controls stay passive.
{
 const original=global.document;
 const created=[];
 const node=()=>({dataset:{},style:{},children:[],attributes:{},appendChild(child){this.children.push(child);child.parentNode=this},setAttribute(k,v){this.attributes[k]=v}});
 global.document={createElement(){const el=node();created.push(el);return el;}};
 try{
  const title=node(),parent=node();parent.insertBefore=function(el){this.children.push(el)};
  const button={...node(),dataset:{action:'hireBlade',tooltip:'Swordsman\nAction — Hire Blade: Pay 5 coins; Target loses an influence.'},parentNode:parent,querySelector:()=>title};
  const container={querySelectorAll:()=>[button]},room={status:'playing',turnPlayerId:'a',players:[]},you={id:'a',alive:true,coins:2};
  feedback.decorateActions(container,{room,you,lang:'en'});
  assert.equal(button.disabled,true);assert.equal(button.parentNode.tabIndex,0);assert.match(button.parentNode.dataset.unavailableReason,/Requires 5 coins/);assert.equal(title.children[0].textContent,'5 coins');
  const offTurnButton={...node(),dataset:{action:'earn',tooltip:'Earn · General action\nTake 1 coin from the treasury. Cannot be challenged.'},parentNode:parent,querySelector:()=>node()};
  feedback.decorateActions({querySelectorAll:()=>[offTurnButton]},{room:{...room,turnPlayerId:'b'},you,lang:'en'});
  assert.equal(offTurnButton.disabled,true,'Hiding turn-only copy cannot enable off-turn actions');
  assert.equal(offTurnButton.parentNode.dataset.unavailableReason,undefined,'Ordinary off-turn actions retain only the ability tooltip');
  assert.equal(offTurnButton.parentNode.title,undefined);
  const poorOffTurn={...node(),dataset:{action:'hireBlade',tooltip:'Swordsman'},parentNode:parent,querySelector:()=>node()};
  feedback.decorateActions({querySelectorAll:()=>[poorOffTurn]},{room:{...room,turnPlayerId:'b',pending:{kind:'claim'}},you,lang:'jp'});
  assert.equal(poorOffTurn.disabled,true);
  assert.equal(poorOffTurn.parentNode.dataset.unavailableReason,'5コイン必要です。','Resource warnings survive off-turn and pending decisions');
  const tutorialTitle=node(),tutorialButton={...node(),dataset:{action:'purge'},querySelector:()=>tutorialTitle};
  feedback.decorateActions({querySelectorAll:()=>[tutorialButton]},{tutorial:true,lang:'jp'});
  assert.equal(tutorialButton.disabled,undefined);assert.equal(tutorialTitle.children[0].textContent,'7コイン');
 }finally{if(original===undefined)delete global.document;else global.document=original;}
}
{
 const script=fs.readFileSync(require.resolve('../../public/js/components/game-feedback'),'utf8');
 const nodes=[],timers=[],animations=[];
 const box={left:10,top:10,width:100,height:50};
 const element=()=>({dataset:{},style:{},setAttribute(){},getBoundingClientRect:()=>box,animate:(frames,options)=>animations.push(options),remove(){this.removed=true}});
 const coins=element(),roles=element(),player={...element(),dataset:{playerId:'a'},querySelector:s=>s==='.player-coins'?coins:roles};
 const context={window:{URAMAKU_I18N:i18n,matchMedia:()=>({matches:true})},document:{createElement:element,body:{appendChild:el=>nodes.push(el)}},setTimeout:(fn,delay)=>timers.push({fn,delay})};
 vm.runInNewContext(script,context);const api=context.window.URAMAKU_FEEDBACK;
 const container={querySelectorAll:()=>[player],querySelector:()=>roles};
 const changes={targets:['a'],coins:[{id:'a',delta:1}],cards:[{id:'a',type:'discard'}]};
 api.animate(changes,{container});assert.equal(nodes.length,0);assert.equal(animations.length,0,'Reduced motion suppresses effects');
 context.window.matchMedia=()=>({matches:false});api.animate(changes,{container});
 assert.equal(nodes.length,1);assert(nodes.some(n=>n.textContent==='+1'));assert(!nodes.some(n=>n.textContent==='Discarded'),'Discard is represented by card movement, not a floating label');assert(timers.some(t=>t.delay===1575),'Coin badges include another half-second, with a cleanup fallback');assert(animations.some(options=>options.duration===1475&&options.fill==='forwards'));timers.forEach(t=>t.fn());assert(nodes.every(n=>n.removed),'Temporary effects clean themselves up');
}
console.log('Shared disabled-control explanations, EN/JP costs, passive tutorial cards, reduced motion and effect cleanup passed.');

// Reproduce the lifecycle gap: animation finishes before the event loop runs
// the cleanup timer. Completion must remove the token and its fallback state
// must stay transparent, including when the animation is canceled.
{
 const script=fs.readFileSync(require.resolve('../../public/js/components/game-feedback'),'utf8');
 const nodes=[],completions=[],timers=[];
 const box={left:10,top:10,width:60,height:20};
 const node=()=>({style:{},setAttribute(){},remove(){this.removed=true},animate(frames,options){this.frames=frames;this.options=options;return {finished:{then:(finished,canceled)=>completions.push({finished,canceled})}}}});
 const coins={getBoundingClientRect:()=>box},player={dataset:{playerId:'a'},querySelector:()=>coins};
 const context={window:{URAMAKU_I18N:i18n,matchMedia:()=>({matches:false})},document:{createElement:node,body:{appendChild:el=>nodes.push(el)}},setTimeout:fn=>timers.push(fn)};
 vm.runInNewContext(script,context);
 context.window.URAMAKU_FEEDBACK.animate({coins:[{id:'a',delta:1},{id:'a',delta:-5}]},{container:{querySelectorAll:()=>[player]}});
 assert.equal(nodes.length,2);
 for(const token of nodes){assert.equal(token.style.opacity,'0');assert.equal(token.options.fill,'forwards');assert.equal(token.options.duration,1475);assert.equal(token.frames.at(-1).opacity,0);}
 completions[0].finished();completions[1].canceled();assert(nodes.every(token=>token.removed),'Badges disappear on finish/cancel before any timer fires');
 timers.forEach(fn=>fn());assert(nodes.every(token=>token.removed),'Late fallback cleanup cannot revive a badge');
 const css=fs.readFileSync(require.resolve('../../public/css/source/10-turn-feedback.css'),'utf8');
 assert.match(css,/\.coin-gain,\.coin-loss,\.coin-transfer\{font-size:17\.5px;padding:3\.75px 8\.75px/,'Coin badge dimensions increase 25%');
 assert(css.includes('--turn-panel-height:160px'));
 assert(css.includes('grid-template-rows:var(--turn-panel-height) auto'));
 assert(css.includes('height:var(--turn-panel-height);max-height:var(--turn-panel-height);overflow-y:auto'),'Decision changes must not grow the shared desktop header row');
}
console.log('Coin animation completion/cancellation, delayed cleanup, requirement-only tooltips and stable shared header height passed.');

// Summon can replace either influence with another copy of the same role.
for(const slot of [0,1]){
 const room=fixture();room.players[0].influences=['magistrate','magistrate'];room.deck=['lord','kingpin','magistrate'];
 game.performAction(room,'a','summon');game.passChallenge(room,'b');game.passChallenge(room,'c');game.chooseSummon(room,'a','keep');
 const before=view(room,'a');game.chooseSummon(room,'a','replace',slot);const after=view(room,'a');
 const choice={code:room.code,playerId:'a',turnNumber:before[0].turnNumber,slot};
 assert.deepEqual(effects(before,after,choice).cards,[{id:'a',type:'replace',slot}]);
 assert.deepEqual(effects(before,after,{...choice,code:'OTHER'}).cards,[],'A stale room selection cannot animate an unrelated influence');
 assert.deepEqual(effects(before,after).cards,[],'An ambiguous replacement must not animate both held influences');
}
// Proving a role also replaces exactly that influence, even on an identical draw.
{
 const room=fixture();room.players[0].influences=['lord','magistrate'];room.deck=['lord','kingpin','magistrate'];
 game.performAction(room,'a','summon');const before=view(room,'a');game.challenge(room,'b');
 assert.deepEqual(effects(before,view(room,'a')).cards,[{id:'a',type:'draw'},{id:'a',type:'replace',slot:1}]);
 assert.deepEqual(effects(view(room,'c'),view(room,'c')).cards,[],'Opponent private influences never produce replacement effects');
}
// Tutorial survivors keep their original visible slot after another card is lost.
{
 const before={code:'tutorial',status:'playing',players:[],log:[]},after={...before};
 const oldYou={id:'0',influences:['magistrate'],influenceSlots:[1]},you={...oldYou,influences:['lord']};
 assert.deepEqual(feedback.changes(before,after,oldYou,you).cards,[{id:'0',type:'replace',slot:1}]);
}
// Exercise the actual animation selector, verifying no hand-container or other
// influence animation runs for a replacement or a discarded Summon draw.
{
 const script=fs.readFileSync(require.resolve('../../public/js/components/game-feedback'),'utf8');
 const moved=[];const box={left:10,top:10,width:40,height:60};
 const node=name=>({style:{},setAttribute(){},getBoundingClientRect:()=>box,animate(){moved.push(name)},remove(){}});
 const slots=[node('slot0'),node('slot1')],hand=node('hand');
 const player={dataset:{playerId:'a'},querySelector:selector=>selector==='.player-roles'?hand:selector.endsWith('[data-influence-slot="0"]')?slots[0]:selector.endsWith('[data-influence-slot="1"]')?slots[1]:null};
 const context={window:{URAMAKU_I18N:i18n,matchMedia:()=>({matches:false})},document:{createElement:()=>node('badge'),body:{appendChild(){}}},setTimeout(){}};
 vm.runInNewContext(script,context);const api=context.window.URAMAKU_FEEDBACK,container={querySelectorAll:()=>[player]};
 api.animate({cards:[{id:'a',type:'replace',slot:1}]},{container});
 assert.deepEqual(moved.filter(name=>name!=='badge'),['slot1']);
 moved.length=0;api.animate({cards:[{id:'a',type:'replace',slot:0}]},{container});assert.deepEqual(moved.filter(name=>name!=='badge'),['slot0']);
 moved.length=0;api.animate({cards:[{id:'a',type:'discard'}]},{container});assert.deepEqual(moved.filter(name=>name!=='badge'),[]);
 const cards=require('../../public/js/components/role-cards');assert(cards.revealed({role:'lord',name:'Lord',slot:1}).includes('data-influence-slot="1"'));
 assert(!cards.revealed({role:'lord',name:'Lord'}).includes('data-influence-slot'));
}
console.log('Single-slot effects, identical-role Summon draws, successful claim proofs and stable tutorial influence slots passed.');
// The live UI captures the clicked slot before sending the existing protocol
// message, so an identical-role replacement can still target the right card.
{
 const app=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8');
 const send=app.slice(app.indexOf('function send(event,data={})'),app.indexOf('// Live room snapshots'));
 const sent=[],context={pendingReplacementChoice:null,state:{code:'ROOM',turnNumber:7,pending:{kind:'summon',stage:'replace',claimantId:'a'}},me:{id:'a'},socket:{emit:(event,data)=>sent.push({event,data})}};
 context.window={URAMAKU_COMMAND_SESSION:{send:(event,data)=>sent.push({event,data})}};
 vm.createContext(context);vm.runInContext(send,context);context.send('summonChoice',{choice:'replace',cardIndex:1});
 assert.equal(context.pendingReplacementChoice.slot,1);assert.equal(context.pendingReplacementChoice.code,'ROOM');assert.equal(context.pendingReplacementChoice.turnNumber,7);
 assert.deepEqual(sent,[{event:'summonChoice',data:{choice:'replace',cardIndex:1}}],'Presentation metadata must not change gameplay messages');
}
