'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),i18n=require('../../shared/i18n');
const app=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8');
function source(name){const start=app.indexOf('function '+name+'('),end=app.indexOf('\nfunction ',start+1);return app.slice(start,end<0?undefined:end);}
for(const lang of ['en','jp'])for(const status of ['lobby','playing']){
 const listeners={},toggleListeners={},button={dataset:{kickId:'sora',kickName:'<Sora>'},addEventListener:(event,fn)=>listeners[event]=fn},toggle={addEventListener:(event,fn)=>toggleListeners[event]=fn};
 let accepted=false,prompt,rendered=0,sent=[];
 const target={id:'sora',name:'<Sora>',connected:false,alive:true,influenceCount:2};
 const ctx={state:{status,code:'KICK',hostId:'host',players:[target]},me:{id:'host'},kickSelectionActive:true,kickPendingId:null,targetSelectionAction:null,document:{getElementById:()=>status==='playing'?toggle:null,querySelectorAll:selector=>selector==='[data-kick-id]'?[button]:[]},window:{confirm:message=>{prompt=message;return accepted;}},t:(key,params)=>i18n.get(key,lang,params),render(){rendered++},send:(event,data)=>{sent.push([event,data]);return true;}};
 vm.createContext(ctx);vm.runInContext(source('kickEligible')+source('bindKickControls')+'\nbindKickControls()',ctx);
 listeners.click({stopPropagation(){}});assert.equal(sent.length,0,'Cancel confirmation does not kick');assert(ctx.kickSelectionActive);
 accepted=true;listeners.click({stopPropagation(){}});assert.equal(sent.length,1);assert.equal(sent[0][0],'kickPlayer');assert.equal(sent[0][1].targetId,'sora');assert.equal(ctx.kickPendingId,'sora');assert.equal(ctx.kickSelectionActive,false);assert(prompt.includes('<Sora>'));assert(rendered>0);
 listeners.click({stopPropagation(){}});assert.equal(sent.length,1,'Selection cannot submit a second kick');if(status==='playing'){toggleListeners.click();assert.equal(ctx.kickSelectionActive,false,'In-flight removal cannot reenable selection');}
 ctx.kickPendingId=null;if(status==='playing'){toggleListeners.click();assert(ctx.kickSelectionActive);toggleListeners.click();assert(!ctx.kickSelectionActive,'Owner can cancel selection without removing anyone');}
 for(const [owner,connected,alive,count,expected] of [[true,false,true,2,true],[true,true,true,2,true],[true,false,false,0,status==='lobby'],[false,false,true,2,false]]){
  ctx.me.id=owner?'host':'guest';Object.assign(target,{connected,alive,influenceCount:count});assert.equal(ctx.kickEligible(target),expected);
 }
 ctx.state.status='finished';ctx.me.id='host';assert.equal(ctx.kickEligible(target),false);
}
const css=fs.readFileSync(require.resolve('../../public/css/source/12-six-player-table.css'),'utf8');assert(css.includes('.player-presence{position:absolute;'));assert(css.includes('right:0;left:auto'));assert(css.includes('padding:2px 6px;font-size:.7rem'));assert(css.includes('border-color:#a26b63;background:#593432'));assert(css.includes('padding:10px 8px;border:0;background:transparent'));assert(css.includes('box-shadow:none;background:transparent'));assert(css.includes('z-index:8'));
for(const text of ['Only the host can remove players.','This player cannot be removed.','Only disconnected players can be removed during a match.'])assert.notEqual(i18n.translate(text,'jp'),text);
console.log('Owner selection/cancel, one pending target, escaped confirmation, online/offline match eligibility, eliminated/finished guards and presence overlay without card growth passed in EN/JP.');
