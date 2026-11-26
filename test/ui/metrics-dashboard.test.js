'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const i18n=require('../../shared/i18n');
const root=path.resolve(__dirname,'../..'),code=fs.readFileSync(path.join(root,'server/admin/metrics.js'),'utf8');
const {RoomStore}=require('../../server/room-store'),engagement=require('../../server/engagement');
async function main(){
 const db=new RoomStore(':memory:'),data={...engagement.report(db.db),current:{connections:0,waitingRooms:0,activeMatches:0,connectedPlayers:0,connectedSpectators:0},runtime:{since:Date.now(),db:{transactions:2,failed:0,meanMs:.5,p95UpperMs:1}}};db.close();
 const elements=new Map(),app={innerHTML:''};let calls=0,fail=false;
 const context=vm.createContext({Intl,Date,window:{URAMAKU_I18N:{...i18n,getLanguage:()=> 'en',setLanguage(){}}},document:{documentElement:{lang:'en'},getElementById(id){if(id==='metrics-app')return app;if(!elements.has(id))elements.set(id,{});return elements.get(id);}},async fetch(url,options){calls++;assert.equal(options.cache,'no-store');assert.equal(options.credentials,'same-origin');assert(!url.includes('password'));return {ok:!fail,json:async()=>data};}});
 vm.runInContext(code,context);await new Promise(resolve=>setImmediate(resolve));
 assert(app.innerHTML.includes('Rooms created'));assert(app.innerHTML.includes('Faction + Riot'));assert(app.innerHTML.includes('not unique people'));assert(app.innerHTML.includes('Server write timings'));assert(!app.innerHTML.includes('undefined'));
 elements.get('languageToggle').onclick();assert.equal(context.document.documentElement.lang,'ja');assert(app.innerHTML.includes('管理者用の統計'));assert(app.innerHTML.includes('陣営＋動乱'));assert(!app.innerHTML.includes('undefined'));assert.equal(calls,1,'Changing language does not trigger a new read');
 fail=true;await elements.get('refresh').onclick();assert(app.innerHTML.includes('統計を読み込めませんでした'));assert(!code.includes('setInterval'),'No background polling or repeated writes for the dashboard');assert(!code.includes('localStorage'),'Only the existing language helper persists a preference');
 const html=fs.readFileSync(path.join(root,'server/admin/metrics.html'),'utf8');assert(html.includes('/css/game.css'));assert(html.includes('noindex,nofollow'));assert(!fs.existsSync(path.join(root,'public/admin/metrics.html')));
 for(const key of code.matchAll(/t\('([^']+)'\)/g))assert.notEqual(i18n.get('metrics'+key[1],'jp'),'metrics'+key[1],'Visible dashboard copy is localized');
 console.log('Dashboard rendering, empty state, shared styles, all mode names, EN/JP switch, failed fetch and no credential storage/background polling passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
