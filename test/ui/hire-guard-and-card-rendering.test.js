const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const game=require('../../server/game');
const renderer=require('../../public/js/components/role-cards');
const publicRoot=path.resolve(__dirname,'../../public');
const make=(id,cards,coins=3)=>({id,name:id,alive:true,ready:true,connected:true,coins,influences:cards.slice(),intrigueVisibility:cards.map(()=>0),privateInvestigations:{}});
function room(players,{treasuryMode=false}={}){
 const r=game.createGame('TEST',players[0]);r.players=players;r.status='playing';r.turn=0;r.deck=Array(30).fill('lord');r.log=[];r.pending=null;r.discard=[];r.revealedCards=[];
 r.treasuryMode=treasuryMode;
 if(treasuryMode){r.totalCoins=players.length*7;r.treasuryCoins=r.totalCoins-players.reduce((sum,p)=>sum+p.coins,0);r.economyWinThreshold=16;}
 return r;
}
function attackThroughCounter(r,a,b,c){
 assert(game.performAction(r,a.id,'assassinate',b.id).ok);
 for(const p of r.players)if(p.id!==a.id)assert(game.passChallenge(r,p.id).ok);
 assert.equal(r.pending?.kind,'counterOffer');
 assert.deepEqual(r.pending.options,['swordsman','assassin']);
 assert(game.chooseCounter(r,b.id,'swordsman').ok);
 assert.equal(r.pending.kind,'counterClaim');
}
{
 // False Trail is still available when the target cannot afford Hire Guard.
 const a=make('a',['assassin','magistrate'],3),b=make('b',['assassin','lord'],4),c=make('c',['kingpin','courtesan'],3);
 const r=room([a,b,c]);assert(game.performAction(r,a.id,'assassinate',b.id).ok);
 assert(game.passChallenge(r,b.id).ok);assert(game.passChallenge(r,c.id).ok);
 assert.deepEqual(r.pending.options,['assassin']);
 assert.equal(game.chooseCounter(r,b.id,'swordsman').ok,false);
 assert(game.chooseCounter(r,b.id,'assassin').ok);
 assert(game.passChallenge(r,a.id).ok);assert(game.passChallenge(r,c.id).ok);
 assert.equal(r.pending,null);
 assert.deepEqual(b.influences,['assassin','lord']);
 assert.equal(b.coins,5,'Only next-turn Income changes the defender’s balance');
 assert(r.log.some(x=>x.includes('uses False Trail to block')));
}
{
 const a=make('a',['assassin','magistrate'],3),b=make('b',['assassin','lord'],0),c=make('c',['kingpin','courtesan'],3);
 const r=room([a,b,c]);assert(game.performAction(r,a.id,'assassinate',b.id).ok);
 assert(game.passChallenge(r,b.id).ok);assert(game.passChallenge(r,c.id).ok);
 assert(game.chooseCounter(r,b.id,'assassin').ok);
 assert(game.challenge(r,a.id).ok);
 assert(game.loseInfluence(r,a.id,1).ok);
 assert.equal(a.influences.length,1);
 assert.equal(b.influences.length,2);
 assert.equal(r.pending,null);
}
{
 const a=make('a',['assassin','magistrate'],3),b=make('b',['swordsman','lord'],0),c=make('c',['kingpin','courtesan'],3);
 const r=room([a,b,c]);assert(game.performAction(r,a.id,'assassinate',b.id).ok);
 assert(game.passChallenge(r,b.id).ok);assert(game.passChallenge(r,c.id).ok);
 assert(game.chooseCounter(r,b.id,'assassin').ok);
 assert(game.challenge(r,a.id).ok);
 assert.equal(b.alive,false,'False Trail bluff is penalized and Assassinate lands');
 assert.equal(r.pending,null);
}
{
 // The counter is paid before the challenge window, even if its claimant spends all 5 coins.
 const a=make('a',['assassin','magistrate'],3),b=make('b',['swordsman','lord'],5),c=make('c',['kingpin','courtesan'],3);
 const r=room([a,b,c],{treasuryMode:true});
 attackThroughCounter(r,a,b,c);assert.equal(b.coins,0,'Charge when claimed');
 assert(game.passChallenge(r,a.id).ok);assert.equal(b.coins,0);
 assert(game.passChallenge(r,c.id).ok);
 assert.equal(r.pending.kind,'lose');assert.equal(r.pending.loserId,a.id);
 assert(game.treasuryInvariant(r));
 assert.equal(r.treasuryCoins,18,'Assassinate 3 and Hire Guard 5 both return to treasury');
 assert(game.loseInfluence(r,a.id,1).ok);
 assert.equal(b.coins,1,'Only next-turn Income');
}
{
 const a=make('a',['assassin','magistrate'],3),b=make('b',['swordsman','lord'],5),c=make('c',['kingpin','courtesan'],3);
 const r=room([a,b,c],{treasuryMode:true});attackThroughCounter(r,a,b,c);
 assert(game.challenge(r,a.id).ok);assert.equal(a.alive,false);
 assert.equal(b.coins,1,'The counter costs 5 once, then passive Income');
 assert(game.treasuryInvariant(r));assert.equal(r.pending,null);
 assert.equal(r.log.filter(x=>x.includes('pays 5 coins to claim Hire Guard')).length,1);
}
{
 const a=make('a',['assassin','magistrate'],3),b=make('b',['kingpin','lord'],5),c=make('c',['courtesan','magistrate'],3);
 const r=room([a,b,c]);attackThroughCounter(r,a,b,c);
 assert(game.challenge(r,a.id).ok);assert.equal(b.coins,0,'No refund for failed Hire Guard');
 assert.equal(b.alive,false,'The failed counter and original attack each cost one influence');
}
{
 const a=make('a',['assassin','magistrate'],3),b=make('b',['swordsman','lord'],6),c=make('c',['kingpin','courtesan'],3);
 const r=room([a,b,c]);attackThroughCounter(r,a,b,c);
 assert(game.challenge(r,c.id).ok);
 assert.equal(b.coins,1);
 assert.equal(game.lossDecision(r,c.id).kind,'lose');assert.equal(game.lossDecision(r,c.id).loserId,c.id);assert.equal(r.pending.loserId,a.id,'Hire Guard also proceeds immediately');
 assert(game.loseInfluence(r,c.id,0).ok);
 assert.equal(b.coins,1,'Third-party challenge does not charge Hire Guard twice');
 assert.equal(r.pending.kind,'lose');assert.equal(r.pending.loserId,a.id);
}
{
 // Intrigue with one unknown influence: pay once, no extra card selection stage.
 const a=make('a',['courtesan','lord'],2),b=make('b',['swordsman','magistrate'],2),c=make('c',['kingpin','lord'],3);
 const r=room([a,b,c]);r.pending={kind:'information',claimantId:a.id,targetId:b.id,action:'intrigue',stage:'choice',unknownIndices:[1]};
 assert(game.chooseCounter(r,b.id,'keepOne').ok);
 assert.notEqual(r.pending?.stage,'selectHidden');assert.equal(b.coins,2,'One coin spent, then passive Income on next turn');assert.equal(a.coins,3);
 assert.equal(a.privateInvestigations.b,undefined);
}
{
 // Source of truth for influence markup is literally the same renderer in both views.
 const own=renderer.revealed({role:'swordsman',name:'Swordsman',status:'Hidden',select:{type:'conceal',index:1,label:'Hide this influence'}});
 assert.match(own,/room-role-card portrait-swordsman/);assert.match(own,/class="role-card-bottom"/);
 assert.match(own,/data-intrigue-reveal="1"/);assert.match(own,/Hide this influence/);
 const loss=renderer.revealed({role:'swordsman',name:'Swordsman',select:{type:'lose',index:1,label:'Lose this influence'}});
 assert.match(loss,/selectable-loss/);assert.match(loss,/data-lose="1"/);
 assert.equal(renderer.hidden().includes('<small>'),false);
 const live=fs.readFileSync(path.join(publicRoot,'js/app.js'),'utf8');
 const tutorial=fs.readFileSync(path.join(publicRoot,'js/tutorial.js'),'utf8');
 assert.match(live,/URAMAKU_ROLE_CARDS.revealed/);assert.match(tutorial,/URAMAKU_ROLE_CARDS.revealed/);
 const start=live.indexOf('function renderPending(isTurn)'),stop=live.indexOf('function actionLabel(action)',start);
 const context={window:{URAMAKU_PANELS:require('../../public/js/components/game-panels')},referenceLanguage:'en',state:{pending:{kind:'information',targetId:'b',claimantName:'a',targetName:'b'}},me:{id:'b',coins:2,informationChoice:{stage:'choice',unknownIndices:[0,1]}},esc:v=>v,t:key=>key};
 vm.createContext(context);vm.runInContext(live.slice(start,stop),context);
 const html=vm.runInContext('renderPending(false)',context);
 assert.match(html,/class="small" data-counter="keepOne"/);
 assert.doesNotMatch(html,/investigate your influences|role-card|influence-art/);
 context.me.informationChoice.stage='selectHidden';assert.equal(vm.runInContext('renderPending(false)',context),'');
 assert(live.includes("t('hideInfluence')"));
 assert(live.includes('data-tab="rules">Actions</button>'));
 assert(!live.includes('Actions & Roles'));
 const css=fs.readFileSync(path.join(publicRoot,'css/source','03-game-components.css'),'utf8');
 assert(!css.includes('background:linear-gradient(145deg,#342628,#241d20)'));
 const modalCss=fs.readFileSync(path.join(publicRoot,'css/source','03-game-components.css'),'utf8');
 assert.match(modalCss,/\.rules-reference-modal\s*\{\s*height:min\(930px, calc\(100dvh - 12px\)\)/,'Guide height must stay fixed across languages and tabs');
 assert(!modalCss.includes('height:min(760px,92dvh)'),'An old height cap must not override the expanded guide');
}
console.log('Hire Guard payment timing, False Trail, coin conservation, and shared card controls passed.');
