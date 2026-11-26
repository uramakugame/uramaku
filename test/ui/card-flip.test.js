'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const game=require('../../server/game'),feedback=require('../../public/js/components/game-feedback'),cards=require('../../public/js/components/role-cards'),i18n=require('../../shared/i18n');
const {harness}=require('../tutorial/browser-harness');
function fixture(){
 const players=[['a',['courtesan','magistrate']],['b',['assassin','kingpin']],['c',['lord','swordsman']]].map(([id,influences])=>({id,name:id,alive:true,ready:true,connected:true,coins:8,influences,intrigueVisibility:[0,0],privateInvestigations:{}}));
 const room=game.createGame('FLIP',players[0]);Object.assign(room,{players,status:'playing',challengeTimerEnabled:false,deck:['lord','kingpin','magistrate'],log:[]});return room;
}
const view=(room,id='a')=>JSON.parse(JSON.stringify([game.publicState(room),game.privateState(room,id)]));
const effects=(before,after,choice)=>feedback.changes(before[0],after[0],before[1],after[1],choice);
const pass=(room,claimant)=>{for(const p of room.players)if(p.alive&&p.id!==claimant)assert(game.passChallenge(room,p.id).ok);};
{
 const room=fixture();assert(game.performAction(room,'a','purge','b').ok);const before=view(room);assert(game.loseInfluence(room,'b',1).ok);const after=view(room);
 assert.deepEqual(effects(before,after).flips,[{id:'b',kind:'loss',revealIndex:0,faction:null}]);
 assert.deepEqual(effects(after,after).flips,[]);assert.deepEqual(effects([null,null],after).flips,[]);
 assert.deepEqual(feedback.changes(before[0],{...after[0],code:'OTHER'},before[1],after[1]).flips,[]);
}
{
 const room=fixture();room.players[0].privateInvestigations.b={1:'kingpin'};assert(game.performAction(room,'a','purge','b').ok);const before=view(room);assert(game.loseInfluence(room,'b',0).ok);
 const flips=effects(before,view(room)).flips;assert.deepEqual(flips,[{id:'b',kind:'loss',revealIndex:0,faction:null}],'Shifting an already-known surviving card is not a reveal');
}
{
 const room=fixture();room.players[0].privateInvestigations.b={1:'kingpin'};assert(game.performAction(room,'a','purge','b').ok);const before=view(room);assert(game.loseInfluence(room,'b',1).ok);assert.deepEqual(effects(before,view(room)).flips,[],'Already-visible lost card does not pretend to become known again');
}
{
 const room=fixture();room.revealFactions=true;assert(game.performAction(room,'a','intrigue','b').ok);pass(room,'a');assert(game.performDeferredAction(room,room.pending).ok);
 const before=view(room),observer=view(room,'c');assert(game.chooseCounter(room,'b','revealAll').ok);const after=view(room);
 assert.deepEqual(effects(before,after).flips,[{id:'b',kind:'reveal',slot:0,faction:'underworld'},{id:'b',kind:'reveal',slot:1,faction:'underworld'}]);
 assert.deepEqual(effects(observer,view(room,'c')).flips,[],'Private Intrigue flips only for its investigator');
 const ownerBefore=view(room,'b');assert.deepEqual(effects(ownerBefore,view(room,'b')).flips,[]);
 const spectatorBefore=view(room,'spectator');assert(game.sharePrivateIntel(room,'a','b',1).ok);
 assert.deepEqual(effects(spectatorBefore,view(room,'spectator')).flips,[{id:'b',kind:'reveal',slot:1,faction:'underworld'}]);
 assert.deepEqual(effects(after,view(room)).flips,[],'Sharing known information publicly is not a second reveal for the investigator');
}
{
 const room=fixture();room.players[1].influences=['courtesan','swordsman'];assert(game.performAction(room,'a','intrigue','b').ok);pass(room,'a');assert(game.chooseCounter(room,'b','courtesan').ok);
 const before=view(room),ownerBefore=view(room,'b');assert(game.challenge(room,'a').ok);
 assert.deepEqual(effects(before,view(room)).flips,[{id:'b',kind:'reveal',slot:1,faction:null}],'Gossip reveals the unchanged card immediately, keeping the new Courtesan replacement hidden');
 assert.deepEqual(effects(ownerBefore,view(room,'b')).flips.filter(f=>f.id==='b'),[{id:'b',kind:'replace',slot:0,fromRole:'courtesan'}],'The proof replacement is initially visible only to its owner');
 const pending=view(room),ownerPending=view(room,'b'),observerPending=view(room,'c');assert(game.loseInfluence(room,'a',1).ok);
 assert.deepEqual(effects(pending,view(room)).flips,[],'Settling the challenge loss never reveals the proof replacement');
 assert.deepEqual(view(room,'b')[1].privateInvestigations.a,{0:'courtesan'},'The defender learns only the surviving attacker influence');
 assert(!effects(ownerPending,view(room,'b')).flips.some(f=>f.id==='a'&&f.kind==='reveal'&&f.slot===1),'A removed influence slot must not animate as a held card');
 assert(!effects(observerPending,view(room,'c')).flips.some(f=>f.id==='b'&&f.kind==='reveal'),'The third player sees no private Gossip reveal');
}
for(const sameRole of [false,true]){
 const room=fixture();room.players[0].influences=['magistrate','lord'];room.deck=[sameRole?'lord':'kingpin'];const before=view(room),observer=view(room,'b');assert(game.performAction(room,'a','summon').ok);pass(room,'a');const preview=view(room);
 assert.deepEqual(effects(before,preview).flips,[{id:'a',kind:'draw'}]);assert.deepEqual(effects(observer,view(room,'b')).flips,[]);
 const keep=view(room);assert(game.chooseSummon(room,'a','replace',1).ok);
 const choice={code:room.code,playerId:'a',turnNumber:keep[0].turnNumber,slot:1};assert.deepEqual(effects(keep,view(room),choice).flips,[{id:'a',kind:'replace',slot:1,fromRole:'lord'}],'Only the selected influence turns, including an identical-role draw');
}
// Exercise the actual browser renderer and effect lifecycle with both languages.
for(const lang of ['en','jp']){
 const h=harness(lang),animations=[],timers=[];h.window.matchMedia=()=>({matches:false});
 const proto=Object.getPrototypeOf(h.app);proto.animate=function(frames,options){const entry={el:this,frames,options};animations.push(entry);return{cancel(){entry.cancel?.()},finished:{then(finish,cancel){entry.finish=finish;entry.cancel=cancel;}}};};
 h.context.setTimeout=fn=>{timers.push(fn);return timers.length};h.context.clearTimeout=()=>{};
 h.app.innerHTML=cards.revealed({role:'kingpin',name:i18n.role('kingpin',lang),slot:1,select:{type:'replace',index:1,label:'Replace'}});
 const card=h.app.querySelector('[data-influence-slot="1"]');card.setAttribute('id','card');card.children[0].setAttribute('id','portrait');const originalChildren=[...card.children];
 assert(h.window.URAMAKU_CARD_FLIP.animate(card,{lang}));assert(card.classList.contains('card-flipping'));assert(originalChildren.every(el=>el.classList.contains('card-flip-covered')));
 const layer=card.querySelector('.card-flip-layer');assert.equal(layer.getAttribute('aria-hidden'),'true');assert(layer.hasAttribute('inert'));assert(layer.querySelector('.card-flip-back .hidden-role-card'));assert(layer.querySelector('.card-flip-front .portrait-kingpin'));assert.equal(layer.querySelectorAll('[id]').length,0);assert.equal(card.id,'card');
 assert.equal(animations.at(-1).frames[0].transform,'rotateY(0deg)');assert.equal(animations.at(-1).frames[1].transform,'rotateY(180deg)');assert.equal(animations.at(-1).options.fill,'both');animations.at(-1).finish();
 assert.equal(card.querySelector('.card-flip-layer'),null);assert(!card.classList.contains('card-flipping'));assert(originalChildren.every(el=>!el.classList.contains('card-flip-covered')));
 assert(h.window.URAMAKU_CARD_FLIP.animate(card,{fromRole:'lord',lang}));assert(card.querySelector('.card-flip-back .portrait-lord'));assert(card.querySelector('.card-flip-back').textContent.includes(i18n.role('lord',lang)));animations.at(-1).cancel();assert(!card.querySelector('.card-flip-layer'));
 h.window.URAMAKU_CARD_FLIP.animate(card,{faction:'order'});assert(card.querySelector('.card-flip-back .faction-portrait.order'));h.window.URAMAKU_CARD_FLIP.animate(card,{});assert.equal(card.querySelectorAll('.card-flip-layer').length,1,'A replacement animation cancels its predecessor');timers.forEach(fn=>fn());assert(!card.querySelector('.card-flip-layer'));
 h.window.matchMedia=()=>({matches:true});const count=animations.length;assert.equal(h.window.URAMAKU_CARD_FLIP.animate(card,{}),false);assert.equal(animations.length,count);assert(!card.querySelector('.card-flip-layer'));
}
// The live game preserves unknown/known card positions instead of moving known cards to the front.
{
 const source=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8'),start=source.indexOf(' const players=state.players.map(p=>{'),end=source.indexOf(" if(state.status==='lobby'){",start);
 const state={status:'playing',players:[{id:'b',name:'B',alive:true,coins:3,influenceCount:2}],revealedCards:[],sharedInvestigations:[]},me={id:'a',alive:true,influences:[],privateInvestigations:{b:{1:'kingpin'}}};
 const context={kickPendingId:null,kickEligible:()=>false,state,me,meId:'a',current:'a',targetSelectionAction:null,window:{URAMAKU_ROLE_CARDS:cards},esc:String,t:key=>key,roleName:id=>i18n.role(id,'en'),roleHint:()=>''};
 vm.createContext(context);const html=vm.runInContext(source.slice(start,end)+'\nplayers',context);const h=harness();h.app.innerHTML=html;
 const rendered=h.app.querySelectorAll('.room-role-card');assert.equal(rendered.length,2);assert.equal(rendered[0].dataset.influenceSlot,'0');assert(rendered[0].classList.contains('hidden-role-card'));assert.equal(rendered[1].dataset.influenceSlot,'1');assert(rendered[1].classList.contains('portrait-kingpin'));
}
const css=fs.readFileSync(require.resolve('../../public/css/source/10-turn-feedback.css'),'utf8');assert(css.includes('perspective:900px'));assert(css.includes('backface-visibility:hidden'));assert(css.includes('transform-style:preserve-3d'));assert(css.includes('.card-flip-layer *{pointer-events:none!important}'));
for(const page of ['index.html','tutorial.html'])assert(fs.readFileSync(require.resolve('../../public/'+page),'utf8').includes('/js/components/card-flip.js'));
console.log('Card flips: authorized reveals, Gossip privacy, Summon, single-slot replacements, stable ordering, 3D faces, EN/JP, cleanup, cancellation and reduced motion passed.');
