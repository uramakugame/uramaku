'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const i18n=require('../../shared/i18n');
const roles=require('../../shared/roles');
const app=fs.readFileSync(path.join(__dirname,'../../public/js/app.js'),'utf8');
const styles=fs.readFileSync(path.join(__dirname,'../../public/css/game.css'),'utf8');
const names={lord:['Tax','Authority'],courtesan:['Intrigue','Gossip'],swordsman:['Hire Blade','Hire Guard'],assassin:['Assassinate','False Trail'],magistrate:['Summon','Enforce'],kingpin:['Extort','Intimidate']};
const wanted={
 lord:['Collect 2 coins from the treasury.','Block Intrigue.'],
 courtesan:["Target privately reveals remaining influences or pays you 1 coin per influence.",'Counter Intrigue; Both players privately reveal remaining influences.'],
 swordsman:["Pay 5 coins; Target loses an influence.",'Pay 5 coins; Counter Assassinate; Target loses an influence.'],
 assassin:["Pay 3 coins; Target loses an influence.",'Block Assassinate.'],
 magistrate:['Draw 1 influence; Discard 1 influence.','Counter Extort; Target must pay you 2 coins or lose an influence.'],
 kingpin:['Take 2 coins from a player.','Block Extort.'],
};
for(const [id,[action,counter]] of Object.entries(wanted)){
 assert.equal(roles[id].action,names[id][0],`${id} printed action name`);
 assert.equal(roles[id].counter,names[id][1],`${id} printed counter name`);
 assert.equal(roles[id].effect,action,`${id} English action copy`);
 assert.equal(roles[id].counterEffect,counter,`${id} English counter copy`);
}
assert.equal(i18n.get('incomeRule','en'),'Take 1 coin from treasury at the beginning of your turn.');
assert.equal(i18n.get('earnRule','en'),'Take 1 coin from treasury.');
assert.equal(i18n.get('purgeRule','en'),"Pay 7 coins to treasury to eliminate a player's influence.");
assert.equal(i18n.get('basicNoChallenge','en'),'Basic actions cannot be challenged.');
assert.equal(i18n.get('basicNote','en'),'Purge is mandatory if player holds 10+ coins at beginning of turn.');
assert(app.includes("['role','faction','action','effect','counter','effect']"),'Keep existing counter/effect columns');
assert(app.includes("i18n.roleEffect(key,'counter',referenceLanguage,{boldRoles:true})"),'Guide must emphasize dynamic role names');
const oldName=i18n.STRINGS.roles.kingpin.en;
try{
 i18n.STRINGS.roles.kingpin.en='Boss';
 const rich=i18n.roleEffect('magistrate','counter','en',{boldRoles:true});
 assert.equal(rich,wanted.magistrate[1],'Printed text is preserved when role names change');
}finally{i18n.STRINGS.roles.kingpin.en=oldName;}
assert(app.includes('${mandatoryPurgeExplainer()}<div class="players">${players}</div>'),'Notice must be inside player board');
assert(!app.includes('${mandatoryPurgeExplainer()}${content}'),'Notice must not float on overall app shell');
assert(styles.includes('.game-layout .game-players-panel .forced-purge-explainer{'));
assert(styles.includes('left:50%;right:auto;'));
assert(styles.includes('border:2px solid #9d4934;border-radius:8px;'));
assert(!styles.includes('border-left:5px solid #a22f27'));
console.log('Printed card names and descriptions, existing guide columns, and centered mandatory-Purge notice passed.');

const generalTooltips={
 hintEarn:'Take 1 coin from the treasury. Cannot be challenged.',
 hintPurge:'Pay 7 coins; Target loses an influence. Cannot be challenged.',
 hintLoot:'Take 1 coin from a player. Cannot be challenged.',
 hintOverthrow:'Pay 5 coins; Target loses an influence. Cannot be challenged.'
};
for(const [key,description] of Object.entries(generalTooltips)){
 assert.equal(i18n.get(key,'en').split('\n').slice(1).join(' '),description);
 assert(i18n.get(key,'jp').includes('チャレンジ不可。'));
}
console.log('All four general-action tooltip descriptions match the requested text exactly.');
