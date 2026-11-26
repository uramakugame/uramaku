'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),panels=require('../../public/js/components/game-panels'),i18n=require('../../shared/i18n'),{harness}=require('../tutorial/browser-harness');
const app=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8'),css=fs.readFileSync(require.resolve('../../public/css/game.css'),'utf8');
for(const lang of ['en','jp']){
 const room={code:'MODE',players:[{alive:true},{alive:false}],treasuryMode:true,riot:false,treasuryCoins:17,totalCoins:24,economyWinThreshold:14};
 let html=panels.matchInfo({room,lang});assert(html.includes(i18n.get('modeStateOrder',lang)));assert(html.includes('17 / 24'));assert(html.includes('14'));assert(!html.includes('Loot active'));
 html=panels.matchInfo({room:{...room,riot:true,treasuryCoins:0},lang});assert(html.includes(i18n.get('modeStateChaos',lang)));assert(html.includes('0 / 24'));
 const classic=panels.matchInfo({room:{...room,treasuryMode:false},lang});assert(!classic.includes('game-board-treasury'));assert(!classic.includes('mode-state'));
 const h=harness(lang);assert(h.app.querySelector('.table-board .table-match-info'));assert(h.app.querySelector('.table-board .game-deck-panel'));assert(!h.app.querySelector('.table-match-info .game-board-treasury'));
 assert.equal(h.app.querySelectorAll('.game-outcome-panel').length,1);assert(h.app.querySelector('[data-player-id="you"]').textContent.includes(lang==='en'?'Hidden':'非公開'));
}
assert(app.includes('URAMAKU_PANELS.board({room:state'));assert(!app.includes('renderBoardEconomy'));assert(!app.includes('economyStatus'));
assert(css.includes('.table-match-info{grid-column:4;grid-row:1'));assert(css.includes('.table-piles{grid-column:4;grid-row:2'));assert(css.includes('grid-template-rows:repeat(8,minmax(32px,1fr))!important'));
assert(i18n.get('treasuryModeHtml','en').includes('Riot Mode has no mandatory Purge.'));assert(i18n.get('treasuryModeHtml','jp').includes('召喚の解決中は略奪できません。'));
assert(require('../../public/js/components/role-cards').hidden().includes('aria-label="Hidden role"'));
console.log('Shared in-board match information, Riot-only state/treasury/wealth, Classic unchanged, equal board/action/log height and bilingual hidden labels passed.');
