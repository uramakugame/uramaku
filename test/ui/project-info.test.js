'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const project=require('../../public/js/components/project-info'),i18n=require('../../shared/i18n');
const {harness}=require('../tutorial/browser-harness');
for(const lang of ['en','jp']){
 const header=project.header({lang});assert(!header.includes('<img'));assert(header.includes(i18n.get('projectBeta',lang)));
 const about=project.about({lang});for(const id of ['beta','artwork','development','feedback'])assert(about.includes(`id="${id}"`));
 assert(about.includes(i18n.get('projectArtDetails',lang)));assert(about.includes('aria-disabled="true"'));assert(!about.includes('mailto:'));
 const h=harness(lang),container=h.document.createElement('div');h.app.remove();container.setAttribute('id','about-app');h.document.body.appendChild(container);
 vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../public/js/about.js'),'utf8'),h.context);
 assert.equal(h.document.documentElement.lang,lang==='jp'?'ja':'en');
 h.document.getElementById('languageToggle').click();assert.equal(h.document.documentElement.lang,lang==='jp'?'en':'ja');
 let prevented=false;const target=container.querySelector('[data-project-placeholder]');
 for(const fn of container.listeners.click||[])fn({target,preventDefault(){prevented=true;}});assert(prevented,'Placeholder links never navigate');
}
const app=fs.readFileSync(path.resolve(__dirname,'../../public/js/app.js'),'utf8');assert(app.includes('URAMAKU_PROJECT.disclosure'));assert(app.includes('URAMAKU_PROJECT.campaign'));assert(!app.includes('lobby-hero'));
console.log('Shared bilingual beta/artwork disclosures, About navigation/language and inactive placeholder links passed.');
