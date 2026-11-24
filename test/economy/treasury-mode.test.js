const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const g=require('../../server/game');
const player=(name,coins=0,influences=['lord','assassin'])=>({id:name,name,coins,influences:[...influences],alive:true,ready:true,connected:true,intrigueVisibility:[0,0],privateInvestigations:{}});
function fixture(coins,{treasuryMode=true,influences={}}={}){
 const players=coins.map((value,index)=>player('p'+index,value,influences[index]||['lord','assassin']));
 const r=g.createGame('ECON',players[0]);r.players=players;r.status='playing';r.turn=0;r.deck=Array(30).fill('lord');r.discard=[];r.log=[];r.pending=null;
 r.treasuryMode=treasuryMode;
 r.totalCoins=treasuryMode?7*coins.length:null;
 r.treasuryCoins=treasuryMode?r.totalCoins-coins.reduce((x,y)=>x+y,0):null;
 if(treasuryMode)assert(r.treasuryCoins>=0);
 r.economyWinThreshold=treasuryMode?Math.min(14,coins.length+9):null;
 return r;
}
const invariant=r=>assert(g.treasuryInvariant(r),'The fixed coin supply must not change');
const mustPass=(r,except)=>{for(const p of r.players)if(p.alive&&p.id!==except)assert(g.passChallenge(r,p.id).ok,p.name+' should pass');};
// Initial supply: starting coins come OUT of the 7 coins per player.
for(let n=2;n<=8;n++){
 const host=player('p0',0,[]),r=g.createGame('ECON',host);
 r.players=Array.from({length:n},(_,i)=>player('p'+i,0,[]));r.treasuryMode=true;
 g.startGame(r);invariant(r);
 assert.equal(r.totalCoins,7*n);
 assert.equal(r.economyWinThreshold,[11,12,13,14,14,14,14][n-2]);
 assert.equal(r.treasuryCoins,6*n-1,'First turn has already withdrawn passive Income');
 assert.deepEqual(r.players.map(p=>p.coins).sort(),[...Array(n-1).fill(1),2].sort());
 const state=g.publicState(r);
 assert.equal(state.treasuryMode,true);assert.equal(state.riot,false);assert.equal(state.purgeCost,7);
}
// Standard Mode: forced Purge is checked AFTER passive Income, and bans all other actions.
{
 const r=fixture([2,9],{treasuryMode:false});
 g.finishTurn(r,'p0');
 assert.equal(r.players[1].coins,10);assert.equal(r.mandatoryPurge,true);
 assert.equal(g.publicState(r).mandatoryPurge,true);
 for(const action of ['earn','tax','assassinate','hireBlade','extort','summon','intrigue']){
   const before=JSON.stringify(r);
   const result=g.performAction(r,'p1',action,'p0');assert.equal(result.ok,false,action);
   assert.match(result.error,/must use Purge/);assert.equal(JSON.stringify(r),before);
 }
 assert(g.performAction(r,'p1','purge','p0').ok);
 assert.equal(r.players[1].coins,3);
}
{
 const r=fixture([2,8],{treasuryMode:false});g.finishTurn(r,'p0');
 assert.equal(r.players[1].coins,9);assert.equal(r.mandatoryPurge,false);
 assert(g.performAction(r,'p1','earn').ok);
}
// When the last treasury coin is taken, it triggers Riot; Tax can pay less than two.
{
 const r=fixture([6,7]);assert.equal(r.treasuryCoins,1);
 assert(g.performAction(r,'p0','tax').ok);mustPass(r,'p0');invariant(r);
 assert.equal(r.players[0].coins,7);assert.equal(r.treasuryCoins,0);
 assert.equal(g.publicState(r).riot,true);assert.equal(g.publicState(r).purgeCost,5);
 assert(r.log.some(msg=>msg.includes('Riot breaks out')));
 assert(r.log.some(msg=>msg.includes('collects 1 coin through Tax')));
 assert(r.log.some(msg=>msg.includes('receives no Income')));
 const before=JSON.stringify(r);assert.equal(g.performAction(r,'p1','earn').ok,false);assert.equal(JSON.stringify(r),before);
}
// Riot Loot is available on or off turn, against a living opponent with coins.
{
 const r=fixture([0,10,11]);assert.equal(r.treasuryCoins,0);
 assert.equal(g.performAction(r,'p0','earn').ok,false);
 assert.equal(g.performAction(r,'p0','loot','p0').ok,false);
 assert.equal(g.performAction(r,'p0','loot','fake').ok,false);
 assert(g.performAction(r,'p0','loot','p1').ok);invariant(r);
 assert.equal(r.players[0].coins,1);assert.equal(r.players[1].coins,9);
 assert.equal(r.treasuryCoins,0);assert.equal(r.pending,null);
 assert.equal(g.publicState(r).turnPlayerId,'p1','Using Loot as your turn action uses the turn');
 assert(g.performAction(r,'p0','loot','p1').ok);invariant(r);
 assert.equal(r.players[0].coins,2);
 assert.equal(g.publicState(r).turnPlayerId,'p1','Off-turn Loot does not advance the turn');
}
{
 const r=fixture([0,0,12,12,11]);
 assert.equal(g.performAction(r,'p0','loot','p1').ok,false,'Zero-coin player cannot be looted');
}
// Players with 3 or more coins can loot, including during an unresolved decision.
{
 const r=fixture([2,10,9]);
 assert.equal(r.treasuryCoins,0);
 assert(g.performAction(r,'p0','loot','p1').ok);invariant(r);
 assert.equal(r.players[0].coins,3);
 assert(g.performAction(r,'p1','summon').ok);
 const pending=r.pending;
 assert(g.performAction(r,'p0','loot','p1').ok);invariant(r);
 assert.equal(r.players[0].coins,4);
 assert.equal(r.pending,pending);
 assert.equal(g.publicState(r).turnPlayerId,'p1');
}
// Loot is restricted to Riot.
{
 const r=fixture([3,3]);
 assert.match(g.performAction(r,'p1','loot','p0').error,/only available during Riot/);
}
// Tax remains possible with 1 treasury coin (partial payout), but never during Riot.
{
 const r=fixture([0,13,8]); // treasury empty; first player has a lawful Tax claim
 const snapshot=JSON.stringify(r);
 const rejected=g.performAction(r,'p0','tax');
 assert.equal(rejected.ok,false);
 assert.match(rejected.error,/unavailable during Riot/);
 assert.equal(JSON.stringify(r),snapshot);
}
// During Riot, Overthrow replaces Purge and deposits 5 coins, ending Riot.
{
 const r=fixture([5,8,8]);invariant(r);
 assert.equal(g.publicState(r).riot,true);
 assert.equal(g.performAction(r,'p0','purge','p1').ok,false,'Purge cannot be used during Riot');
 assert(g.performAction(r,'p0','overthrow','p1').ok);invariant(r);
 assert.equal(r.players[0].coins,0);assert.equal(r.treasuryCoins,5);
 assert.equal(g.publicState(r).riot,false);assert.equal(g.publicState(r).purgeCost,7);
 assert.equal(r.pending?.kind,'lose');assert(g.loseInfluence(r,'p1',0).ok);invariant(r);
 assert(r.log.some(msg=>msg.includes('Riot ends')));
}
// Overthrow cannot be selected outside Riot, including when the treasury has coins.
{
 const r=fixture([7,4,5]);
 const before=JSON.stringify(r);
 const denied=g.performAction(r,'p0','overthrow','p1');
 assert.equal(denied.ok,false);assert.match(denied.error,/only available during Riot/);
 assert.equal(JSON.stringify(r),before);
}
// Riot Overthrow requires five coins, even if the target cannot counter.
{
 const r=fixture([4,9,8]);
 const before=JSON.stringify(r);
 const denied=g.performAction(r,'p0','overthrow','p1');
 assert.equal(denied.ok,false);assert.match(denied.error,/costs 5 coins/);
 assert.equal(JSON.stringify(r),before);
}
// Elimination returns all held coins on top of the elimination cost.
{
 const r=fixture([7,4,5],{influences:{1:['swordsman']}});
 assert.equal(r.treasuryCoins,5);
 assert(g.performAction(r,'p0','purge','p1').ok);invariant(r);
 assert.equal(r.players[1].alive,false);assert.equal(r.players[1].coins,0);
 assert.equal(r.treasuryCoins,15,'Purge 7 + defeated player 4 - next turn Income 1');
 assert(r.log.some(msg=>msg.includes('remaining coins return to the treasury')));
}
// Forfeits also return coins, without leaving a dead seat holding the supply.
{
 const r=fixture([4,5,6]);assert(g.forfeitPlayer(r,'p1').ok);invariant(r);
 assert.equal(r.players[1].coins,0);
}
// Economic win: after turn-start Income, after resolving Tax, and after Extort.
{
 const r=fixture([4,12,4,4]);r.turn=0;
 g.finishTurn(r,'p0');invariant(r);
 assert.equal(r.status,'finished');assert.equal(r.winner,'p1');assert.equal(r.winType,'economy');
 assert.equal(r.pending,null);assert.equal(r.players[1].coins,13);
}
{
 const r=fixture([12,4,3,3]);
 assert(g.performAction(r,'p0','tax').ok);mustPass(r,'p0');invariant(r);
 assert.equal(r.status,'finished');assert.equal(r.winner,'p0');assert.equal(r.pending,null);
}
{
 const r=fixture([12,2,2,3]);
 assert(g.performAction(r,'p0','extort','p1').ok);mustPass(r,'p0');
 assert.equal(r.pending?.kind,'counterOffer');
 const pending=r.pending;r.pending=null;assert(g.performDeferredAction(r,pending).ok);invariant(r);
 assert.equal(r.status,'finished');assert.equal(r.players[0].coins,14);
}
// A defended/paid Intrigue can cause immediate economic victory during the response.
{
 const r=fixture([11,2,0]);
 assert(g.performAction(r,'p0','intrigue','p1').ok);mustPass(r,'p0');
 assert.equal(r.pending?.kind,'counterOffer');
 const pending=r.pending;r.pending=null;assert(g.performDeferredAction(r,pending).ok);
 assert.equal(r.pending.kind,'information');
 assert(g.chooseCounter(r,'p1','keepOne').ok);invariant(r);
 assert.equal(r.status,'finished');assert.equal(r.winner,'p0');assert.equal(r.pending,null);
}
// Authority blocks with no transfer; Enforce sends 2 coins to its claimant.
{
 const r=fixture([11,1,1]);
 assert(g.performAction(r,'p0','intrigue','p1').ok);mustPass(r,'p0');
 assert(g.chooseCounter(r,'p1','lord').ok);mustPass(r,'p1');invariant(r);
 assert.equal(r.status,'playing');assert.equal(r.players[0].coins,11);assert.equal(r.players[1].coins,2);
}
{
 const r=fixture([2,8,1]), treasury=r.treasuryCoins;
 assert(g.performAction(r,'p0','extort','p1').ok);mustPass(r,'p0');
 assert(g.chooseCounter(r,'p1','magistrate').ok);mustPass(r,'p1');invariant(r);
 assert.equal(r.status,'playing');assert.equal(r.players[1].coins,11);
 assert.equal(r.treasuryCoins,treasury-1,'Only new-turn Income changes the treasury');
}
{
 const r=fixture([2,10,1]), treasury=r.treasuryCoins;
 assert(g.performAction(r,'p0','extort','p1').ok);mustPass(r,'p0');
 assert(g.chooseCounter(r,'p1','magistrate').ok);mustPass(r,'p1');invariant(r);
 assert.equal(r.status,'finished');assert.equal(r.winner,'p1');assert.equal(r.pending,null);
 assert.equal(r.players[1].coins,12);
 assert.equal(r.treasuryCoins,treasury,'Counter reaches the wealth goal before another turn begins');
}
// In Treasury mode, reaching 10+ never makes Purge compulsory.
{
 const r=fixture([10,4,3]);r.turn=0;r.mandatoryPurge=false;
 assert(g.performAction(r,'p0','earn').ok);invariant(r);
 assert.equal(r.mandatoryPurge,false);
}
// UI contract: separate mode toggle, visible Riot affordances, Hidden label and asset.
{
 const app=fs.readFileSync(path.join(__dirname,'../../public/js/app.js'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'../../server/index.js'),'utf8');
 const tut=fs.readFileSync(path.join(__dirname,'../../public/js/tutorial.js'),'utf8');
 assert(server.includes("on('setTreasuryMode'"));
 assert(app.includes('id="treasuryMode"'));assert(app.includes('RIOT'));
 const markup=require('../../public/js/components/game-panels').actions({room:{riot:true,roles:g.ROLES},you:{influences:[]},allowedAction:false});
 assert(markup.includes('src="/assets/icons/loot-pouch.svg"'));
 assert(markup.includes('data-action="loot"'));assert(markup.includes('data-action="overthrow"'));
 assert(!markup.includes('data-action="earn"'));assert(!markup.includes('data-action="purge"'));
 assert(require('../../public/js/components/game-panels').actions({room:{status:'playing',turnPlayerId:'p0',mandatoryPurge:true,players:[{id:'p1',alive:true,coins:1}],roles:g.ROLES},you:{id:'p0',alive:true,coins:10,influences:[]}}).includes('forced-purge'));
 const i18n=fs.readFileSync(path.join(__dirname,'../../shared/i18n.js'),'utf8');
 assert(i18n.includes('Loot · General action')); 
 assert(!app.includes('fewer than 3 coins'));
 assert(app.includes('URAMAKU_PANELS.actions('));
 assert(app.includes('state.mandatoryPurge'));assert(markup.includes('riot-overthrow'));
 assert(markup.includes('<b>Overthrow</b>'));
 assert(!app.includes('riot-cost'),'Action card must not print the Riot cost');
 assert(app.includes("(visibility&1)?'Privately revealed':'Hidden'"));assert(require('../tutorial/browser-harness').harness().app.querySelector('[data-player-id="you"]').textContent.includes('Hidden'));
 assert(fs.existsSync(path.join(__dirname,'../../public/assets/icons/loot-pouch.svg')));
}
console.log('Treasury Mode, Riot, wealth victory, coin conservation, mandatory Purge, and UI checks passed.');

// Each original player count uses the requested target, including the exact winning payment.
for (const [offset, target] of [11,12,13,14,14,14,14].entries()) {
 const seats=offset+2;
 for (const gap of [2,1]) {
  const participants=Array.from({length:seats},(_,index)=>player('goal'+index,0,[]));
  const room=g.createGame('GOAL',participants[0]);room.players=participants;room.treasuryMode=true;
  g.startGame(room);
  const actor=room.players[0];
  room.players.forEach(p=>p.coins=0);
  actor.coins=target-gap;
  room.treasuryCoins=room.totalCoins-actor.coins;
  assert(g.performAction(room,actor.id,'earn').ok);
  invariant(room);
  assert.equal(actor.coins,target-gap+1);
  assert.equal(room.status,gap===1?'finished':'playing');
  if(gap===1){assert.equal(room.winner,actor.name);assert.equal(room.winType,'economy');}
 }
}
{
 const room=fixture([2,3,4,4]);
 assert.equal(room.economyWinThreshold,13);
 assert(g.forfeitPlayer(room,'p3').ok);
 assert(g.forfeitPlayer(room,'p2').ok);
 assert.equal(room.economyWinThreshold,13,'Eliminations preserve the goal for the original four-player match');
 invariant(room);
}
console.log('Treasury wealth targets 11/12/13/14 for 2/3/4/5+ players, exact wins and fixed initial player count passed.');
