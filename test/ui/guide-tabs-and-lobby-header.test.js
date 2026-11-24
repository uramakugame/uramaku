'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const i18n=require('../../shared/i18n');const game=require('../../server/game');
const app=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8');
const guide=app.slice(app.indexOf('function showRules(){'),app.indexOf('// On returning from the full-page tutorial'));
for(const lang of ['en','jp']){
 const button=dataset=>({dataset,classList:{toggle(){}},setAttribute(){},focus(){}});
 const tabs=['rules','howto','treasury'].map(tab=>button({tab})),languages=['en','jp'].map(lang=>button({lang}));
 const title={},body={innerHTML:''},close=button({});
 const overlay={innerHTML:'',querySelector(selector){if(selector==='.rules-reference-body')return body;if(selector==='#referenceTitle')return title;if(selector==='#closeRules')return close;return tabs.find(b=>selector===`[data-tab="${b.dataset.tab}"]`);},querySelectorAll(selector){return selector==='[data-lang]'?languages:tabs;},addEventListener(){},remove(){this.removed=true;}};
 const document={getElementById(){return null;},createElement(){return overlay;},body:{appendChild(){}},addEventListener(){},removeEventListener(){}};
 const context={document,referenceLanguage:lang,referenceTab:'rules',state:game.publicState(game.createGame('TEST',{id:'h',name:'Host',coins:0,influences:[]})),i18n,t:key=>i18n.get(key,lang),roleAction:key=>i18n.action(key,lang),esc:value=>String(value),localizeRoom(){},render(){}};
 vm.runInNewContext(guide+'\nshowRules();',context);
 assert(overlay.innerHTML.includes('data-tab="treasury"'));assert(body.innerHTML.includes('rules-table'),'Actions still shows the approved role cards');
 tabs[1].onclick();assert.equal(body.innerHTML,i18n.get('howToHtml',lang));assert(!body.innerHTML.includes('treasury-steps'),'Treasury content is removed from How to Play');
 assert.equal((body.innerHTML.match(/<li>/g)||[]).length,5);
 tabs[2].onclick();assert.equal(body.innerHTML,i18n.get('treasuryModeHtml',lang));assert(body.innerHTML.includes('treasury-steps'));assert.equal((body.innerHTML.match(/<li>/g)||[]).length,5);
 assert.equal(tabs[2].textContent,i18n.get('treasuryGuide',lang));tabs[0].onclick();assert(body.innerHTML.includes('rules-table'));
}
const lobby=app.slice(app.indexOf(" if(state.status==='lobby'){"),app.indexOf(" const lobby='';"));
const header=lobby.slice(lobby.indexOf('class="lobby-intro"'),lobby.indexOf('class="lobby-panels"'));
assert(header.includes('class="lobby-intro-tools"'));assert(header.indexOf('${languageToggleMarkup()}')<header.indexOf('id="exitRoom"'),'Language control is immediately before Leave room');
const tools=lobby.slice(lobby.indexOf('class="lobby-roster-tools"'),lobby.indexOf('class="lobby-roster"'));
assert(!tools.includes('languageToggleMarkup'),'The old roster language control is removed');
assert(lobby.includes('min="5" max="60"'));assert(lobby.includes('state.challengeDurationSeconds??15'));
const css=fs.readFileSync(require.resolve('../../public/css/game.css'),'utf8');assert(css.includes('.lobby-intro-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}'));
for(const lang of ['en','jp'])assert(i18n.get('challengeDurationHint',lang).includes('15'));
console.log('Three guide tabs in EN/JP, Treasury-only content, retained action assets, lobby language/Leave order and 5–60s/15s controls passed.');
