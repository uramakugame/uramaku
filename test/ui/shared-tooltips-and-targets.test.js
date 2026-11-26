'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {harness}=require('../tutorial/browser-harness');
const i18n=require('../../shared/i18n'),roles=require('../../shared/roles');
const panels=require('../../public/js/components/game-panels'),tooltips=require('../../public/js/components/role-tooltips');
const read=file=>fs.readFileSync(require.resolve('../../'+file),'utf8');
const main=read('public/js/app.js'),tutorial=read('public/js/tutorial.js');
const hintSource=main.match(/function roleHint\(role\)\{[\s\S]*?^\}/m)[0];
for(const lang of ['en','jp']){
 for(const revealFactions of [false,true])for(const role of Object.keys(roles)){
  const room={roles,revealFactions};
  const mainHint=vm.runInNewContext(hintSource+`;roleHint('${role}')`,{state:room,referenceLanguage:lang,t:key=>i18n.get(key,lang)});
  const tutorialHint=panels.roleHint(room,role,lang);assert.equal(mainHint,tutorialHint,'Both pages supply identical tooltip metadata');
  const html=tooltips.content({raw:mainHint,lang,revealFactions});
  assert(html.includes('tooltip-heading'));assert(html.includes('tooltip-ability-name'));assert(html.includes('tooltip-description'));assert.equal(html.includes('tooltip-faction'),revealFactions);
  if(role==='magistrate')assert(html.includes(i18n.roleEffect(role,'counter',lang)),'Enforce displays the new 2-coin text');
 }
 const h=harness(lang);h.click('#startTutorial');
 assert.equal(h.document.body.querySelectorAll('.role-quick-tooltip').length,1);
 assert.equal(h.window.URAMAKU_TOOLTIPS.install({document:h.document,window:h.window}),h.value('roleTooltips'),'Repeated installation uses one tooltip and event lifecycle');
 const card=h.app.querySelector('[data-action="summon"]');h.dispatchDocument('pointerover',{target:card});
 const tip=h.document.body.querySelector('.role-quick-tooltip');assert.equal(tip.hidden,false);assert(tip.innerHTML.includes('tooltip-ability-name'));assert(tip.innerHTML.includes(i18n.roleEffect('magistrate','counter',lang)));
 h.dispatchDocument('keydown',{key:'Escape'});assert.equal(tip.hidden,true);
 h.dispatchDocument('focusin',{target:card});assert.equal(tip.hidden,false);
 h.setLanguage(h.document.documentElement.lang==='ja'?'en':'jp');assert.equal(tip.hidden,true,'Rerender hides stale hover text');h.setLanguage(h.document.documentElement.lang==='ja'?'en':'jp');
 while(h.value('tutorial.step.id')!=='your-extort')h.value('handle(tutorial.step.input)');
 h.click('[data-action="extort"]');
 const targets=h.app.querySelectorAll('.selectable-target[data-player-id]');assert.equal(targets.length,1);assert.equal(targets[0].dataset.playerId,'sora');assert.equal(targets[0].getAttribute('tabindex'),'0');
 assert(h.app.querySelector('.t-feedback').textContent.includes(lang==='jp'?'ソラ':'Sora'),'Target instruction names Sora');
 const before=h.state();h.click('[data-player-id="mei"]');h.click('[data-player-id="akira"]');assert.deepEqual(h.state(),before,'Other opponents cannot advance the lesson');
 h.click('[data-player-id="sora"]');assert.equal(h.value('tutorial.step.id'),'sora-enforce');
}
const css=read('public/css/source/06-lobby-and-interactions.css');
assert(css.includes('.player:not(.active-player):not(.selectable-target){outline:none!important'),'Inactive-seat reset excludes selectable targets');
assert(css.includes('.player.me:not(.selectable-target)'),'Own-seat reset also preserves eligible target appearance');
const base=css.match(/\.game-shell \.game-layout \.game-players-panel \.player\.selectable-target\{([^}]+)\}/)[1];
assert(base.includes('background:#fff0c9!important'));assert(base.includes('outline:3px solid #b17624!important'));assert(base.includes('box-shadow:inset'));
assert(!read('public/css/tutorial.css').includes('.role-quick-tooltip'),'No tutorial tooltip style fork');
for(const page of ['public/index.html','public/tutorial.html'])assert(read(page).includes('/js/components/role-tooltips.js'));
assert(main.includes('URAMAKU_TOOLTIPS.install')&&tutorial.includes('URAMAKU_TOOLTIPS.install'));
const unsafe=tooltips.content({raw:'<script>alert(1)</script>\nAction — <img onerror=x>: <svg onload=x>',unavailableReason:'<img onerror=y>'});assert(!unsafe.includes('<script>'));assert(!unsafe.includes('<img '));assert(!unsafe.includes('<svg '));assert(unsafe.includes('&lt;'));
assert(tooltips.content({raw:i18n.get('hintEarn','en')}).includes('Take 1 coin from the treasury. Cannot be challenged.'));
console.log('Shared tooltip parity for six roles and EN/JP, one hover/focus lifecycle, escaping, no tutorial style fork, named Sora target and visible pre-hover gold styling passed.');
