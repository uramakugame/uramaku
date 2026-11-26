# Action results, turn handoff and Income

Both multiplayer and the guided tutorial use the same browser presentation sequence:

1. Finish the confirmed action’s effects and display its resulting balances.
2. Move the current-turn emphasis to the next player with a 520 ms border pulse/fade.
3. Display that player’s Income and immediately enable the next action or decision.
4. Let the Income coin animation finish independently.

For example, Extort takes 2 from the next player: the target first shows **−2** and the claimant **+2**, with a transfer between them. After the handoff the target receives a separate **+1 Income**. The target’s displayed total follows both events rather than jumping to a net −1.

| Effect | Completion awaited before handoff |
| --- | --- |
| Earn, Tax, action/counter payments | Gain/loss badges (1475 ms) |
| Extort, Loot, Enforce, Intrigue payments | Both deltas and transfer flight (1175 ms) |
| Purge, Overthrow, Hire Blade, Assassinate, Hire Guard | Attack flight, source/target emphasis and any resulting influence reveal/loss |
| False Trail | Blocking nudge |
| Influence loss | Flip, readable hold and discard/settle |
| Proof replacement or Summon replacement | Old card leaves, replacement arrives face down and flips only for its owner |
| Summon draw/discard | Private deck-top flip or preview discard |
| Initial deal | All arrivals, authorized flips and Match Start fade before first turn emphasis |
| Victory | Final action/card effects complete before victory; Income remains a nonblocking visual |

The existing Current Turn/Room Code height stays at 160 px on desktop. The tutorial keeps its guide panel. The ring is an overlay and does not resize player cards. Approved art and card backs are unchanged.

## Implementation

`game-feedback.timeline` creates display frames from the confirmed public snapshot and the local player’s private snapshot. It separates the final turn-start Income from the action balance and updates Treasury/Riot presentation accordingly. It never examines an opponent’s hidden hand or changes the confirmed game state.

`presentation-flow.enqueue` keeps incoming room snapshots in order. Coin badges, transfers, flips, card motions, attacks, blocks and the border handoff register completion in the existing shared coordinator. A newly exposed private draw also holds completion until its flip finishes. Animation failures have cleanup fallbacks.

Action controls are inert during the prior action and handoff; Income coin badges are cancelable nonblocking decorations, so controls and later snapshots proceed while the +1 is still visible. During blocking stages, the command boundary also rejects premature action clicks. Chat, Leave, language selection and the tutorial’s Back/Restart remain usable. Room navigation clears queued work and floating effects. Re-rendering transfers active card layers without replaying the sequence. Reduced motion applies the confirmed snapshot immediately.

This queue is entirely in the browser. The authoritative server, SQLite commits, normal reconnect/restart handling and challenge deadlines continue normally. No presentation phase is persisted and no server-side animation timer or client-completion protocol is introduced.

## Current rules and compatibility scope

Treasury wealth victory is **10 / 12 / 14 coins for 2 / 3 / 4+ starting players**. Supply choices remain 5/6/7 per starting player, default 6; each initial 1 coin is included. The wealth goal stays fixed after eliminations.

Removed the old `responseVersion` rules fork, startup settings migration, saved-7-coin fallback, alternate response-ID acceptance and obsolete two-step Summon Keep phase. Regular persistence, anonymous reconnection, command receipts and aggregate metrics remain. A rule-changing deployment can require restarting a match; it has no special mid-deployment recovery path.

## Local checks

- Extort the player whose turn is next; verify −2, handoff, +1 as separate beats.
- Repeat Tax, Enforce and Intrigue concealment payments.
- Finish each elimination action and both attack counters; the handoff should wait for attacks and loss reveals.
- Keep a Summon draw, discard a draw, and prove a role claim; inspect the unchanged influence too.
- Change languages during a sequence, use chat, and leave during a transfer. No old turn or floating token should return.
- In the tutorial, Back/Restart cancels the old sequence and restores the checkpoint/deal.
- Enable reduced motion and confirm immediate usable controls without a decorative delay.

Automated coverage exercises the real shared controller and live state-handler path in addition to the engine. The rendered visual pace is intended for local feedback.
