'use strict';
const assert=require('node:assert/strict'),cards=require('../../public/js/components/role-cards'),{harness}=require('../tutorial/browser-harness');
function setup(lang='en'){
 const h=harness(lang),animations=[],timers=[];h.window.matchMedia=()=>({matches:false});
 Object.getPrototypeOf(h.app).animate=function(frames,options){const entry={element:this,frames,options};animations.push(entry);return{cancel(){entry.cancel?.()},finished:{then(finish,cancel){entry.finish=finish;entry.cancel=cancel;}}};};
 h.context.setTimeout=fn=>{timers.push(fn);return timers.length;};h.context.clearTimeout=()=>{};
 return{...h,animations,timers};
}
async function main(){
for(const lang of ['en','jp']){
 const h=setup(lang),api=h.window.URAMAKU_CARD_MOTION;
 h.app.innerHTML='<div>'+cards.revealed({role:'kingpin',name:'Kingpin',slot:0,select:{type:'replace',index:0,label:'Replace'}})+cards.revealed({role:'lord',name:'Lord',slot:1})+'</div>';
 const target=h.app.querySelector('[data-influence-slot="0"]'),other=h.app.querySelector('[data-influence-slot="1"]');
 assert(api.animate(target,{kind:'replace',fromRole:'magistrate',lang}));
 assert(target.classList.contains('card-flipping'));assert(!other.classList.contains('card-flipping'));assert(target.querySelector('.card-discard .portrait-magistrate'));
 let stage=h.animations.at(-1);assert(stage.element.classList.contains('card-discard'));assert.equal(stage.frames[0].transform,'translateY(0px)');assert.match(stage.frames.at(-1).transform,/translateY\(\d+px\)/);assert.equal(h.animations.length,1,'Replacement starts with discarding, before arrival');
 stage.finish();stage=h.animations.at(-1);assert(stage.element.classList.contains('card-arrival'));assert(stage.element.querySelector('.hidden-role-card .card-back-image').getAttribute('src').endsWith('/standard.png'));assert.match(stage.frames[0].transform,/translateY\(-\d+px\)/);assert.equal(stage.frames.at(-1).transform,'translateY(0px)');assert.equal(stage.options.fill,'both');
 assert(!target.querySelector('.card-flip-turner'),'Card stays face down during arrival');stage.finish();stage=h.animations.at(-1);assert(stage.element.classList.contains('card-flip-turner'),'Flip starts after arrival');assert.equal(stage.frames[0].transform,'rotateY(0deg)');assert.equal(stage.frames.at(-1).transform,'rotateY(180deg)');stage.finish();assert(!target.querySelector('.card-flip-layer'));assert(target.getAttribute('data-summon-replace')==='0','Original card controls remain in place');
 assert(!other.querySelector('.card-flip-layer'));
 // An opponent's arriving card remains the correct faction back.
 h.app.innerHTML=cards.hidden({faction:'underworld',slot:0});const hidden=h.app.querySelector('[data-influence-slot="0"]');const start=h.animations.length;assert(api.animate(hidden,{kind:'replace',oldFaction:'order',faction:'underworld',reveal:false,lang}));assert(hidden.querySelector('.card-discard .card-back-image').getAttribute('src').endsWith('/order.png'));h.animations.at(-1).finish();assert(hidden.querySelector('.card-arrival .card-back-image').getAttribute('src').endsWith('/underworld.png'));h.animations.at(-1).finish();assert.equal(h.animations.length-start,2,'Hidden replacements never flip to a role');assert(!hidden.querySelector('.card-flip-layer'));assert(hidden.querySelector('.card-back-image').getAttribute('src').endsWith('/underworld.png'));
 // Initial deals arrive face down with their stagger, then flip for the owner only.
 h.app.innerHTML=cards.revealed({role:'lord',name:'Lord',slot:0});const dealt=h.app.querySelector('[data-influence-slot="0"]');assert(api.animate(dealt,{kind:'deal',delay:120,lang}));assert.equal(h.animations.at(-1).options.delay,120);assert(h.animations.at(-1).element.classList.contains('card-arrival'));h.animations.at(-1).finish();assert(h.animations.at(-1).element.classList.contains('card-flip-turner'));h.animations.at(-1).finish();
 // Rejected Summon previews move down without moving the held hand.
 h.app.innerHTML='<section id="summonTray">'+cards.revealed({role:'swordsman',name:'Swordsman',classes:['summon-drawn-card']})+'</section>';
 const rect=api.previewRect(h.app);assert(rect.width>0);assert(api.discardPreview({rect,fromRole:'swordsman',lang}));const ghost=h.document.body.querySelector('.card-discard-float');assert(ghost.hasAttribute('inert'));assert.equal(ghost.getAttribute('aria-hidden'),'true');assert.match(h.animations.at(-1).frames.at(-1).transform,/translateY\(\d+px\)/);h.animations.at(-1).finish();assert(!h.document.body.querySelector('.card-discard-float'));
 // Cancellation/fallback removes covers instead of leaving an invisible live card.
 const preview=h.app.querySelector('.summon-drawn-card');api.animate(preview,{kind:'deal',lang});h.animations.at(-1).cancel();assert(!preview.classList.contains('card-flipping'));assert(!preview.querySelector('.card-flip-layer'));
 api.animate(preview,{kind:'replace',fromRole:'lord',lang});api.animate(preview,{kind:'deal',lang});assert.equal(preview.querySelectorAll('.card-motion-layer').length,1);for(let i=0;i<h.timers.length&&i<50;i++)h.timers[i]();assert(!preview.querySelector('.card-flip-layer'));
 Object.defineProperty(preview,'isConnected',{value:false});api.animate(preview,{kind:'replace',fromRole:'lord',lang});const count=h.animations.length;h.animations.at(-1).finish();assert.equal(h.animations.length,count,'Detached cards stop the sequence');assert(!preview.querySelector('.card-flip-layer'));
 h.window.matchMedia=()=>({matches:true});assert.equal(api.animate(preview,{}),false);assert.equal(api.discardPreview({rect,fromRole:'lord'}),false);
}
// Normal state renders transfer the running layer rather than restarting it.
{
 const h=setup(),api=h.window.URAMAKU_CARD_MOTION;
 const markup=status=>'<div class="player" data-player-id="a"><div class="player-roles">'+cards.revealed({role:'kingpin',name:'Kingpin',status,slot:0})+cards.revealed({role:'lord',name:'Lord',slot:1})+'</div></div>';
 h.app.innerHTML=markup('Initial');let card=h.app.querySelector('[data-influence-slot="0"]');api.animate(card,{kind:'replace',fromRole:'lord'});
 function render(status){const saved=api.capture(h.app),count=h.animations.length;assert.equal(saved.length,1);h.app.innerHTML=markup(status);api.restore(h.app,saved);card=h.app.querySelector('[data-influence-slot="0"]');assert.equal(h.animations.length,count,'Rerender does not replay motion');assert(card.classList.contains('card-flipping'));assert(!h.app.querySelector('[data-influence-slot="1"]').classList.contains('card-flipping'));}
 render('After state update');h.animations.at(-1).finish();assert(h.animations.at(-1).element.classList.contains('card-arrival'));
 render('After another update');h.animations.at(-1).finish();assert(h.animations.at(-1).element.classList.contains('card-flip-turner'));
 render('Latest');assert(card.querySelector('.card-flip-front').textContent.includes('Latest'),'Latest controls and captions survive a flip transfer');h.animations.at(-1).finish();assert(!card.querySelector('.card-flip-layer'));assert(!card.classList.contains('card-flipping'));
 api.animate(card,{kind:'deal'});const saved=api.capture(h.app);h.app.innerHTML='<div class="player" data-player-id="a">'+cards.revealed({role:'lord',name:'Lord',slot:0})+'</div>';api.restore(h.app,saved);assert(!h.app.querySelector('.card-flip-layer'),'Changed card identities cancel stale effects');
}
// The actual tutorial deals once on entry/restart, never on a language render.
for(const lang of ['en','jp']){
 const animations=[];
 const h=harness(lang,({window,Element})=>{
  window.matchMedia=()=>({matches:false});
  Element.prototype.animate=function(frames,options){const a={element:this,frames,options};animations.push(a);return{cancel(){},finished:{then(finish){a.finish=finish;}}};};
 });
 assert.equal(animations.length,0,'The opening deal waits for Start tutorial');h.click('#startTutorial');
 for(const a of animations.filter(a=>a.element.classList.contains('card-pile-motion')))a.finish();
 const arrivals=animations.filter(a=>a.element.classList.contains('card-arrival'));
 assert.equal(arrivals.length,8,'The four-player opening deals two cards per player');
 assert(arrivals.every(a=>a.element.querySelector('.card-back-image').getAttribute('src').endsWith('/standard.png')));
 for(const a of arrivals)a.finish();
 const turns=animations.filter(a=>a.element.classList.contains('card-flip-turner'));
 assert.equal(turns.length,2,'Only the learner’s own opening cards turn');
 for(const a of turns)a.finish();for(const a of animations.filter(a=>a.element.classList.contains('match-start-popup')))a.finish();for(let i=0;i<5;i++)await Promise.resolve();
 const completed=animations.length;h.setLanguage(h.document.documentElement.lang==='ja'?'en':'jp');assert.equal(animations.length,completed,'Language switches do not redeal');
 h.click('#continueLesson');assert.equal(animations.filter(a=>a.element.classList.contains('card-arrival')).length,8,'Beginning the first turn does not repeat the introduction deal');for(let i=0;i<5;i++)await Promise.resolve();
 h.click('#restart');for(const a of animations.slice(completed).filter(a=>a.element.classList.contains('card-pile-motion')))a.finish();assert.equal(animations.slice(completed).filter(a=>a.element.classList.contains('card-arrival')).length,8,'Restart uses the shared opening deal');
}
console.log('Sequential card motion: discard down → face-down arrival → owner flip, correct faction backs, opening stagger, preview rejection, untouched second card, EN/JP, cancellation, render transfer and reduced motion passed.');

}
main().catch(error=>{console.error(error);process.exitCode=1;});
