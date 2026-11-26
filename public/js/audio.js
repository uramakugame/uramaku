/* Original synthesized sounds shared by multiplayer and tutorial. */
(function(){
 'use strict';
 let ctx=null,muted=false,settingsOpen=false;
 const defaults={master:.65,gameplay:1,deadline:true};
 let settings={...defaults};
 try{
  muted=localStorage.getItem('uramakuMuted')==='1';
  const saved=JSON.parse(localStorage.getItem('uramakuSoundSettings')||'null');
  for(const key of ['master','gameplay'])if(Number.isFinite(saved?.[key]))settings[key]=Math.max(0,Math.min(1,saved[key]));
  if(typeof saved?.deadline==='boolean')settings.deadline=saved.deadline;
 }catch{}
 const persist=()=>{try{localStorage.setItem('uramakuMuted',muted?'1':'0');localStorage.setItem('uramakuSoundSettings',JSON.stringify(settings));}catch{}};
 function context(){
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext)return null;
  if(!ctx)ctx=new AudioContext();
  if(ctx.state==='suspended')ctx.resume().catch(()=>{});
  return ctx;
 }
 function tone(frequency,duration,options={}){
  const level=settings.master*settings.gameplay;
  if(muted||!level)return;
  try{
   const c=context();if(!c)return;
   const start=c.currentTime+(options.delay||0),osc=c.createOscillator(),gain=c.createGain();
   osc.type=options.type||'sine';osc.frequency.setValueAtTime(frequency,start);
   if(options.endFrequency)osc.frequency.exponentialRampToValueAtTime(options.endFrequency,start+duration);
   const volume=Math.min(options.volume??.025,.055)*level;
   gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),start+.008);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
   osc.connect(gain).connect(c.destination);osc.start(start);osc.stop(start+duration+.01);
  }catch{} // Audio must never interrupt a decision.
 }
 // Short filtered noise envelopes resemble a card sliding and landing on felt.
 function paper(kind,{delay=0}={}){
  const level=settings.master*settings.gameplay;if(muted||!level)return true;
  try{
   const c=context();if(c?.state==='suspended')return true; // Never queue an old paper cue behind the browser's gesture gate.
   if(!c?.createBuffer||!c.createBufferSource||!c.createBiquadFilter)return false;
   const drawing=kind==='draw',duration=drawing?.24:.18,start=c.currentTime+delay;
   const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),samples=buffer.getChannelData(0);
   for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(.72+.28*Math.sin(i/(drawing?79:31)));
   const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;
   filter.type='bandpass';filter.Q.setValueAtTime(drawing?.65:.9,start);filter.frequency.setValueAtTime(drawing?1800:950,start);filter.frequency.exponentialRampToValueAtTime(drawing?700:450,start+duration);
   gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime((drawing?.065:.085)*level,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
   source.connect(filter);filter.connect(gain);gain.connect(c.destination);source.start(start);source.stop(start+duration+.01);
   if(!drawing)tone(145,.055,{delay:delay+.075,type:'triangle',volume:.013,endFrequency:85});
   return true;
  }catch{return false;}
 }
 function play(kind,{delay=0}={}){
  if(kind==='deadline'&&!settings.deadline)return;
  if((kind==='draw'||kind==='discard')&&paper(kind,{delay}))return;
  const note=(frequency,duration,options={})=>tone(frequency,duration,{...options,delay:delay+(options.delay||0),channel:'gameplay'});
  if(kind==='click')note(630,.045,{volume:.012,endFrequency:440});
  else if(kind==='confirm'){note(392,.11,{volume:.02});note(588,.17,{delay:.075,volume:.022});}
  else if(kind==='coin'){note(740,.09,{volume:.025});note(988,.19,{delay:.075,volume:.025});}
  else if(kind==='intrigue'){note(310,.2,{type:'triangle',volume:.017});note(465,.28,{delay:.1,type:'triangle',volume:.018});}
  else if(kind==='challenge'){note(220,.14,{type:'triangle',volume:.029});note(330,.16,{delay:.11,type:'triangle',volume:.023});}
  else if(kind==='counter'){note(460,.09,{type:'triangle',volume:.025});note(350,.19,{delay:.07,type:'triangle',volume:.024});}
  else if(kind==='eliminate'){note(210,.21,{type:'triangle',volume:.032,endFrequency:130});note(165,.34,{delay:.14,volume:.024});}
  else if(kind==='turn'){note(440,.12,{volume:.019});note(660,.18,{delay:.1,volume:.02});}
  else if(kind==='response'){note(660,.08,{type:'triangle',volume:.023});note(880,.12,{delay:.12,type:'triangle',volume:.023});}
  else if(kind==='deadline'){note(520,.075,{volume:.017});note(520,.075,{delay:.16,volume:.017});}
  else if(kind==='draw')note(620,.16,{type:'triangle',volume:.015,endFrequency:260});
  else if(kind==='replace'){note(320,.1,{type:'triangle',volume:.016,endFrequency:540});note(660,.09,{delay:.1,volume:.015});}
  else if(kind==='discard')note(400,.14,{type:'triangle',volume:.015,endFrequency:180});
  else if(kind==='victory'){[392,494,587,784].forEach((f,i)=>note(f,.27,{delay:i*.12,volume:.023}));}
  else if(kind==='defeat'){note(330,.23,{volume:.02});note(262,.3,{delay:.18,volume:.017});}
  else if(kind==='attackPurge'){note(110,.25,{type:'triangle',volume:.032,endFrequency:65});note(165,.2,{delay:.15,volume:.021,endFrequency:82});}
  else if(kind==='attackOverthrow'){[146,196,247].forEach((f,i)=>note(f,.14,{delay:i*.09,type:'triangle',volume:.025}));note(294,.18,{delay:.28,volume:.019});}
  else if(kind==='attackHireBlade'){note(960,.11,{type:'triangle',volume:.018,endFrequency:220});note(1320,.15,{delay:.07,volume:.017,endFrequency:660});}
  else if(kind==='attackAssassinate'){note(520,.22,{type:'triangle',volume:.019,endFrequency:95});note(130,.2,{delay:.16,volume:.016,endFrequency:65});}
  else if(kind==='error')note(220,.15,{type:'triangle',volume:.019,endFrequency:170});
 }
 document.addEventListener('click',e=>{
  const button=e.target.closest('button');
  if(!button||button.disabled||button.closest('.sound-controls'))return;
  // Claim/counter/loss sounds follow confirmed state, not a rejected click.
  play('click');
 },true);
 // A gesture also unlocks audio when the user joins with a keyboard.
 const unlock=()=>{if(!muted)try{context();}catch{}};
 document.addEventListener('pointerdown',unlock,{once:true});
 document.addEventListener('keydown',unlock,{once:true});
 function renderToggle(){
  const lang=window.URAMAKU_I18N?.getLanguage()||'en';
  const text=(key)=>window.URAMAKU_I18N?.get(key,lang)||key;
  let controls=document.getElementById('uramakuSoundControls');
  if(!controls){controls=document.createElement('div');controls.id='uramakuSoundControls';controls.className='sound-controls';document.body.appendChild(controls);}
  controls.innerHTML=`<button id="uramakuSoundToggle" class="sound-toggle" type="button" aria-pressed="${!muted}" aria-label="${text(muted?'soundEnable':'soundMute')}">${muted?'🔇':'🔊'} ${text(muted?'soundOff':'soundOn')}</button><button id="uramakuSoundSettings" class="sound-settings-button" type="button" aria-expanded="${settingsOpen}" aria-controls="uramakuSoundPanel">${text('soundSettings')}</button><section id="uramakuSoundPanel" class="sound-settings-panel panel" aria-label="${text('soundSettings')}" ${settingsOpen?'':'hidden'}><div class="sound-panel-heading"><strong>${text('soundSettings')}</strong><button id="closeSoundSettings" type="button" aria-label="${text('soundClose')}">×</button></div>${[['master','soundMaster'],['gameplay','soundGameplay']].map(([key,label])=>`<label class="sound-volume-row" for="sound-${key}"><span>${text(label)}</span><output id="sound-${key}-value">${Math.round(settings[key]*100)}%</output><input id="sound-${key}" data-sound-volume="${key}" type="range" min="0" max="100" value="${Math.round(settings[key]*100)}"></label>`).join('')}<label class="sound-warning-row"><input id="soundDeadline" type="checkbox" ${settings.deadline?'checked':''}>${text('soundWarning')}</label><button type="button" id="testGameSound">${text('soundTest')}</button></section>`;
  controls.querySelector('#uramakuSoundToggle').onclick=()=>{muted=!muted;persist();renderToggle();controls.querySelector('#uramakuSoundToggle').focus();if(!muted)play('confirm');};
  controls.querySelector('#uramakuSoundSettings').onclick=()=>{settingsOpen=!settingsOpen;renderToggle();controls.querySelector(settingsOpen?'#sound-master':'#uramakuSoundSettings').focus();};
  controls.querySelector('#closeSoundSettings').onclick=closeSettings;
  controls.querySelectorAll('[data-sound-volume]').forEach(input=>{
   input.oninput=()=>{settings[input.dataset.soundVolume]=Number(input.value)/100;controls.querySelector(`#sound-${input.dataset.soundVolume}-value`).textContent=input.value+'%';persist();};
   input.onchange=()=>play('confirm');
  });
  controls.querySelector('#soundDeadline').onchange=e=>{settings.deadline=e.target.checked;persist();};
  controls.querySelector('#testGameSound').onclick=()=>play('turn');
 }
 function closeSettings(){settingsOpen=false;renderToggle();document.getElementById('uramakuSoundSettings')?.focus();}
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&settingsOpen){e.preventDefault();closeSettings();}});
 function gameEvent(message){
  const msg=String(message||'').toLowerCase();
  if(/uses purge against/.test(msg))return 'attackPurge';
  if(/uses overthrow against/.test(msg))return 'attackOverthrow';
  if(/declares hire blade against/.test(msg))return 'attackHireBlade';
  if(/declares assassinate against/.test(msg))return 'attackAssassinate';
  if(/passes on challenging/.test(msg))return null;
  if(/loses? (an? |both )?influence|has been eliminated/.test(msg))return 'eliminate';
  if(/challeng/.test(msg)&&!/passes on challenging/.test(msg))return 'challenge';
  if(/claims .+? \((authority|gossip|hire guard|false trail|intimidate|enforce)\)|uses? (authority|gossip|hire guard|false trail|intimidate|enforce)|counter/.test(msg))return 'counter';
  if(/draws a card with summon/.test(msg))return 'draw';
  if(/replaces an influence with summon/.test(msg))return 'replace';
  if(/discards the card drawn with summon/.test(msg))return 'discard';
  if(/intrigue|investigat|conceal/.test(msg))return 'intrigue';
  if(/coin|tax|earn|income|extort|loot/.test(msg))return 'coin';
  return 'confirm';
 }
 window.UramakuAudio={play,renderToggle,gameEvent};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderToggle);else renderToggle();
})();
