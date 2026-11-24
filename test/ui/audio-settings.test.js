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
 const f=fixture({master:.5,gameplay:.5,chat:0});f.audio.play('chat');assert.equal(f.tones.length,0);f.audio.play('turn');assert.equal(f.tones.length,2);assert(f.gains.every(x=>x<=.0051),'Master and channel volume multiply');
}
{
 const f=fixture({master:1,gameplay:0,chat:1});f.audio.play('response');assert.equal(f.tones.length,0);f.audio.play('chat');assert.equal(f.tones.length,2);
}
{
 const f=fixture({deadline:false});f.audio.play('deadline');assert.equal(f.tones.length,0);f.audio.play('turn',{delay:.3});assert.equal(f.tones[0].time,.3);
 const mute=fixture({},true);mute.audio.play('victory');assert.equal(mute.tones.length,0);
 const blocked=fixture();blocked.listeners.pointerdown();assert.equal(blocked.tones.length,0,'Unlocking audio alone must not produce sound');
}
assert.equal(fixture().audio.gameEvent('A loots 1 coin from B during Riot.'),'coin');
assert.equal(fixture().audio.gameEvent('A claims Assassin and declares Assassinate against B.'),'attackAssassinate','Declaring Assassinate must use its unique attack cue');
console.log('Independent chat/gameplay volume, master/mute, deadline preference, cue coverage and delayed scheduling passed.');

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
 const settings={master:.5,gameplay:.4,chat:1};
 const context={window:{AudioContext},localStorage:{getItem:key=>key==='uramakuMuted'?'0':JSON.stringify(settings)},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(source,context);
 context.window.UramakuAudio.play('draw',{delay:.3});context.window.UramakuAudio.play('discard',{delay:.6});
 assert.equal(buffers.length,2);assert(buffers[0].length>buffers[1].length,'Draw is a longer slide, discard a shorter landing');assert(buffers.every(b=>b.channels===1&&b.samples.some(value=>value!==0)));
 assert(filters[0].frequencyStart>filters[1].frequencyStart,'Different paper timbres');assert.equal(sources[0].time,2.3);assert.equal(sources[1].time,2.6);assert.equal(tones.length,1,'Discard has a soft landing tap');assert(gains.every(value=>value<=.01701),'Paper cues honor master × gameplay volume');
 audioContext.state='suspended';context.window.UramakuAudio.play('draw');assert.equal(buffers.length,2);assert.equal(tones.length,1,'A blocked opening cue must not be queued for a later unrelated gesture');
}
