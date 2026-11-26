/* Stable preset IDs; labels live in the shared English/Japanese glossary. */
(function(root){
 'use strict';
 const ids=Object.freeze(['suspicious','believe','bold','wellPlayed','ouch','thinking']);
 const keys=Object.freeze({suspicious:'reactionSuspicious',believe:'reactionBelieve',bold:'reactionBold',wellPlayed:'reactionWellPlayed',ouch:'reactionOuch',thinking:'reactionThinking'});
 const api=Object.freeze({ids,keys,duration:3800,cooldown:4000,valid:id=>ids.includes(id)});
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.URAMAKU_REACTIONS=api;
})(typeof window!=='undefined'?window:null);
