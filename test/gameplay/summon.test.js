'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const game = require('../../server/game');
const i18n = require('../../shared/i18n');
const cards = require('../../public/js/components/role-cards');

function fixture(hand = ['magistrate', 'swordsman'], treasuryMode = false) {
  const player = (id, influences) => ({ id, name: id, coins: 2, influences, alive: true });
  const claimant = player('claimant', hand.slice());
  const opponent = player('opponent', ['lord', 'courtesan']);
  const room = game.createGame('SUMMON', claimant);
  room.players.push(opponent);
  Object.assign(room, { status: 'playing', deck: ['kingpin', 'assassin'], revealFactions: true });
  if (treasuryMode) {
    Object.assign(room, { treasuryMode: true, treasuryCoins: 0, totalCoins: 14, economyWinThreshold: 11 });
    claimant.coins = 5;
    opponent.coins = 9;
  }
  assert(game.addSpectator(room, 'observer', 'Observer').ok);
  return { room, claimant, opponent };
}
function openSummon(room) {
  const deck = room.deck.slice();
  assert(game.performAction(room, 'claimant', 'summon').ok);
  assert.equal(room.pending.kind, 'claim');
  assert.equal(room.pending.role, 'magistrate');
  assert.deepEqual(room.deck, deck, 'The draw waits for the challenge to resolve');
  assert.equal(game.chooseSummon(room, 'claimant', 'keep').ok, false);
  assert(game.passChallenge(room, 'opponent').ok);
}

for (const treasuryMode of [false, true]) {
  const { room, claimant, opponent } = fixture(undefined, treasuryMode);
  claimant.intrigueVisibility = [3, 3];
  opponent.privateInvestigations = { claimant: { 0: 'magistrate', 1: 'swordsman' } };
  opponent.lastInvestigation = { playerId: 'claimant', playerName: 'claimant', indices: [0, 1], roles: ['magistrate', 'swordsman'] };
  room.sharedInvestigations = [{ playerId: 'claimant', indices: [0, 1], roles: ['magistrate', 'swordsman'] }];
  openSummon(room);
  assert.equal(room.pending.stage, 'preview');
  assert.deepEqual(room.deck, ['kingpin'], 'Exactly one card is drawn automatically');
  assert.equal(game.chooseSummon(room, 'claimant', 'draw').ok, false);
  assert.equal(game.chooseSummon(room, 'claimant', 'decline').ok, false);
  assert.equal(game.chooseSummon(room, 'claimant', 'replace', -1).ok, false);
  assert.equal(game.privateState(room, 'claimant').summonDrawnRole, 'assassin');
  assert.equal(game.privateState(room, 'opponent').summonDrawnRole, null);
  assert.equal(game.privateState(room, 'observer'), null);
  assert.equal(Object.hasOwn(game.publicState(room).pending, 'drawnRole'), false);
  assert.equal(game.publicState(room).players[0].influenceCount, 2);
  assert(!room.log.some(line => line.includes('Assassin')));
  assert(game.chooseSummon(room, 'claimant', 'keep').ok);
  assert.equal(room.pending.stage, 'replace');
  assert.deepEqual(claimant.influences, ['magistrate', 'swordsman']);
  assert.equal(game.chooseSummon(room, 'opponent', 'replace', 0).ok, false);
  assert.equal(game.chooseSummon(room, 'claimant', 'replace', '0').ok, false);
  assert.equal(game.chooseSummon(room, 'claimant', 'replace', 2).ok, false);
  assert(game.chooseSummon(room, 'claimant', 'replace', 0).ok);
  assert.deepEqual(claimant.influences, ['assassin', 'swordsman']);
  assert.deepEqual(room.discard, ['magistrate']);
  assert.deepEqual(room.revealedCards, []);
  assert.deepEqual(claimant.intrigueVisibility, [0, 3]);
  assert.deepEqual(opponent.privateInvestigations.claimant, { 1: 'swordsman' });
  assert.deepEqual(opponent.lastInvestigation.roles, ['swordsman']);
  assert.deepEqual(room.sharedInvestigations[0].indices, [1]);
  assert.equal(game.privateState(room, 'claimant').summonDrawnRole, null);
  assert.equal(game.chooseSummon(room, 'claimant', 'replace', -1).ok, false);
  assert.equal(game.publicState(room).turnPlayerId, 'opponent');
  assert.equal(opponent.coins, treasuryMode ? 9 : 3);
  assert(game.treasuryInvariant(room));
}
for (const treasuryMode of [false, true]) {
  const { room, claimant } = fixture(['magistrate'], treasuryMode);
  openSummon(room);
  assert(game.chooseSummon(room, 'claimant', 'discard').ok);
  assert.deepEqual(claimant.influences, ['magistrate']);
  assert.deepEqual(room.discard, ['assassin']);
  assert.deepEqual(room.deck, ['kingpin']);
  assert.equal(game.publicState(room).turnPlayerId, 'opponent');
}
{
  const { room, claimant } = fixture(['magistrate']);
  room.deck = [];
  room.discard = ['courtesan'];
  openSummon(room);
  assert.equal(game.privateState(room, 'claimant').summonDrawnRole, 'courtesan');
  assert(game.chooseSummon(room, 'claimant', 'keep').ok);
  assert.equal(room.pending.stage, 'replace', 'A one-card hand still selects its replacement');
  assert(game.chooseSummon(room, 'claimant', 'replace', 0).ok);
  assert.deepEqual(claimant.influences, ['courtesan']);
  assert.deepEqual(room.discard, ['magistrate']);
}
{
  const { room } = fixture();
  room.deck = [];
  openSummon(room);
  assert.equal(room.pending, null, 'An exhausted deck resolves without a modal');
  assert.equal(game.publicState(room).turnPlayerId, 'opponent');
}
{
  const { room } = fixture(['lord', 'swordsman']);
  assert(game.performAction(room, 'claimant', 'summon').ok);
  assert(game.challenge(room, 'opponent').ok);
  assert(game.loseInfluence(room, 'claimant', 0).ok);
  assert.equal(room.pending, null);
  assert.equal(room.deck.length, 2, 'A successfully challenged Summon never draws');
}
{
  const { room } = fixture();
  assert(game.performAction(room, 'claimant', 'summon').ok);
  assert(game.challenge(room, 'opponent').ok);
  assert(game.loseInfluence(room, 'opponent', 0).ok);
  assert.equal(room.pending.stage, 'preview');
  assert.deepEqual(room.deck, [], 'The proof replacement and Summon each draw one card');
  assert.equal(game.privateState(room, 'claimant').summonDrawnRole, 'kingpin');
}
for (const quitter of ['claimant', 'opponent']) {
  const { room } = fixture();
  openSummon(room);
  assert(game.forfeitPlayer(room, quitter).ok);
  assert.equal(room.status, 'finished');
  assert.deepEqual(room.discard, ['assassin']);
  assert(!room.revealedCards.some(card => card.role === 'assassin'));
}
{
  const { room } = fixture(undefined, true);
  assert(game.performAction(room, 'claimant', 'summon').ok);
  assert(game.expireChallenge(room, room.pending.challengeDeadline));
  assert.equal(room.pending.stage, 'preview', 'Timeout draws immediately during Riot');
  for (const stage of ['preview', 'replace']) {
    if (stage === 'replace') assert(game.chooseSummon(room, 'claimant', 'keep').ok);
    for (const [id, target] of [['claimant', 'opponent'], ['opponent', 'claimant']]) {
      const snapshot = JSON.stringify(room);
      const result = game.performAction(room, id, 'loot', target);
      assert.equal(result.ok, false);
      assert.match(result.error, /Summon is resolving/);
      assert.equal(JSON.stringify(room), snapshot, 'Rejected Loot cannot move coins or interrupt the private draw');
    }
  }
  assert(game.chooseSummon(room, 'claimant', 'replace', 0).ok);
  assert(game.performAction(room, 'claimant', 'loot', 'opponent').ok, 'Loot resumes after Summon resolves');
  assert(game.treasuryInvariant(room));
}

// Exercise the real modal and action-eligibility functions against server snapshots.
{
  const source = fs.readFileSync(path.resolve(__dirname, '../../public/js/app.js'), 'utf8');
  const { room } = fixture(undefined, true);
  openSummon(room);
  const context = vm.createContext({
    state: game.publicState(room), me: game.privateState(room, 'claimant'),
    referenceLanguage: 'en', targetSelectionAction: null,
    window: { URAMAKU_PANELS:require('../../public/js/components/game-panels'),URAMAKU_ROLE_CARDS: cards }, esc: String
  });
  context.t = (key, params) => i18n.get(key, context.referenceLanguage, params);
  context.roleName = id => i18n.role(id, context.referenceLanguage);
  context.roleAction = id => i18n.action(id, context.referenceLanguage);
  vm.runInContext(source.slice(source.indexOf('function renderPending('), source.indexOf('function actionLabel(')), context);
  const modal = () => require('../../public/js/components/game-panels').summon({room:context.state,you:context.me,lang:context.referenceLanguage});
  const deck = room.deck.slice();
  assert.match(modal(), /You drew Assassin/);
  assert.match(modal(), /data-summon-controls/);assert.doesNotMatch(modal(), /<dialog|data-summon-choice="keep"/);
  assert.match(modal(), /data-summon-choice="discard"/);
  assert.doesNotMatch(modal(), /data-action="loot"|data-summon-choice="draw"|Draw one card/);
  assert.equal(vm.runInContext("canChooseAction('loot')", context), false);
  modal();
  assert.deepEqual(room.deck, deck, 'Repeated renders cannot draw another card');
  context.me = game.privateState(room, 'opponent');
  assert.equal(modal(), '');
  assert.equal(vm.runInContext("canChooseAction('loot')", context), false);
  context.me = game.privateState(room, 'claimant');
  context.referenceLanguage = 'jp';
  assert.match(modal(), /くノ一を引きました/);
  assert(game.chooseSummon(room, 'claimant', 'keep').ok);
  context.state = game.publicState(room);
  assert.match(modal(), /data-summon-controls/);
  const pending = vm.runInContext('renderPending(true)', context);
  assert.match(pending, /data-summon-controls/, 'The discard choice belongs in Current Turn');
  assert.doesNotMatch(pending, /\/assets\/portraits\//);
  assert.equal(vm.runInContext("canChooseAction('loot')", context), false);
  const selection = cards.revealed({ role: 'swordsman', name: '用心棒', select: { type: 'replace', index: 1, label: context.t('replaceInfluence') } });
  assert.match(selection, /data-summon-replace="1"/);
}
{const {room}=fixture();openSummon(room);assert(game.chooseSummon(room,'claimant','keep').ok);assert(game.chooseSummon(room,'claimant','discard').ok,'A restored legacy keep-stage can still discard through the new tray');assert.equal(room.pending,null);assert.deepEqual(room.discard,['assassin']);}
console.log('Automatic Summon draw, privacy, keep/discard, player-card replacement, Riot Loot guards and EN/JP board tray passed.');
