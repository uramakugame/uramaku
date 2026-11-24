const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const g=require('../../server/game');
const source=fs.readFileSync(path.join(__dirname,'../../public/js/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../../public/css/game.css'),'utf8');
const player=(id,coins)=>({id,name:id,coins,influences:['lord','assassin'],alive:true,connected:true,ready:true,intrigueVisibility:[0,0],privateInvestigations:{}});
const makeRoom=(coins)=>{const r=g.createGame('AUTO',player('P1',coins[0]));r.players=coins.map((v,i)=>player('P'+(i+1),v));r.status='playing';r.turn=0;r.pending=null;r.log=[];return r;};
// A new turn with 9 coins receives Income and must immediately choose a Purge target.
const room=makeRoom([3,9,1]);g.finishTurn(room,'P1');
assert.equal(room.players[1].coins,10);
assert.equal(room.mandatoryPurge,true);
const first=g.publicState(room);
assert.equal(first.turnNumber,1);
assert.equal(first.mandatoryPurge,true);
assert.equal(g.performAction(room,'P2','tax').ok,false,'Other actions remain server-blocked');
// The turn ID changes every time a new turn begins, even if the same player
// is active again later. The UI can reliably re-open the explanation once per turn.
g.finishTurn(room,'P2');g.finishTurn(room,'P3');g.finishTurn(room,'P1');
assert.equal(g.publicState(room).turnNumber,4);
// Treasury mode never forces Purge.
const treasury=makeRoom([9,2]);treasury.treasuryMode=true;treasury.treasuryCoins=3;treasury.totalCoins=14;treasury.economyWinThreshold=10;
g.finishTurn(treasury,'P1');
assert.equal(treasury.mandatoryPurge,false);
const from=source.indexOf('let targetSelectionAction=null;');
const to=source.indexOf('const ACTION_ANNOUNCEMENT_DURATION',from);
assert(from>=0 && to>from);
const snippet=source.slice(from,to);
function mockUI(s, self){
 const context={state:s,me:self};vm.createContext(context);
 vm.runInContext(snippet,context);
 return {run:()=>vm.runInContext('syncMandatoryPurgeTargeting();',context),
   evaluate:(expr)=>vm.runInContext(expr,context),
   set:(expr)=>vm.runInContext(expr,context)};
}
const ui=mockUI(first,{id:'P2',alive:true});
ui.run();
assert.equal(ui.evaluate('targetSelectionAction'),'purge','Must open Purge targeting automatically');
assert.equal(ui.evaluate('forcedPurgeExplainerOpen'),true);
let popout=ui.evaluate('mandatoryPurgeExplainer()');
assert.match(popout,/Purge was selected automatically/);
assert.match(popout,/Select an opponent/);
assert.match(popout,/10 or more coins after Income/);
// Closing the explanation must not cancel the compulsory target selection.
ui.set('forcedPurgeExplainerOpen=false;');ui.run();
assert.equal(ui.evaluate('targetSelectionAction'),'purge');
assert.equal(ui.evaluate('mandatoryPurgeExplainer()'),'');
// After selecting a target, do not reopen the prompt on a same-state rerender.
ui.set('forcedPurgeTargetSubmitted=true;targetSelectionAction=null;');ui.run();
assert.equal(ui.evaluate('targetSelectionAction'),null);
ui.set('state.turnNumber=4;');ui.run();
assert.equal(ui.evaluate('targetSelectionAction'),'purge','Next forced turn must prompt again');
// A spectator or opponent never gets another player's compulsory target controls.
const opponent=mockUI(first,{id:'P3',alive:true});opponent.run();
assert.equal(opponent.evaluate('targetSelectionAction'),null);
assert.equal(opponent.evaluate('mandatoryPurgeExplainer()'),'');
assert(source.includes("const compulsory=state.mandatoryPurge&&targetSelectionAction==='purge'"));
assert(source.includes("compulsory?'':'<div class=\"row decision-buttons\"><button type=\"button\" class=\"small\" id=\"cancelTargetSelection\">Cancel</button></div>'"),'Mandatory target selection cannot be canceled');
assert(source.includes("send('action',{action,targetId:candidate.id})"),'Targeting still sends the standard Purge action');
assert(css.includes('.forced-purge-explainer{'));
console.log('Automatic mandatory-Purge target selection, explanation, and once-per-turn behavior passed.');
