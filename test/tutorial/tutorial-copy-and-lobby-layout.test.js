'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');const {steps}=require('../../shared/tutorial'),i18n=require('../../shared/i18n');
for(const step of steps){for(const lang of ['en','jp']){assert(step.title[lang]?.length,step.id+' title '+lang);assert(step.text[lang]?.length,step.id+' body '+lang);assert(!step.text[lang].includes('undefined'));}}
assert.equal(i18n.roleEffect('kingpin','action','en'),'Take 2 coins from a player.');
assert(!Object.values(i18n.STRINGS).some(dict=>dict.challengeDoubleRisk),'Double-loss coaching is removed from challenge prompts');
assert(!Object.values(i18n.STRINGS).some(dict=>dict.challengeRisk),'Generic challenge coaching is removed');
assert(steps.find(s=>s.id==='double-loss').text.en.includes('another to Hire Guard'));
assert(steps.find(s=>s.id==='bluff-gossip').text.jp.includes('ブラフ'));
const app=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8');assert(app.includes('class="lobby-entry-buttons"'));assert(app.includes('class="lobby-roster-tools"'));
console.log('Complete EN/JP scenario, approved Extort wording, shortened warnings and lobby structure passed.');
