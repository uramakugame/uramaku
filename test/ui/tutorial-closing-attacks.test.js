'use strict';
const assert=require('node:assert/strict'),{harness}=require('../tutorial/browser-harness');
for(const lang of ['en','jp']){
 const h=harness(lang),animations=[],timers=[];
 // Reach the actual approved closing scene without creating old decorative jobs.
 let guard=0;while(h.value('tutorial.step.id')!=='first-assassinate'&&guard++<60)h.value('handle(tutorial.step.input)');assert(guard<60);
 h.window.matchMedia=()=>({matches:false});
 const proto=Object.getPrototypeOf(h.app);proto.animate=function(frames,options){const entry={element:this,frames,options};animations.push(entry);return {cancel(){},finished:{then(finish,cancel){entry.finish=finish;entry.cancel=cancel;}}};};
 proto.getBoundingClientRect=function(){const left=this.dataset.playerId==='sora'?400:20;return {left,top:20,width:120,height:180,right:left+120,bottom:200};};
 h.context.setTimeout=(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer;};h.context.clearTimeout=timer=>{if(timer)timer.canceled=true;};
 function finish(){let guard=0;while(guard++<20){const pending=animations.filter(a=>!a.done),due=timers.filter(t=>!t.done&&!t.canceled);if(!pending.length&&!due.length)break;for(const a of pending){a.done=true;a.finish?.();}for(const t of due){t.done=true;t.fn();}}assert(guard<20,'Effects settle without an animation loop');}
 function attack(step){
  assert.equal(h.value('tutorial.step.id'),step);const before=h.state(),start=animations.length,soundStart=h.sounds.length;
  h.click('[data-action="assassinate"]');assert.deepEqual(h.state(),before,'Selecting an action still waits for the target');h.click('[data-player-id="sora"]');
  const flights=animations.slice(start).filter(a=>a.element.classList.contains('attack-flight'));assert.equal(flights.length,1,step+' must fly once to Sora');
  assert(flights[0].frames[1].transform.includes('translate(380px,0px)'),'The flight reaches Sora’s actual player-card center');assert.equal(flights[0].options.duration,500);
  assert.equal(h.sounds.slice(soundStart).filter(c=>c==='attackAssassinate').length,1,'One Assassinate sound accompanies the flight');
  if(step==='final-assassinate')assert(!h.sounds.slice(soundStart).includes('victory'),'Victory sound waits for the attack and loss presentation');
  const count=animations.length;h.value('render();render()');assert.equal(animations.length,count,'Ordinary rerenders do not launch another attack');finish();
  if(step==='final-assassinate')assert.equal(h.sounds.slice(soundStart).filter(c=>c==='victory').length,1);
 }
 attack('first-assassinate');assert.equal(h.state().room.players.find(p=>p.id==='sora').influenceCount,1);
 guard=0;while(h.value('tutorial.step.id')!=='final-assassinate'&&guard++<10)h.value('handle(tutorial.step.input)');assert(guard<10);finish();
 attack('final-assassinate');assert.equal(h.state().room.status,'finished');assert.equal(h.state().room.winner,'You');
}
console.log('Both actual closing tutorial Assassinates fly once from You to Sora in EN/JP, with correct sound, target geometry, no rerender replay and victory sequencing.');
