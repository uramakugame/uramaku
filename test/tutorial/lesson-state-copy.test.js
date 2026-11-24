'use strict';
const assert=require('node:assert/strict'),{Tutorial,steps}=require('../../shared/tutorial'),{harness}=require('./browser-harness'),i18n=require('../../shared/i18n');
const t=new Tutorial(),views=new Map();while(true){views.set(t.step.id,t.view());if(t.step.input.type==='end')break;t.dispatch(t.step.input);}
const balance=(id,seat)=>views.get(id).room.players.find(p=>p.id===seat).coins;
// Statements about paid actions and current turns must describe the displayed state.
assert.equal(balance('opening-proof','you'),4);assert.equal(views.get('opening-proof').room.challengeLosses[0].loserId,'mei');assert.equal(balance('tax-result','you'),4);assert.equal(views.get('tax-result').room.turnPlayerId,'mei');
assert.equal(balance('mei-earn','mei'),1);assert.equal(views.get('mei-earn').room.turnPlayerId,'mei');assert.equal(balance('share-assassin','mei'),2);assert.equal(balance('share-assassin','sora'),7);
assert.equal(views.get('guard-challenge').room.pending.kind,'counterClaim');assert.equal(balance('guard-challenge','you'),0);assert.equal(views.get('double-loss').room.players.find(p=>p.id==='akira').alive,false);
assert.equal(balance('sora-final-tax','sora'),5);assert.equal(views.get('sora-final-tax').room.pending.kind,'claim');assert.equal(balance('final-assassinate','sora'),7);assert.equal(views.get('victory').room.status,'finished');
assert(steps.find(s=>s.id==='opening-proof').text.en.includes('already paid 2 coins'));assert(steps.find(s=>s.id==='guard-challenge').text.en.includes('Continue to see how Akira responds'));assert(steps.find(s=>s.id==='sora-final-tax').text.en.includes('Tax will bring Sora to 7 coins'));
assert.equal(steps.length,47);assert.equal(steps[17].id,'replace-courtesan');assert.equal(steps[35].id,'replace-magistrate');assert(!steps.some(s=>['keep-swordsman','keep-assassin'].includes(s.id)));
for(const lang of ['en','jp'])for(const [id,index,role,old] of [['replace-courtesan',1,'swordsman','courtesan'],['replace-magistrate',0,'assassin','magistrate']]){
 const h=harness(lang);h.value(`while(tutorial.step.id!=='${id}')handle(tutorial.step.input)`);const before=h.state();assert.equal(before.you.summonDrawnRole,role);assert.equal(before.you.influences[index],old);
 assert(!h.app.querySelector('#continueLesson'),'A card-selection instruction immediately offers the card choice');assert(h.app.querySelector(`[data-summon-replace="${index}"]`).classList.contains('tutorial-highlight'));assert.equal(h.app.querySelector('.action-flow [data-summon-choice="discard"]').disabled,true);
 h.click(`[data-summon-replace="${index}"]`);assert.equal(h.state().you.influences[index],role);assert.equal(h.state().you.summonDrawnRole,null);assert.equal(h.state().you.intrigueVisibility[index],0);assert.equal(h.state().room.turnNumber,before.room.turnNumber+1);
 h.click('#backStep');assert.deepEqual(h.state(),before,'Back returns directly to the same actionable replacement');
}
for(const step of steps){assert(!/\bliving\b/i.test(step.title.en+' '+step.text.en));assert(!step.text.jp.includes('刺客'),'Japanese role copy matches the displayed くノ一 name');}
for(const key of ['targetNotEliminated','shareRequiresInfluence'])assert.equal(i18n.translate(i18n.get(key,'en'),'jp'),i18n.get(key,'jp'));
console.log('47 lessons: merged Summon choices are actionable immediately; copy matches actual Income/payments, counter windows, turn changes, EN/JP names and Back replay.');
