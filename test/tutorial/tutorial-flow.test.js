'use strict';
const assert=require('node:assert/strict');const {Tutorial,steps}=require('../../shared/tutorial'),game=require('../../server/game');
assert.equal(game,require('../../shared/game'));
const t=new Tutorial();assert.deepEqual(t.room.players.map(p=>p.id),['you','mei','akira','sora']);assert.deepEqual(t.room.players.map(p=>p.coins),[1,1,1,1]);
assert.deepEqual(t.room.players.map(p=>p.influences),[['lord','courtesan'],['assassin','swordsman'],['assassin','magistrate'],['courtesan','kingpin']]);
const states=new Map(),turns=[];let lastTurn=t.room.turnNumber;
function conservation(){const all=[...t.room.deck,...t.room.discard,...t.room.revealedCards.map(c=>c.role),...t.room.players.flatMap(p=>p.influences),...(t.room.pending?.drawnRole?[t.room.pending.drawnRole]:[])];for(const role of Object.keys(game.ROLES))assert.equal(all.filter(r=>r===role).length,3,role);}
while(t.step.input.type!=='end'){
 conservation();states.set(t.step.id,JSON.parse(JSON.stringify(t.view())));const saved=JSON.stringify(t.room),index=t.index;
 assert.equal(t.dispatch({type:'wrong'}).ok,false);assert.equal(t.index,index);assert.equal(JSON.stringify(t.room),saved);
 assert(t.dispatch(t.step.input).ok);if(t.room.turnNumber!==lastTurn){turns.push(t.view().room.turnPlayerId);lastTurn=t.room.turnNumber;}
}
conservation();assert.equal(t.room.status,'finished');assert.equal(t.room.winner,'You');assert.equal(t.round,7);assert.equal(t.room.players[0].coins,0);assert.deepEqual(t.room.players[0].influences,['assassin']);
assert.deepEqual(turns,['you','mei','akira','sora','you','mei','akira','sora','you','mei','sora','you','sora','you','sora','you','sora','you']);
const coins=id=>states.get(id).you.coins;
for(const [id,n] of [['first-tax',2],['tax-result',4],['summon',5],['hire-guard',5],['guard-challenge',0],['your-extort',1],['comeback-summon',2],['first-assassinate',3],['your-earn',1],['final-assassinate',3]])assert.equal(coins(id),n,id);
assert.equal(t.room.log.filter(x=>x.includes('takes Earn')).length,3);assert.equal(t.room.revealedCards.filter(x=>x.playerId==='akira').length,2);assert.equal(t.room.revealedCards.filter(x=>x.playerId==='you').length,1);
assert.deepEqual(states.get('gossip-result').you.privateInvestigations.mei,{0:'assassin'});
assert.deepEqual(states.get('double-loss').you.influences,['magistrate','kingpin']);
assert.deepEqual(states.get('sora-loses-courtesan').you.privateInvestigations.sora,{0:'lord'});
assert.equal(states.get('hidden-assassin').you.intrigueVisibility[0],0);assert.deepEqual(states.get('bluff-gossip-result').you.privateInvestigations.sora,{0:'courtesan',1:'lord'});
assert(states.get('share-assassin').room.turnPlayerId==='sora','Player shares outside own turn');
assert(states.get('mei-shares').room.sharedInvestigations.some(x=>x.playerId==='mei'));
assert(states.get('sora-purge').room.sharedInvestigations.some(x=>x.playerId==='you'));
assert.equal(states.get('sora-purge').room.players.find(p=>p.id==='sora').coins,0);
assert.equal(states.get('final-assassinate').room.players.find(p=>p.id==='sora').coins,7);
// Every checkpoint replays exactly: no extra Income, charges, cards or knowledge.
const final=JSON.stringify(t.room);while(t.back()){const index=t.index,copy=new Tutorial();while(copy.index<index)copy.dispatch(copy.step.input);assert.equal(JSON.stringify(t.room),JSON.stringify(copy.room),'Back restores '+t.step.id);}
while(t.step.input.type!=='end')t.dispatch(t.step.input);assert.equal(JSON.stringify(t.room),final);
assert.equal(steps.length,47);
console.log('47-step seven-round tutorial: fixed seats, all 18 cards, exact coins, private/public sharing, legal bluffs, challenge loss, double Hire Guard, comeback and complete Back/replay passed.');
