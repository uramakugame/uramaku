'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../../public/js/audio.js'),'utf8');
function fixture(saved={},muted=false){
 const tones=[],gains=[],listeners={};
 class AudioContext{constructor(){this.currentTime=0;this.state='running';this.destination={};}resume(){return Promise.resolve();}createOscillator(){const tone={};tones.push(tone);return {frequency:{setValueAtTime:(value,time)=>Object.assign(tone,{value,time}),exponentialRampToValueAtTime(){}},connect(){return {connect(){}}},start(){},stop(){}};}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime:value=>gains.push(value)}};}}
 const context={window:{AudioContext},localStorage:{getItem:key=>key==='uramakuMuted'?(muted?'1':'0'):JSON.stringify(saved)},document:{readyState:'loading',addEventListener:(event,fn)=>listeners[event]=fn}};
 vm.runInNewContext(source,context);return {audio:context.window.UramakuAudio,tones,gains,listeners};
}
for(const kind of ['turn','response','deadline','draw','replace','discard','victory','defeat','attackPurge','attackOverthrow','attackHireBlade','attackAssassinate']){const f=fixture();f.audio.play(kind);assert(f.tones.length>0,kind+' has a cue');}
{
 const f=fixture({master:.5,gameplay:.5});f.audio.play('chat');assert.equal(f.tones.length,0);f.audio.play('turn');assert.equal(f.tones.length,2);assert(f.gains.every(x=>x<=.0051),'Master and channel volume multiply');
}
{
 const f=fixture({master:1,gameplay:0});f.audio.play('response');assert.equal(f.tones.length,0);f.audio.play('turn');assert.equal(f.tones.length,0);
}
{
 const f=fixture({deadline:false});f.audio.play('deadline');assert.equal(f.tones.length,0);f.audio.play('turn',{delay:.3});assert.equal(f.tones[0].time,.3);
 const mute=fixture({},true);mute.audio.play('victory');assert.equal(mute.tones.length,0);
 const blocked=fixture();blocked.listeners.pointerdown();assert.equal(blocked.tones.length,0,'Unlocking audio alone must not produce sound');
}
assert.equal(fixture().audio.gameEvent('A loots 1 coin from B during Chaos.'),'coin');
assert.equal(fixture().audio.gameEvent('A claims Assassin and declares Assassinate against B.'),'attackAssassinate','Declaring Assassinate must use its unique attack cue');
console.log('Gameplay volume, master/mute, deadline preference, cue coverage and delayed scheduling passed.');

const signatures=['attackPurge','attackOverthrow','attackHireBlade','attackAssassinate'].map(kind=>{const f=fixture();f.audio.play(kind);return JSON.stringify(f.tones)});
assert.equal(new Set(signatures).size,4,'Each elimination action needs a distinct sound pattern');
for(const kind of ['attackPurge','attackOverthrow','attackHireBlade','attackAssassinate']){const f=fixture({gameplay:0});f.audio.play(kind);assert.equal(f.tones.length,0);}

// Card foley is synthesized locally: separate noise envelopes, no network or assets.
{
 const buffers=[],sources=[],filters=[],gains=[],tones=[];let audioContext;
 class AudioContext{
  constructor(){this.currentTime=2;this.sampleRate=44100;this.destination={};this.state='running';audioContext=this;}
  resume(){return Promise.resolve();}
  createBuffer(channels,length,sampleRate){const samples=new Float32Array(length),buffer={channels,length,sampleRate,samples,getChannelData:()=>samples};buffers.push(buffer);return buffer;}
  createBufferSource(){const source={connect(){},start(time){this.time=time;},stop(time){this.stopTime=time;}};sources.push(source);return source;}
  createBiquadFilter(){const filter={Q:{setValueAtTime(value){filter.q=value;}},frequency:{setValueAtTime(value){filter.frequencyStart=value;},exponentialRampToValueAtTime(value){filter.frequencyEnd=value;}},connect(){}};filters.push(filter);return filter;}
  createGain(){return{connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(value){gains.push(value);}}};}
  createOscillator(){const tone={frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return{connect(){}}},start(){},stop(){}};tones.push(tone);return tone;}
 }
 const settings={master:.5,gameplay:.4};
 const context={window:{AudioContext},localStorage:{getItem:key=>key==='uramakuMuted'?'0':JSON.stringify(settings)},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(source,context);
 context.window.UramakuAudio.play('draw',{delay:.3});context.window.UramakuAudio.play('discard',{delay:.6});
 assert.equal(buffers.length,2);assert(buffers[0].length>buffers[1].length,'Draw is a longer slide, discard a shorter landing');assert(buffers.every(b=>b.channels===1&&b.samples.some(value=>value!==0)));
 assert(filters[0].frequencyStart>filters[1].frequencyStart,'Different paper timbres');assert.equal(sources[0].time,2.3);assert.equal(sources[1].time,2.6);assert.equal(tones.length,1,'Discard has a soft landing tap');assert(gains.every(value=>value<=.01701),'Paper cues honor master × gameplay volume');
 audioContext.state='suspended';context.window.UramakuAudio.play('draw');assert.equal(buffers.length,2);assert.equal(tones.length,1,'A blocked opening cue must not be queued for a later unrelated gesture');
}

// Run the real tutorial and audio module together with a gesture-gated context.
async function tutorialStartup(){
 const {harness}=require('../tutorial/browser-harness');
 for(const reduced of [false,true])for(const muted of [false,true]){
  let gesture=false,buffers=0;const created=[],animations=[],timers=[];
  class AudioContext{
   constructor(){created.push(gesture);this.state=gesture?'running':'suspended';this.currentTime=0;this.sampleRate=1000;this.destination={};}
   resume(){if(gesture)this.state='running';return Promise.resolve();}
   createBuffer(channels,length){buffers++;return{getChannelData:()=>new Float32Array(length)};}
   createBufferSource(){return{connect(){},start(){},stop(){}};}
   createBiquadFilter(){return{Q:{setValueAtTime(){}},frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
   createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this;}};}
   createOscillator(){return{frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(gain){return gain;},start(){},stop(){}};}
  }
  const h=harness('en',({window,context,Element})=>{
   context.document.readyState='loading';context.localStorage={getItem:key=>key==='uramakuMuted'?(muted?'1':'0'):null,setItem(){}};window.AudioContext=AudioContext;window.matchMedia=()=>({matches:reduced});
   context.setTimeout=(fn,ms)=>{const t={fn,ms};timers.push(t);return t;};context.clearTimeout=t=>{if(t)t.canceled=true;};
   Element.prototype.animate=function(frames,options){const a={element:this,frames,options};animations.push(a);return{cancel(){if(!a.done){a.done=true;a.reject?.();}},finished:{then(finish,reject){a.finish=()=>{if(!a.done){a.done=true;finish();}};a.reject=reject;}}};};
   vm.runInContext(source,context);
  });
  const tick=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
  assert.deepEqual(created,[]);assert.equal(buffers,0);assert.equal(animations.length,0,'No opening deal or audio runs before Start tutorial');assert(h.app.querySelector('[data-reaction-toggle]'));assert(h.app.querySelector('[data-player-id="you"] .hidden-role-card'));
  const welcome=h.state();gesture=true;h.click('#startTutorial');gesture=false;assert.deepEqual(h.state(),welcome,'Starting preserves all four 1-coin balances and the welcome lesson');assert(!created.includes(false),'Audio is created within the Start gesture');
  const count=animations.length;h.value('startTutorial()');assert.equal(animations.length,count,'Repeated Start cannot redeal');
  if(!reduced){h.click('#continueLesson');assert.deepEqual(h.state(),welcome,'Continue cannot skip the running opening deal');}
  for(let i=0;i<30;i++){
   for(const a of animations.filter(a=>!a.done))a.finish?.();
   for(const t of timers.filter(t=>!t.done&&!t.canceled)){t.done=true;t.fn();}
   await tick();if(!h.window.URAMAKU_PRESENTATION.busy(h.app)&&!animations.some(a=>!a.done))break;
  }
  assert(!h.window.URAMAKU_PRESENTATION.busy(h.app));assert.equal(buffers,muted?0:reduced?1:2,'Opening card foley plays after activation; reduced motion retains one cue and mute remains silent');assert.equal(h.value('tutorial.step.id'),'welcome');assert.equal(h.state().you.coins,1);
  h.click('#continueLesson');await tick();assert.equal(h.value('tutorial.step.id'),'income');assert.equal(h.state().you.coins,2);
  const animationsBeforeBack=animations.length,buffersBeforeBack=buffers;h.click('#backStep');assert.equal(h.value('tutorial.step.id'),'welcome');assert.equal(h.state().you.coins,1);assert(h.app.querySelector('#continueLesson'));assert(!h.app.querySelector('#startTutorial'));assert.equal(animations.length,animationsBeforeBack,'Back does not redeal');assert.equal(buffers,buffersBeforeBack,'Back does not replay the opening sound');
 }
 console.log('Real tutorial/audio startup: Start gesture before deal/sound, initial React, no duplicate deal or early Income, completion gating, reduced-motion cue and mute preference passed.');
}
tutorialStartup().catch(error=>{console.error(error);process.exitCode=1;});
