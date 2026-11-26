'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const web=path.join(root,'public');
const i18n=require('../../shared/i18n');
const roles=require('../../shared/roles');
const art=require('../../public/js/config/action-assets');
const main=fs.readFileSync(path.join(web,'js/app.js'),'utf8');
const tutorial=fs.readFileSync(path.join(web,'js/tutorial.js'),'utf8');
const html=fs.readFileSync(path.join(web,'tutorial.html'),'utf8');
const css=fs.readFileSync(path.join(web,'css/game.css'),'utf8');
const styles=fs.readFileSync(path.join(web,'css/source/03-game-components.css'),'utf8');

// Any editable label, role name, ability description or rule section has BOTH locales.
for(const [category,group] of Object.entries(i18n.STRINGS)){
 for(const [id,copy] of Object.entries(group)){
  assert.equal(typeof copy.en,'string',`${category}.${id} English translation missing`);
  assert.equal(typeof copy.jp,'string',`${category}.${id} Japanese translation missing`);
  assert(copy.en.length&&copy.jp.length,`${category}.${id} has an empty translation`);
 }
}
assert.equal(Object.keys(roles).length,6);
for(const [id,definition] of Object.entries(roles)){
 assert.equal(definition.name,i18n.role(id,'en'));
 assert.equal(definition.jp,i18n.role(id,'jp'));
 assert(fs.existsSync(path.join(web,'assets/portraits',`${id}.jpg`)),`Missing shared character portrait for ${id}`);
 for(const [en,jp] of [[definition.action,definition.actionJp],[definition.counter,definition.counterJp]]){
  if(en==='—')continue;
  const entry=Object.values(i18n.STRINGS.actions).find(c=>c.en===en);
  assert(entry,`Missing action/counter glossary term ${en}`);
  assert.equal(entry.jp,jp,`Translation drift in ${en}`);
 }
 assert.equal(definition.effect,i18n.roleEffect(id,'action','en'));
 assert.equal(definition.effectJp,i18n.roleEffect(id,'action','jp'));
 if(definition.counter!=='—'){
  assert.equal(definition.counterEffect,i18n.roleEffect(id,'counter','en'));
  assert.equal(definition.counterEffectJp,i18n.roleEffect(id,'counter','jp'));
 }
}
assert.equal(roles.swordsman.name,'Swordsman');
assert.equal(roles.swordsman.jp,'用心棒');
assert.equal(roles.swordsman.counter,'Hire Guard');
assert.equal(roles.swordsman.counterJp,'護衛を雇う');
assert.equal(i18n.action('overthrow','en'),'Overthrow');
assert.equal(i18n.action('overthrow','jp'),'下剋上');
for(const [id,src] of Object.entries(art)){
 assert(src.startsWith('/'),`Action art is not an app asset: ${id}`);
 assert(fs.existsSync(path.join(web,src.slice(1))),`Missing action illustration ${src}`);
}
assert(tutorial.includes('URAMAKU_ROLE_CARDS.revealed'));
assert(tutorial.includes('URAMAKU_ROLE_CARDS.hidden'));
assert(tutorial.includes('t-shell factions-off'));
assert(html.indexOf('/shared/i18n.js')<html.indexOf('/shared/roles.js'),'Localized metadata must load after its glossary');
assert(main.includes('languageToggleMarkup()}${window.URAMAKU_PLAYER_REACTIONS.controls({room:state,you:me,lang:referenceLanguage})}<button id="chatToggle"'), 'React must be immediately left of Chat, after the language toggle');
assert(main.includes('i18n.get(\'howToHtml\',referenceLanguage)'));
assert(tutorial.includes('URAMAKU_TUTORIAL'));
for(const step of require('../../shared/tutorial').steps){
 for(const lang of ['en','jp']){
  assert(step.title[lang]&&step.text[lang],`Missing ${lang} tutorial copy in ${step.id}`);
  assert(!step.text[lang].includes('undefined'));
 }
}
assert(html.indexOf('/shared/game.js')<html.indexOf('/shared/tutorial.js'));
assert(html.indexOf('/shared/tutorial.js')<html.indexOf('/js/tutorial.js'));
assert(!i18n.get('howToHtml','en').includes('undefined'));
assert(i18n.get('treasuryModeHtml','en').includes('Basic actions (Chaos)'));
assert(i18n.get('treasuryModeHtml','jp').includes('基本アクション（混乱中）'));
assert(!main.slice(main.indexOf('function showRules(){')).includes('When the treasury is empty, <strong>Riot</strong>'),'How to play text should come from dictionary');
assert(!i18n.get('basicNote','en').toLowerCase().includes('treasury'));
assert(!i18n.get('basicNote','jp').includes('宝庫'));
assert(/height:min\(930px, calc\(100dvh - 12px\)\)/.test(styles),'Guide should retain fixed height between views');
assert(css.includes('background:#363441'));
assert(css.includes('border:2px solid #e6e4ef'));
assert(css.includes('animation:action-enter .40s'));
assert(css.includes('animation:action-leave .54s'));
assert.equal(i18n.get('tutorialProgress','jp',{percent:50}),'50% 完了');
console.log('Bilingual glossary, role/action name parity, shared art, tutorial, guide, Riot and matte announcement consistency passed.');
