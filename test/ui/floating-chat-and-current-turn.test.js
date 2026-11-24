const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const game=require('../../server/game');
const root=path.join(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'public/js/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/css/game.css'),'utf8');
// Intrigue has a single canonical action name across all stages.
const flowSource=app.slice(app.indexOf('function renderActionFlow(){'),app.indexOf('function renderBoardEconomy(){'));
const ctx={state:null,me:null,referenceLanguage:'en',i18n:require('../../shared/i18n'),esc:x=>String(x)};
vm.createContext(ctx);vm.runInContext(flowSource,ctx);
const players=[{id:'one',name:'Akira',alive:true},{id:'two',name:'Sora',alive:true}];
ctx.me={id:'one',alive:true};
ctx.state={status:'playing',players,roles:{courtesan:{name:'Courtesan'}},turnPlayerId:'one',pending:{kind:'information',action:'intrigue',claimantId:'one',targetId:'two'}};
const infoFlow=vm.runInContext('renderActionFlow()',ctx);
assert.match(infoFlow,/Akira targets Sora with Intrigue\./);
assert.doesNotMatch(infoFlow,/Pry|with the action|the current action/);
ctx.state.pending={kind:'counterOffer',action:'intrigue',claimantId:'one',targetId:'two'};
assert.match(vm.runInContext('renderActionFlow()',ctx),/Akira targets Sora with Intrigue\./);
ctx.state.pending={kind:'claim',action:'assassinate',role:'assassin',claimantId:'one',targetId:'two',passedBy:[]};
assert.match(vm.runInContext('renderActionFlow()',ctx),/Akira targets Sora with Assassinate\./);
// Server must preserve action identity as an Intrigue claim becomes a response decision.
const p=(id,coins)=>({id,name:id,coins,influences:['courtesan','lord'],alive:true,ready:true,connected:true});
const room=game.createGame('TEST',p('one',3));room.players=[p('one',3),p('two',3)];room.status='playing';room.turn=0;room.pending=null;room.deck=Array(20).fill('lord');
assert(game.performAction(room,'one','intrigue','two').ok);
assert(game.passChallenge(room,'two').ok);
assert.equal(room.pending.kind,'counterOffer');
const offer=room.pending;room.pending=null;assert(game.performDeferredAction(room,offer).ok);
assert.equal(room.pending.kind,'information');
assert.equal(room.pending.action,'intrigue');
// Modal no longer blocks the table; it supports header drag and native resizing.
assert(app.includes('class="chat-modal" id="chatWindow"'));
assert(app.includes('class="chat-drag-handle"'));
assert(app.includes("drag.addEventListener('pointermove'"));
assert(app.includes('chatSizeObserver=new ResizeObserver'));
assert(app.includes('function captureChatBounds(){'));
assert(css.includes('resize:both'));
assert(css.includes('pointer-events:none!important'));
assert(css.includes('pointer-events:auto!important'));
assert(app.includes('if(chatOnly){'),'Incoming messages should not overwrite the active chat draft');
// All exits have one consistent label, including the victory dialog.
assert(app.includes('id="victoryLeaveRoom">Leave room</button>'));
assert(app.includes('id="exitRoom" class="small" type="button">Leave room</button>'));
assert(!app.includes('>Exit game</button>'));
// Faction mode affects the card emblems without changing the game mechanics.
assert(app.includes("${state?.revealFactions?'factions-on':'factions-off'}"));
assert(css.includes('.factions-off .game-players-panel .player-roles .faction-mark{display:none!important}'));
// Target choice receives the same urgent visual treatment as a challenge.
assert(app.includes("flow.classList.add('has-decision','has-target-selection','flow-attention')"));
assert(css.includes('.action-flow.has-target-selection{border-left:4px solid #a32e2b!important'));
assert(css.includes('transform:translate(-50%,-50%)'),'Action announcements should anchor to board center');
assert(app.includes('function positionActionAnnouncements()'),'Announcement location should follow board geometry');
assert(css.includes('.game-room-code .room-code-heading'));
console.log('Floating chat, phase labels, Intrigue server flow, faction styling, winner exit and target highlights passed.');
