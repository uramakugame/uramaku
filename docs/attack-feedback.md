# Elimination action feedback

| Action | Sound and motion |
| --- | --- |
| Purge | Low descending percussion-like tones; deliberate forward motion and solid crimson trail |
| Overthrow | Rising rhythmic tones; stronger forward motion and dashed amber trail |
| Hire Blade | Quick bright descending tones; fastest forward motion and thin orange trail |
| Hire Guard | Hire Blade cue and full-distance counter flight from defender to original attacker |
| False Trail | Counter cue and a small defensive nudge toward the original attacker; no flight |
| Assassinate | Quiet descending tones; subtle fade and approach with a dotted purple trail |

The initiating player card gives a brief directional cue and returns to rest. A visual copy then travels the full center-to-center distance to the targeted player card and fades there; a temporary arrow shows direction. The copy uses the same shared player-card styling, size and visible contents as the source. It carries no player ID or duplicate element IDs, is hidden from assistive technology, and accepts no pointer or keyboard input. The real board controls keep their positions. These effects begin on a confirmed attack declaration and never imply that an influence has already been lost. Failed claims and successful counters follow the existing rules and do not replay the attack motion.

Both multiplayer and scripted tutorial events use `public/js/components/game-feedback.js` and `public/js/audio.js`. Approved character artwork is preserved. Effects never block input or delay the game engine. Reduced-motion preferences suppress animation; sound follows the master/gameplay volume settings. Repeated snapshots and initial/reconnected room histories do not replay an attack.

The flight is appended outside the board so panel overflow cannot clip its path. It uses measured viewport rectangles, including different card dimensions and targets above, below or across the board. Completion, cancellation and a fallback timer remove the temporary copy and arrow. Reduced-motion settings suppress both.


Loss reveals wait for a pending target attack to finish, with 80 ms separation. This includes immediate/final-influence Purge and Overthrow outcomes and a quick card-selection response arriving in a later snapshot. The face-down reveal layer and loss badge retain the remaining delay. Pending replacement motions, attack flights and loss flips settle before victory audio/dialogs appear, so an ending overlay cannot obscure the final attack. No additional server delay is introduced.
