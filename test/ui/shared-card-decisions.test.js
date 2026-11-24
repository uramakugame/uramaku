const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../..','public');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const tutorial=fs.readFileSync(path.join(root,'js/tutorial.js'),'utf8');
const tutorialCss=fs.readFileSync(path.join(root,'css/tutorial.css'),'utf8');
const gameCss=fs.readFileSync(path.join(root,'css/source','08-responsive-room.css'),'utf8');
const sharedCss=fs.readFileSync(path.join(root,'css/source','09-floating-chat-and-polish.css'),'utf8');

// The decision describes the choice, but never duplicates the influence portraits.
const start=app.indexOf('function renderPending(isTurn)');
const end=app.indexOf('function actionLabel(action)',start);
assert(start!==-1&&end>start);
const context={state:{pending:{kind:'information',stage:'selectHidden',targetId:'p1',claimantId:'p2',claimantName:'Akira'},players:[]},me:{id:'p1',alive:true,coins:2,informationChoice:{stage:'selectHidden',unknownIndices:[0,1]}},esc:x=>String(x)};
vm.createContext(context);
vm.runInContext(app.slice(start,end),context);
let result=vm.runInContext('renderPending(false)',context);
assert.equal(result,'','The influence choice must be made directly on the game board, not in a decision dialog');
assert.doesNotMatch(result,/data-intrigue-reveal|influence-art|<div class="cards">/);
assert(require('../../public/js/components/role-cards').revealed({role:'swordsman',name:'Swordsman',select:{type:'conceal',index:0,label:'Hide this influence'}}).includes('selectable-conceal'),'Only eligible real influence portraits may be clicked');
assert(app.includes('concealOptions.includes(i)'),'Must filter to influences unknown to the investigator');
assert(app.includes("type:selectionType,index:i"),'Cards must send their original slot index');
assert(require('../../public/js/components/role-cards').revealed({role:'swordsman',name:'Swordsman',select:{type:'conceal',index:1,label:'Hide this influence'}}).includes('data-intrigue-reveal="1"'));
assert(app.includes("send('intrigueReveal',{cardIndex:Number(card.dataset.intrigueReveal)})"));
assert(sharedCss.includes('.room-role-card:is(.selectable-loss,.selectable-conceal,.selectable-replace)'));
assert(tutorial.includes('URAMAKU_ROLE_CARDS.revealed')&&app.includes('URAMAKU_ROLE_CARDS.revealed'),'Both rooms must render the same role-card component');

// The tutorial uses production's actual sidebar / main / log grid and same action art.
assert(tutorial.includes('class="game-actions-sidebar"'));
assert(tutorial.includes('class="game-main"'));
assert(tutorial.includes('class="game-sidebar"'));
assert(tutorial.includes('panels.actions('),'Both pages use the shared action panel');
for(const page of ['index.html','tutorial.html'])assert(fs.readFileSync(path.join(root,page),'utf8').includes('role-cards.js'),'Shared renderer must load in '+page);
assert(!tutorialCss.includes('.game-actions-panel .action'),'Tutorial must not override action dimensions or portrait framing');
assert(!tutorialCss.includes('.game-log-panel'),'Tutorial must not override game log dimensions');
assert(gameCss.includes('.game-main>.action-flow'),'The lesson and Current Turn must share the same top-row grid placement');
assert(tutorial.includes('URAMAKU_TOOLTIPS.install')&&app.includes('URAMAKU_TOOLTIPS.install'),'Both views use the same tooltip component');
assert(app.includes('Actions | How to play</button>'));
assert(app.includes('class="section-title">ROOM CODE</span>'));
assert(require('../../public/js/components/game-panels').information({you:{coins:2,informationChoice:{unknownIndices:[0,1]}}}).includes('data-counter="keepOne"'));
assert(!app.includes('is using Intrigue to investigate your influences. Choose what to conceal.'));
assert(fs.readFileSync(path.join(root,'css/source','03-game-components.css'),'utf8').includes('background:transparent!important'));
console.log('Shared tutorial/game layout and card-selection decisions passed.');

const sharedCards=require('../../public/js/components/role-cards');
for(const faction of ['order','underworld',null]){
 const back=sharedCards.hidden({faction});
 assert.doesNotMatch(back,/faction-mark|faction-symbol|Faction emblem|菊|影/);
 if(faction)assert(back.includes('faction-portrait '+faction),'The existing faction tint remains available');
}
for(const role of ['lord','courtesan','swordsman','assassin','magistrate','kingpin']){
 assert.doesNotMatch(sharedCards.revealed({role,name:role}),/faction-mark|faction-symbol|Faction emblem|菊|影/);
}
console.log('Shared hidden and revealed role cards render without faction symbols.');
