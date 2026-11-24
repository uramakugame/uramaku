'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const panels=require('../../public/js/components/game-panels'),i18n=require('../../shared/i18n'),{harness}=require('../tutorial/browser-harness');
for(const lang of ['en','jp']){
 for(const faction of ['order','underworld']){
  const room={revealFactions:true,drawPile:{count:7,topFaction:faction,reshufflePending:false}},html=panels.deck({room,lang});
  assert(html.includes('/card-backs/'+faction+'.png'));assert(html.includes('class="deck-count">7<'));assert(html.includes(i18n.get('deckNextFaction',lang,{faction:i18n.get(faction,lang)})));assert(html.includes('aria-live="polite"'));assert(html.includes('deck-stack is-stacked'));
  const hidden=panels.deck({room:{...room,revealFactions:false},lang});assert(hidden.includes('/card-backs/standard.png'));assert(!hidden.includes('deck-next-faction'),'Standard mode never shows a faction even if supplied stale metadata');
 }
 const one=panels.deck({room:{drawPile:{count:1}},lang});assert(!one.includes('is-stacked'));
 const empty=panels.deck({room:{revealFactions:true,drawPile:{count:0,topFaction:'order',reshufflePending:true}},lang});assert(empty.includes('deck-empty-slot'));assert(!empty.includes('card-back-image'),'An empty deck must not pretend to know a future shuffled back');assert(empty.includes(i18n.get('deckReshuffle',lang)));
 assert(panels.deck({room:{drawPile:{count:0}},lang}).includes(i18n.get('deckEmpty',lang)));
 const h=harness(lang);assert.equal(h.app.querySelector('.game-deck-panel .deck-count').textContent,'10');assert(h.app.querySelector('.game-sidebar .game-deck-panel'));assert(h.app.querySelector('.game-sidebar .game-log-panel'));
 h.value("tutorial.room.revealFactions=true;tutorial.room.deck=['courtesan','lord'];render()");assert(h.app.querySelector('.game-deck-panel .card-back-image').getAttribute('src').endsWith('/order.png'));h.value('tutorial.room.deck.pop();render()');assert.equal(h.app.querySelector('.deck-count').textContent,'1');assert(h.app.querySelector('.game-deck-panel .card-back-image').getAttribute('src').endsWith('/underworld.png'));h.click('#languageToggle');assert.equal(h.app.querySelectorAll('.game-deck-panel').length,1,'Language renders do not duplicate the panel');
}
const app=fs.readFileSync(require.resolve('../../public/js/app.js'),'utf8'),tutorial=fs.readFileSync(require.resolve('../../public/js/tutorial.js'),'utf8');assert(app.includes('URAMAKU_PANELS.deck({room:state,you:me,lang:referenceLanguage})'));assert(tutorial.includes('panels.deck({room,you,lang:tutorialLanguage})'));
console.log('Shared bilingual deck panel: actual top back, hidden factions, empty/one-card states, live tutorial updates, language changes and game/tutorial parity passed.');
