'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'public/js/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/css/game.css'),'utf8');
const game=fs.readFileSync(path.join(root,'shared/game.js'),'utf8');
const renderer=require('../../public/js/components/role-cards');

// The shared renderer must place the share button AFTER the private Intel
// status INSIDE the same caption, not absolutely over the status.
const card=renderer.revealed({role:'swordsman',name:'Swordsman',status:'Private intel',extraHtml:'<button class="private-intel-share-control">Make public</button>'});
assert.match(card,/<small>Private intel<\/small><button class="private-intel-share-control">Make public<\/button><\/div>/);
assert.match(css,/\.private-intel-share-control\{[\s\S]*?position:relative/);
assert(!css.includes('left:3px;right:3px;bottom:3px;z-index:3;font-size:9px'));

// The overlay follows board geometry and uses a high-contrast matte plum-grey surface.
assert(app.includes("document.querySelector('.game-layout .game-players-panel')"));
assert(app.includes('const y=Math.max(48,Math.min(window.innerHeight-48,bounds.top+bounds.height/2));'));
assert.match(css,/background:#363441/);
assert.match(css,/border:2px solid #e6e4ef/);
assert(!css.includes('linear-gradient(125deg,#540e1f'));
assert(!css.includes('.action-announcements{top:auto!important;bottom:'));

// No held-role checkmarks. The gold border continues to identify held actions.
assert(!css.includes('.action.held::after'));
assert(css.includes('game-actions-panel .action.held{'));

// Riot is a true action swap. The board card has only the label, not the cost.
const panels=require('../../public/js/components/game-panels');
const riotActions=panels.actions({room:{riot:true,roles:require('../../shared/roles')},you:{influences:[]},allowedAction:false});
assert(riotActions.includes('data-action="overthrow"'));
assert(riotActions.includes('<b>Overthrow</b>'));
assert(!riotActions.includes('data-action="purge"'));
assert(!riotActions.includes('riot-cost'));
assert(!app.includes('riot-cost'));
assert(game.includes("if (action==='purge' || action==='overthrow')"));
assert(game.includes("Purge is replaced by Overthrow during Riot."));
assert(game.includes("Overthrow is only available during Riot."));
assert(require('../../shared/i18n').get('treasuryModeHtml','jp').includes('下剋上（げこくじょう）'));
assert(require('../../shared/i18n').get('treasuryModeHtml','en').includes('Overthrow (下剋上 / Gekokujō)'));

// Correct names appear in announcements; regular Purge remains normal mode.
const source=app.slice(app.indexOf('function announcementForLog('),app.indexOf('function showActionAnnouncement('));
const sandbox={};vm.runInNewContext(source,sandbox);
assert.equal(sandbox.announcementForLog('Sora uses Overthrow against Akira during Riot (5 coins).'),'Sora uses Overthrow against Akira');
assert.equal(sandbox.announcementForLog('Sora uses Purge against Akira.'),'Sora uses Purge against Akira');
console.log('Center announcements, private Intel control, action badges, and distinct Riot Overthrow regression checks passed.');
