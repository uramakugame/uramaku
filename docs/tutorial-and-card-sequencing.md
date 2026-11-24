# Tutorial comeback and card sequencing

> Historical release: Summon modal timing and standard Gossip sequencing described here are superseded by [challenge timing and board Summon](challenge-timing-and-board-summon.md).

Implemented November 23, 2026, on top of hosting Stage D. This update implements the approved tutorial draft and three gameplay/presentation corrections. It does not deploy the game or change the hosting architecture.

## Approved tutorial

The new 49-step, seven-round Standard tutorial uses the multiplayer engine and shared actions, cards, tooltips, decisions, Summon modal and public-information control. Everyone starts with 1 coin; fixed order is You → Mei → Akira → Sora. The corrected Sora hand is Courtesan + Kingpin; a proved Intimidate later replaces Kingpin with Lord. The story covers genuine and bluff claims, proof replacement, Gossip, concealment payments, public information sharing, Summon, False Trail, the two-influence Hire Guard penalty, failed learner challenge, Purge and the Assassin comeback. Full route and deterministic coin/card checks are in [tutorial.md](tutorial.md).

## Reveal before discard

An unknown eliminated influence first turns face-up, remains readable for 180 ms after the 650 ms flip, then completes a 280 ms downward discard/settle motion. It remains face-up on the player board and permanently out of circulation. Already known influences need no redundant reveal. Only affected cards animate; a surviving influence stays still.

The same ordering applies when an opponent proves a previously unknown role: reveal the publicly proved old card, hold it, discard it, then bring the replacement down face-down. Only its owner can see the replacement flip. Own or previously discovered outgoing cards are already known, so they retain the normal discard → arrival sequence. Discard sound starts with discard movement, not at the beginning of the reveal.

Existing attack-impact delays still precede elimination reveals. Reduced motion skips decorative effects. Animation cancellation, fallback and normal state/language renders preserve or safely cancel jobs without repeating them. All effects use shared card markup and approved artwork.

## Extort after a final influence challenge

When the target challenges a genuine Kingpin and loses their final influence, the target still pays up to 2 coins for the accepted Extort. The engine resolves the failed-challenge influence loss, settles the coin transfer, then returns any remaining eliminated-player coins to the Treasury if that mode applies, and resolves victory/turn continuation. The transfer cannot disappear merely because the target is eliminated. A surviving target retains the normal counter opportunity.

The transfer and penalty are in the same durable command transaction. A duplicate/retried challenge cannot transfer twice; a server restart retains the committed result. Two-player final victories and Treasury wealth-victory/conservation cases are covered. A false Kingpin claim takes nothing. Extort remains Take 2 coins and Enforce remains Pay 2 coins or lose an influence. Normal Gossip challenge/proof/exchange ordering is unchanged.

## Summon preview timing

The Summon preview dialog stays closed while existing proof replacements, challenger-loss reveals or attack/card presentation jobs are running. Once the board settles, the modal opens and its own private draw/flip begins while visible. Hidden dialogs do not consume or replay their preview animation behind the screen. A state/language render transfers ongoing effects and keeps an already-open preview open. Obsolete or canceled dialogs cannot open after a different decision or room is shown.

This changes presentation only: the server draws once, saves the exact drawn card and continues existing deadlines normally. No timer pause, extra draw or new confirmation step is introduced. Both the tutorial and live room call the shared presentation coordinator.

## Validation and updating

Run `npm ci`, `npm test` and `npm run test:economy-stress` with Node 26. The suite covers the full bilingual tutorial, exact checkpoint replay, animation completion/cancellation, hidden information, challenged Summon sequencing, real Socket.IO Extort transitions and crash/retry recovery. **Recorded results:** 66/66 automated test files passed; the compiled stylesheet is current. The randomized run completed 280/280 matches with card/economy invariants checked. Approved asset bytes are unchanged.

Keep the existing `data/` directory (or custom `SQLITE_PATH`) when replacing code. Restart the server and refresh open browser tabs. No dependency or SQLite schema change is required. Already committed old match outcomes are not retroactively rewritten.

For visual testing, watch an opponent's unknown loss and proved-role discard, then challenge a genuine Summon and select the losing influence quickly. Confirm the board replacement is visible before the preview modal opens. Repeat with a language change during the sequence and with reduced motion enabled. In Classic and Treasury, challenge Extort on a last influence while holding 1, 2 and more than 2 coins, including the last opponent in a two-player game.


## Follow-up: closing Assassinate animations

The final two learner Assassinates can declare, pass the challenge/counter windows and resolve during one tutorial update. Feedback previously recognized Assassinate from a visible pending claim, so these compressed transitions skipped the flight. Shared feedback now also recognizes newly appended public Assassinate/Hire Blade declarations and deduplicates them with the pending-claim path. Both closing attacks fly from the learner's tile to Sora's tile, play one Assassinate cue, and retain attack-before-loss and victory-audio sequencing. Repeated state/language renders and reconnect snapshots do not replay old declarations. Card ordering, card assets, game rules and the approved tutorial sequence are unchanged.

Regression coverage drives both actual action/target clicks in English and Japanese and checks the full target distance, sound, rerender behavior and final victory ordering. Shared engine coverage also checks attacks fully resolved between snapshots, including elimination of the last opponent.

Current validation: 67/67 automated test files passed, including the generated CSS check. The focused closing-attack and completed-between-snapshots regressions pass.
