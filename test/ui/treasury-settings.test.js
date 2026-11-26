'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),i18n=require('../../shared/i18n'),{harness}=require('../tutorial/browser-harness');
const app=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8');
const source=app.slice(app.indexOf('function treasurySettingsMarkup('),app.indexOf('function kickEligible('));
for(const lang of ['en','jp'])for(const supply of [5,6,7])for(const owner of [false,true]){
 const h=harness(lang),sent=[],state={treasuryMode:true,treasuryCoinsPerPlayer:supply,players:[{},{}]},ctx={state,t:(key,params)=>i18n.get(key,lang,params),esc:String,send:(...data)=>sent.push(data),document:h.document};vm.createContext(ctx);vm.runInContext(source,ctx);
 h.app.innerHTML=ctx.treasurySettingsMarkup(owner);const select=h.app.querySelector('#treasuryCoinsPerPlayer');assert(select);assert.equal(select.disabled,!owner);assert.deepEqual(select.querySelectorAll('option').map(o=>o.getAttribute('value')),['5','6','7']);assert.equal(select.querySelector('[selected]').getAttribute('value'),String(supply));assert(h.app.innerHTML.includes(i18n.get('treasurySupplyLabel',lang)));

 if(owner){vm.runInContext(app.split('\n').find(line=>line.includes("getElementById('treasuryCoinsPerPlayer')?.addEventListener")),ctx);select.listeners.change[0]({target:{value:'7'}});assert.deepEqual(JSON.parse(JSON.stringify(sent)),[['setTreasuryMode',{coinsPerPlayer:7}]]);}
 state.treasuryMode=false;assert.equal(ctx.treasurySettingsMarkup(owner),'');
 assert(i18n.get('challengeDurationHint',lang).includes(lang==='jp'?'10〜60':'10–60'));assert.equal(i18n.translate('Treasury coin supply must be 5, 6 or 7 coins per player.',lang),i18n.get('treasurySupplyInvalid',lang));
 assert(i18n.get('treasuryModeHtml',lang).includes(lang==='jp'?'初期値6':'default 6'));
}
console.log('Bilingual Treasury selector: exact options, saved selection, owner-only disabled state, numeric socket command, hidden when off, matching 10–60s guide copy passed.');
