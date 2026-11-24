'use strict';
const assert=require('node:assert/strict');const {install,entries}=require('../../public/js/components/public-rooms');const i18n=require('../../shared/i18n');
const sample={code:'ABCD',name:'Evening <script>alert(1)</script>',mode:'treasuryFaction',playerCount:3,maxPlayers:8,status:'waiting'};
for(const lang of ['en','jp']){
 const html=entries([sample],lang,i18n);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes(i18n.get('modeTreasuryFaction',lang)));assert(html.includes('3 / 8'));
}
function fixture(){
 const sent=[],handlers={},jobs=[];let restoredFocus=0,joined;
 const input={value:'',focus(){this.focused=true;}},status={},previous={},next={},refresh={},close={};
 const rows={querySelectorAll(){return this.buttons||[];},set innerHTML(html){this.html=html;this.buttons=[...html.matchAll(/data-room-code="([A-Z0-9]+)"/g)].map(m=>({dataset:{roomCode:m[1]}}));},get innerHTML(){return this.html;}};
 const backdrop={innerHTML:'',querySelector(selector){return {'input':input,'tbody':rows,'[data-room-status]':status,'[data-room-previous]':previous,'[data-room-next]':next,'[data-room-refresh]':refresh,'.room-entry-close':close}[selector];},remove(){this.removed=true;}};
 const doc={createElement(){return backdrop;},body:{appendChild(){}},addEventListener(type,fn){this[type]=fn;},removeEventListener(type){delete this[type];}};
 const socket={connected:true,on(event,fn){handlers[event]=fn;},timeout(){return this;},emit(event,data,cb){sent.push({event,data,cb});}};
 const browser=install({socket,document:doc,getLanguage:()=> 'en',i18n,onJoin:room=>joined=room,schedule:fn=>{const job={fn};jobs.push(job);return job;},cancel:job=>{if(job)job.canceled=true;}});
 browser.open({focus(){restoredFocus++;}});
 return {browser,backdrop,input,status,rows,previous,next,refresh,socket,sent,handlers,jobs,doc,get joined(){return joined;},get restoredFocus(){return restoredFocus;}};
}
const f=fixture();assert(f.input.focused);assert.equal(f.sent[0].data.subscribe,true);
f.input.value='Duel';f.refresh.onclick();const fresh=f.sent.at(-1);
fresh.cb(null,{rooms:[sample],total:1,offset:0,nextOffset:null});
const current=f.rows.innerHTML;f.sent[0].cb(null,{rooms:[],total:0,offset:0,nextOffset:null});assert.equal(f.rows.innerHTML,current,'A delayed search reply cannot replace newer results');
f.rows.buttons[0].onclick();assert.deepEqual(f.joined,{code:'ABCD'});assert(f.backdrop.removed);assert.equal(f.restoredFocus,1);assert.equal(f.sent.at(-1).event,'stopRoomBrowser');
const second=fixture();second.input.oninput();second.input.oninput();assert(second.jobs[0].canceled);second.jobs[1].fn();assert.equal(second.sent.filter(s=>s.event==='listRooms').length,2,'Searches are debounced');
second.handlers.disconnect();assert.equal(second.rows.innerHTML,'');assert(second.status.textContent.includes('Disconnected'));second.handlers.connect();assert.equal(second.sent.at(-1).event,'listRooms');
second.doc.keydown({key:'Escape'});const closed=second.status.textContent;second.sent.filter(s=>s.event==='listRooms').at(-1).cb(null,{rooms:[sample],total:1,offset:0,nextOffset:null});assert.equal(second.status.textContent,closed);
console.log('Bilingual escaped room rows, request ordering, debounced search, reconnect, join handoff and modal cleanup passed.');
