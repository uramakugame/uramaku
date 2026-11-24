/* Shared role IDs and ability metadata. English and Japanese copy live in shared/i18n.js. */
(function (root) {
  'use strict';
  const localization = typeof module !== 'undefined' && module.exports
    ? require('./i18n')
    : root?.URAMAKU_I18N;
  if (!localization) throw new Error('Missing bilingual game dictionary (i18n.js)');

  // Canonical English IDs are shared by the engine, browser, tutorial and portraits.
  const metadata = {
    lord: { faction: 'order', action: 'tax', counter: 'authority' },
    courtesan: { faction: 'underworld', action: 'intrigue', counter: 'gossip' },
    assassin: { faction: 'underworld', action: 'assassinate', counter: 'falseTrail' },
    swordsman: { faction: 'order', action: 'hireBlade', counter: 'hireGuard' },
    kingpin: { faction: 'underworld', action: 'extort', counter: 'intimidate' },
    magistrate: { faction: 'order', action: 'summon', counter: 'enforce' }
  };

  const terms = localization.STRINGS;
  const roles = Object.fromEntries(Object.entries(metadata).map(([id, info]) => {
    const role = terms.roles[id];
    const action = terms.actions[info.action];
    const counter = terms.actions[info.counter];
    const effect = terms.roleEffects[id + 'ActionEffect'];
    const counterEffect = terms.roleEffects[id + 'CounterEffect'];
    if (!role || !action || !counter || !effect || !counterEffect) {
      throw new Error('Missing role glossary entry: ' + id);
    }
    return [id, {
      id,
      actionId: info.action,
      counterId: info.counter,
      factionId: info.faction,
      name: role.en,
      jp: role.jp,
      faction: info.faction === 'order' ? '秩序 / Order' : '裏社会 / Underworld',
      action: action.en,
      actionJp: action.jp,
      effect: localization.roleEffect(id, 'action', 'en'),
      effectJp: localization.roleEffect(id, 'action', 'jp'),
      counter: counter.en,
      counterJp: counter.jp,
      counterEffect: localization.roleEffect(id, 'counter', 'en'),
      counterEffectJp: localization.roleEffect(id, 'counter', 'jp')
    }];
  }));

  if (typeof module !== 'undefined' && module.exports) module.exports = roles;
  if (root) root.URAMAKU_ROLES = roles;
})(typeof window !== 'undefined' ? window : null);
