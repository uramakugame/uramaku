'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const tutorial=read('public/js/tutorial.js');
const game=read('public/js/app.js');
const server=read('shared/game.js');
const panels=require('../../public/js/components/game-panels');
const i18n=require('../../shared/i18n');
const roles=require('../../shared/roles');
assert.equal(i18n.action('hireBlade','en'),'Hire Blade');
assert.equal(i18n.action('hireBlade','jp'),'刺客を雇う');
assert.equal(roles.swordsman.action,'Hire Blade');
const tooltipSource=read('public/js/components/role-tooltips.js');
assert.equal(tooltipSource.match(/className='role-quick-tooltip'/g)?.length,1,'One shared tooltip element');
assert(tutorial.includes('URAMAKU_TOOLTIPS.install')&&game.includes('URAMAKU_TOOLTIPS.install'),'Both views install the shared tooltip');
assert(!tutorial.includes('tip.textContent'),'No plain-text tutorial tooltip renderer');
assert(tooltipSource.includes('tooltip-ability-name'),'Shared semantic ability styling');
assert(panels.actions({room:{roles},you:{influences:[]},allowedAction:false}).includes('<b>Hire Blade</b>'),'Shared action label derives from glossary');
assert(server.includes('ROLES.swordsman.action'),'Server hireBlade name derives from shared metadata');
for(const file of ['public/js/app.js','server/game.js','shared/i18n.js','public/js/tutorial.js']){
 assert(!read(file).includes(['Flash','Draw'].join(' ')),file+' has an old label');
}
console.log('Hire Blade display naming and single original tutorial tooltip verified.');
