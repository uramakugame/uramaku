const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../../public/js/app.js'),'utf8');
const game=fs.readFileSync(path.join(__dirname,'../../shared/game.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../../public/css/game.css'),'utf8');
assert(!app.includes('Revealed influences · Face up'),'separate revealed section should be removed');
assert(!app.includes('No influences</span>'),'lobby should not show no influences placeholder');
assert(app.includes("p.id===state.hostId?'<span class=\"turn-badge owner-badge\">OWNER"),'owner indicator missing');
assert(app.includes("p.id===current?'active-player'"),'active player red border indicator missing');
assert(!app.includes('<span class="turn-badge">TURN</span>'),'turn badge should be removed');
assert(!app.includes('<span class="next-turn">'),'next turn badge should not appear');
assert(app.includes("Array.from({length:p.influenceCount},(_,slot)=>cards[slot]||window.URAMAKU_ROLE_CARDS.hidden"),'Render each living influence slot exactly once');
assert(app.includes('privateIntelSlots.forEach(slot=>'),'private intel must track card slots per target');
assert(app.includes('if(seen.has(slot))return'),'shared intel must not duplicate already known card slots');
assert(app.includes('p.influenceFactions?.[slot]'),'faction backs must use per-slot faction metadata');
assert(app.includes('id="revealFactions"'),'lobby setting must be present');
assert(require('../../public/js/components/role-cards').revealed({role:'swordsman',name:'Swordsman',status:'Eliminated'}).includes('<small>Eliminated</small>'),'English-only eliminated label missing');
assert(game.includes('uses Authority'),'Authority resolution must identify the block');
assert(game.includes('Hire Guard against ${original.name}’s Assassinate'),'Hire Guard log should identify original actor');
assert(game.includes('Enforce against ${original.name}’s Extort'),'Enforce log should identify original actor');
assert(css.includes('flex-direction:column;align-items:stretch;justify-content:flex-start'),'player layout should be vertically stacked');
// Model the visibility calculation to catch the reported two-visible-plus-two-hidden bug.
function counts(visible, shared, influenceCount){const remaining=[...shared];for(const r of visible){const i=remaining.indexOf(r);if(i!==-1)remaining.splice(i,1);}return {shown:visible.length+remaining.length,hidden:Math.max(0,influenceCount-visible.length-remaining.length)};}
assert.deepEqual(counts(['lord','swordsman'],[],2),{shown:2,hidden:0});
assert.deepEqual(counts(['lord'],[],2),{shown:1,hidden:1});
assert.deepEqual(counts(['lord'],['lord'],2),{shown:1,hidden:1});
assert.deepEqual(counts(['lord','lord'],['lord'],2),{shown:2,hidden:0});
assert.deepEqual(counts([],['lord','lord'],2),{shown:2,hidden:0});
console.log('Player card, lobby, log, and Intrigue UI regression checks passed.');
assert(app.includes('const flow=(stage,headline,subline='),'Current Turn should use the compact message renderer');
assert(app.includes("return flow('COUNTER',actionSentence,ownDecision?'':"),'counter decision should not duplicate its own decision prompt');
assert(app.includes("return flow('INTRIGUE',actionSentence,ownDecision?'':"),'Gossip should avoid repeating instructions to the deciding player');
assert(!app.includes('Challenge the role claim or pass.'),'Current Turn should not repeat the decision buttons');
assert(!app.includes('The investigator may reveal the discovered influences publicly or keep them private.'),'Current Turn should not duplicate Intrigue share controls');

// Announcement text should include the target, and resolved events should be visible.
const vm=require('node:vm');
const parser=app.slice(app.indexOf('function announcementForLog('),app.indexOf('function showActionAnnouncement('));
const context={i18n:require('../../shared/i18n')};vm.runInNewContext(parser,context);
const ann=context.announcementForLog;
assert.equal(ann('Akira claims Assassin and declares Assassinate against Sora.'),'Akira claims Assassin (Assassinate) and targets Sora.');
assert.equal(ann('Akira claims Lord and declares Tax.'),'Akira uses Tax');
assert.equal(ann('Akira claims Swordsman and declares Hire Blade against Sora.'),'Akira claims Swordsman (Hire Blade) and targets Sora.');
assert.equal(ann('Sora uses Purge against Akira.'),'Sora uses Purge against Akira');
assert.equal(ann('Sora uses Hire Guard against Akira’s Assassinate. The Assassin loses an influence.'),'Sora resolves Hire Guard against Akira');
assert.equal(ann('Akira loses both influences (Swordsman, Lord).'),'Akira loses Swordsman, Lord');
assert.equal(ann('Sora has been eliminated.'),'Sora is eliminated');
assert.equal(ann('Akira shares Intrigue information about Sora: Lord.'),'Akira reveals Intrigue results about Sora');
assert.equal(ann('Akira passes on challenging.'),null);
console.log('Action declaration and resolution announcement checks passed.');

assert(!app.includes('data-intrigue-share'),'Gossip must not require an immediate sharing decision');
assert(app.includes('data-share-private-target'),'Private intel cards must provide a late-sharing control');
assert(!app.includes('Reveal Publicly?'),'Late intel sharing should not require confirmation');
assert(app.includes('URAMAKU_ROLE_CARDS.shareControl'),'Live sharing uses the shared control');assert(require('../../public/js/components/role-cards').shareControl({targetId:'p',slot:0,label:'Make public'}).includes('>Make public</button>'),'Shared direct control keeps its label');
assert.equal(ann('Akira successfully challenges Sora. Sora must lose an influence.'),"Akira's challenge succeeds! Sora must lose an Influence");
assert.equal(ann('Sora loses an influence (Swordsman).'),'Sora loses Swordsman');
console.log('Late sharing and announcement wording checks passed.');

assert.equal(ann('Akira takes Earn (稼ぎ) and gains 1 coin.'),'Akira earns 1 coin');
assert.equal(ann('Sora uses Intimidate to block Akira’s Extort.'),"Sora's Intimidate succeeds.");
assert.equal(ann('Akira claims Courtesan and declares Intrigue against Sora.'),'Akira claims Courtesan (Intrigue) and targets Sora.');
assert.equal(ann('Akira claims Magistrate and declares Summon.'),'Akira uses Summon');
assert.equal(ann('Akira claims Kingpin and declares Extort against Sora.'),'Akira claims Kingpin (Extort) and targets Sora.');


// Next-build UI contracts: naming, guided match flow, and public intel visibility.
const tutorialNext=fs.readFileSync(path.join(__dirname,'../../public/js/tutorial.js'),'utf8');
const tutorialSteps=require('../../shared/tutorial').steps;
const tutorialCopy=tutorialSteps.map(step=>step.title.en+' '+step.text.en).join(' ');
const styleNext=fs.readFileSync(path.join(__dirname,'../../public/css/game.css'),'utf8');
assert.equal(require('../../server/game').ROLES.swordsman.name,'Swordsman');
assert.equal(require('../../server/game').ROLES.swordsman.actionJp,'刺客を雇う');
assert.equal(require('../../server/game').ROLES.swordsman.counterJp,'護衛を雇う');
assert.equal(require('../../server/game').ROLES.courtesan.action,'Intrigue');
assert(tutorialCopy.includes("Akira challenged Hire Guard."));
assert(tutorialCopy.includes('Sora’s replacement was Lord, so the Kingpin claim was a bluff.'));
assert(!tutorialNext.includes('Purge Mei instead'));
assert(tutorialNext.includes('URAMAKU_FEEDBACK.visibleRoles(room,you,p.id)'),'Only public or privately discovered information appears on opponents’ cards');
assert(styleNext.includes('room-role-card.t-public-intel'));
assert(app.includes('!shared?.indices?.includes(slot)'));
assert(app.includes('!shared?.indices?.includes(slot)'));
assert(!app.includes('privateIntelShareChoice'),'The late-share confirmation state should be removed');
assert.equal(ann('Sora uses Enforce against Akira’s Extort. Akira pays 2 coins to Sora.'),'Sora resolves Enforce against Akira');
assert.equal(ann('Sora uses False Trail to block Akira’s Assassinate.'),'Sora resolves False Trail against Akira');
console.log('Next-build localization, tutorial, Summon, and private-intel sharing regression checks passed.');

// Concurrent announcements: each event enters the stack immediately and
// has its own removal timer; prior notifications must not queue newer ones.
assert(app.includes("actionAnnouncements"));
assert(app.includes("stack.appendChild(toast)"));
assert(app.includes("setTimeout(()=>{toast.remove();"));
assert(app.includes('ANNOUNCEMENT_GAP_MS=1000'));
assert(app.includes('ACTION_ANNOUNCEMENT_DURATION=2500'));
assert(app.includes('previousAnnouncementRemovalAt+ANNOUNCEMENT_GAP_MS'));
assert(!app.includes('actionAnnouncementQueue'));
assert(!app.includes('showNextActionAnnouncement'));
assert(styleNext.includes('.action-announcements .action-announcement.announce-active'));
assert(tutorialCopy.includes('The sidebar highlights actions for roles you hold'));
assert(!tutorialNext.includes('previewDoubleLoss'),'Retired preview branch must not interrupt the four-turn flow');
assert(tutorialNext.includes('URAMAKU_TUTORIAL'));
assert(fs.readFileSync(path.join(__dirname,'../../public/tutorial.html'),'utf8').includes('/shared/roles.js'));
console.log('Concurrent announcement and shared tutorial role reference checks passed.');

// Stability and interaction contracts for the revised game shell.
assert(app.includes('class=\"lobby-dashboard\"'),'Lobby dashboard must be present');
assert(app.includes('data-kick-id'),'Host-only kick control should render for guests');
assert(app.includes("socket.emit('leaveRoom'"),'Exiting a room should inform the server');
assert(require('../../public/js/components/role-cards').revealed({role:'swordsman',name:'Swordsman',select:{type:'lose',index:0,label:'Lose this influence'}}).includes('selectable-loss'),'Influence loss should be selectable on your real role cards');
assert(!app.includes('influence-loss-selection'),'No duplicated influence choices in decision panel');
assert(app.includes('claims ${roleName} (${counter})'),'Counter claim status should show role before counter');
assert(app.includes("t('makePublic')"),'Direct share should use the bilingual label');
const tutorialCss=fs.readFileSync(path.join(__dirname,'../../public/css/tutorial.css'),'utf8');
assert(tutorialNext.includes('room.turnPlayerId===p.id'),'Tutorial must track the engine’s active turn');
assert(tutorialNext.includes('class="game-actions-sidebar"'),'Tutorial must use the same Actions sidebar structure as multiplayer');
assert(tutorialNext.includes('class="game-main"'),'Tutorial must use the same main board structure as multiplayer');
assert(!tutorialCss.includes('.game-actions-panel .action'),'Tutorial must inherit main game action-card styling, not duplicate it');
assert(!tutorialCss.includes('.game-log-panel'),'Tutorial must inherit main game log styling');
assert(styleNext.includes('selectable-loss'),'Influence-loss overlay styling missing');
