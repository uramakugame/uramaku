'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const rolesRoot=path.join(__dirname,'../../public/assets/portraits');
const catalog=require('../../public/js/config/action-assets.js');
const roleCards=require('../../public/js/components/role-cards.js');
const manifest=JSON.parse(fs.readFileSync(path.join(rolesRoot,'artwork-manifest.json'),'utf8'));
const mapping={lord:'tax',courtesan:'intrigue',assassin:'assassinate',swordsman:'hireBlade',kingpin:'extort',magistrate:'summon'};
assert.equal(manifest.roles.length,6,'Six approved character portraits must exist');
for(const [role,action] of Object.entries(mapping)){
 const item=manifest.roles.find(r=>r.roleId===role);
 assert.ok(item,`Missing portrait metadata for ${role}`);
 const portrait=`/assets/portraits/${role}.jpg`;
 assert.equal(item.asset,portrait);
 assert.equal(catalog[action],portrait,`${action} must use shared role art`);
 const roleCard=roleCards.revealed({role,name:item.role});
 assert.ok(roleCard.includes(`src="${portrait}"`),`Player card must use same portrait (${role})`);
 const bytes=fs.readFileSync(path.join(rolesRoot,`${role}.jpg`));
 assert.ok(bytes.length>80_000,`${role} unexpectedly small`);
 assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8); // JPEG
 assert.equal(bytes[bytes.length-2],0xff);assert.equal(bytes[bytes.length-1],0xd9);
 assert.deepEqual(item.dimensionsPx,[620,670]);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.assetSHA256);
}
assert.equal(manifest.roles.find(r=>r.roleId==='assassin').sourceFile,'All_Cards_Warmer.png');
const bannerBytes=fs.readFileSync(path.join(__dirname,'../../public/assets/images/lobby-banner.png'));
assert.equal(crypto.createHash('sha256').update(bannerBytes).digest('hex'),manifest.banner.sourceSHA256);
assert.deepEqual([bannerBytes.readUInt32BE(16),bannerBytes.readUInt32BE(20)],manifest.banner.dimensionsPx);
const tutorial=fs.readFileSync(path.join(__dirname,'../../public/js/tutorial.js'),'utf8');
assert.ok(tutorial.includes('window.URAMAKU_ROLE_CARDS.revealed'), 'Tutorial uses the shared portrait renderer');
const panels=require('../../public/js/components/game-panels');
const actions=panels.actions({room:{roles:require('../../shared/roles')},you:{influences:[]},allowedAction:false});
for(const action of Object.keys(mapping).map(role=>mapping[role]))assert(actions.includes(`src="${catalog[action]}"`),'Shared action panel uses approved art');
assert.ok(tutorial.includes('panels.actions('), 'Tutorial uses shared actions');
console.log('Approved six-role portrait assets, mappings, and shared UI paths passed.');
