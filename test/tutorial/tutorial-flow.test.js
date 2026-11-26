'use strict';
const assert=require('node:assert/strict');const {Tutorial,steps}=require('../../shared/tutorial'),game=require('../../server/game');
assert.equal(game,require('../../shared/game'));
const t=new Tutorial();assert.deepEqual(t.room.players.map(p=>p.id),['you','mei','akira','sora']);assert.deepEqual(t.room.players.map(p=>p.coins),[1,1,1,1]);
assert.deepEqual(t.room.players.map(p=>p.influences),[['lord','courtesan'],['assassin','swordsman'],['assassin','magistrate'],['courtesan','magistrate']]);
const states=new Map(),turns=[];let lastTurn=t.room.turnNumber;
function conservation(){const all=[...t.room.deck,...t.room.discard,...t.room.revealedCards.map(c=>c.role),...t.room.players.flatMap(p=>p.influences),...(t.room.pending?.drawnRole?[t.room.pending.drawnRole]:[])];for(const role of Object.keys(game.ROLES))assert.equal(all.filter(r=>r===role).length,3,role);}
while(t.step.input.type!=='end'){
 conservation();states.set(t.step.id,JSON.parse(JSON.stringify(t.view())));const saved=JSON.stringify(t.room),index=t.index;
 assert.equal(t.dispatch({type:'wrong'}).ok,false);assert.equal(t.index,index);assert.equal(JSON.stringify(t.room),saved);
 assert(t.dispatch(t.step.input).ok);if(t.room.turnNumber!==lastTurn){turns.push(t.view().room.turnPlayerId);lastTurn=t.room.turnNumber;}
}
conservation();assert.equal(t.room.status,'finished');assert.equal(t.room.winner,'You');assert.equal(t.round,6);assert.equal(t.room.players[0].coins,2);assert.deepEqual(t.room.players[0].influences,['assassin']);
assert.deepEqual(turns,['you','mei','akira','sora','you','mei','akira','sora','you','mei','sora','you','sora','you','sora','you','sora']);
const coins=id=>states.get(id).you.coins;
for(const [id,n] of [['first-tax',2],['tax-result',4],['summon',5],['hire-guard',5],['guard-challenge',0],['your-extort',1],['sora-enforce',1],['enforce-loss',1],['comeback-summon',2],['first-assassinate',3],['your-earn',1],['sora-final-extort',2]])assert.equal(coins(id),n,id);
assert.equal(t.room.log.filter(x=>x.includes('takes Earn')).length,3);assert.equal(t.room.revealedCards.filter(x=>x.playerId==='akira').length,2);assert.equal(t.room.revealedCards.filter(x=>x.playerId==='you').length,1);
assert.deepEqual(states.get('gossip-result').you.privateInvestigations.mei,{0:'assassin'});
assert.deepEqual(states.get('double-loss').you.influences,['magistrate','kingpin']);
assert.deepEqual(states.get('sora-loses-courtesan').you.privateInvestigations.sora,{0:'magistrate'});
assert.equal(states.get('hidden-assassin').you.intrigueVisibility[0],0);assert.deepEqual(states.get('bluff-gossip-result').you.privateInvestigations.sora,{0:'courtesan',1:'magistrate'});
assert.equal(states.get('sora-enforce').room.pending.counterRole,'magistrate');assert.equal(states.get('enforce-loss').room.pending.reason,'Enforce');assert.equal(states.get('enforce-loss').room.pending.lossCount||1,1);
assert.deepEqual(states.get('your-earn').you.privateInvestigations.sora||{}, {},'Sora Summon clears the previously known Magistrate');assert.equal(states.get('sora-final-extort').room.pending.action,'extort');
assert(states.get('share-assassin').room.turnPlayerId==='sora','Player shares outside own turn');
assert(states.get('mei-shares').room.sharedInvestigations.some(x=>x.playerId==='mei'));
assert(states.get('sora-purge').room.sharedInvestigations.some(x=>x.playerId==='you'));
assert.equal(states.get('sora-purge').room.players.find(p=>p.id==='sora').coins,0);
assert.equal(states.get('sora-final-extort').room.players.find(p=>p.id==='sora').coins,3);
assert.equal(t.room.revealedCards.find(c=>c.playerId==='sora'&&c.role==='lord').role,'lord');assert.equal(t.room.players.find(p=>p.id==='sora').coins,3,'A failed Extort transfers no coins');
// The warning describes the real engine outcome; Enforce was genuine all along.
const risky=new Tutorial();while(risky.step.id!=='sora-enforce')risky.dispatch(risky.step.input);assert(game.challenge(risky.room,'you').ok);assert.equal(risky.room.players[0].influences.length,0);assert.equal(risky.room.players[0].coins,1);
// Every checkpoint replays exactly: no extra Income, charges, cards or knowledge.
const final=JSON.stringify(t.room);while(t.back()){const index=t.index,copy=new Tutorial();while(copy.index<index)copy.dispatch(copy.step.input);assert.equal(JSON.stringify(t.room),JSON.stringify(copy.room),'Back restores '+t.step.id);}
while(t.step.input.type!=='end')t.dispatch(t.step.input);assert.equal(JSON.stringify(t.room),final);
assert.equal(steps.length,43);
console.log('43-step six-round tutorial: exact coins and all 18 cards, genuine Enforce and double-loss risk, private Summon, final challenged Extort bluff, turn order and complete Back/replay passed.');
