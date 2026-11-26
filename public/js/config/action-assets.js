/* One shared asset catalog for live-game and guided-tutorial action cards. */
const URAMAKU_ACTION_ART = Object.freeze({
  earn:'/assets/icons/earn-coins.svg',
  loot:'/assets/icons/chaos-loot.svg',
  tax:'/assets/portraits/lord.jpg',
  intrigue:'/assets/portraits/courtesan.jpg',
  hireBlade:'/assets/portraits/swordsman.jpg',
  assassinate:'/assets/portraits/assassin.jpg',
  summon:'/assets/portraits/magistrate.jpg',
  extort:'/assets/portraits/kingpin.jpg',
  purge:'/assets/icons/purge-scroll.svg',
  overthrow:'/assets/icons/chaos-overthrow.svg'
});
if(typeof window!=='undefined')window.URAMAKU_ACTION_ART=URAMAKU_ACTION_ART;
if(typeof module!=='undefined' && module.exports)module.exports=URAMAKU_ACTION_ART;
