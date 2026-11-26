'use strict';
const assert=require('node:assert/strict');
const panels=require('../../public/js/components/game-panels');
const game=require('../../server/game');
const i18n=require('../../shared/i18n');
const {harness}=require('../tutorial/browser-harness');
function fixture(){
 const player=(id,influences,coins)=>({id,name:id,alive:true,ready:true,coins,influences,intrigueVisibility:influences.map(()=>0),privateInvestigations:{}});
 const you=player('you',['lord','magistrate'],8),mei=player('mei',['assassin','kingpin'],8);
 const room=game.createGame('PANELS',you);Object.assign(room,{players:[you,mei],status:'playing',deck:['swordsman','courtesan'],turn:0});
 return{room,you,mei};
}
function actionTag(markup,action){return markup.match(new RegExp(`<button[^>]+data-action="${action}"[^>]*>`))?.[0]||'';}
for(const lang of ['en','jp']){
 const {room}=fixture(),snapshot=game.publicState(room),you=game.privateState(room,'you');
 const html=panels.actions({room:snapshot,you,lang});
 assert.equal((html.match(/data-action=/g)||[]).length,8);
 for(const action of ['earn','tax','intrigue','hireBlade','assassinate','summon','extort','purge'])assert(!actionTag(html,action).includes('disabled'),action+' initially available');
 assert(html.includes('class="action held" data-action="tax"'));
 assert(html.includes('class="action bluff" data-action="extort"'));
 for(const [action,key] of [['earn','hintEarn'],['purge','hintPurge']])assert(html.includes(`data-tooltip="${i18n.get(key,lang)}"`));
 assert(!html.includes('Available during your turn.'));
 const poor=panels.actions({room:snapshot,you:{...you,coins:2},lang});
 for(const action of ['hireBlade','assassinate','purge'])assert(actionTag(poor,action).includes('disabled'));
 assert(!actionTag(poor,'tax').includes('disabled'));
 const forced=panels.actions({room:{...snapshot,mandatoryPurge:true},you:{...you,coins:10},lang});
 for(const action of ['earn','tax','intrigue','hireBlade','assassinate','summon','extort'])assert(actionTag(forced,action).includes('disabled'));
 assert(!actionTag(forced,'purge').includes('disabled'));
 const guided=panels.actions({room:snapshot,you,lang,allowedAction:'tax'});
 for(const action of ['earn','intrigue','hireBlade','assassinate','summon','extort','purge'])assert(actionTag(guided,action).includes('disabled'));
 assert(!actionTag(guided,'tax').includes('disabled'));
 const riot=panels.actions({room:{...snapshot,riot:true},you,lang});
 assert(actionTag(riot,'loot'));assert(actionTag(riot,'overthrow'));assert(!actionTag(riot,'earn'));assert(!actionTag(riot,'purge'));assert(actionTag(riot,'tax').includes('disabled'));
 assert(panels.actions({room:{...snapshot,riot:true,pending:{kind:'summon',stage:'preview'}},you,lang}).match(/data-action="loot"[^>]+disabled/));
 assert(panels.roleHint(snapshot,'kingpin',lang).includes(i18n.roleEffect('kingpin','action',lang)));
 assert(!panels.challenge({room:{...snapshot,pending:{kind:'claim',role:'lord',action:'tax',claimantId:'mei'}},you,lang}).includes('challenge-risk'));
 for(const [action,role] of [['assassinate','assassin'],['hireBlade','swordsman']]){
  const risk=panels.challenge({room:{...snapshot,pending:{kind:'claim',role,action,claimantId:'mei',targetId:'you'}},you,lang});
  assert(!risk.includes('challenge-risk'));assert(!risk.includes('both influences'));assert(!risk.includes('影響力を2枚とも'));
 }
 const counter=panels.counter({room:{...snapshot,pending:{kind:'counterOffer',options:['swordsman','assassin']}},you,lang});
 assert(counter.includes('data-counter="swordsman"'));assert(counter.includes('data-counter="assassin"'));assert(counter.includes('data-decline'));assert(!counter.includes('counter-cost'));assert(!counter.includes(i18n.get('actionCoinCost',lang,{count:5})),'Hire Guard button shows only its claim label');assert(counter.includes(i18n.get('claimCounter',lang,{role:i18n.role('swordsman',lang),counter:lang==='jp'?snapshot.roles.swordsman.counterJp:snapshot.roles.swordsman.counter})));
 const info=panels.information({you:{coins:1,informationChoice:{unknownIndices:[0,1]}},lang});
 assert(info.match(/data-counter="concealAll" disabled/));assert(info.includes('data-counter="keepOne"'));assert(info.includes('data-counter="revealAll"'));
 assert(!panels.information({you:{coins:1,informationChoice:{unknownIndices:[0]}},lang}).includes('concealAll'));
}
{
 const {room}=fixture();assert(game.performAction(room,'you','summon').ok);assert(game.passChallenge(room,'mei').ok);
 const snapshot=game.publicState(room),you=game.privateState(room,'you');
 for(const lang of ['en','jp']){
  const preview=panels.summon({room:snapshot,you,lang});
  assert(preview.includes('data-summon-controls'));assert(!preview.includes('portrait-courtesan'),'Choices contain no duplicate preview');const deck=panels.deck({room:snapshot,you,lang});assert(deck.includes('id="summonTray"'));assert(deck.includes('portrait-courtesan'));assert(!deck.includes('data-summon-choice'));assert(!preview.includes('data-summon-choice="keep"'));assert(!preview.includes('<dialog'));assert(preview.includes('data-summon-choice="discard"'));
  assert.equal(panels.summon({room:snapshot,you:game.privateState(room,'mei'),lang}),'','Other players must not receive the drawn card');
 }

}
assert.equal(game.createGame('DEFAULT',{id:'host',name:'Host'}).challengeDurationSeconds,15);
assert(!Object.values(i18n.STRINGS).some(dict=>dict.challengeDoubleRisk));
assert.equal(game.ROLES.kingpin.effect,'Take 2 coins from a player.');
// Re-rendering and language changes must leave the controller's actual room unchanged.
const h=harness();h.click('#startTutorial');
while(h.value('tutorial.step.input.type')!=='end'){
 const before=h.state();h.setLanguage(h.document.documentElement.lang==='ja'?'en':'jp');h.setLanguage(h.document.documentElement.lang==='ja'?'en':'jp');assert.deepEqual(h.state(),before);
 h.value('handle(tutorial.step.input)');
}
console.log('Shared panels: bilingual availability, exact tooltips, requirement gating, Riot swaps, shortened warnings, counters, private Summon, 15s default and pure language changes passed.');
