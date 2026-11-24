'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const i18n=require('../../shared/i18n');
const app=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8');const binding=app.slice(app.indexOf('function bindKickControls(){'),app.indexOf('function chooseAction(action){'));
for(const lang of ['en','jp'])for(const status of ['lobby','playing']){
 const listeners={},button={dataset:{kickId:'sora',kickName:'Sora'},addEventListener:(e,f)=>listeners[e]=f};let prompt,stopped=0,accepted=true,sent=[];
 const context={state:{status},document:{querySelectorAll:()=>[button]},window:{confirm:message=>{prompt=message;return accepted;}},t:(key,params)=>i18n.get(key,lang,params),send:(event,data)=>sent.push([event,data])};
 vm.runInNewContext(binding+'\nbindKickControls();',context);listeners.keydown({key:'Enter',stopPropagation:()=>stopped++});assert.equal(stopped,1);
 listeners.click({stopPropagation:()=>stopped++});assert.equal(stopped,2);assert(prompt.includes('Sora'));assert(!prompt.includes('{name}'));assert.equal(sent[0][0],'kickPlayer');assert.equal(sent[0][1].targetId,'sora');
 if(status==='playing')assert.equal(prompt,i18n.get('kickMatchConfirm',lang,{name:'Sora'}));accepted=false;listeners.click({stopPropagation(){}});assert.equal(sent.length,1,'Cancel never forfeits');
}
const markup=app.slice(app.indexOf('  const offline='),app.indexOf(" }).join('');",app.indexOf('  const offline=')));
for(const lang of ['en','jp'])for(const [alive,influenceCount] of [[true,2],[true,1],[false,0]])for(const connected of [true,false])for(const owner of [true,false])for(const status of ['playing','finished']){
 const ctx={p:{id:'sora',name:'<Sora>',connected,coins:2,alive,influenceCount},state:{status,hostId:'host'},meId:owner?'host':'guest',current:'host',isMe:false,t:k=>i18n.get(k,lang),esc:s=>String(s).replaceAll('<','&lt;'),indicator:'',roleSlots:''};
 const html=vm.runInNewContext('(function(){'+markup+'})()',ctx);
 assert.equal(html.includes('player-offline'),!connected);assert.equal(html.includes('data-kick-id'),!connected&&owner&&status==='playing'&&alive&&influenceCount>0);assert(!html.includes('<Sora>'));
}
for(const text of ['Too many requests. Please wait and try again.','The server is full. Please try again later.','This room has reached its spectator limit.','Only the host can remove players.','This player cannot be removed.','Only disconnected players can be removed during a match.'])assert.notEqual(i18n.translate(text,'jp'),text);
console.log('Eliminated players lose their Kick button; active offline seats remain removable in EN/JP. Shared bilingual kick confirmation, cancellation, offline-only owner controls, escaped names and prevention of target-click/keyboard propagation passed.');
