const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../../public/js/app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../../public/css/game.css'),'utf8');
const tutorial=fs.readFileSync(path.join(__dirname,'../../public/js/tutorial.js'),'utf8');
// Treasury is only in the player board header, not in the Current Turn status.
assert(app.includes('class="game-board-header ${state.treasuryMode?\'has-treasury\':\'\'}"'));
assert(app.includes('${renderBoardEconomy()}<div class="row game-board-controls">'));
assert(!app.includes('economyStatus'),'Treasury must not be displayed in Current Turn');
const begin=app.indexOf('function renderBoardEconomy(){');
const end=app.indexOf('function openEntryDialog(mode)',begin);
assert(begin>=0&&end>begin);
const ctx={state:null};vm.createContext(ctx);
vm.runInContext(app.slice(begin,end),ctx);
ctx.state={treasuryMode:false,riot:false,treasuryCoins:null,totalCoins:null,economyWinThreshold:null};
assert.equal(vm.runInContext('renderBoardEconomy()',ctx),'');
ctx.state={treasuryMode:true,riot:false,treasuryCoins:17,totalCoins:28,economyWinThreshold:13};
let board=vm.runInContext('renderBoardEconomy()',ctx);
assert.match(board,/Treasury<\/strong> 17 \/ 28 coins/);
assert.match(board,/Wealth victory: <strong>13 coins<\/strong>/);
assert.doesNotMatch(board,/Loot active|Purge 5/);
ctx.state.riot=true;ctx.state.treasuryCoins=0;
board=vm.runInContext('renderBoardEconomy()',ctx);
assert.match(board,/RIOT · Treasury/);
assert.match(board,/0 \/ 28 coins/);
assert.doesNotMatch(board,/Loot active|Purge 5/);
// The board header places the treasury between its title and chat, even on
// narrow displays. The first and last grid columns are equally wide.
assert(css.includes('grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)'));
assert(css.includes('.game-board-header.has-treasury'));
assert(css.includes('grid-column:1/-1;grid-row:2'));
assert(css.includes('grid-template-rows:repeat(8,minmax(32px,1fr))!important'));
assert(css.includes('grid-template-rows:repeat(2,minmax(clamp(135px,calc(21cqw + 23px),340px),max-content))'));
assert(css.includes('min-width:0!important'),'Player board must be allowed to shrink');
assert(css.includes('flex-direction:column!important;flex-wrap:nowrap!important'));
// Labels belong to your OWN hidden roles; visual card backs stay textless.
assert(app.includes("(visibility&1)?'Privately revealed':'Hidden'"));
assert(!app.includes('<small>Hidden</small>'));
assert(!tutorial.includes('<small>Hidden</small>'));
assert(require('../tutorial/browser-harness').harness().app.querySelector('[data-player-id="you"]').textContent.includes('Hidden'));
assert(require('../../public/js/components/role-cards').hidden().includes('aria-label="Hidden role"'),'Hidden card should still be accessible');
// Rules need to explain Riot actions and fixed supply for both languages.
assert(require('../../shared/i18n').get('treasuryModeHtml','en').includes('Treasury Mode has no mandatory Purge.'));
assert(require('../../shared/i18n').get('treasuryModeHtml','jp').includes('召喚の解決中は略奪できません。')); 
console.log('Treasury board header, equal-height actions, Riot rules, and own-versus-opponent Hidden text passed.');
