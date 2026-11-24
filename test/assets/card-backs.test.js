'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const cards=require('../../public/js/components/role-cards'),manifest=require('../../public/assets/card-backs/artwork-manifest.json');
assert.equal(manifest.backs.length,3);
for(const back of manifest.backs){const data=fs.readFileSync(require.resolve('../../public'+back.asset));assert.equal(data.readUInt32BE(16),825);assert.equal(data.readUInt32BE(20),1125);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),back.sha256);const html=cards.hidden({faction:back.id==='standard'?null:back.id});assert(html.includes('src="'+back.asset+'"'));assert(!html.includes('faction-mark'));}
for(const page of ['index.html','tutorial.html']){const html=fs.readFileSync(require.resolve('../../public/'+page),'utf8');assert(html.includes('card-motion.js'));for(const back of manifest.backs)assert(html.includes('href="'+back.asset+'"'));}
const css=fs.readFileSync(require.resolve('../../public/css/source/10-turn-feedback.css'),'utf8');assert(css.includes('object-fit:cover!important'));assert(css.includes('object-position:center!important'));assert(css.includes('filter:brightness(.9)!important'));assert(css.includes('transform:scale(1.08);transform-origin:center center'));assert(css.includes('filter:none!important;overflow:hidden!important'));assert(css.includes('filter:none!important'));
console.log('Three approved card backs: exact PNG bytes, 825×1125 dimensions, standard/faction mapping, centered cover with 10% darkening and preloading passed.');
