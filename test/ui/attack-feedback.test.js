'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const game=require('../../server/game'),feedback=require('../../public/js/components/game-feedback'),i18n=require('../../shared/i18n');
function fixture(action){const players=['a','b','c'].map(id=>({id,name:id,coins:7,alive:true,influences:['lord','magistrate']}));const room=game.createGame('ATTACK',players[0]);Object.assign(room,{players,status:'playing',deck:Array(18).fill('kingpin')});if(action==='overthrow')Object.assign(room,{treasuryMode:true,treasuryCoins:0,totalCoins:21,economyWinThreshold:14});return room;}
const cues={purge:'attackPurge',overthrow:'attackOverthrow',hireBlade:'attackHireBlade',assassinate:'attackAssassinate'};
for(const [action,cue] of Object.entries(cues)){
 const room=fixture(action),before=game.publicState(room);assert(game.performAction(room,'a',action,'b').ok);const after=game.publicState(room),effects=feedback.changes(before,after,null,null);
 assert.deepEqual(effects.attacks,[{from:'a',to:'b',action}]);assert(effects.sounds.includes(cue));
 assert.deepEqual(feedback.changes(after,after,null,null).attacks,[],'A repeated room snapshot must not replay the attack');
 assert.deepEqual(feedback.changes(null,after,null,null).attacks,[],'Joining/reloading does not replay past attacks');
 if(action==='assassinate'){const beforeChallenge=game.publicState(room);game.challenge(room,'b');assert.deepEqual(feedback.changes(beforeChallenge,game.publicState(room),null,null).attacks,[],'A failed claim must not produce an extra attack motion or imply a hit');}
}
{
 const before={code:'tutorial',status:'playing',players:[{id:'0'},{id:'1'}],log:[]},after={...before,presentationAttack:{key:'assassinate',from:'1',to:'0',action:'assassinate'}};
 assert.deepEqual(feedback.changes(before,after,null,null).attacks,[{from:'1',to:'0',action:'assassinate'}]);
 assert.deepEqual(feedback.changes(after,after,null,null).attacks,[]);
}
// Full-distance visual copies reach target centers without moving live controls.
{
 const animations=[],appended=[],timers=[];
 function node(name,box,attributes={}){
  const el={name,box,attributes:{...attributes},dataset:{},style:{},children:[],rendered:'visible card only',
   setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];if(key==='data-player-id')delete this.dataset.playerId;},
   appendChild(child){this.children.push(child);child.parent=this;return child;},
   querySelectorAll(selector){const all=[];const visit=parent=>{for(const child of parent.children){if(selector==='[id]'&&child.attributes.id)all.push(child);visit(child);}};visit(this);return all;},
   closest:()=>({getBoundingClientRect:()=>({width:1200})}),getBoundingClientRect(){return this.box;},
   cloneNode(deep){const copy=node(name+'-copy',{...this.box},this.attributes);copy.dataset={...this.dataset};copy.rendered=this.rendered;if(deep)for(const child of this.children)copy.appendChild(child.cloneNode(true));return copy;},
   animate(frames,options){const record={element:this,name,frames,options};animations.push(record);return{finished:{then(resolve,reject){record.finish=resolve;record.cancel=reject;}}};},remove(){this.removed=true;}
  };if(attributes['data-player-id'])el.dataset.playerId=attributes['data-player-id'];return el;
 }
 const source=node('a',{left:10,top:20,width:100,height:100},{id:'source','data-player-id':'a'}),target=node('b',{left:210,top:120,width:100,height:100},{'data-player-id':'b'});
 source.appendChild(node('caption',{}, {id:'caption'}));
 const context={window:{URAMAKU_I18N:i18n,matchMedia:()=>({matches:true})},document:{createElement:tag=>node(tag,{}),body:{appendChild:el=>appended.push(el)}},setTimeout:fn=>timers.push(fn)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../public/js/components/game-feedback'),'utf8'),context);const api=context.window.URAMAKU_FEEDBACK,container={querySelectorAll:()=>[source,target]};
 api.animate({attacks:[{from:'a',to:'b',action:'hireBlade'}]},{container});assert.equal(animations.length,0);assert.equal(appended.length,0,'Reduced motion creates no flight overlays');
 context.window.matchMedia=()=>({matches:false});
 for(const action of Object.keys(cues))api.animate({attacks:[{from:'a',to:'b',action}]},{container});
 const motion=animations.filter(item=>item.name==='a');assert.equal(motion.length,4);assert.equal(new Set(motion.map(item=>item.options.duration)).size,4);
 for(const item of motion)assert.equal(item.frames.at(-1).transform,'translate(0,0)','Live-card cue returns to rest');
 const flights=appended.filter(el=>el.className==='game-shell attack-flight'),trails=appended.filter(el=>el.className.startsWith('attack-trail '));
 assert.equal(flights.length,4);assert.equal(trails.length,4);
 function checkFlight(flight,dx,dy){
  const animation=animations.find(item=>item.element===flight),copy=flight.children[0].children[0].children[0];
  const match=animation.frames[1].transform.match(/translate\((-?[\d.]+)px,(-?[\d.]+)px\)/);
  assert.equal(Number(match[1]),dx);assert.equal(Number(match[2]),dy);assert.equal(animation.frames.at(-1).opacity,0);assert.equal(animation.options.fill,'forwards');
  assert.equal(flight.style.left,'10px');assert.equal(flight.style.top,'20px');assert.equal(flight.style.width,'100px');assert.equal(flight.style.opacity,'0');
  assert.equal(flight.attributes['aria-hidden'],'true');assert(Object.hasOwn(flight.attributes,'inert'));
  assert.equal(flight.children[0].className,'game-layout');assert.equal(flight.children[0].children[0].className,'game-players-panel');assert.equal(flight.children[0].children[0].style.width,'1200px');
  assert.equal(copy.rendered,source.rendered,'Only the current viewer’s rendered card is copied');assert.equal(copy.attributes.id,undefined);assert.equal(copy.dataset.playerId,undefined);assert.equal(copy.querySelectorAll('[id]').length,0);
 }
 for(const flight of flights)checkFlight(flight,200,100);
 assert.equal(source.attributes.id,'source');assert.equal(source.dataset.playerId,'a');assert.equal(source.children[0].attributes.id,'caption');assert.deepEqual(source.style,{},'Live controls retain their original layout');
 // Arrival follows actual geometry, including opposite direction and unequal dimensions.
 for(const box of [{left:-190,top:20,width:100,height:100},{left:10,top:620,width:180,height:80},{left:510,top:-80,width:70,height:140}]){
  target.box=box;api.animate({attacks:[{from:'a',to:'b',action:'purge'}]},{container});checkFlight(appended.at(-2),box.left+box.width/2-60,box.top+box.height/2-70);
 }
 const count=appended.length;target.box={...source.box};api.animate({attacks:[{from:'a',to:'b',action:'purge'}]},{container});api.animate({attacks:[{from:'a',to:'missing',action:'purge'}]},{container});assert.equal(appended.length,count,'Coincident/missing cards create no flight');
 const overlayAnimations=animations.filter(item=>appended.includes(item.element));overlayAnimations[0].finish();overlayAnimations[1].cancel();assert(overlayAnimations[0].element.removed);assert(overlayAnimations[1].element.removed,'Cancellation cleans up');
 timers.forEach(fn=>fn());assert(appended.every(el=>el.removed),'Fallback removes all overlays and trails');
 const css=fs.readFileSync(require.resolve('../../public/css/source/10-turn-feedback.css'),'utf8');assert.match(css,/\.attack-trail\{[^}]*pointer-events:none/);assert.match(css,/\.attack-flight\{[^}]*pointer-events:none/);assert(css.includes('.attack-flight *{pointer-events:none!important}'));assert(css.includes('.attack-flight{display:none!important}'));
}
// A custom duration drives the progress bar; the 6s default must not leak into a 12s game.
{
 const source=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8'),method=source.slice(source.indexOf('function updateChallengeCountdown(){'),source.indexOf('// Current Turn status'));
 const bar={style:{}},label={};const context={state:{status:'playing',challengeDurationSeconds:12,pending:{kind:'claim',stage:'challenge',challengeDeadline:7000,challengeDurationMs:12000}},Date:{now:()=>1000},serverClockOffset:0,challengeCountdownTimer:null,clearTimeout(){},setTimeout(){},document:{querySelector:s=>s.includes('progress')?bar:s.includes('clock')?{classList:{toggle(){}}}:label},window:{URAMAKU_FEEDBACK:{decisionKey:()=>null}},me:null,t:(key,params)=>i18n.get(key,'en',params)};
 vm.createContext(context);vm.runInContext(method,context);context.updateChallengeCountdown();assert.equal(bar.style.width,'50%');assert.match(label.textContent,/in 6s/);
}
console.log('Four directional attack effects/cues, no replay or false impact, shared tutorial events, reduced motion, cleanup and custom-duration progress passed.');
// A shared engine declaration can be accepted and fully resolved between
// viewed states. The public log must still trigger one attack, without replay.
for(const action of ['assassinate','hireBlade'])for(const final of [false,true]){
 const room=fixture(action);room.challengeTimerEnabled=false;room.players[0].influences=[action==='assassinate'?'assassin':'swordsman','lord'];
 if(final){room.players=room.players.slice(0,2);room.players[1].influences=['magistrate'];}
 const before=game.publicState(room);assert(game.performAction(room,'a',action,'b').ok);for(const p of room.players.filter(p=>p.id!=='a'))assert(game.passChallenge(room,p.id).ok);
 if(room.pending?.kind==='counterOffer'){const q=room.pending;room.pending=null;assert(game.performDeferredAction(room,q).ok);}
 if(room.pending?.kind==='lose')assert(game.loseInfluence(room,'b',0).ok);
 const after=game.publicState(room),effects=feedback.changes(before,after,null,null);
 assert.deepEqual(effects.attacks,[{from:'a',to:'b',action}]);assert.equal(effects.sounds.filter(c=>c===cues[action]).length,1);assert.equal(after.status,final?'finished':'playing');
 assert.deepEqual(feedback.changes(after,after,null,null).attacks,[]);assert.deepEqual(feedback.changes(null,after,null,null).attacks,[]);
}
